import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/types";
import { sendSmsNotification } from "@/lib/email";
import { logApiEvent } from "@/lib/observability";
import { sendNewConversationEmail, sendNewMessageEmail } from "@/lib/support-email";
import { env } from "@/lib/env";
import crypto from "crypto";

const ACTIVE_STATUSES = ["WAITING", "OPEN", "ASSIGNED"] as const;
const SUPPORT_GUEST_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const conversationInclude = {
  customerUser: {
    select: { id: true, firstName: true, lastName: true, email: true, role: true },
  },
  assignedAdmin: {
    select: { id: true, firstName: true, lastName: true, email: true, role: true },
  },
  messages: {
    orderBy: { createdAt: "asc" as const },
    take: 100,
    include: {
      senderUser: {
        select: { id: true, firstName: true, lastName: true, email: true, role: true },
      },
    },
  },
};

function getDisplayName(user: CurrentUser | null, fallbackName?: string) {
  if (user) {
    return [user.firstName, user.lastName].filter(Boolean).join(" " ).trim();
  }
  return (fallbackName ?? "").trim();
}

function normalizeGuestEmail(email: string) {
  return email.trim().toLowerCase();
}

export function createSupportGuestAccessToken(conversationId: string, guestEmail: string): string {
  const normalizedEmail = normalizeGuestEmail(guestEmail);
  const issuedAt = Date.now().toString();
  const payload = `${conversationId}:${normalizedEmail}:${issuedAt}`;
  const signature = crypto.createHmac("sha256", env.sessionSecret).update(payload).digest("hex");
  return Buffer.from(`${conversationId}:${normalizedEmail}:${issuedAt}:${signature}`).toString("base64");
}

export function verifySupportGuestAccessToken(
  token: string,
  conversationId: string,
  guestEmail: string,
): boolean {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const [tokenConversationId, tokenEmail, tokenIssuedAt, tokenSignature] = decoded.split(":");
    if (!tokenConversationId || !tokenEmail || !tokenIssuedAt || !tokenSignature) return false;
    if (tokenConversationId !== conversationId) return false;

    const normalizedGuestEmail = normalizeGuestEmail(guestEmail);
    if (tokenEmail !== normalizedGuestEmail) return false;

    const payload = `${tokenConversationId}:${tokenEmail}:${tokenIssuedAt}`;
    const expectedSignature = crypto.createHmac("sha256", env.sessionSecret).update(payload).digest("hex");
    if (tokenSignature.length !== expectedSignature.length) return false;
    if (!crypto.timingSafeEqual(Buffer.from(tokenSignature), Buffer.from(expectedSignature))) return false;

    const issuedAtMs = Number.parseInt(tokenIssuedAt, 10);
    if (!Number.isFinite(issuedAtMs)) return false;
    if (Date.now() - issuedAtMs > SUPPORT_GUEST_TOKEN_TTL_MS) return false;

    return true;
  } catch {
    return false;
  }
}

export async function isAnyAdminAvailable() {
  const session = await prisma.session.findFirst({
    where: { expiresAt: { gt: new Date() }, user: { role: "ADMIN" } },
    select: { id: true },
  });
  return Boolean(session);
}

export async function getSupportStateForUser(user: CurrentUser | null) {
  const adminAvailable = await isAnyAdminAvailable();
  if (!user || user.role === "ADMIN") {
    return { adminAvailable, activeConversation: null };
  }
  const activeConversation = await prisma.supportConversation.findFirst({
    where: { customerUserId: user.id, status: { in: [...ACTIVE_STATUSES] } },
    orderBy: { updatedAt: "desc" },
    include: conversationInclude,
  });
  return { adminAvailable, activeConversation };
}

