import { prisma } from "@/lib/prisma";
import {
  getConversionDashboardSnapshot,
  getEmptyConversionDashboardSnapshot,
  type ConversionDashboardSnapshot,
} from "@/lib/conversion-analytics";
import {
  getAdminNotificationOpsSnapshot,
  type AdminNotificationOpsSnapshot,
} from "@/lib/app-notifications";
import { getVariantOptionLabel, type PublicProductVariant } from "@/lib/product-variants";

const OUT_OF_STOCK_THRESHOLD = 0;
const LOW_STOCK_THRESHOLD = 3;

type StockAlertItem = {
  id: string;
  slug: string;
  nameFr: string;
  nameEn: string;
  stock: number;
  variantId?: string | null;
  variantSku?: string | null;
  variantNameFr?: string | null;
  variantNameEn?: string | null;
  isVariant?: boolean;
};

export type OwnerTodaySnapshot = {
  dateKey: string;
  todayOrderCount: number;
  ordersToPrepareCount: number;
  ordersToPrepare: Array<{
    id: string;
    orderNumber: string;
    customerName: string;
    status: string;
    paymentStatus: string;
    totalCents: number;
    currency: string;
    createdAt: Date;
    itemCount: number;
  }>;
  deliveryOrderCount: number;
  deliveryOrders: Array<{
    id: string;
    orderNumber: string;
    customerName: string;
    deliveryStatus: string;
    deliveryWindowStartAt: Date | null;
    deliveryWindowEndAt: Date | null;
    shippingCity: string | null;
    itemCount: number;
  }>;
  openSupportCount: number;
  supportQueue: Array<{
    id: string;
    customerName: string;
    customerEmail: string;
    status: string;
    priority: string;
    lastMessageAt: Date;
    slaDueAt: Date | null;
    orderNumber: string | null;
  }>;
  activeRunCount: number;
  activeRuns: Array<{
    id: string;
    dateKey: string;
    status: string;
    slotStartAt: Date;
    slotEndAt: Date;
    startedAt: Date | null;
    stopCount: number;
  }>;
  todaySalesCents: number;
  outOfStockCount: number;
  outOfStockProducts: StockAlertItem[];
  lowStockCount: number;
  lowStockProducts: StockAlertItem[];
  backup: {
    status: "ok" | "warn" | "unknown";
    label: string;
    latestName: string | null;
    ageHours: number | null;
  };
  conversion: ConversionDashboardSnapshot;
  notifications: AdminNotificationOpsSnapshot;
};

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfLocalDay() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function readBackupSnapshot(): OwnerTodaySnapshot["backup"] {
  return {
    status: "unknown",
    label: "Verifier avec npm run ops:status",
    latestName: null,
    ageHours: null,
  };
}

function sortStockAlertItems(items: StockAlertItem[]) {
  return [...items].sort((a, b) => {
    if (a.stock !== b.stock) return a.stock - b.stock;
    return a.nameFr.localeCompare(b.nameFr, "fr-CA");
  });
}

function getVariantName(variant: PublicProductVariant, language: "fr" | "en") {
  return getVariantOptionLabel(variant, language);
}

async function getStockAlertRows(threshold: number) {
  const variantWhere = {
    isActive: true,
    stock: { lte: threshold },
    product: { isActive: true },
  };
  const simpleProductWhere = {
    isActive: true,
    stock: { lte: threshold },
    variants: { none: {} },
  };

  const [variantCount, variantRows, simpleProductCount, simpleProducts] = await Promise.all([
    prisma.productVariant.count({ where: variantWhere }),
    prisma.productVariant.findMany({
      where: variantWhere,
      orderBy: [{ stock: "asc" }, { updatedAt: "desc" }],
      take: 5,
      select: {
        id: true,
        slug: true,
        sku: true,
        colorNameFr: true,
        colorNameEn: true,
        sizeNameFr: true,
        sizeNameEn: true,
        sizeCode: true,
        stock: true,
        product: {
          select: {
            id: true,
            slug: true,
            nameFr: true,
            nameEn: true,
          },
        },
      },
    }),
    prisma.product.count({ where: simpleProductWhere }),
    prisma.product.findMany({
      where: simpleProductWhere,
      orderBy: [{ stock: "asc" }, { updatedAt: "desc" }],
      take: 5,
      select: {
        id: true,
        slug: true,
        nameFr: true,
        nameEn: true,
        stock: true,
      },
    }),
  ]);

  const variantItems: StockAlertItem[] = variantRows.map((variant) => {
    const variantNameFr = getVariantName(variant, "fr");
    const variantNameEn = getVariantName(variant, "en");

    return {
      id: variant.product.id,
      slug: variant.product.slug,
      nameFr: `${variant.product.nameFr} - ${variantNameFr}`,
      nameEn: `${variant.product.nameEn} - ${variantNameEn}`,
      stock: variant.stock,
      variantId: variant.id,
      variantSku: variant.sku,
      variantNameFr,
      variantNameEn,
      isVariant: true,
    };
  });

  const productItems: StockAlertItem[] = simpleProducts.map((product) => ({
    id: product.id,
    slug: product.slug,
    nameFr: product.nameFr,
    nameEn: product.nameEn,
    stock: product.stock,
    isVariant: false,
  }));

  return {
    count: variantCount + simpleProductCount,
    products: sortStockAlertItems([...variantItems, ...productItems]).slice(0, 5),
  };
}

