import { prisma } from "@/lib/prisma";
import type { CurrentUser, SupportConversationCloseReason, SupportConversationPriority } from "@/lib/types";
import { sendSmsNotification } from "@/lib/email";
import { logApiEvent } from "@/lib/observability";
import { sendConversationAssignedEmail, sendNewConversationEmail, sendNewMessageEmail } from "@/lib/support-email";
import {
  shouldSendConversationAssignedEmail,
  shouldSendNewConversationEmail,
  shouldSendNewMessageEmail,
} from "@/lib/support-notification-preferences";
import { env } from "@/lib/env";
import crypto from "crypto";

const ACTIVE_STATUSES = ["WAITING", "OPEN", "ASSIGNED"] as const;
const SUPPORT_GUEST_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SUPPORT_DEFAULT_PRIORITY = "NORMAL";
const SUPPORT_DEFAULT_SOURCE = "WIDGET";
const SUPPORT_MESSAGE_PREVIEW_LENGTH = 120;
const SUPPORT_DEFAULT_SLA_MINUTES: Record<SupportConversationPriority, number> = {
  LOW: 48 * 60,
  NORMAL: 24 * 60,
  HIGH: 4 * 60,
  URGENT: 60,
};

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
  internalNotes: {
    orderBy: { createdAt: "asc" as const },
    take: 100,
    include: {
      adminUser: {
        select: { id: true, firstName: true, lastName: true, email: true, role: true },
      },
    },
  },
  order: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentStatus: true,
      deliveryStatus: true,
      totalCents: true,
      currency: true,
      createdAt: true,
    },
  },
};

type SupportOrderContext = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  deliveryStatus: string;
  totalCents: number;
  currency: string;
  createdAt: Date;
};

type SupportCustomerUserContext = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
};

type SupportAdminUserContext = SupportCustomerUserContext;

type SupportConversationContext = {
  id: string;
  customerUserId: string | null;
  customerEmail: string;
  customerName: string;
  assignedAdminId?: string | null;
  status: string;
  priority?: string | null;
  source?: string | null;
  tagsJson?: string | null;
  aiSummary?: string | null;
  aiIntent?: string | null;
  closedReason?: string | null;
  closedNote?: string | null;
  reopenedAt?: Date | null;
  priorityUpdatedAt?: Date | null;
  slaDueAt?: Date | null;
  lastMessageAt?: Date | null;
  messages: Array<{ senderType: string; content: string; readAt?: Date | null; createdAt?: Date }>;
  internalNotes?: Array<{
    id: string;
    content: string;
    createdAt: Date;
    adminUser?: SupportAdminUserContext | null;
  }>;
  order?: SupportOrderContext | null;
  customerUser?: SupportCustomerUserContext | null;
  assignedAdmin?: SupportAdminUserContext | null;
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

function parseTags(tagsJson: string | null | undefined) {
  if (!tagsJson) return [] as string[];
  try {
    const parsed = JSON.parse(tagsJson) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
      .filter(Boolean)
      .slice(0, 12);
  } catch {
    return [];
  }
}

function normalizeTags(tags: string[] | null | undefined) {
  if (!Array.isArray(tags)) return [] as string[];
  return [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))]
    .slice(0, 12)
    .map((tag) => tag.slice(0, 40));
}

function normalizePriority(priority: string | null | undefined): SupportConversationPriority {
  return priority === "LOW" || priority === "HIGH" || priority === "URGENT" ? priority : "NORMAL";
}

function getSupportSlaDueAt(priority: string | null | undefined, from = new Date()) {
  const normalizedPriority = normalizePriority(priority);
  return new Date(from.getTime() + SUPPORT_DEFAULT_SLA_MINUTES[normalizedPriority] * 60_000);
}

function getLastMessageBySender(messages: Array<{ senderType: string; createdAt?: Date }>, senderType: string) {
  return [...messages].reverse().find((message) => message.senderType === senderType);
}

