import twilio, { validateRequest } from "twilio";
import { env } from "@/lib/env";
import { logApiEvent } from "@/lib/observability";
import { prisma } from "@/lib/prisma";

export type SmsNotificationType =
  | "ORDER_PAID"
  | "DELIVERY_SCHEDULED"
  | "DELIVERY_RESCHEDULED"
  | "DELIVERY_OUT_FOR_DELIVERY"
  | "DELIVERY_DELIVERED"
  | "DELIVERY_FAILED";

type SmsLanguage = "fr" | "en";

type OrderSmsSnapshot = {
  id: string;
  orderNumber: string;
  userId: string | null;
  customerName: string;
  deliveryPhone: string | null;
  deliveryWindowStartAt: Date | null;
  deliveryWindowEndAt: Date | null;
};

type TwilioErrorLike = {
  code?: string | number;
  message?: string;
  status?: number;
};

const SMS_ROUTE = "lib/sms";
const STOP_KEYWORDS = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT", "OPTOUT", "REVOKE"]);
const START_KEYWORDS = new Set(["START", "UNSTOP"]);
const HELP_KEYWORDS = new Set(["HELP", "INFO"]);

let smsSchemaAvailableCache: boolean | null = null;
let twilioClient: ReturnType<typeof twilio> | null = null;

function sanitizePreview(value: string | null | undefined, maxLength = 180) {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function normalizeSmsPhoneToE164(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export function isValidSmsPhone(value: string | null | undefined) {
  return Boolean(normalizeSmsPhoneToE164(value));
}

function normalizeLanguage(value: string | null | undefined): SmsLanguage {
  return value === "en" ? "en" : "fr";
}

function formatWindow(startAt: Date | null, endAt: Date | null) {
  if (!startAt || !endAt) return null;
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(startAt);
  const timeFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${date} ${timeFormatter.format(startAt)}-${timeFormatter.format(endAt)}`;
}

function buildOrderSmsBody(type: SmsNotificationType, order: OrderSmsSnapshot, language: SmsLanguage) {
  const windowLabel = formatWindow(order.deliveryWindowStartAt, order.deliveryWindowEndAt);
  const suffix = " STOP pour arreter.";

  if (language === "en") {
    switch (type) {
      case "ORDER_PAID":
        return `Chez Olive: order #${order.orderNumber} is confirmed. Thank you! Reply STOP to opt out.`;
      case "DELIVERY_SCHEDULED":
        return `Chez Olive: delivery for order #${order.orderNumber} is scheduled${windowLabel ? ` for ${windowLabel}` : ""}. Reply STOP to opt out.`;
      case "DELIVERY_RESCHEDULED":
        return `Chez Olive: delivery for order #${order.orderNumber} was rescheduled${windowLabel ? ` to ${windowLabel}` : ""}. Reply STOP to opt out.`;
      case "DELIVERY_OUT_FOR_DELIVERY":
        return `Chez Olive: order #${order.orderNumber} is out for delivery today. Reply STOP to opt out.`;
      case "DELIVERY_DELIVERED":
        return `Chez Olive: order #${order.orderNumber} was delivered. Thank you! Reply STOP to opt out.`;
      case "DELIVERY_FAILED":
        return `Chez Olive: delivery for order #${order.orderNumber} could not be completed. We will contact you. Reply STOP to opt out.`;
    }
  }

  switch (type) {
    case "ORDER_PAID":
      return `Chez Olive: commande #${order.orderNumber} confirmee. Merci!${suffix}`;
    case "DELIVERY_SCHEDULED":
      return `Chez Olive: livraison de la commande #${order.orderNumber} planifiee${windowLabel ? ` pour ${windowLabel}` : ""}.${suffix}`;
    case "DELIVERY_RESCHEDULED":
      return `Chez Olive: livraison de la commande #${order.orderNumber} replanifiee${windowLabel ? ` pour ${windowLabel}` : ""}.${suffix}`;
    case "DELIVERY_OUT_FOR_DELIVERY":
      return `Chez Olive: commande #${order.orderNumber} en cours de livraison aujourd'hui.${suffix}`;
    case "DELIVERY_DELIVERED":
      return `Chez Olive: commande #${order.orderNumber} livree. Merci!${suffix}`;
    case "DELIVERY_FAILED":
      return `Chez Olive: livraison de la commande #${order.orderNumber} non completee. On te contactera.${suffix}`;
  }
}

function getTwilioClient() {
  if (!twilioClient) {
    twilioClient = twilio(env.twilioAccountSid, env.twilioAuthToken);
  }
  return twilioClient;
}

function statusTimestampPatch(status: string) {
  const now = new Date();
  if (status === "DELIVERED") return { deliveredAt: now };
  if (status === "SENT") return { sentAt: now };
  return {};
}

function getTwilioErrorDetails(error: unknown) {
  const candidate = error as TwilioErrorLike;
  return {
    code: candidate?.code === undefined ? null : String(candidate.code),
    message: sanitizePreview(candidate?.message ?? "SMS delivery failed", 240),
    status: candidate?.status,
  };
}