async function getStockAlertSnapshot() {
  const [outOfStock, lowStock] = await Promise.all([
    getStockAlertRows(OUT_OF_STOCK_THRESHOLD),
    getStockAlertRows(LOW_STOCK_THRESHOLD),
  ]);

  return {
    outOfStockCount: outOfStock.count,
    outOfStockProducts: outOfStock.products,
    lowStockCount: lowStock.count,
    lowStockProducts: lowStock.products,
  };
}

export async function getOwnerTodaySnapshot(): Promise<OwnerTodaySnapshot> {
  const startOfDay = startOfLocalDay();
  const dateKey = localDateKey(startOfDay);

  const [
    todayOrderCount,
    ordersToPrepareCount,
    ordersToPrepare,
    deliveryOrderCount,
    deliveryOrders,
    openSupportCount,
    supportQueue,
    activeRunCount,
    activeRuns,
    todaySales,
    stockAlerts,
    conversion,
    notifications,
  ] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.order.count({
      where: {
        status: { in: ["PENDING", "PAID", "PROCESSING"] },
      },
    }),
    prisma.order.findMany({
      where: {
        status: { in: ["PENDING", "PAID", "PROCESSING"] },
      },
      orderBy: [{ createdAt: "asc" }],
      take: 5,
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        status: true,
        paymentStatus: true,
        totalCents: true,
        currency: true,
        createdAt: true,
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({
      where: {
        deliveryStatus: { in: ["SCHEDULED", "OUT_FOR_DELIVERY"] },
      },
    }),
    prisma.order.findMany({
      where: {
        deliveryStatus: { in: ["SCHEDULED", "OUT_FOR_DELIVERY"] },
      },
      orderBy: [{ deliveryWindowStartAt: "asc" }, { createdAt: "asc" }],
      take: 5,
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        deliveryStatus: true,
        deliveryWindowStartAt: true,
        deliveryWindowEndAt: true,
        shippingCity: true,
        _count: { select: { items: true } },
      },
    }),
    prisma.supportConversation.count({
      where: { status: { in: ["WAITING", "OPEN", "ASSIGNED"] } },
    }),
    prisma.supportConversation.findMany({
      where: { status: { in: ["WAITING", "OPEN", "ASSIGNED"] } },
      orderBy: [{ slaDueAt: "asc" }, { lastMessageAt: "asc" }],
      take: 5,
      select: {
        id: true,
        customerName: true,
        customerEmail: true,
        status: true,
        priority: true,
        lastMessageAt: true,
        slaDueAt: true,
        order: {
          select: {
            orderNumber: true,
          },
        },
      },
    }),
    prisma.deliveryRun.count({
      where: { status: { in: ["PUBLISHED", "IN_PROGRESS"] } },
    }),
    prisma.deliveryRun.findMany({
      where: { status: { in: ["PUBLISHED", "IN_PROGRESS"] } },
      orderBy: [{ dateKey: "asc" }, { updatedAt: "desc" }],
      take: 5,
      select: {
        id: true,
        dateKey: true,
        status: true,
        startedAt: true,
        deliverySlot: {
          select: {
            startAt: true,
            endAt: true,
          },
        },
        _count: { select: { stops: true } },
      },
    }),
    prisma.order.aggregate({
      where: {
        createdAt: { gte: startOfDay },
        status: { not: "CANCELLED" },
      },
      _sum: { totalCents: true },
    }),
    getStockAlertSnapshot(),
    getConversionDashboardSnapshot().catch(() => getEmptyConversionDashboardSnapshot()),
    getAdminNotificationOpsSnapshot().catch(() => ({
      recent: [],
      unreadCount: 0,
      disabledPushSubscriptionCount: 0,
    })),
  ]);

  return {
    dateKey,
    todayOrderCount,
    ordersToPrepareCount,
    ordersToPrepare: ordersToPrepare.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      status: order.status,
      paymentStatus: order.paymentStatus,
      totalCents: order.totalCents,
      currency: order.currency,
      createdAt: order.createdAt,
      itemCount: order._count.items,
    })),
    deliveryOrderCount,
    deliveryOrders: deliveryOrders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      deliveryStatus: order.deliveryStatus,
      deliveryWindowStartAt: order.deliveryWindowStartAt,
      deliveryWindowEndAt: order.deliveryWindowEndAt,
      shippingCity: order.shippingCity,
      itemCount: order._count.items,
    })),
    openSupportCount,
    supportQueue: supportQueue.map((conversation) => ({
      id: conversation.id,
      customerName: conversation.customerName,
      customerEmail: conversation.customerEmail,
      status: conversation.status,
      priority: conversation.priority,
      lastMessageAt: conversation.lastMessageAt,
      slaDueAt: conversation.slaDueAt,
      orderNumber: conversation.order?.orderNumber ?? null,
    })),
    activeRunCount,
    activeRuns: activeRuns.map((run) => ({
      id: run.id,
      dateKey: run.dateKey,
      status: run.status,
      slotStartAt: run.deliverySlot.startAt,
      slotEndAt: run.deliverySlot.endAt,
      startedAt: run.startedAt,
      stopCount: run._count.stops,
    })),
    todaySalesCents: todaySales._sum.totalCents ?? 0,
    outOfStockCount: stockAlerts.outOfStockCount,
    outOfStockProducts: stockAlerts.outOfStockProducts,
    lowStockCount: stockAlerts.lowStockCount,
    lowStockProducts: stockAlerts.lowStockProducts,
    backup: readBackupSnapshot(),
    conversion,
    notifications,
  };
}
