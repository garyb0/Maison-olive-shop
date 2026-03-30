import { Server as HTTPServer } from "http";
import { Server as SocketIOServer, Socket, DefaultEventsMap } from "socket.io";
import { prisma } from "@/lib/prisma";
import { logApiEvent } from "@/lib/observability";

// Socket.IO server instance (will be initialized when the app starts)
let io: SocketIOServer | null = null;

// Map to track which users are in which rooms
const userRooms = new Map<string, Set<string>>();

// Map to track online admins
const onlineAdmins = new Map<string, string>(); // adminId -> socketId

export interface ServerToClientEvents {
  // Conversation events
  "conversation:new": (data: { conversationId: string; customerName: string; customerEmail: string; message: string }) => void;
  "conversation:message": (data: { conversationId: string; message: any; senderType: string }) => void;
  "conversation:status": (data: { conversationId: string; status: string; assignedAdminId?: string }) => void;
  "conversation:closed": (data: { conversationId: string }) => void;
  
  // Typing indicators
  "typing:start": (data: { conversationId: string; userId: string; userName: string }) => void;
  "typing:stop": (data: { conversationId: string; userId: string }) => void;
  
  // Presence
  "presence:admin-online": (data: { adminId: string; adminName: string }) => void;
  "presence:admin-offline": (data: { adminId: string }) => void;
  "presence:update": (data: { onlineAdmins: Array<{ id: string; name: string }> }) => void;
  
  // Read receipts
  "message:read": (data: { conversationId: string; messageId: string; readAt: string }) => void;
}

export interface ClientToServerEvents {
  // Join conversation room
  "join:conversation": (data: { conversationId: string }, callback?: (result: { success: boolean; error?: string }) => void) => void;
  "leave:conversation": (data: { conversationId: string }) => void;
  
  // Typing indicators
  "typing:start": (data: { conversationId: string; userId: string; userName: string }) => void;
  "typing:stop": (data: { conversationId: string; userId: string }) => void;
  
  // Mark as read
  "message:read": (data: { conversationId: string; messageId: string }) => void;
  
  // Admin presence
  "admin:online": (data: { adminId: string; adminName: string }) => void;
  "admin:offline": (data: { adminId: string }) => void;
}

export interface SocketData {
  userId: string;
  userEmail: string;
  userRole: "ADMIN" | "CUSTOMER";
  userName: string;
}

