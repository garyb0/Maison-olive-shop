import { createHash } from "node:crypto";
import type { ConversionEventType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const CONVERSION_EVENT_TYPES = [
  "SHOP_VIEW",
  "PRODUCT_VIEW",
  "CART_ADD",
  "CART_VIEW",
  "CHECKOUT_START",
  "DELIVERY_SELECTED",
  "PAYMENT_SELECTED",
  "ORDER_CREATED",
  "CHECKOUT_ERROR",
] as const satisfies readonly ConversionEventType[];

type ConversionDevice = "mobile" | "desktop" | "unknown";

export type ConversionEventInput = {
  type: ConversionEventType;
  sessionKey: string;
  userId?: string | null;
  productId?: string | null;
  productSlug?: string | null;
  orderId?: string | null;
  orderNumber?: string | null;
  currency?: string | null;
  cartTotalCents?: number | null;
  itemCount?: number | null;
  quantity?: number | null;
  paymentMethod?: string | null;
  deliveryMode?: string | null;
  language?: "fr" | "en" | null;
  path?: string | null;
  referrerPath?: string | null;
  metadata?: Record<string, string | number | boolean | null> | null;
};

type ConversionEventForSummary = {
  type: ConversionEventType;
  sessionKey: string;
  productId: string | null;
  productSlug: string | null;
  quantity: number | null;
  metadataJson?: string | null;
  createdAt: Date;
};

export type ConversionProductMetric = {
  key: string;
  productId: string | null;
  productSlug: string | null;
  nameFr: string;
  nameEn: string;
  addCount: number;
  quantity: number;
};

export type ConversionReasonMetric = {
  reason: string;
  count: number;
};

export type ConversionSummary = {
  shopVisitors: number;
  productViews: number;
  productViewSessions: number;
  cartAdds: number;
  cartAddSessions: number;
  cartViews: number;
  checkoutStarts: number;
  ordersCreated: number;
  checkoutErrors: number;
  shopToCartRate: number | null;
  productToCartRate: number | null;
  cartToCheckoutRate: number | null;
  checkoutToOrderRate: number | null;
  productViewDropOffCount: number;
  cartToCheckoutDropOffCount: number;
  checkoutToOrderDropOffCount: number;
  topAddedProducts: ConversionProductMetric[];
  topAbandonedProducts: ConversionProductMetric[];
  topViewedNotAddedProducts: ConversionProductMetric[];
  checkoutErrorReasons: ConversionReasonMetric[];
};

export type ConversionDashboardSnapshot = {
  generatedAt: string;
  today: ConversionSummary;
  sevenDays: ConversionSummary;
};

const EMPTY_SUMMARY: ConversionSummary = {
  shopVisitors: 0,
  productViews: 0,
  productViewSessions: 0,
  cartAdds: 0,
  cartAddSessions: 0,
  cartViews: 0,
  checkoutStarts: 0,
  ordersCreated: 0,
  checkoutErrors: 0,
  shopToCartRate: null,
  productToCartRate: null,
  cartToCheckoutRate: null,
  checkoutToOrderRate: null,
  productViewDropOffCount: 0,
  cartToCheckoutDropOffCount: 0,
  checkoutToOrderDropOffCount: 0,
  topAddedProducts: [],
  topAbandonedProducts: [],
  topViewedNotAddedProducts: [],
  checkoutErrorReasons: [],
};

export function getEmptyConversionDashboardSnapshot(): ConversionDashboardSnapshot {
  return {
    generatedAt: new Date().toISOString(),
    today: { ...EMPTY_SUMMARY },
    sevenDays: { ...EMPTY_SUMMARY },
  };
}

function normalizeString(value: string | null | undefined, maxLength: number) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

export function hashConversionSessionKey(sessionKey: string) {
  return createHash("sha256").update(sessionKey.trim()).digest("hex").slice(0, 48);
}

function normalizePath(value: string | null | undefined) {
  const trimmed = normalizeString(value, 300);
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed, "https://chezolive.local");
    return parsed.pathname.slice(0, 160);
  } catch {
    return trimmed.startsWith("/") ? trimmed.split(/[?#]/)[0].slice(0, 160) : null;
  }
}

function detectDevice(userAgent?: string | null): ConversionDevice {
  if (!userAgent) return "unknown";
  return /Mobile|Android|iPhone|iPod|IEMobile|Opera Mini/i.test(userAgent) ? "mobile" : "desktop";
}

function serializeMetadata(metadata: ConversionEventInput["metadata"]) {
  if (!metadata) return null;
  const safeEntries = Object.entries(metadata).slice(0, 12).filter(([key, value]) => {
    return key.length <= 40 && (value === null || ["string", "number", "boolean"].includes(typeof value));
  });

  if (!safeEntries.length) return null;
  return JSON.stringify(Object.fromEntries(safeEntries));
}

export async function createConversionEvent(
  input: ConversionEventInput,
  context: { userId?: string | null; userAgent?: string | null } = {},
) {
  return prisma.conversionEvent.create({
    data: {
      type: input.type,
      sessionKey: hashConversionSessionKey(input.sessionKey),
      userId: context.userId ?? input.userId ?? null,
      productId: normalizeString(input.productId, 191),
      productSlug: normalizeString(input.productSlug, 120),
      orderId: normalizeString(input.orderId, 191),
      orderNumber: normalizeString(input.orderNumber, 80),
      currency: normalizeString(input.currency, 10) ?? "CAD",
      cartTotalCents: input.cartTotalCents ?? null,
      itemCount: input.itemCount ?? null,
      quantity: input.quantity ?? null,
      paymentMethod: normalizeString(input.paymentMethod, 20),
      deliveryMode: normalizeString(input.deliveryMode, 40),
      language: input.language ?? null,
      device: detectDevice(context.userAgent),
      path: normalizePath(input.path),
      referrerPath: normalizePath(input.referrerPath),
      metadataJson: serializeMetadata(input.metadata),
    },
  });
}

export async function recordOrderCreatedConversion(input: {
  sessionKey?: string | null;
  userId?: string | null;
  orderId: string;
  orderNumber: string;
  totalCents: number;
  itemCount: number;
  paymentMethod: string;
  deliveryMode?: string | null;
  language?: "fr" | "en" | null;
}) {
  const sessionKey = input.sessionKey?.trim() || `order:${input.orderId}`;

  await createConversionEvent({
    type: "ORDER_CREATED",
    sessionKey,
    userId: input.userId ?? null,
    orderId: input.orderId,
    orderNumber: input.orderNumber,
    cartTotalCents: input.totalCents,
    itemCount: input.itemCount,
    paymentMethod: input.paymentMethod,
    deliveryMode: input.deliveryMode,
    language: input.language,
  });
}

function productKey(event: Pick<ConversionEventForSummary, "productId" | "productSlug">) {
  return event.productId ?? event.productSlug ?? null;
}

function productSessionKey(event: Pick<ConversionEventForSummary, "sessionKey" | "productId" | "productSlug">) {
  const key = productKey(event);
  return key ? `${event.sessionKey}:${key}` : null;
}

function upsertProductMetric(
  map: Map<string, ConversionProductMetric>,
  event: ConversionEventForSummary,
  productLabels: Map<string, { nameFr: string; nameEn: string; slug: string }>,
) {
  const key = productKey(event);
  if (!key) return;

  const labels = event.productId ? productLabels.get(event.productId) : null;
  const existing = map.get(key);
  const quantity = Math.max(1, event.quantity ?? 1);

  if (existing) {
    existing.addCount += 1;
    existing.quantity += quantity;
    return;
  }

  map.set(key, {
    key,
    productId: event.productId,
    productSlug: event.productSlug ?? labels?.slug ?? null,
    nameFr: labels?.nameFr ?? event.productSlug ?? key,
    nameEn: labels?.nameEn ?? event.productSlug ?? key,
    addCount: 1,
    quantity,
  });
}

function topMetrics(map: Map<string, ConversionProductMetric>) {
  return Array.from(map.values())
    .sort((left, right) => right.quantity - left.quantity || right.addCount - left.addCount || left.key.localeCompare(right.key))
    .slice(0, 5);
}

function safeCheckoutErrorReason(metadataJson: string | null | undefined) {
  if (!metadataJson) return "unknown";

  try {
    const parsed = JSON.parse(metadataJson) as { reason?: unknown; code?: unknown; step?: unknown };
    const reason = [parsed.reason, parsed.code, parsed.step].find((value) => typeof value === "string" && value.trim().length > 0);
    return typeof reason === "string" ? reason.trim().slice(0, 60) : "unknown";
  } catch {
    return "unknown";
  }
}

function topReasons(map: Map<string, number>) {
  return Array.from(map.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason))
    .slice(0, 5);
}