export async function createSupportConversation(input: {
  user: CurrentUser | null;
  name?: string;
  email?: string;
  message: string;
}) {
  const adminAvailable = await isAnyAdminAvailable();
  const nextStatus = adminAvailable ? "OPEN" : "WAITING";

  if (input.user && input.user.role === "ADMIN") {
    throw new Error("FORBIDDEN");
  }

  if (input.user) {
    const existing = await prisma.supportConversation.findFirst({
      where: {
        customerUserId: input.user.id,
        status: { in: [...ACTIVE_STATUSES] },
      },
      orderBy: { updatedAt: "desc" },
    });

    if (existing) {
      return createSupportMessageAsCustomer(existing.id, input.user, input.message);
    }
  }

  if (!input.user && (!input.name || !input.email)) {
    throw new Error("MISSING_GUEST_DETAILS");
  }

  return prisma.$transaction(async (tx) => {
    const conversation = await tx.supportConversation.create({
      data: {
        customerUserId: input.user?.id,
        customerEmail: input.user?.email ?? input.email ?? "",
        customerName: getDisplayName(input.user, input.name),
        status: nextStatus,
        lastMessageAt: new Date(),
      },
    });

    await tx.supportMessage.create({
      data: {
        conversationId: conversation.id,
        senderUserId: input.user?.id,
        senderType: "CUSTOMER",
        content: input.message,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: input.user?.id,
        action: "SUPPORT_CONVERSATION_CREATED",
        entity: "SupportConversation",
        entityId: conversation.id,
        metadata: JSON.stringify({ status: nextStatus, guest: !input.user }),
      },
    });

    const customerName = getDisplayName(input.user, input.name) || "Client";
    const smsMessage = `🔔 Nouveau chat Chez Olive!\nDe: ${customerName}\n${input.message.slice(0, 50)}${input.message.length > 50 ? "..." : ""}`;
    sendSmsNotification(smsMessage).catch((err) => {
      logApiEvent({
        level: "WARN",
        route: "lib/support",
        event: "SUPPORT_SMS_NOTIFICATION_FAILED",
        details: { conversationId: conversation.id, error: err },
      });
    });

    const adminUsers = await tx.user.findMany({
      where: { role: "ADMIN" },
      select: { email: true, firstName: true, lastName: true },
    });
    
    const adminEmails = adminUsers.map((a) => a.email).filter(Boolean) as string[];
    
    if (adminEmails.length > 0) {
      sendNewConversationEmail({
        conversationId: conversation.id,
        customerName: getDisplayName(input.user, input.name),
        customerEmail: input.user?.email ?? input.email ?? "",
        messageContent: input.message,
        adminEmails,
      }).catch((err) => {
        logApiEvent({
          level: "WARN",
          route: "lib/support",
          event: "SUPPORT_NEW_CONVERSATION_EMAIL_FAILED",
          details: { conversationId: conversation.id, error: err },
        });
      });
    }

    return tx.supportConversation.findUniqueOrThrow({
      where: { id: conversation.id },
      include: conversationInclude,
    });
  });
}

export async function createSupportMessageAsCustomer(conversationId: string, user: CurrentUser, content: string) {
  return prisma.$transaction(async (tx) => {
    const conversation = await tx.supportConversation.findFirst({
      where: { id: conversationId, customerUserId: user.id },
    });

    if (!conversation) throw new Error("CONVERSATION_NOT_FOUND");
    if (conversation.status === "CLOSED") throw new Error("CONVERSATION_CLOSED");

    await tx.supportMessage.create({
      data: {
        conversationId,
        senderUserId: user.id,
        senderType: "CUSTOMER",
        content,
      },
    });

    await tx.supportConversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        status: conversation.status === "WAITING" ? "OPEN" : conversation.status,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "SUPPORT_MESSAGE_SENT_BY_CUSTOMER",
        entity: "SupportConversation",
        entityId: conversationId,
      },
    });

    const result = await tx.supportConversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: conversationInclude,
    });

    // Send email to assigned admin if exists (non-blocking)
    if (result.assignedAdmin?.email) {
      sendNewMessageEmail({
        conversationId: conversationId,
        customerName: result.customerName,
        customerEmail: result.customerEmail,
        messageContent: content,
        adminEmail: result.assignedAdmin.email,
        adminName: [result.assignedAdmin.firstName, result.assignedAdmin.lastName].filter(Boolean).join(" "),
      }).catch((err) => {
        logApiEvent({
          level: "WARN",
          route: "lib/support",
          event: "SUPPORT_ASSIGNED_ADMIN_EMAIL_FAILED",
          details: { conversationId, adminEmail: result.assignedAdmin?.email, error: err },
        });
      });
    }

    return result;
  });
}

