import { Server as HTTPServer } from "http";
import { Server as SocketIOServer, Socket, DefaultEventsMap } from "socket.io";
import { prisma } from "@/lib/prisma";
import { logApiEvent } from "@/lib/observability";
import { resolvePublicSiteUrl } from "@/lib/site-url";
import { env } from "@/lib/env";

type ConversationMessagePayload = Record<string, unknown>;

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, SocketData>;

// Socket.IO server instance (will be initialized when the app starts)
let io: SocketIOServer | null = null;

// Map to track which users are in which rooms
const userRooms = new Map<string, Set<string>>();

// Map to track online admins
const onlineAdmins = new Map<string, string>(); // adminId -> socketId

export interface ServerToClientEvents {
  // Conversation events
  "conversation:new": (data: { conversationId: string; customerName: string; customerEmail: string; message: string }) => void;
  "conversation:message": (data: { conversationId: string; message: ConversationMessagePayload; senderType: string }) => void;
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

function parseCookieHeader(cookieHeader: string | undefined) {
  const cookies = new Map<string, string>();
  if (!cookieHeader) return cookies;

  for (const part of cookieHeader.split(";")) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex === -1) continue;

    const name = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();
    if (!name) continue;

    try {
      cookies.set(name, decodeURIComponent(value));
    } catch {
      cookies.set(name, value);
    }
  }

  return cookies;
}

export async function resolveSocketUserFromCookieHeader(cookieHeader: string | undefined): Promise<SocketData | null> {
  const sessionToken = parseCookieHeader(cookieHeader).get(env.sessionCookieName);
  if (!sessionToken) return null;

  const session = await prisma.session.findUnique({
    where: { token: sessionToken },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  return {
    userId: session.user.id,
    userEmail: session.user.email,
    userRole: session.user.role,
    userName: `${session.user.firstName} ${session.user.lastName}`.trim() || session.user.email,
  };
}

// Initialize Socket.IO server
export function initSocketIO(httpServer: HTTPServer) {
  const publicSiteUrl = resolvePublicSiteUrl();

  io = new SocketIOServer<ServerToClientEvents, ClientToServerEvents>(httpServer, {
    cors: {
      origin: publicSiteUrl,
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Middleware for authentication
  io.use((socket: AppSocket, next: (err?: Error) => void) => {
    void resolveSocketUserFromCookieHeader(socket.handshake.headers.cookie).then((socketUser) => {
      if (!socketUser) {
        return next(new Error("Authentication required"));
      }

      socket.data = socketUser;
      return next();
    }).catch((error) => {
      logApiEvent({
        level: "WARN",
        route: "lib/websocket",
        event: "SOCKET_AUTH_ERROR",
        status: 401,
        details: { error },
      });
      return next(new Error("Authentication failed"));
    });
  });

  io.on("connection", (socket: AppSocket) => {
    const { userId, userRole, userName } = socket.data;

    logApiEvent({
      level: "INFO",
      route: "lib/websocket",
      event: "SOCKET_CONNECTED",
      status: 200,
      details: { userId, role: userRole },
    });

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

        logApiEvent({
          level: "INFO",
          route: "lib/websocket",
          event: "SOCKET_JOIN_CONVERSATION",
          status: 200,
          details: { userId, conversationId },
        });
        callback?.({ success: true });
      } catch (error) {
        logApiEvent({
          level: "WARN",
          route: "lib/websocket",
          event: "SOCKET_JOIN_CONVERSATION_FAILED",
          status: 500,
          details: { userId, conversationId, error },
        });
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

      logApiEvent({
        level: "INFO",
        route: "lib/websocket",
        event: "SOCKET_LEAVE_CONVERSATION",
        status: 200,
        details: { userId, conversationId },
      });
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
        logApiEvent({
          level: "WARN",
          route: "lib/websocket",
          event: "SOCKET_MESSAGE_READ_FAILED",
          status: 500,
          details: { userId, conversationId, messageId, error },
        });
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
      logApiEvent({
      level: "INFO",
        route: "lib/websocket",
        event: "SOCKET_DISCONNECTED",
        status: 200,
        details: { userId },
      });

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

  logApiEvent({
    level: "INFO",
    route: "lib/websocket",
    event: "SOCKET_SERVER_INITIALIZED",
    status: 200,
    details: { origin: publicSiteUrl },
  });
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
  message: ConversationMessagePayload;
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
