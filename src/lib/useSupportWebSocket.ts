"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { io, Socket } from "socket.io-client";

interface UseSupportWebSocketOptions {
  userId?: string;
  userEmail?: string;
  userRole?: string;
  userName?: string;
  conversationId?: string;
  onNewMessage?: (data: { conversationId: string; message: unknown; senderType: string }) => void;
  onTypingStart?: (data: { conversationId: string; userId: string; userName: string }) => void;
  onTypingStop?: (data: { conversationId: string; userId: string }) => void;
  onConversationStatus?: (data: { conversationId: string; status: string; assignedAdminId?: string }) => void;
  onConversationClosed?: (data: { conversationId: string }) => void;
  onAdminOnline?: (data: { adminId: string; adminName: string }) => void;
  onAdminOffline?: (data: { adminId: string }) => void;
}

export function useSupportWebSocket(options: UseSupportWebSocketOptions) {
  const {
    userId,
    userEmail,
    userRole,
    userName,
    conversationId,
    onNewMessage,
    onTypingStart,
    onTypingStop,
    onConversationStatus,
    onConversationClosed,
    onAdminOnline,
    onAdminOffline,
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [onlineAdmins, setOnlineAdmins] = useState<Array<{ id: string; name: string }>>([]);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  // Initialize socket connection
  useEffect(() => {
    if (!userId || !userRole) return;

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3101";
    
    const socket = io(siteUrl, {
      auth: {
        token: "websocket-auth", // Token will be validated server-side
        userId,
        userEmail: userEmail || "",
        userRole,
        userName: userName || "Anonymous",
      },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    socket.on("connect", () => {
      console.log("[WebSocket] Connected to server");
      setConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("[WebSocket] Disconnected from server");
      setConnected(false);
    });

    socket.on("connect_error", (error: Error) => {
      console.log("[WebSocket] Connection error:", error.message);
    });

    // Handle new messages
    socket.on("conversation:message", (data: { conversationId: string; message: unknown; senderType: string }) => {
      console.log("[WebSocket] New message:", data);
      onNewMessage?.(data);
    });

    // Handle typing indicators
    socket.on("typing:start", (data: { conversationId: string; userId: string; userName: string }) => {
      setTypingUsers(prev => new Set([...prev, data.userId]));
      onTypingStart?.(data);
    });

    socket.on("typing:stop", (data: { conversationId: string; userId: string }) => {
      setTypingUsers(prev => {
        const next = new Set(prev);
        next.delete(data.userId);
        return next;
      });
      onTypingStop?.(data);
    });

    // Handle conversation status changes
    socket.on("conversation:status", (data: { conversationId: string; status: string; assignedAdminId?: string }) => {
      console.log("[WebSocket] Conversation status changed:", data);
      onConversationStatus?.(data);
    });

    // Handle conversation closed
    socket.on("conversation:closed", (data: { conversationId: string }) => {
      console.log("[WebSocket] Conversation closed:", data);
      onConversationClosed?.(data);
    });

    // Handle admin presence
    socket.on("presence:admin-online", (data: { adminId: string; adminName: string }) => {
      console.log("[WebSocket] Admin online:", data);
      setOnlineAdmins(prev => {
        if (prev.find(a => a.id === data.adminId)) return prev;
        return [...prev, { id: data.adminId, name: data.adminName }];
      });
      onAdminOnline?.(data);
    });

    socket.on("presence:admin-offline", (data: { adminId: string }) => {
      console.log("[WebSocket] Admin offline:", data);
      setOnlineAdmins(prev => prev.filter(a => a.id !== data.adminId));
      onAdminOffline?.(data);
    });

    socket.on("presence:update", (data: { onlineAdmins: Array<{ id: string; name: string }> }) => {
      console.log("[WebSocket] Presence update:", data);
      setOnlineAdmins(data.onlineAdmins);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [userId, userRole, userEmail, userName]);

  // Join/leave conversation room
  useEffect(() => {
    if (!socketRef.current || !conversationId) return;

    socketRef.current.emit("join:conversation", { conversationId }, (result: { success: boolean; error?: string }) => {
      if (result.success) {
        console.log("[WebSocket] Joined conversation:", conversationId);
      } else {
        console.error("[WebSocket] Failed to join conversation:", result.error);
      }
    });

    return () => {
      socketRef.current?.emit("leave:conversation", { conversationId });
    };
  }, [conversationId]);

  // Send typing indicator
  const startTyping = useCallback(() => {
    if (!socketRef.current || !conversationId || !userId) return;
    
    socketRef.current.emit("typing:start", {
      conversationId,
      userId,
      userName: userName || "Anonymous",
    });
  }, [conversationId, userId, userName]);

  const stopTyping = useCallback(() => {
    if (!socketRef.current || !conversationId || !userId) return;
    
    socketRef.current.emit("typing:stop", {
      conversationId,
      userId,
    });
  }, [conversationId, userId]);

  // Mark message as read
  const markMessageAsRead = useCallback((messageId: string) => {
    if (!socketRef.current || !conversationId) return;
    
    socketRef.current.emit("message:read", {
      conversationId,
      messageId,
    });
  }, [conversationId]);

  // Admin presence
  const setAdminOnline = useCallback(() => {
    if (!socketRef.current || !userId) return;
    
    socketRef.current.emit("admin:online", {
      adminId: userId,
      adminName: userName || "Admin",
    });
  }, [userId, userName]);

  const setAdminOffline = useCallback(() => {
    if (!socketRef.current || !userId) return;
    
    socketRef.current.emit("admin:offline", {
      adminId: userId,
    });
  }, [userId]);

  return {
    connected,
    onlineAdmins,
    typingUsers,
    startTyping,
    stopTyping,
    markMessageAsRead,
    setAdminOnline,
    setAdminOffline,
  };
}