export async function getAdminSupportConversations() {
  try {
    return await prisma.supportConversation.findMany({
      orderBy: [{ status: "asc" }, { lastMessageAt: "desc" }],
      include: conversationInclude,
    });
  } catch (error) {
    logApiEvent({
      level: "ERROR",
      route: "lib/support",
      event: "SUPPORT_ADMIN_CONVERSATIONS_FETCH_FAILED",
      details: { error },
    });
    throw error;
  }
}

export async function assignSupportConversation(conversationId: string, admin: CurrentUser) {
  return prisma.$transaction(async (tx) => {
    const conversation = await tx.supportConversation.findUnique({ where: { id: conversationId } });
    if (!conversation) throw new Error("CONVERSATION_NOT_FOUND");
    if (conversation.status === "CLOSED") throw new Error("CONVERSATION_CLOSED");

    await tx.supportConversation.update({
      where: { id: conversationId },
      data: { assignedAdminId: admin.id, status: "ASSIGNED" },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: admin.id,
        action: "SUPPORT_CONVERSATION_ASSIGNED",
        entity: "SupportConversation",
        entityId: conversationId,
      },
    });

    return tx.supportConversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: conversationInclude,
    });
  });
}

export async function closeSupportConversation(conversationId: string, admin: CurrentUser) {
  return prisma.$transaction(async (tx) => {
    const conversation = await tx.supportConversation.findUnique({ where: { id: conversationId } });
    if (!conversation) throw new Error("CONVERSATION_NOT_FOUND");

    await tx.supportConversation.update({
      where: { id: conversationId },
      data: {
        assignedAdminId: conversation.assignedAdminId ?? admin.id,
        status: "CLOSED",
        closedAt: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: admin.id,
        action: "SUPPORT_CONVERSATION_CLOSED",
        entity: "SupportConversation",
        entityId: conversationId,
      },
    });

    return tx.supportConversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: conversationInclude,
    });
  });
}

export async function getSupportConversationPublic(conversationId: string, guestToken: string) {
  const conversation = await prisma.supportConversation.findUnique({
    where: { id: conversationId },
    include: conversationInclude,
  });

  if (!conversation) return null;

  if (!verifySupportGuestAccessToken(guestToken, conversation.id, conversation.customerEmail)) {
    return null;
  }

  return conversation;
}

export async function createSupportMessageAsGuest(
  conversationId: string,
  guestEmail: string,
  guestToken: string,
  content: string,
) {
  return prisma.$transaction(async (tx) => {
    const conversation = await tx.supportConversation.findUnique({ where: { id: conversationId } });
    if (!conversation) throw new Error("CONVERSATION_NOT_FOUND");
    if (conversation.status === "CLOSED") throw new Error("CONVERSATION_CLOSED");

    const normalizedGuestEmail = normalizeGuestEmail(guestEmail);
    if (conversation.customerEmail.toLowerCase() !== normalizedGuestEmail) {
      throw new Error("FORBIDDEN");
    }

    if (!verifySupportGuestAccessToken(guestToken, conversation.id, conversation.customerEmail)) {
      throw new Error("FORBIDDEN");
    }

    await tx.supportMessage.create({
      data: {
        conversationId,
        senderUserId: null,
        senderType: "CUSTOMER",
        content,
      },
    });

    await tx.supportConversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        status: conversation.status === "WAITING" ? "OPEN" : conversation.status,
      },
    });

    return tx.supportConversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: conversationInclude,
    });
  });
}

export async function createSupportMessageAsAdmin(conversationId: string, admin: CurrentUser, content: string) {
  return prisma.$transaction(async (tx) => {
    const conversation = await tx.supportConversation.findUnique({ where: { id: conversationId } });
    if (!conversation) throw new Error("CONVERSATION_NOT_FOUND");
    if (conversation.status === "CLOSED") throw new Error("CONVERSATION_CLOSED");

    await tx.supportMessage.create({
      data: {
        conversationId,
        senderUserId: admin.id,
        senderType: "ADMIN",
        content,
      },
    });

    await tx.supportConversation.update({
      where: { id: conversationId },
      data: {
        assignedAdminId: conversation.assignedAdminId ?? admin.id,
        status: "ASSIGNED",
        lastMessageAt: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: admin.id,
        action: "SUPPORT_MESSAGE_SENT_BY_ADMIN",
        entity: "SupportConversation",
        entityId: conversationId,
      },
    });

    return tx.supportConversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: conversationInclude,
    });
  });
}

