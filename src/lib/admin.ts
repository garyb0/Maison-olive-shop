import { prisma } from "@/lib/prisma";
import type { OrderStatus } from "@/lib/types";

type OrdersFilter = {
  status?: OrderStatus;
  customer?: string;
};

export async function getAdminOrders(filter: OrdersFilter) {
  return prisma.order.findMany({
    where: {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.customer
        ? {
            OR: [
              { customerEmail: { contains: filter.customer } },
              { customerName: { contains: filter.customer } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      user: true,
      items: {
        include: { product: true },
      },
    },
  });
}

export async function getAdminCustomers(search?: string) {
  return prisma.user.findMany({
    where: {
      ...(search
        ? {
            OR: [
              { email: { contains: search } },
              { firstName: { contains: search } },
              { lastName: { contains: search } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });
}

export async function getTaxReport(start?: Date, end?: Date) {
  const where = {
    ...(start || end
      ? {
          createdAt: {
            ...(start ? { gte: start } : {}),
            ...(end ? { lte: end } : {}),
          },
        }
      : {}),
  };

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      orderNumber: true,
      createdAt: true,
      customerEmail: true,
      subtotalCents: true,
      discountCents: true,
      taxCents: true,
      shippingCents: true,
      refundedCents: true,
      totalCents: true,
      paymentStatus: true,
      status: true,
    },
  });

  type TaxOrder = (typeof orders)[number];

  type Totals = {
    subtotalCents: number;
    discountCents: number;
    taxCents: number;
    shippingCents: number;
    refundedCents: number;
    totalCents: number;
  };

  const summary = orders.reduce<Totals>(
    (acc: Totals, order: TaxOrder) => {
      acc.subtotalCents += order.subtotalCents;
      acc.discountCents += order.discountCents;
      acc.taxCents += order.taxCents;
      acc.shippingCents += order.shippingCents;
      acc.refundedCents += order.refundedCents;
      acc.totalCents += order.totalCents;
      return acc;
    },
    {
      subtotalCents: 0,
      discountCents: 0,
      taxCents: 0,
      shippingCents: 0,
      refundedCents: 0,
      totalCents: 0,
    },
  );

  return { summary, orders };
}

export function taxReportToCsv(
  orders: Array<{
    orderNumber: string;
    createdAt: Date;
    customerEmail: string;
    subtotalCents: number;
    discountCents: number;
    taxCents: number;
    shippingCents: number;
    refundedCents: number;
    totalCents: number;
    paymentStatus: string;
    status: string;
  }>,
) {
  const header = [
    "order_number",
    "created_at",
    "customer_email",
    "subtotal_cents",
    "discount_cents",
    "tax_cents",
    "shipping_cents",
    "refunded_cents",
    "total_cents",
    "payment_status",
    "order_status",
  ];

  const rows = orders.map((order) => [
    order.orderNumber,
    order.createdAt.toISOString(),
    order.customerEmail,
    String(order.subtotalCents),
    String(order.discountCents),
    String(order.taxCents),
    String(order.shippingCents),
    String(order.refundedCents),
    String(order.totalCents),
    order.paymentStatus,
    order.status,
  ]);

  return [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
}
