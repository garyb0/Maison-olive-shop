import { createHash } from "node:crypto";
import * as webpush from "web-push";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import type { CurrentUser, UserRole } from "@/lib/types";
import type { webPushSubscriptionSchema } from "@/lib/validators";
import type { z } from "zod";

export type AppNotificationType =
  | "ORDER_UPDATE"
  | "DELIVERY_UPDATE"
  | "SUPPORT_UPDATE"
  | "DOG_QR_UPDATE"
  | "ADMIN_ORDER"
  | "ADMIN_SUPPORT"
  | "ADMIN_STOCK"
  | "ADMIN_HEALTH"
  | "DRIVER_RUN"
  | "SYSTEM";

export type AppNotificationAudience = "CUSTOMER" | "ADMIN" | "DRIVER";

export type AppNotificationDTO = {
  id: string;
  type: AppNotificationType;
  audience: AppNotificationAudience;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

export type AppNotificationPreferencesDTO = {
  pushEnabled: boolean;
  orderUpdates: boolean;
  deliveryUpdates: boolean;
  supportUpdates: boolean;
  dogQrUpdates: boolean;
  adminAlerts: boolean;
  driverRunUpdates: boolean;
};

export type AdminNotificationOpsSnapshot = {
  recent: AppNotificationDTO[];
  unreadCount: number;
  disabledPushSubscriptionCount: number;
};

type PushSubscriptionInput = z.infer<typeof webPushSubscriptionSchema>;

type NotificationRecord = {
  id: string;
  type: string;
  audience: string;
  title: string;
  body: string;
  href: string | null;
  readAt: Date | null;
  createdAt: Date;
};

const DEFAULT_PREFERENCES: AppNotificationPreferencesDTO = {
  pushEnabled: false,
  orderUpdates: true,
  deliveryUpdates: true,
  supportUpdates: true,
  dogQrUpdates: true,
  adminAlerts: true,
  driverRunUpdates: true,
};

const NOTIFICATION_TYPE_LABELS: Record<AppNotificationType, keyof AppNotificationPreferencesDTO> = {
  ORDER_UPDATE: "orderUpdates",
  DELIVERY_UPDATE: "deliveryUpdates",
  SUPPORT_UPDATE: "supportUpdates",
  DOG_QR_UPDATE: "dogQrUpdates",
  ADMIN_ORDER: "adminAlerts",
  ADMIN_SUPPORT: "adminAlerts",
  ADMIN_STOCK: "adminAlerts",
  ADMIN_HEALTH: "adminAlerts",
  DRIVER_RUN: "driverRunUpdates",
  SYSTEM: "pushEnabled",
};

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function sanitizeString(value: string, maxLength: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeHref(href: string | null | undefined) {
  const normalized = sanitizeString(href ?? "", 220);
  if (!normalized || !normalized.startsWith("/")) return null;
  if (normalized.startsWith("//")) return null;
  return normalized;
}

function normalizeAudience(value: string): AppNotificationAudience {
  return value === "ADMIN" || value === "DRIVER" ? value : "CUSTOMER";
}

function serializeNotification(row: NotificationRecord): AppNotificationDTO {
  return {
    id: row.id,
    type: row.type as AppNotificationType,
    audience: normalizeAudience(row.audience),
    title: row.title,
    body: row.body,
    href: row.href,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function normalizePreferences(preferences: Partial<AppNotificationPreferencesDTO> | null | undefined) {
  return {
    ...DEFAULT_PREFERENCES,
    ...(preferences ?? {}),
  };
}

export function getWebPushPublicKey() {
  return env.webPushPublicKey;
}

export function isWebPushConfigured() {
  return Boolean(env.webPushPublicKey && env.webPushPrivateKey && env.webPushSubject);
}

export async function hasAppNotificationSchemaTables() {
  try {
    const rows = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name IN ('WebPushSubscription', 'NotificationPreference', 'AppNotification')
    `;
    const names = new Set(rows.map((row) => row.name));
    return names.has("WebPushSubscription") && names.has("NotificationPreference") && names.has("AppNotification");
  } catch {
    return true;
  }
}

export async function getAppNotificationPreferences(userId: string): Promise<AppNotificationPreferencesDTO> {
  if (!(await hasAppNotificationSchemaTables())) return { ...DEFAULT_PREFERENCES };

  const preferences = await prisma.notificationPreference.findUnique({
    where: { userId },
    select: {
      pushEnabled: true,
      orderUpdates: true,
      deliveryUpdates: true,
      supportUpdates: true,
      dogQrUpdates: true,
      adminAlerts: true,
      driverRunUpdates: true,
    },
  });

  return normalizePreferences(preferences);
}

export async function updateAppNotificationPreferences(
  userId: string,
  patch: Partial<AppNotificationPreferencesDTO>,
) {
  const next = normalizePreferences(patch);
  const saved = await prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId, ...next },
    update: patch,
    select: {
      pushEnabled: true,
      orderUpdates: true,
      deliveryUpdates: true,
      supportUpdates: true,
      dogQrUpdates: true,
      adminAlerts: true,
      driverRunUpdates: true,
    },
  });

  return normalizePreferences(saved);
}

export async function listAppNotificationsForUser(user: CurrentUser, take = 20) {
  if (!(await hasAppNotificationSchemaTables())) {
    return { notifications: [] as AppNotificationDTO[], unreadCount: 0 };
  }

  const where = {
    userId: user.id,
  };

  const [rows, unreadCount] = await Promise.all([
    prisma.appNotification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        type: true,
        audience: true,
        title: true,
        body: true,
        href: true,
        readAt: true,
        createdAt: true,
      },
    }),
    prisma.appNotification.count({
      where: {
        ...where,
        readAt: null,
      },
    }),
  ]);

  return {
    notifications: rows.map(serializeNotification),
    unreadCount,
  };
}

export async function getAdminNotificationOpsSnapshot(take = 8): Promise<AdminNotificationOpsSnapshot> {
  if (!(await hasAppNotificationSchemaTables())) {
    return {
      recent: [],
      unreadCount: 0,
      disabledPushSubscriptionCount: 0,
    };
  }

  const where = {
    audience: "ADMIN",
  };

  const [rows, unreadCount, disabledPushSubscriptionCount] = await Promise.all([
    prisma.appNotification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        type: true,
        audience: true,
        title: true,
        body: true,
        href: true,
        readAt: true,
        createdAt: true,
      },
    }),
    prisma.appNotification.count({
      where: {
        ...where,
        readAt: null,
      },
    }),
    prisma.webPushSubscription.count({
      where: { enabled: false },
    }),
  ]);

  return {
    recent: rows.map(serializeNotification),
    unreadCount,
    disabledPushSubscriptionCount,
  };
}

export async function markAppNotificationsRead(
  user: CurrentUser,
  input: { ids?: string[]; all?: boolean; read?: boolean },
) {
  const readAt = input.read === false ? null : new Date();
  const where = input.all
    ? { userId: user.id }
    : { userId: user.id, id: { in: input.ids ?? [] } };

  if (!input.all && (!input.ids || input.ids.length < 1)) {
    return listAppNotificationsForUser(user);
  }

  await prisma.appNotification.updateMany({
    where,
    data: { readAt },
  });

  return listAppNotificationsForUser(user);
}

function audienceFromRole(role: UserRole): AppNotificationAudience {
  return role === "ADMIN" ? "ADMIN" : "CUSTOMER";
}

function subscriptionPayload(row: { endpoint: string; p256dh: string; auth: string }): webpush.PushSubscription {
  return {
    endpoint: row.endpoint,
    keys: {
      p256dh: row.p256dh,
      auth: row.auth,
    },
  };
}

function shouldSendPush(type: AppNotificationType, preferences: AppNotificationPreferencesDTO) {
  if (!preferences.pushEnabled) return false;
  const preferenceKey = NOTIFICATION_TYPE_LABELS[type] ?? "pushEnabled";
  return Boolean(preferences[preferenceKey]);
}

async function deliverPushNotification(input: {
  userId?: string | null;
  driverRunId?: string | null;
  type: AppNotificationType;
  title: string;
  body: string;
  href: string | null;
}) {
  if (!isWebPushConfigured()) return;

  const subscriptionWhere = input.userId
    ? { userId: input.userId, enabled: true }
    : input.driverRunId
      ? { driverRunId: input.driverRunId, enabled: true }
      : null;

  if (!subscriptionWhere) return;

  const subscriptions = await prisma.webPushSubscription.findMany({
    where: subscriptionWhere,
    select: {
      id: true,
      endpointHash: true,
      endpoint: true,
      p256dh: true,
      auth: true,
      userId: true,
    },
  });

  if (subscriptions.length < 1) return;

  const preferences = input.userId
    ? await getAppNotificationPreferences(input.userId)
    : { ...DEFAULT_PREFERENCES, pushEnabled: true };

  if (!shouldSendPush(input.type, preferences)) return;

  const payload = JSON.stringify({
    type: input.type,
    title: input.title,
    body: input.body,
    href: input.href ?? "/app",
  });

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(subscriptionPayload(subscription), payload, {
          vapidDetails: {
            subject: env.webPushSubject,
            publicKey: env.webPushPublicKey,
            privateKey: env.webPushPrivateKey,
          },
        });
      } catch (error) {
        const statusCode = typeof (error as { statusCode?: unknown }).statusCode === "number"
          ? (error as { statusCode: number }).statusCode
          : null;
        if (statusCode === 404 || statusCode === 410) {
          await prisma.webPushSubscription.updateMany({
            where: { endpointHash: subscription.endpointHash },
            data: { enabled: false },
          });
        }
      }
    }),
  );
}

export async function createAppNotification(input: {
  userId?: string | null;
  driverRunId?: string | null;
  audience: AppNotificationAudience;
  type: AppNotificationType;
  title: string;
  body: string;
  href?: string | null;
  metadata?: Record<string, string | number | boolean | null> | null;
}) {
  if (!(await hasAppNotificationSchemaTables())) return null;

  const title = sanitizeString(input.title, 90);
  const body = sanitizeString(input.body, 180);
  const href = normalizeHref(input.href);
  const notification = await prisma.appNotification.create({
    data: {
      userId: input.userId ?? null,
      driverRunId: input.driverRunId ?? null,
      audience: input.audience,
      type: input.type,
      title,
      body,
      href,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
    },
    select: {
      id: true,
      type: true,
      audience: true,
      title: true,
      body: true,
      href: true,
      readAt: true,
      createdAt: true,
    },
  });

  await deliverPushNotification({
    userId: input.userId ?? null,
    driverRunId: input.driverRunId ?? null,
    type: input.type,
    title,
    body,
    href,
  }).catch(() => undefined);

  return serializeNotification(notification);
}

export async function createAdminAppNotification(input: {
  type: Extract<AppNotificationType, "ADMIN_ORDER" | "ADMIN_SUPPORT" | "ADMIN_STOCK" | "ADMIN_HEALTH" | "SYSTEM">;
  title: string;
  body: string;
  href?: string | null;
  metadata?: Record<string, string | number | boolean | null> | null;
}) {
  if (!(await hasAppNotificationSchemaTables())) return [];

  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  });

  const created = await Promise.all(
    admins.map((admin) =>
      createAppNotification({
        userId: admin.id,
        audience: "ADMIN",
        type: input.type,
        title: input.title,
        body: input.body,
        href: input.href,
        metadata: input.metadata,
      }),
    ),
  );

  return created.filter((notification): notification is AppNotificationDTO => Boolean(notification));
}

export async function createDogQrScanNotification(input: {
  userId: string;
  dogId: string;
  dogName: string | null;
}) {
  if (!(await hasAppNotificationSchemaTables())) return null;

  const dedupeSince = new Date(Date.now() - 30 * 60 * 1000);
  const existing = await prisma.appNotification.findFirst({
    where: {
      userId: input.userId,
      type: "DOG_QR_UPDATE",
      createdAt: { gte: dedupeSince },
      metadataJson: { contains: `"dogId":"${input.dogId}"` },
    },
    select: { id: true },
  });

  if (existing) return null;

  const dogLabel = input.dogName?.trim() || "Ton chien";
  return createAppNotification({
    userId: input.userId,
    audience: "CUSTOMER",
    type: "DOG_QR_UPDATE",
    title: "Profil QR consulté",
    body: `${dogLabel} vient d'etre consulte depuis son medaillon.`,
    href: "/account/dogs",
    metadata: { dogId: input.dogId },
  });
}

export async function registerWebPushSubscriptionForUser(
  user: CurrentUser,
  subscription: PushSubscriptionInput,
  userAgent?: string | null,
) {
  const endpointHash = hashValue(subscription.endpoint);
  const audience = audienceFromRole(user.role);

  const saved = await prisma.$transaction(async (tx) => {
    await tx.notificationPreference.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...DEFAULT_PREFERENCES, pushEnabled: true },
      update: { pushEnabled: true },
    });

    return tx.webPushSubscription.upsert({
      where: { endpointHash },
      create: {
        userId: user.id,
        audience,
        endpointHash,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: sanitizeString(userAgent ?? "", 240),
        enabled: true,
        lastSeenAt: new Date(),
      },
      update: {
        userId: user.id,
        driverRunId: null,
        driverTokenHash: null,
        audience,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: sanitizeString(userAgent ?? "", 240),
        enabled: true,
        lastSeenAt: new Date(),
      },
      select: { id: true, audience: true, enabled: true },
    });
  });

  return {
    id: saved.id,
    audience: normalizeAudience(saved.audience),
    enabled: saved.enabled,
    pushAvailable: isWebPushConfigured(),
  };
}