export function summarizeConversionEvents(
  events: ConversionEventForSummary[],
  productLabels: Map<string, { nameFr: string; nameEn: string; slug: string }> = new Map(),
): ConversionSummary {
  const countByType = (type: ConversionEventType) => events.filter((event) => event.type === type).length;
  const sessionSetByType = (type: ConversionEventType) =>
    new Set(events.filter((event) => event.type === type).map((event) => event.sessionKey));

  const shopSessions = sessionSetByType("SHOP_VIEW");
  const productViewSessions = sessionSetByType("PRODUCT_VIEW");
  const cartAddSessions = sessionSetByType("CART_ADD");
  const checkoutSessions = sessionSetByType("CHECKOUT_START");
  const orderSessions = sessionSetByType("ORDER_CREATED");
  const productViewToCartSessions = new Set(Array.from(productViewSessions).filter((session) => cartAddSessions.has(session)));
  const cartAdds = countByType("CART_ADD");
  const checkoutStarts = checkoutSessions.size;
  const ordersCreated = countByType("ORDER_CREATED");
  const addedProducts = new Map<string, ConversionProductMetric>();
  const abandonedProducts = new Map<string, ConversionProductMetric>();
  const viewedNotAddedProducts = new Map<string, ConversionProductMetric>();
  const cartProductSessionKeys = new Set(
    events
      .filter((event) => event.type === "CART_ADD")
      .map((event) => productSessionKey(event))
      .filter((key): key is string => Boolean(key)),
  );
  const checkoutErrorReasons = new Map<string, number>();

  for (const event of events) {
    if (event.type === "CART_ADD") {
      upsertProductMetric(addedProducts, event, productLabels);
      if (!orderSessions.has(event.sessionKey)) {
        upsertProductMetric(abandonedProducts, event, productLabels);
      }
    }

    if (event.type === "PRODUCT_VIEW") {
      const key = productSessionKey(event);
      if (key && !cartProductSessionKeys.has(key)) {
        upsertProductMetric(viewedNotAddedProducts, { ...event, quantity: 1 }, productLabels);
      }
    }

    if (event.type === "CHECKOUT_ERROR") {
      const reason = safeCheckoutErrorReason(event.metadataJson);
      checkoutErrorReasons.set(reason, (checkoutErrorReasons.get(reason) ?? 0) + 1);
    }
  }

  return {
    shopVisitors: shopSessions.size,
    productViews: countByType("PRODUCT_VIEW"),
    productViewSessions: productViewSessions.size,
    cartAdds,
    cartAddSessions: cartAddSessions.size,
    cartViews: sessionSetByType("CART_VIEW").size,
    checkoutStarts,
    ordersCreated,
    checkoutErrors: countByType("CHECKOUT_ERROR"),
    shopToCartRate: shopSessions.size > 0 ? cartAddSessions.size / shopSessions.size : null,
    productToCartRate: productViewSessions.size > 0 ? productViewToCartSessions.size / productViewSessions.size : null,
    cartToCheckoutRate: cartAddSessions.size > 0 ? checkoutStarts / cartAddSessions.size : null,
    checkoutToOrderRate: checkoutStarts > 0 ? ordersCreated / checkoutStarts : null,
    productViewDropOffCount: Array.from(productViewSessions).filter((session) => !cartAddSessions.has(session)).length,
    cartToCheckoutDropOffCount: Array.from(cartAddSessions).filter((session) => !checkoutSessions.has(session)).length,
    checkoutToOrderDropOffCount: Array.from(checkoutSessions).filter((session) => !orderSessions.has(session)).length,
    topAddedProducts: topMetrics(addedProducts),
    topAbandonedProducts: topMetrics(abandonedProducts),
    topViewedNotAddedProducts: topMetrics(viewedNotAddedProducts),
    checkoutErrorReasons: topReasons(checkoutErrorReasons),
  };
}

function startOfLocalDay() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export async function getConversionDashboardSnapshot(): Promise<ConversionDashboardSnapshot> {
  const now = new Date();
  const todayStart = startOfLocalDay();
  const sevenDaysStart = new Date(now);
  sevenDaysStart.setDate(sevenDaysStart.getDate() - 6);
  sevenDaysStart.setHours(0, 0, 0, 0);

  const events = await prisma.conversionEvent.findMany({
    where: { createdAt: { gte: sevenDaysStart } },
    orderBy: { createdAt: "asc" },
    select: {
      type: true,
      sessionKey: true,
      productId: true,
      productSlug: true,
      quantity: true,
      metadataJson: true,
      createdAt: true,
    },
  });

  const productIds = Array.from(new Set(events.map((event) => event.productId).filter((id): id is string => Boolean(id))));
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, slug: true, nameFr: true, nameEn: true },
      })
    : [];
  const productLabels = new Map(products.map((product) => [product.id, product]));
  const todayEvents = events.filter((event) => event.createdAt >= todayStart);

  return {
    generatedAt: now.toISOString(),
    today: summarizeConversionEvents(todayEvents, productLabels),
    sevenDays: summarizeConversionEvents(events, productLabels),
  };
}