function getSupportSlaStatus(conversation: SupportConversationContext) {
  if (conversation.status === "CLOSED") return "closed";
  if (!conversation.slaDueAt) return "ok";
  const dueAt = new Date(conversation.slaDueAt).getTime();
  const now = Date.now();
  if (dueAt <= now) return "overdue";
  if (dueAt - now <= 60 * 60 * 1000) return "watch";
  return "ok";
}

function getAgentDisplayName(user: SupportAdminUserContext | null | undefined) {
  if (!user) return "";
  return [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email;
}

function createLastMessagePreview(messages: Array<{ content: string }>) {
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage) return "";
  const normalized = lastMessage.content.replace(/\s+/g, " ").trim();
  return normalized.length > SUPPORT_MESSAGE_PREVIEW_LENGTH
    ? `${normalized.slice(0, SUPPORT_MESSAGE_PREVIEW_LENGTH - 1)}…`
    : normalized;
}

function getUnreadCount(
  messages: Array<{ senderType: string; readAt?: Date | string | null }>,
  perspective: "admin" | "customer",
) {
  return messages.filter((message) => {
    if (message.readAt) return false;
    if (perspective === "admin") return message.senderType === "CUSTOMER";
    return message.senderType === "ADMIN" || message.senderType === "SYSTEM";
  }).length;
}

function summarizeOrder(order: {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  deliveryStatus: string;
  totalCents: number;
  currency: string;
  createdAt: Date;
}) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    deliveryStatus: order.deliveryStatus,
    totalCents: order.totalCents,
    currency: order.currency,
    createdAt: order.createdAt,
  };
}

async function buildSupportCustomerContext(conversation: {
  id: string;
  customerUserId: string | null;
  customerEmail: string;
  customerName: string;
  order?: SupportOrderContext | null;
  customerUser?: SupportCustomerUserContext | null;
}) {
  const orderWhere = conversation.customerUserId
    ? { OR: [{ userId: conversation.customerUserId }, { customerEmail: conversation.customerEmail }] }
    : { customerEmail: conversation.customerEmail };
  const [recentOrders, supportHistoryCount] = await Promise.all([
    prisma.order.findMany({
      where: orderWhere,
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        deliveryStatus: true,
        totalCents: true,
        currency: true,
        createdAt: true,
      },
    }),
    prisma.supportConversation.count({
      where: { customerEmail: conversation.customerEmail },
    }),
  ]);

  return {
    account: conversation.customerUser
      ? {
          id: conversation.customerUser.id,
          email: conversation.customerUser.email,
          name: [conversation.customerUser.firstName, conversation.customerUser.lastName].filter(Boolean).join(" ").trim(),
          role: conversation.customerUser.role,
        }
      : null,
    linkedOrder: conversation.order ? summarizeOrder(conversation.order) : null,
    recentOrders: recentOrders.map(summarizeOrder),
    supportHistoryCount,
  };
}

async function enrichSupportConversation(
  conversation: SupportConversationContext,
  perspective: "admin" | "customer",
  currentAdmin?: CurrentUser | null,
) {
  const latestCustomerMessage = getLastMessageBySender(conversation.messages, "CUSTOMER");
  const latestAdminMessage = getLastMessageBySender(conversation.messages, "ADMIN");
  const lastCustomerAt = latestCustomerMessage?.createdAt ?? null;
  const lastAdminAt = latestAdminMessage?.createdAt ?? null;
  const needsReply =
    conversation.status !== "CLOSED" &&
    Boolean(lastCustomerAt) &&
    (!lastAdminAt || (lastCustomerAt?.getTime() ?? 0) > lastAdminAt.getTime());
  const waitMinutes =
    needsReply && lastCustomerAt
      ? Math.max(0, Math.floor((Date.now() - lastCustomerAt.getTime()) / 60_000))
      : 0;

  const base = {
    ...conversation,
    priority: conversation.priority ?? SUPPORT_DEFAULT_PRIORITY,
    source: conversation.source ?? SUPPORT_DEFAULT_SOURCE,
    tags: parseTags(conversation.tagsJson),
    unreadCount: getUnreadCount(conversation.messages, perspective),
    lastMessagePreview: createLastMessagePreview(conversation.messages),
    aiSummary: conversation.aiSummary ?? null,
    aiIntent: conversation.aiIntent ?? null,
    aiEnabled: env.supportAiEnabled,
    assignedAdminName: getAgentDisplayName(conversation.assignedAdmin),
    assignedToMe: Boolean(currentAdmin?.id && conversation.assignedAdminId === currentAdmin.id),
    needsReply,
    waitMinutes,
    slaStatus: getSupportSlaStatus(conversation),
  };

  if (perspective === "admin") {
    return {
      ...base,
      internalNotes: (conversation.internalNotes ?? []).map((note) => ({
        id: note.id,
        content: note.content,
        createdAt: note.createdAt,
        adminName: getAgentDisplayName(note.adminUser),
      })),
      customerContext: await buildSupportCustomerContext(conversation),
    };
  }

  const customerSafeBase = { ...base } as typeof base & {
    internalNotes?: unknown;
    closedNote?: unknown;
  };
  delete customerSafeBase.internalNotes;
  delete customerSafeBase.closedNote;
  return customerSafeBase;
}