export async function unregisterWebPushSubscriptionForUser(userId: string, endpoint?: string | null) {
  const where = endpoint
    ? { userId, endpointHash: hashValue(endpoint) }
    : { userId };

  await prisma.$transaction(async (tx) => {
    await tx.webPushSubscription.updateMany({
      where,
      data: { enabled: false },
    });
    await tx.notificationPreference.upsert({
      where: { userId },
      create: { userId, ...DEFAULT_PREFERENCES, pushEnabled: false },
      update: { pushEnabled: false },
    });
  });

  return { ok: true };
}

function hashDeliveryRunToken(token: string) {
  return hashValue(token);
}

export async function registerWebPushSubscriptionForDriverToken(input: {
  token: string;
  runId: string;
  subscription: PushSubscriptionInput;
  userAgent?: string | null;
}) {
  const endpointHash = hashValue(input.subscription.endpoint);
  const driverTokenHash = hashDeliveryRunToken(input.token);

  const saved = await prisma.webPushSubscription.upsert({
    where: { endpointHash },
    create: {
      driverRunId: input.runId,
      driverTokenHash,
      audience: "DRIVER",
      endpointHash,
      endpoint: input.subscription.endpoint,
      p256dh: input.subscription.keys.p256dh,
      auth: input.subscription.keys.auth,
      userAgent: sanitizeString(input.userAgent ?? "", 240),
      enabled: true,
      lastSeenAt: new Date(),
    },
    update: {
      userId: null,
      driverRunId: input.runId,
      driverTokenHash,
      audience: "DRIVER",
      endpoint: input.subscription.endpoint,
      p256dh: input.subscription.keys.p256dh,
      auth: input.subscription.keys.auth,
      userAgent: sanitizeString(input.userAgent ?? "", 240),
      enabled: true,
      lastSeenAt: new Date(),
    },
    select: { id: true, audience: true, enabled: true },
  });

  return {
    id: saved.id,
    audience: normalizeAudience(saved.audience),
    enabled: saved.enabled,
    pushAvailable: isWebPushConfigured(),
  };
}

export async function unregisterWebPushSubscriptionForDriverToken(token: string, endpoint?: string | null) {
  const driverTokenHash = hashDeliveryRunToken(token);
  const where = endpoint
    ? { driverTokenHash, endpointHash: hashValue(endpoint) }
    : { driverTokenHash };

  await prisma.webPushSubscription.updateMany({
    where,
    data: { enabled: false },
  });

  return { ok: true };
}
