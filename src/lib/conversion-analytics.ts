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

export type ConversionSummary = {
  shopVisitors: number;
  productViews: number;
  cartAdds: number;
  cartViews: number;
  checkoutStarts: number;
  ordersCreated: number;
  checkoutErrors: number;
  cartToCheckoutRate: number | null;
  checkoutToOrderRate: number | null;
  topAddedProducts: ConversionProductMetric[];
  topAbandonedProducts: ConversionProductMetric[];
};

export type ConversionDashboardSnapshot = {
  generatedAt: string;
  today: ConversionSummary;
  sevenDays: ConversionSummary;
};

const EMPTY_SUMMARY: ConversionSummary = {
  shopVisitors: 0,
  productViews: 0,
  cartAdds: 0,
  cartViews: 0,
  checkoutStarts: 0,
  ordersCreated: 0,
  checkoutErrors: 0,
  cartToCheckoutRate: null,
  checkoutToOrderRate: null,
  topAddedProducts: [],
  topAbandonedProducts: [],
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

export function summarizeConversionEvents(
  events: ConversionEventForSummary[],
  productLabels: Map<string, { nameFr: string; nameEn: string; slug: string }> = new Map(),
): ConversionSummary {
  const countByType = (type: ConversionEventType) => events.filter((event) => event.type === type).length;
  const uniqueSessionsByType = (type: ConversionEventType) =>
    new Set(events.filter((event) => event.type === type).map((event) => event.sessionKey)).size;

  const cartAdds = countByType("CART_ADD");
  const checkoutStarts = uniqueSessionsByType("CHECKOUT_START");
  const ordersCreated = countByType("ORDER_CREATED");
  const orderSessions = new Set(events.filter((event) => event.type === "ORDER_CREATED").map((event) => event.sessionKey));
  const addedProducts = new Map<string, ConversionProductMetric>();
  const abandonedProducts = new Map<string, ConversionProductMetric>();

  for (const event of events) {
    if (event.type !== "CART_ADD") continue;
    upsertProductMetric(addedProducts, event, productLabels);
    if (!orderSessions.has(event.sessionKey)) {
      upsertProductMetric(abandonedProducts, event, productLabels);
    }
  }

  return {
    shopVisitors: uniqueSessionsByType("SHOP_VIEW"),
    productViews: countByType("PRODUCT_VIEW"),
    cartAdds,
    cartViews: uniqueSessionsByType("CART_VIEW"),
    checkoutStarts,
    ordersCreated,
    checkoutErrors: countByType("CHECKOUT_ERROR"),
    cartToCheckoutRate: cartAdds > 0 ? checkoutStarts / cartAdds : null,
    checkoutToOrderRate: checkoutStarts > 0 ? ordersCreated / checkoutStarts : null,
    topAddedProducts: topMetrics(addedProducts),
    topAbandonedProducts: topMetrics(abandonedProducts),
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
