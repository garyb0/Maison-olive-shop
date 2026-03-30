import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPromoDiscountCents } from "@/lib/promo";
import { computeOrderAmounts } from "@/lib/taxes";
import { sendOrderConfirmationEmail } from "@/lib/business";
import { stripe, stripeEnabled } from "@/lib/stripe";
import type { PaymentMethod } from "@/lib/types";
import { isRimouskiDeliveryAddress } from "@/lib/delivery-zone";

type CheckoutItem = {
  productId: string;
  quantity: number;
};

type CreateOrderInput = {
  userId: string;
  customerEmail: string;
  customerName: string;
  paymentMethod: PaymentMethod;
  promoCode?: string;
  items: CheckoutItem[];
  shippingLine1?: string;
  shippingCity?: string;
  shippingRegion?: string;
  shippingPostal?: string;
  shippingCountry?: string;
};

const nextOrderNumber = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const random = Math.floor(1000 + Math.random() * 9000);
  return `MO-${yyyy}${mm}${dd}-${random}`;
};

// CRITICAL DATA SAFETY NOTE (FR/EN)
// FR: Cette fonction utilise une transaction pour protéger commandes + inventaire.
// EN: This function uses a transaction to protect orders + inventory.
export async function createOrderSafely(input: CreateOrderInput) {
  if (!input.items.length) {
    throw new Error("EMPTY_CART");
  }

  if (
    !isRimouskiDeliveryAddress({
      postalCode: input.shippingPostal,
      country: input.shippingCountry,
    })
  ) {
    throw new Error("OUTSIDE_DELIVERY_ZONE");
  }

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const products = await tx.product.findMany({
      where: {
        id: { in: input.items.map((item) => item.productId) },
        isActive: true,
      },
      select: {
        id: true,
        priceCents: true,
        stock: true,
        nameFr: true,
        nameEn: true,
      },
    });

    const map = new Map(products.map((p) => [p.id, p] as const));

    for (const item of input.items) {
      const product = map.get(item.productId);
      if (!product) throw new Error("PRODUCT_NOT_FOUND");
      if (item.quantity <= 0) throw new Error("INVALID_QUANTITY");
      if (product.stock < item.quantity) throw new Error("INSUFFICIENT_STOCK");
    }

    const subtotalCents = input.items.reduce((sum, item) => {
      const product = map.get(item.productId)!;
      return sum + product.priceCents * item.quantity;
    }, 0);

    const discountCents = getPromoDiscountCents(subtotalCents, input.promoCode);
    const amounts = computeOrderAmounts(subtotalCents, discountCents);

    const order = await tx.order.create({
      data: {
        orderNumber: nextOrderNumber(),
        userId: input.userId,
        customerEmail: input.customerEmail,
        customerName: input.customerName,
        paymentMethod: input.paymentMethod,
        paymentProvider: input.paymentMethod === "STRIPE" ? "stripe" : "manual",
        subtotalCents: amounts.subtotalCents,
        discountCents: amounts.discountCents,
        taxCents: amounts.taxCents,
        shippingCents: amounts.shippingCents,
        totalCents: amounts.totalCents,
        currency: "CAD",
        shippingLine1: input.shippingLine1,
        shippingCity: input.shippingCity,
        shippingRegion: input.shippingRegion,
        shippingPostal: input.shippingPostal,
        shippingCountry: input.shippingCountry,
      },
    });

    for (const item of input.items) {
      const product = map.get(item.productId)!;

      await tx.orderItem.create({
        data: {
          orderId: order.id,
          productId: product.id,
          quantity: item.quantity,
          unitPriceCents: product.priceCents,
          lineTotalCents: product.priceCents * item.quantity,
          productNameSnapshotFr: product.nameFr,
          productNameSnapshotEn: product.nameEn,
        },
      });

      await tx.product.update({
        where: { id: product.id },
        data: { stock: { decrement: item.quantity } },
      });

      await tx.inventoryMovement.create({
        data: {
          productId: product.id,
          orderId: order.id,
          quantityChange: -item.quantity,
          reason: "ORDER_PLACED",
        },
      });
    }

    await tx.auditLog.create({
      data: {
        actorUserId: input.userId,
        action: "ORDER_CREATED",
        entity: "Order",
        entityId: order.id,
        metadata: JSON.stringify({
          paymentMethod: input.paymentMethod,
          itemCount: input.items.length,
        }),
      },
    });

    return order;
  });
}

export async function getOrdersForUser(userId: string) {
  return prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
  });
}

export async function getOrderByIdForUser(orderId: string, userId: string) {
  return prisma.order.findFirst({
    where: { id: orderId, userId },
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
  });
}

export async function reorderFromOrder(orderId: string, userId: string) {
  const baseOrder = await prisma.order.findFirst({
    where: { id: orderId, userId },
    select: {
      customerEmail: true,
      customerName: true,
      shippingLine1: true,
      shippingCity: true,
      shippingRegion: true,
      shippingPostal: true,
      shippingCountry: true,
      items: {
        select: {
          productId: true,
          quantity: true,
        },
      },
    },
  });

  if (!baseOrder) throw new Error("ORDER_NOT_FOUND");

  return createOrderSafely({
    userId,
    customerEmail: baseOrder.customerEmail,
    customerName: baseOrder.customerName,
    paymentMethod: "MANUAL",
    items: baseOrder.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    })),
    shippingLine1: baseOrder.shippingLine1 ?? undefined,
    shippingCity: baseOrder.shippingCity ?? undefined,
    shippingRegion: baseOrder.shippingRegion ?? undefined,
    shippingPostal: baseOrder.shippingPostal ?? undefined,
    shippingCountry: baseOrder.shippingCountry ?? undefined,
  });
}

export async function syncOrderPaymentFromStripeSessionForUser(sessionId: string, userId: string) {
  if (!stripeEnabled || !stripe) {
    return;
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const orderId = session.client_reference_id ?? session.metadata?.orderId;

  if (!orderId || session.payment_status !== "paid") {
    return;
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: { user: true },
  });

  if (!order) {
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.updateMany({
      where: { id: order.id, paymentStatus: "PENDING" },
      data: {
        paymentStatus: "PAID",
        status: "PAID",
        stripeSessionId: session.id,
      },
    });

    if (updated.count === 0) {
      return { transitionedToPaid: false };
    }

    await tx.auditLog.create({
      data: {
        actorUserId: order.userId,
        action: "STRIPE_CHECKOUT_SUCCESS_SYNC",
        entity: "Order",
        entityId: order.id,
        metadata: JSON.stringify({ sessionId: session.id, source: "success_url" }),
      },
    });

    return { transitionedToPaid: true };
  });

  if (!result.transitionedToPaid) {
    return;
  }

  await sendOrderConfirmationEmail({
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    totalCents: order.totalCents,
    currency: order.currency,
    language: order.user.language === "en" ? "en" : "fr",
  });
}
