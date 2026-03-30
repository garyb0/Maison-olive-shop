import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/types";
import { sendSmsNotification } from "@/lib/email";
import { env } from "@/lib/env";
import { sendNewConversationEmail, sendNewMessageEmail, sendConversationClosedEmail } from "@/lib/support-email";

const ACTIVE_STATUSES = ["WAITING", "OPEN", "ASSIGNED"] as const;

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

    // Send SMS notification to admin if configured
    const customerName = getDisplayName(input.user, input.name) || "Client";
    const smsMessage = `🔔 Nouveau chat Maison Olive!\nDe: ${customerName}\n${input.message.slice(0, 50)}${input.message.length > 50 ? '...' : ''}`;
    
    console.log("[SUPPORT DEBUG] About to send SMS notification for new conversation");
    console.log("[SUPPORT DEBUG] Customer name:", customerName);
    console.log("[SUPPORT DEBUG] SMS message:", smsMessage);
    
    // Don't block the response for SMS notification
    sendSmsNotification(smsMessage).catch((err) => {
      console.log("[SUPPORT DEBUG] SMS notification failed (non-critical):", err);
    });

    // Send email notifications to all admins (non-blocking)
    const adminUsers = await tx.user.findMany({
      where: { role: "ADMIN" },
      select: { email: true, firstName: true, lastName: true },
    });
    
    const adminEmails = adminUsers.map(a => a.email).filter(Boolean) as string[];
    
    if (adminEmails.length > 0) {
      sendNewConversationEmail({
        conversationId: conversation.id,
        customerName: getDisplayName(input.user, input.name),
        customerEmail: input.user?.email ?? input.email ?? "",
        messageContent: input.message,
        adminEmails,
      }).catch(err => {
        console.log("[SUPPORT DEBUG] Email notification failed (non-critical):", err);
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
        adminName: [result.assignedAdmin.firstName, result.assignedAdmin.lastName].filter(Boolean).join(' '),
      }).catch(err => {
        console.log("[SUPPORT DEBUG] Email notification to admin failed (non-critical):", err);
      });
    }

    return result;
  });
}

export async function getAdminSupportConversations() {
  try {
    const conversations = await prisma.supportConversation.findMany({
      orderBy: [{ status: "asc" }, { lastMessageAt: "desc" }],
      include: conversationInclude,
    });
    console.log(`[DEBUG] getAdminSupportConversations: Found ${conversations.length} conversations`);
    return conversations;
  } catch (error) {
    console.error("[DEBUG] getAdminSupportConversations error:", error);
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

export async function getSupportConversationPublic(conversationId: string) {
  return prisma.supportConversation.findUnique({
    where: { id: conversationId },
    include: conversationInclude,
  });
}

export async function createSupportMessageAsGuest(conversationId: string, guestEmail: string, content: string) {
  return prisma.$transaction(async (tx) => {
    const conversation = await tx.supportConversation.findUnique({ where: { id: conversationId } });
    if (!conversation) throw new Error("CONVERSATION_NOT_FOUND");
    if (conversation.status === "CLOSED") throw new Error("CONVERSATION_CLOSED");

    // Verify email matches to prevent unauthorized access
    if (conversation.customerEmail.toLowerCase() !== guestEmail.toLowerCase()) {
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