async function findConversationOrThrow(conversationId: string) {
  return prisma.supportConversation.findUniqueOrThrow({
    where: { id: conversationId },
    include: conversationInclude,
  });
}

export async function buildSupportAiContext(conversationId: string) {
  const conversation = await findConversationOrThrow(conversationId);
  const customerContext = await buildSupportCustomerContext(conversation);

  return {
    enabled: env.supportAiEnabled,
    mode: "admin_suggestion_only" as const,
    guardrail: "Suggestions must be reviewed and sent manually by an admin.",
    conversation: {
      id: conversation.id,
      status: conversation.status,
      priority: conversation.priority ?? SUPPORT_DEFAULT_PRIORITY,
      source: conversation.source ?? SUPPORT_DEFAULT_SOURCE,
      tags: parseTags(conversation.tagsJson),
      aiSummary: conversation.aiSummary ?? null,
      aiIntent: conversation.aiIntent ?? null,
      lastMessageAt: conversation.lastMessageAt,
    },
    customer: {
      name: conversation.customerName,
      email: conversation.customerEmail,
      context: customerContext,
    },
    messages: conversation.messages.slice(-30).map((message) => ({
      senderType: message.senderType,
      content: message.content,
      createdAt: message.createdAt,
    })),
  };
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
  return {
    adminAvailable,
    activeConversation: activeConversation ? await enrichSupportConversation(activeConversation, "customer") : null,
  };
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

  const result = await prisma.$transaction(async (tx) => {
    const conversation = await tx.supportConversation.create({
      data: {
        customerUserId: input.user?.id,
        customerEmail: input.user?.email ?? input.email ?? "",
        customerName: getDisplayName(input.user, input.name),
        priority: SUPPORT_DEFAULT_PRIORITY,
        source: SUPPORT_DEFAULT_SOURCE,
        slaDueAt: getSupportSlaDueAt(SUPPORT_DEFAULT_PRIORITY),
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
      select: {
        email: true,
        firstName: true,
        lastName: true,
        supportNotificationPreference: {
          select: { emailNewConversation: true },
        },
      },
    });
    
    const adminEmails = adminUsers
      .filter((adminUser) => shouldSendNewConversationEmail(adminUser.supportNotificationPreference))
      .map((adminUser) => adminUser.email)
      .filter(Boolean) as string[];
    
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
  return enrichSupportConversation(result, "customer");
}

export async function createSupportMessageAsCustomer(conversationId: string, user: CurrentUser, content: string) {
  const result = await prisma.$transaction(async (tx) => {
    const conversation = await tx.supportConversation.findFirst({
      where: { id: conversationId, customerUserId: user.id },
    });

    if (!conversation) throw new Error("CONVERSATION_NOT_FOUND");

    await tx.supportMessage.updateMany({
      where: {
        conversationId,
        senderType: { in: ["ADMIN", "SYSTEM"] },
        readAt: null,
      },
      data: { readAt: new Date() },
    });

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
        status: conversation.status === "CLOSED" || conversation.status === "WAITING" ? "OPEN" : conversation.status,
        reopenedAt: conversation.status === "CLOSED" ? new Date() : conversation.reopenedAt,
        closedAt: conversation.status === "CLOSED" ? null : conversation.closedAt,
        slaDueAt: getSupportSlaDueAt(conversation.priority),
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

    if (result.assignedAdmin?.email) {
      const notificationPreference = await tx.supportNotificationPreference.findUnique({
        where: { adminUserId: result.assignedAdmin.id },
        select: { emailNewMessage: true },
      });

      if (shouldSendNewMessageEmail(notificationPreference)) {
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
    }

    return result;
  });
  return enrichSupportConversation(result, "customer");
}

export async function getAdminSupportConversations(admin?: CurrentUser | null) {
  try {
    const conversations = await prisma.supportConversation.findMany({
      orderBy: [{ status: "asc" }, { lastMessageAt: "desc" }],
      include: conversationInclude,
    });
    return Promise.all(conversations.map((conversation) => enrichSupportConversation(conversation, "admin", admin)));
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
  const result = await prisma.$transaction(async (tx) => {
    const conversation = await tx.supportConversation.findUnique({ where: { id: conversationId } });
    if (!conversation) throw new Error("CONVERSATION_NOT_FOUND");
    if (conversation.status === "CLOSED") throw new Error("CONVERSATION_CLOSED");
    const latestMessage = await tx.supportMessage.findFirst({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      select: { content: true },
    });

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

    const updatedConversation = await tx.supportConversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: conversationInclude,
    });

    const notificationPreference = await tx.supportNotificationPreference.findUnique({
      where: { adminUserId: admin.id },
      select: { emailConversationAssigned: true },
    });

    if (shouldSendConversationAssignedEmail(notificationPreference)) {
      sendConversationAssignedEmail({
        conversationId,
        customerName: updatedConversation.customerName,
        customerEmail: updatedConversation.customerEmail,
        messageContent: latestMessage?.content ?? "Conversation support assignée.",
        adminEmail: admin.email,
        adminName: [admin.firstName, admin.lastName].filter(Boolean).join(" "),
      }).catch((err) => {
        logApiEvent({
          level: "WARN",
          route: "lib/support",
          event: "SUPPORT_CONVERSATION_ASSIGNED_EMAIL_FAILED",
          details: { conversationId, adminEmail: admin.email, error: err },
        });
      });
    }

    return updatedConversation;
  });
  return enrichSupportConversation(result, "admin", admin);
}

export async function closeSupportConversation(
  conversationId: string,
  admin: CurrentUser,
  input?: { reason?: SupportConversationCloseReason; note?: string },
) {
  const result = await prisma.$transaction(async (tx) => {
    const conversation = await tx.supportConversation.findUnique({ where: { id: conversationId } });
    if (!conversation) throw new Error("CONVERSATION_NOT_FOUND");
    const closedNote = input?.note?.trim() || null;

    await tx.supportConversation.update({
      where: { id: conversationId },
      data: {
        assignedAdminId: conversation.assignedAdminId ?? admin.id,
        status: "CLOSED",
        closedAt: new Date(),
        closedReason: input?.reason ?? "RESOLVED",
        closedNote,
        slaDueAt: null,
      },
    });

    if (closedNote) {
      await tx.supportInternalNote.create({
        data: {
          conversationId,
          adminUserId: admin.id,
          content: `Fermeture: ${closedNote}`,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        actorUserId: admin.id,
        action: "SUPPORT_CONVERSATION_CLOSED",
        entity: "SupportConversation",
        entityId: conversationId,
        metadata: JSON.stringify({ reason: input?.reason ?? "RESOLVED", hasNote: Boolean(closedNote) }),
      },
    });

    return tx.supportConversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: conversationInclude,
    });
  });
  return enrichSupportConversation(result, "admin", admin);
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

  return enrichSupportConversation(conversation, "customer");
}

export async function createSupportMessageAsGuest(
  conversationId: string,
  guestEmail: string,
  guestToken: string,
  content: string,
) {
  const result = await prisma.$transaction(async (tx) => {
    const conversation = await tx.supportConversation.findUnique({ where: { id: conversationId } });
    if (!conversation) throw new Error("CONVERSATION_NOT_FOUND");

    const normalizedGuestEmail = normalizeGuestEmail(guestEmail);
    if (conversation.customerEmail.toLowerCase() !== normalizedGuestEmail) {
      throw new Error("FORBIDDEN");
    }

    if (!verifySupportGuestAccessToken(guestToken, conversation.id, conversation.customerEmail)) {
      throw new Error("FORBIDDEN");
    }

    await tx.supportMessage.updateMany({
      where: {
        conversationId,
        senderType: { in: ["ADMIN", "SYSTEM"] },
        readAt: null,
      },
      data: { readAt: new Date() },
    });

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
        status: conversation.status === "CLOSED" || conversation.status === "WAITING" ? "OPEN" : conversation.status,
        reopenedAt: conversation.status === "CLOSED" ? new Date() : conversation.reopenedAt,
        closedAt: conversation.status === "CLOSED" ? null : conversation.closedAt,
        slaDueAt: getSupportSlaDueAt(conversation.priority),
      },
    });

    const result = await tx.supportConversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: conversationInclude,
    });

    if (result.assignedAdmin?.email) {
      const notificationPreference = await tx.supportNotificationPreference.findUnique({
        where: { adminUserId: result.assignedAdmin.id },
        select: { emailNewMessage: true },
      });

      if (shouldSendNewMessageEmail(notificationPreference)) {
        sendNewMessageEmail({
          conversationId,
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
    }

    return result;
  });
  return enrichSupportConversation(result, "customer");
}