// Initialize Socket.IO server
export function initSocketIO(httpServer: HTTPServer) {
  io = new SocketIOServer<ServerToClientEvents, ClientToServerEvents>(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3101",
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Middleware for authentication
  io.use((socket: Socket<SocketData, ServerToClientEvents, ClientToServerEvents, any>, next: (err?: Error) => void) => {
    const token = socket.handshake.auth.token;
    const userId = socket.handshake.auth.userId;
    const userRole = socket.handshake.auth.userRole;
    const userEmail = socket.handshake.auth.userEmail;
    const userName = socket.handshake.auth.userName;

    if (!token || !userId || !userRole) {
      return next(new Error("Authentication required"));
    }

    socket.data = {
      userId,
      userEmail,
      userRole: userRole as "ADMIN" | "CUSTOMER",
      userName: userName || "Anonymous",
    };

    next();
  });

  io.on("connection", (socket: Socket<SocketData>) => {
    const { userId, userRole, userName, userEmail } = socket.data;

    console.log(`[WebSocket] User connected: ${userId} (${userRole})`);

    // Handle joining a conversation room
    socket.on("join:conversation", async (data: { conversationId: string }, callback?: (result: { success: boolean; error?: string }) => void) => {
      const { conversationId } = data;

      try {
        // Verify the user has access to this conversation
        const conversation = await prisma.supportConversation.findUnique({
          where: { id: conversationId },
          select: { customerUserId: true, assignedAdminId: true },
        });

        if (!conversation) {
          callback?.({ success: false, error: "Conversation not found" });
          return;
        }

        // Check access
        const hasAccess = 
          userRole === "ADMIN" || 
          conversation.customerUserId === userId;

        if (!hasAccess) {
          callback?.({ success: false, error: "Access denied" });
          return;
        }

        // Join the room
        socket.join(conversationId);
        
        // Track user rooms
        if (!userRooms.has(userId)) {
          userRooms.set(userId, new Set());
        }
        userRooms.get(userId)?.add(conversationId);

        console.log(`[WebSocket] User ${userId} joined conversation ${conversationId}`);
        callback?.({ success: true });
      } catch (error) {
        console.error("[WebSocket] Error joining conversation:", error);
        callback?.({ success: false, error: "Internal error" });
      }
    });

    // Handle leaving a conversation room
    socket.on("leave:conversation", (data: { conversationId: string }) => {
      const { conversationId } = data;
      socket.leave(conversationId);
      
      // Update tracking
      const rooms = userRooms.get(userId);
      if (rooms) {
        rooms.delete(conversationId);
        if (rooms.size === 0) {
          userRooms.delete(userId);
        }
      }

      console.log(`[WebSocket] User ${userId} left conversation ${conversationId}`);
    });

    // Handle typing indicators
    socket.on("typing:start", (data: { conversationId: string; userId: string; userName: string }) => {
      const { conversationId, userId: typingUserId, userName: typingUserName } = data;
      
      // Broadcast to others in the room
      socket.to(conversationId).emit("typing:start", {
        conversationId,
        userId: typingUserId,
        userName: typingUserName || userName,
      });
    });

    socket.on("typing:stop", (data: { conversationId: string; userId: string }) => {
      const { conversationId, userId: typingUserId } = data;
      
      socket.to(conversationId).emit("typing:stop", {
        conversationId,
        userId: typingUserId,
      });
    });

    // Handle message read receipts
    socket.on("message:read", async (data: { conversationId: string; messageId: string }) => {
      const { conversationId, messageId } = data;
      
      // Update message read status in database
      try {
        await prisma.supportMessage.update({
          where: { id: messageId },
          data: { readAt: new Date() },
        });

        // Notify others in the conversation
        socket.to(conversationId).emit("message:read", {
          conversationId,
          messageId,
          readAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error("[WebSocket] Error marking message as read:", error);
      }
    });

    // Handle admin online status
    socket.on("admin:online", (data: { adminId: string; adminName: string }) => {
      const { adminId, adminName } = data;
      
      if (userRole === "ADMIN") {
        onlineAdmins.set(adminId, socket.id);
        
        // Broadcast to all clients
        io?.emit("presence:admin-online", {
          adminId,
          adminName: adminName || userName,
        });

        // Send current online admins list to this user
        const onlineList = Array.from(onlineAdmins.entries()).map(([id]) => ({
          id,
          name: "", // We'd need to store names separately
        }));
        
        socket.emit("presence:update", {
          onlineAdmins: onlineList,
        });
      }
    });

    socket.on("admin:offline", (data: { adminId: string }) => {
      const { adminId } = data;
      
      if (userRole === "ADMIN") {
        onlineAdmins.delete(adminId);
        
        io?.emit("presence:admin-offline", {
          adminId,
        });
      }
    });

    // Handle disconnection
    socket.on("disconnect", () => {
      console.log(`[WebSocket] User disconnected: ${userId}`);

      // Clean up rooms
      const rooms = userRooms.get(userId);
      if (rooms) {
        rooms.forEach(conversationId => {
          socket.leave(conversationId);
        });
        userRooms.delete(userId);
      }

      // Handle admin offline
      if (userRole === "ADMIN" && onlineAdmins.has(userId)) {
        onlineAdmins.delete(userId);
        io?.emit("presence:admin-offline", { adminId: userId });
      }
    });
  });

  console.log("[WebSocket] Socket.IO server initialized");
  return io;
}

// Get the Socket.IO instance
export function getSocketIO(): SocketIOServer | null {
  return io;
}

// Broadcast new conversation to all admins
export function broadcastNewConversation(data: {
  conversationId: string;
  customerName: string;
  customerEmail: string;
  message: string;
}) {
  io?.emit("conversation:new", data);
  logApiEvent({
    level: "INFO",
    route: "lib/websocket",
    event: "BROADCAST_NEW_CONVERSATION",
    details: { conversationId: data.conversationId },
  });
}

// Broadcast new message to conversation participants
export function broadcastNewMessage(data: {
  conversationId: string;
  message: any;
  senderType: string;
}) {
  io?.to(data.conversationId).emit("conversation:message", data);
}

// Broadcast conversation status change
export function broadcastConversationStatus(data: {
  conversationId: string;
  status: string;
  assignedAdminId?: string;
}) {
  io?.to(data.conversationId).emit("conversation:status", data);
}

// Broadcast conversation closed
export function broadcastConversationClosed(data: {
  conversationId: string;
}) {
  io?.to(data.conversationId).emit("conversation:closed", data);
}