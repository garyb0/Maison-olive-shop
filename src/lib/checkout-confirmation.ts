import type { Order, OrderItem } from "@prisma/client";
import type { CheckoutConfirmation } from "@/lib/types";
import { prisma } from "@/lib/prisma";
import { computeStoredOrderTaxBreakdown } from "@/lib/taxes";

type CheckoutConfirmationOrder = Order & {
  items: OrderItem[];
};

export function buildCheckoutConfirmation(order: CheckoutConfirmationOrder): CheckoutConfirmation {
  const taxSummary = computeStoredOrderTaxBreakdown(
    order.subtotalCents,
    order.discountCents,
    order.shippingCents,
  );

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    registerEmail: order.customerEmail,
    paymentMode: order.paymentMethod === "MANUAL" ? "manual" : "stripe",
    orderCreatedAt: order.createdAt.toISOString(),
    currency: order.currency,
    subtotalCents: order.subtotalCents,
    discountCents: order.discountCents,
    shippingCents: order.shippingCents,
    gstCents: taxSummary.gstCents,
    qstCents: taxSummary.qstCents,
    taxCents: order.taxCents,
    totalCents: order.totalCents,
    items: order.items.map((item) => ({
      id: item.id,
      nameFr: item.productNameSnapshotFr,
      nameEn: item.productNameSnapshotEn,
      quantity: item.quantity,
      lineTotalCents: item.lineTotalCents,
    })),
  };
}

export async function getCheckoutConfirmationByOrderId(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  return order ? buildCheckoutConfirmation(order) : null;
}

export async function getCheckoutConfirmation(orderNumber: string, registerEmail: string) {
  if (!orderNumber.trim() || !registerEmail.trim()) {
    return null;
  }

  const order = await prisma.order.findFirst({
    where: {
      orderNumber: orderNumber.trim(),
      customerEmail: registerEmail.trim(),
    },
    include: { items: true },
  });

  return order ? buildCheckoutConfirmation(order) : null;
}