export async function createSupportMessageAsAdmin(conversationId: string, admin: CurrentUser, content: string) {
  const result = await prisma.$transaction(async (tx) => {
    const conversation = await tx.supportConversation.findUnique({ where: { id: conversationId } });
    if (!conversation) throw new Error("CONVERSATION_NOT_FOUND");
    if (conversation.status === "CLOSED") throw new Error("CONVERSATION_CLOSED");

    await tx.supportMessage.updateMany({
      where: {
        conversationId,
        senderType: "CUSTOMER",
        readAt: null,
      },
      data: { readAt: new Date() },
    });

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
        slaDueAt: null,
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
  return enrichSupportConversation(result, "admin", admin);
}

export async function markSupportConversationReadAsCustomer(conversationId: string, user: CurrentUser) {
  const conversation = await prisma.supportConversation.findFirst({
    where: { id: conversationId, customerUserId: user.id },
    include: conversationInclude,
  });

  if (!conversation) throw new Error("CONVERSATION_NOT_FOUND");

  await prisma.supportMessage.updateMany({
    where: {
      conversationId,
      senderType: { in: ["ADMIN", "SYSTEM"] },
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  const result = await findConversationOrThrow(conversationId);
  return enrichSupportConversation(result, "customer");
}

export async function markSupportConversationReadAsGuest(
  conversationId: string,
  guestEmail: string,
  guestToken: string,
) {
  const conversation = await prisma.supportConversation.findUnique({
    where: { id: conversationId },
    include: conversationInclude,
  });

  if (!conversation) throw new Error("CONVERSATION_NOT_FOUND");
  if (conversation.customerEmail.toLowerCase() !== normalizeGuestEmail(guestEmail)) throw new Error("FORBIDDEN");
  if (!verifySupportGuestAccessToken(guestToken, conversation.id, conversation.customerEmail)) throw new Error("FORBIDDEN");

  await prisma.supportMessage.updateMany({
    where: {
      conversationId,
      senderType: { in: ["ADMIN", "SYSTEM"] },
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  const result = await findConversationOrThrow(conversationId);
  return enrichSupportConversation(result, "customer");
}

export async function markSupportConversationReadAsAdmin(conversationId: string, admin: CurrentUser) {
  const conversation = await prisma.supportConversation.findUnique({
    where: { id: conversationId },
    include: conversationInclude,
  });

  if (!conversation) throw new Error("CONVERSATION_NOT_FOUND");
  if (admin.role !== "ADMIN") throw new Error("FORBIDDEN");

  await prisma.supportMessage.updateMany({
    where: {
      conversationId,
      senderType: "CUSTOMER",
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  const result = await findConversationOrThrow(conversationId);
  return enrichSupportConversation(result, "admin", admin);
}

export async function updateSupportConversationAsAdmin(
  conversationId: string,
  admin: CurrentUser,
  input: {
    priority?: SupportConversationPriority;
    tags?: string[];
    orderId?: string;
  },
) {
  if (admin.role !== "ADMIN") throw new Error("FORBIDDEN");
  const conversation = await prisma.supportConversation.findUnique({ where: { id: conversationId } });
  if (!conversation) throw new Error("CONVERSATION_NOT_FOUND");

  if (input.orderId) {
    const order = await prisma.order.findUnique({ where: { id: input.orderId }, select: { id: true } });
    if (!order) throw new Error("ORDER_NOT_FOUND");
  }

  await prisma.supportConversation.update({
    where: { id: conversationId },
    data: {
      ...(input.priority
        ? {
            priority: input.priority,
            priorityUpdatedAt: new Date(),
            slaDueAt: conversation.status !== "CLOSED" ? getSupportSlaDueAt(input.priority) : conversation.slaDueAt,
          }
        : {}),
      ...(input.tags ? { tagsJson: JSON.stringify(normalizeTags(input.tags)) } : {}),
      ...(input.orderId !== undefined ? { orderId: input.orderId } : {}),
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: admin.id,
      action: "SUPPORT_CONVERSATION_UPDATED",
      entity: "SupportConversation",
      entityId: conversationId,
      metadata: JSON.stringify({
        priority: input.priority,
        tags: input.tags ? normalizeTags(input.tags) : undefined,
        orderId: input.orderId,
      }),
    },
  });

  const result = await findConversationOrThrow(conversationId);
  return enrichSupportConversation(result, "admin", admin);
}

export async function addSupportInternalNote(conversationId: string, admin: CurrentUser, content: string) {
  if (admin.role !== "ADMIN") throw new Error("FORBIDDEN");
  const conversation = await prisma.supportConversation.findUnique({ where: { id: conversationId }, select: { id: true } });
  if (!conversation) throw new Error("CONVERSATION_NOT_FOUND");

  await prisma.supportInternalNote.create({
    data: {
      conversationId,
      adminUserId: admin.id,
      content: content.trim(),
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: admin.id,
      action: "SUPPORT_INTERNAL_NOTE_CREATED",
      entity: "SupportConversation",
      entityId: conversationId,
    },
  });

  const result = await findConversationOrThrow(conversationId);
  return enrichSupportConversation(result, "admin", admin);
}

export async function reopenSupportConversation(conversationId: string, admin: CurrentUser) {
  if (admin.role !== "ADMIN") throw new Error("FORBIDDEN");
  const conversation = await prisma.supportConversation.findUnique({ where: { id: conversationId } });
  if (!conversation) throw new Error("CONVERSATION_NOT_FOUND");

  await prisma.supportConversation.update({
    where: { id: conversationId },
    data: {
      status: conversation.assignedAdminId ? "ASSIGNED" : "OPEN",
      closedAt: null,
      reopenedAt: new Date(),
      slaDueAt: getSupportSlaDueAt(conversation.priority),
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: admin.id,
      action: "SUPPORT_CONVERSATION_REOPENED",
      entity: "SupportConversation",
      entityId: conversationId,
    },
  });

  const result = await findConversationOrThrow(conversationId);
  return enrichSupportConversation(result, "admin", admin);
}

export async function unassignSupportConversation(conversationId: string, admin: CurrentUser) {
  if (admin.role !== "ADMIN") throw new Error("FORBIDDEN");
  const conversation = await prisma.supportConversation.findUnique({ where: { id: conversationId } });
  if (!conversation) throw new Error("CONVERSATION_NOT_FOUND");
  if (conversation.status === "CLOSED") throw new Error("CONVERSATION_CLOSED");

  await prisma.supportConversation.update({
    where: { id: conversationId },
    data: {
      assignedAdminId: null,
      status: conversation.status === "ASSIGNED" ? "OPEN" : conversation.status,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: admin.id,
      action: "SUPPORT_CONVERSATION_UNASSIGNED",
      entity: "SupportConversation",
      entityId: conversationId,
    },
  });

  const result = await findConversationOrThrow(conversationId);
  return enrichSupportConversation(result, "admin", admin);
}

const DEFAULT_QUICK_REPLY_MACROS = {
  fr: [
    {
      title: "Accueil chaleureux",
      content: "Bonjour ! Je suis de l'équipe Chez Olive. Je regarde ça avec vous.",
      category: "general",
    },
    {
      title: "Vérification commande",
      content: "Merci pour votre message. Je vérifie le statut de votre commande et je vous reviens avec une réponse claire.",
      category: "commande",
    },
    {
      title: "Livraison locale",
      content: "Je vérifie les détails de livraison locale à Rimouski et environs pour vous confirmer la meilleure suite.",
      category: "livraison",
    },
    {
      title: "Fermeture douce",
      content: "Merci pour votre patience. Je ferme la conversation, mais vous pouvez nous réécrire si une autre question arrive.",
      category: "fermeture",
    },
  ],
  en: [
    {
      title: "Warm hello",
      content: "Hello! I am with the Chez Olive team. I will look into this with you.",
      category: "general",
    },
    {
      title: "Order check",
      content: "Thank you for your message. I will check your order status and come back with a clear answer.",
      category: "order",
    },
    {
      title: "Local delivery",
      content: "I will check the local delivery details around Rimouski and confirm the best next step.",
      category: "delivery",
    },
    {
      title: "Gentle close",
      content: "Thank you for your patience. I am closing this conversation, but you can message us again if another question comes up.",
      category: "closing",
    },
  ],
} as const;

async function ensureDefaultSupportQuickReplies(language: "fr" | "en") {
  const existing = await prisma.supportQuickReply.count({
    where: { language, isActive: true },
  });
  if (existing > 0) return;

  await prisma.supportQuickReply.createMany({
    data: DEFAULT_QUICK_REPLY_MACROS[language].map((reply, index) => ({
      ...reply,
      language,
      sortOrder: index + 1,
    })),
  });
}

export async function listSupportQuickReplies(language: "fr" | "en") {
  await ensureDefaultSupportQuickReplies(language);
  return prisma.supportQuickReply.findMany({
    where: { language, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function createSupportQuickReply(
  admin: CurrentUser,
  input: { title: string; content: string; category?: string; language: "fr" | "en"; sortOrder?: number },
) {
  if (admin.role !== "ADMIN") throw new Error("FORBIDDEN");
  return prisma.supportQuickReply.create({
    data: {
      title: input.title.trim(),
      content: input.content.trim(),
      category: input.category?.trim() || "general",
      language: input.language,
      sortOrder: input.sortOrder ?? 100,
      createdByAdminId: admin.id,
    },
  });
}

export async function updateSupportQuickReply(
  quickReplyId: string,
  admin: CurrentUser,
  input: {
    title?: string;
    content?: string;
    category?: string;
    language?: "fr" | "en";
    isActive?: boolean;
    sortOrder?: number;
  },
) {
  if (admin.role !== "ADMIN") throw new Error("FORBIDDEN");
  try {
    return await prisma.supportQuickReply.update({
      where: { id: quickReplyId },
      data: {
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.content !== undefined ? { content: input.content.trim() } : {}),
        ...(input.category !== undefined ? { category: input.category.trim() || "general" } : {}),
        ...(input.language !== undefined ? { language: input.language } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
    });
  } catch {
    throw new Error("QUICK_REPLY_NOT_FOUND");
  }
}