export async function hasSmsSchemaTables() {
  if (smsSchemaAvailableCache !== null) return smsSchemaAvailableCache;

  try {
    const rows = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name IN ('SmsRecipientPreference', 'SmsNotificationLog', 'SmsInboundMessage')
    `;
    const names = new Set(rows.map((row) => row.name));
    smsSchemaAvailableCache =
      names.has("SmsRecipientPreference") && names.has("SmsNotificationLog") && names.has("SmsInboundMessage");
    return smsSchemaAvailableCache;
  } catch {
    smsSchemaAvailableCache = false;
    return false;
  }
}

export async function createOrderSmsPreference(input: {
  orderId: string;
  userId?: string | null;
  phone?: string | null;
  language?: string | null;
  optedIn?: boolean;
  source: string;
}) {
  if (!input.optedIn) return null;
  if (!(await hasSmsSchemaTables())) return null;

  const phoneE164 = normalizeSmsPhoneToE164(input.phone);
  if (!phoneE164) return null;

  const now = new Date();
  return prisma.smsRecipientPreference.upsert({
    where: {
      orderId_phoneE164: {
        orderId: input.orderId,
        phoneE164,
      },
    },
    create: {
      userId: input.userId ?? null,
      orderId: input.orderId,
      phoneE164,
      language: normalizeLanguage(input.language),
      optedIn: true,
      optedOut: false,
      optInSource: input.source,
      optInAt: now,
      optOutAt: null,
    },
    update: {
      userId: input.userId ?? null,
      language: normalizeLanguage(input.language),
      optedIn: true,
      optedOut: false,
      optInSource: input.source,
      optInAt: now,
      optOutAt: null,
    },
  }).catch((error) => {
    logApiEvent({
      level: "WARN",
      route: SMS_ROUTE,
      event: "SMS_PREFERENCE_SAVE_FAILED",
      details: { orderId: input.orderId, error },
    });
    return null;
  });
}

function smsConfigReady() {
  return Boolean(env.twilioAccountSid && env.twilioAuthToken && env.twilioMessagingServiceSid);
}

function smsStatusCallbackUrl() {
  const base = env.siteUrl.replace(/\/+$/, "");
  return `${base}/api/twilio/message-status`;
}

export async function sendOrderSmsNotification(input: {
  orderId: string;
  type: SmsNotificationType;
  dedupeKey?: string | null;
}) {
  if (!env.smsNotificationsEnabled) {
    return { sent: false, reason: "DISABLED" as const };
  }

  if (!(await hasSmsSchemaTables())) {
    return { sent: false, reason: "SCHEMA_UNAVAILABLE" as const };
  }

  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    select: {
      id: true,
      orderNumber: true,
      userId: true,
      customerName: true,
      deliveryPhone: true,
      deliveryWindowStartAt: true,
      deliveryWindowEndAt: true,
      smsRecipientPreferences: {
        where: { optedIn: true },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          phoneE164: true,
          language: true,
          optedOut: true,
        },
      },
    },
  });

  if (!order) return { sent: false, reason: "ORDER_NOT_FOUND" as const };

  const preference = order.smsRecipientPreferences[0] ?? null;
  if (!preference || preference.optedOut) {
    return { sent: false, reason: "NO_OPT_IN" as const };
  }

  const toPhoneE164 = normalizeSmsPhoneToE164(preference.phoneE164 ?? order.deliveryPhone);
  if (!toPhoneE164) {
    return { sent: false, reason: "INVALID_PHONE" as const };
  }

  const eventKey = ["order", order.id, input.type, input.dedupeKey ?? ""].filter(Boolean).join(":");
  const existing = await prisma.smsNotificationLog.findUnique({
    where: { eventKey },
    select: { id: true, status: true },
  });
  if (existing) {
    return { sent: false, reason: "DUPLICATE" as const, logId: existing.id };
  }

  const language = normalizeLanguage(preference.language);
  const body = buildOrderSmsBody(input.type, order, language);
  const now = new Date();
  const log = await prisma.smsNotificationLog.create({
    data: {
      eventKey,
      type: input.type,
      orderId: order.id,
      userId: order.userId,
      recipientPreferenceId: preference.id,
      toPhoneE164,
      language,
      bodyPreview: sanitizePreview(body),
      status: env.smsDryRun ? "DRY_RUN" : "PENDING",
      dryRun: env.smsDryRun,
      attemptedAt: now,
    },
    select: { id: true },
  });

  if (env.smsDryRun) {
    logApiEvent({
      level: "INFO",
      route: SMS_ROUTE,
      event: "SMS_DRY_RUN",
      details: { orderId: order.id, type: input.type, toPhoneE164, logId: log.id },
    });
    return { sent: false, reason: "DRY_RUN" as const, logId: log.id };
  }

  if (!smsConfigReady()) {
    await prisma.smsNotificationLog.update({
      where: { id: log.id },
      data: {
        status: "FAILED",
        errorMessage: "Twilio SMS configuration is incomplete.",
      },
    });
    return { sent: false, reason: "CONFIG_INCOMPLETE" as const, logId: log.id };
  }

  try {
    const message = await getTwilioClient().messages.create({
      messagingServiceSid: env.twilioMessagingServiceSid,
      to: toPhoneE164,
      body,
      statusCallback: smsStatusCallbackUrl(),
    });

    const status = (message.status ?? "queued").toUpperCase();
    await prisma.smsNotificationLog.update({
      where: { id: log.id },
      data: {
        status,
        twilioMessageSid: message.sid,
        twilioAccountSid: message.accountSid ?? env.twilioAccountSid,
        twilioMessagingServiceSid: message.messagingServiceSid ?? env.twilioMessagingServiceSid,
        ...statusTimestampPatch(status),
      },
    });

    return { sent: true, logId: log.id, messageSid: message.sid };
  } catch (error) {
    const details = getTwilioErrorDetails(error);
    await prisma.smsNotificationLog.update({
      where: { id: log.id },
      data: {
        status: "FAILED",
        errorCode: details.code,
        errorMessage: details.message,
      },
    });
    logApiEvent({
      level: "WARN",
      route: SMS_ROUTE,
      event: "SMS_SEND_FAILED",
      status: details.status,
      details: { orderId: order.id, type: input.type, logId: log.id, code: details.code },
    });
    return { sent: false, reason: "TWILIO_ERROR" as const, logId: log.id };
  }
}

export function formDataToTwilioParams(formData: FormData) {
  const params: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    params[key] = typeof value === "string" ? value : value.name;
  }
  return params;
}

export function validateTwilioRequest(request: Request, params: Record<string, string>) {
  const signature = request.headers.get("x-twilio-signature") ?? "";
  if (!env.twilioAuthToken || !signature) return false;
  return validateRequest(env.twilioAuthToken, signature, request.url, params);
}

function normalizeSmsStatus(status: string | null | undefined) {
  return sanitizePreview(status ?? "unknown", 40).toUpperCase() || "UNKNOWN";
}

export async function recordSmsStatusCallback(params: Record<string, string>) {
  if (!(await hasSmsSchemaTables())) return;

  const messageSid = params.MessageSid;
  if (!messageSid) return;

  const status = normalizeSmsStatus(params.MessageStatus ?? params.SmsStatus);
  const toPhoneE164 = normalizeSmsPhoneToE164(params.To) ?? "unknown";
  const errorCode = sanitizePreview(params.ErrorCode, 40) || null;
  const errorMessage = sanitizePreview(params.ErrorMessage, 240) || null;
  const timestampPatch = statusTimestampPatch(status);

  await prisma.smsNotificationLog.upsert({
    where: { twilioMessageSid: messageSid },
    create: {
      eventKey: `twilio:${messageSid}`,
      type: "STATUS_CALLBACK",
      toPhoneE164,
      status,
      twilioMessageSid: messageSid,
      twilioAccountSid: params.AccountSid ?? null,
      twilioMessagingServiceSid: params.MessagingServiceSid ?? null,
      errorCode,
      errorMessage,
      ...timestampPatch,
    },
    update: {
      status,
      twilioAccountSid: params.AccountSid ?? undefined,
      twilioMessagingServiceSid: params.MessagingServiceSid ?? undefined,
      errorCode,
      errorMessage,
      ...timestampPatch,
    },
  });
}

function deriveOptOutType(params: Record<string, string>) {
  const explicit = sanitizePreview(params.OptOutType, 20).toUpperCase();
  if (explicit === "STOP" || explicit === "START" || explicit === "HELP") return explicit;

  const body = sanitizePreview(params.Body, 80).toUpperCase();
  if (STOP_KEYWORDS.has(body)) return "STOP";
  if (START_KEYWORDS.has(body)) return "START";
  if (HELP_KEYWORDS.has(body)) return "HELP";
  return null;
}

export async function recordInboundSms(params: Record<string, string>) {
  if (!(await hasSmsSchemaTables())) return { optOutType: null as string | null };

  const messageSid = params.MessageSid;
  const fromPhoneE164 = normalizeSmsPhoneToE164(params.From);
  if (!messageSid || !fromPhoneE164) return { optOutType: null as string | null };

  const optOutType = deriveOptOutType(params);
  await prisma.smsInboundMessage.upsert({
    where: { messageSid },
    create: {
      messageSid,
      fromPhoneE164,
      toPhoneE164: normalizeSmsPhoneToE164(params.To),
      optOutType,
      bodyPreview: sanitizePreview(params.Body, 80) || null,
    },
    update: {
      optOutType,
      bodyPreview: sanitizePreview(params.Body, 80) || null,
    },
  });

  if (optOutType === "STOP") {
    await prisma.smsRecipientPreference.updateMany({
      where: { phoneE164: fromPhoneE164 },
      data: { optedOut: true, optOutAt: new Date() },
    });
  } else if (optOutType === "START") {
    await prisma.smsRecipientPreference.updateMany({
      where: { phoneE164: fromPhoneE164 },
      data: { optedIn: true, optedOut: false, optOutAt: null },
    });
  }

  return { optOutType };
}
