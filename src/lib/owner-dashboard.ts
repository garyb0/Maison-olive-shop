import { prisma } from "@/lib/prisma";

export type OwnerTodaySnapshot = {
  dateKey: string;
  todayOrderCount: number;
  ordersToPrepareCount: number;
  deliveryOrderCount: number;
  openSupportCount: number;
  activeRunCount: number;
  todaySalesCents: number;
  lowStockCount: number;
  lowStockProducts: Array<{
    id: string;
    slug: string;
    nameFr: string;
    nameEn: string;
    stock: number;
  }>;
  backup: {
    status: "ok" | "warn" | "unknown";
    label: string;
    latestName: string | null;
    ageHours: number | null;
  };
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

export async function getOwnerTodaySnapshot(): Promise<OwnerTodaySnapshot> {
  const startOfDay = startOfLocalDay();
  const dateKey = localDateKey(startOfDay);

  const [
    todayOrderCount,
    ordersToPrepareCount,
    deliveryOrderCount,
    openSupportCount,
    activeRunCount,
    todaySales,
    lowStockCount,
    lowStockProducts,
  ] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.order.count({
      where: {
        status: { in: ["PENDING", "PAID", "PROCESSING"] },
      },
    }),
    prisma.order.count({
      where: {
        deliveryStatus: { in: ["SCHEDULED", "OUT_FOR_DELIVERY"] },
      },
    }),
    prisma.supportConversation.count({
      where: { status: { in: ["WAITING", "OPEN", "ASSIGNED"] } },
    }),
    prisma.deliveryRun.count({
      where: { status: { in: ["PUBLISHED", "IN_PROGRESS"] } },
    }),
    prisma.order.aggregate({
      where: {
        createdAt: { gte: startOfDay },
        status: { not: "CANCELLED" },
      },
      _sum: { totalCents: true },
    }),
    prisma.product.count({
      where: { isActive: true, stock: { lte: 3 } },
    }),
    prisma.product.findMany({
      where: { isActive: true, stock: { lte: 3 } },
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

  return {
    dateKey,
    todayOrderCount,
    ordersToPrepareCount,
    deliveryOrderCount,
    openSupportCount,
    activeRunCount,
    todaySalesCents: todaySales._sum.totalCents ?? 0,
    lowStockCount,
    lowStockProducts,
    backup: readBackupSnapshot(),
  };
}
