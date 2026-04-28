import type { Prisma } from "@prisma/client";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { resolvePromoCodeDiscount } from "@/lib/promo";
import { getHiddenStorefrontProductSlugs } from "@/lib/launch-guards";
import { computeOrderAmounts } from "@/lib/taxes";
import { sendOrderConfirmationEmail } from "@/lib/business";
import { stripe, stripeEnabled } from "@/lib/stripe";
import type { PaymentMethod } from "@/lib/types";
import { isRimouskiDeliveryAddress } from "@/lib/delivery-zone";
import { resolveDeliverySelectionForOrder } from "@/lib/delivery";
import {
  assertDeliveryAddressComplete,
  createDeliveryAddressForUser,
  DeliveryAddressLimitError,
  findMatchingDeliveryAddressForUser,
  getDeliveryAddressForUser,
  markDeliveryAddressUsed,
  normalizeDeliveryAddressInput,
} from "@/lib/delivery-addresses";

type CheckoutItem = {
  productId: string;
  quantity: number;
};

type CreateOrderInput = {
  userId?: string | null;
  customerEmail: string;
  customerName: string;
  paymentMethod: PaymentMethod;
  promoCode?: string;
  items: CheckoutItem[];
  deliveryAddressId?: string;
  deliveryAddressLabel?: string;
  saveDeliveryAddress?: boolean;
  shippingLine1?: string;
  shippingCity?: string;
  shippingRegion?: string;
  shippingPostal?: string;
  shippingCountry?: string;
  deliverySlotId?: string;
  deliveryWindowStartAt?: string;
  deliveryWindowEndAt?: string;
  deliveryInstructions?: string;
  deliveryPhone?: string;
};

type EffectiveDeliveryAddress = {
  shippingLine1: string;
  shippingCity: string;
  shippingRegion: string;
  shippingPostal: string;
  shippingCountry: string;
  deliveryPhone?: string;
  deliveryInstructions?: string;
};

const normalizeOrderAddress = (input: EffectiveDeliveryAddress) => normalizeDeliveryAddressInput({
  label: "temp",
  shippingLine1: input.shippingLine1,
  shippingCity: input.shippingCity,
  shippingRegion: input.shippingRegion,
  shippingPostal: input.shippingPostal,
  shippingCountry: input.shippingCountry,
  deliveryPhone: input.deliveryPhone,
  deliveryInstructions: input.deliveryInstructions,
});

const getDefaultDeliveryAddressLabel = (input: EffectiveDeliveryAddress) =>
  input.shippingLine1.trim() || input.shippingCity.trim() || "Adresse";

const normalizeDeliveryPhone = (value: string) => value.replace(/\D/g, "");

const isValidDeliveryPhone = (value: string) => {
  if (!value.trim()) return false;
  const digits = normalizeDeliveryPhone(value);
  return digits.length === 10 || (digits.length === 11 && digits.startsWith("1"));
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

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const savedAddress = input.userId && input.deliveryAddressId
      ? await getDeliveryAddressForUser(input.userId, input.deliveryAddressId, tx)
      : null;
    const effectiveAddress = normalizeOrderAddress({
      shippingLine1: input.shippingLine1?.trim() || savedAddress?.shippingLine1 || "",
      shippingCity: input.shippingCity?.trim() || savedAddress?.shippingCity || "",
      shippingRegion: input.shippingRegion?.trim() || savedAddress?.shippingRegion || "",
      shippingPostal: input.shippingPostal?.trim() || savedAddress?.shippingPostal || "",
      shippingCountry: input.shippingCountry?.trim() || savedAddress?.shippingCountry || "CA",
      deliveryPhone: input.deliveryPhone?.trim() || savedAddress?.deliveryPhone || undefined,
      deliveryInstructions: input.deliveryInstructions?.trim() || savedAddress?.deliveryInstructions || undefined,
    });

    assertDeliveryAddressComplete(effectiveAddress);

    if (
      !isRimouskiDeliveryAddress({
        postalCode: effectiveAddress.shippingPostal,
        country: effectiveAddress.shippingCountry,
      })
    ) {
      throw new Error("OUTSIDE_DELIVERY_ZONE");
    }

    const savedAddressComparable = savedAddress
      ? normalizeOrderAddress({
          shippingLine1: savedAddress.shippingLine1,
          shippingCity: savedAddress.shippingCity,
          shippingRegion: savedAddress.shippingRegion,
          shippingPostal: savedAddress.shippingPostal,
          shippingCountry: savedAddress.shippingCountry,
          deliveryPhone: savedAddress.deliveryPhone ?? undefined,
          deliveryInstructions: savedAddress.deliveryInstructions ?? undefined,
        })
      : null;
    const selectedAddressChanged = savedAddressComparable
      ? (
          savedAddressComparable.shippingLine1 !== effectiveAddress.shippingLine1 ||
          savedAddressComparable.shippingCity !== effectiveAddress.shippingCity ||
          savedAddressComparable.shippingRegion !== effectiveAddress.shippingRegion ||
          savedAddressComparable.shippingPostal !== effectiveAddress.shippingPostal ||
          savedAddressComparable.shippingCountry !== effectiveAddress.shippingCountry ||
          (savedAddressComparable.deliveryPhone ?? undefined) !== (effectiveAddress.deliveryPhone ?? undefined) ||
          (savedAddressComparable.deliveryInstructions ?? undefined) !== (effectiveAddress.deliveryInstructions ?? undefined)
        )
      : false;

    const deliverySelection = await resolveDeliverySelectionForOrder(tx, {
      deliverySlotId: input.deliverySlotId,
      deliveryWindowStartAt: input.deliveryWindowStartAt ? new Date(input.deliveryWindowStartAt) : undefined,
      deliveryWindowEndAt: input.deliveryWindowEndAt ? new Date(input.deliveryWindowEndAt) : undefined,
    });

    if (effectiveAddress.deliveryPhone && !isValidDeliveryPhone(effectiveAddress.deliveryPhone)) {
      throw new Error("INVALID_DELIVERY_PHONE");
    }

    // Vérification atomique de la capacité du créneau de livraison
    if (!deliverySelection.deliverySlotId && !effectiveAddress.deliveryPhone?.trim()) {
      throw new Error("DELIVERY_PHONE_REQUIRED");
    }

    if (deliverySelection.deliverySlotId) {
      // Récupérer la capacité du créneau
      const slot = await tx.deliverySlot.findUnique({
        where: { id: deliverySelection.deliverySlotId },
        select: { capacity: true },
      });
      if (!slot) throw new Error("DELIVERY_SLOT_NOT_FOUND");

      // Compter les réservations existantes
      const reservedCount = await tx.order.count({
        where: {
          deliverySlotId: deliverySelection.deliverySlotId,
          status: { not: "CANCELLED" },
          paymentStatus: { not: "FAILED" },
        },
      });
      if (reservedCount >= slot.capacity) {
        throw new Error("DELIVERY_SLOT_FULL");
      }
    }

    const products = await tx.product.findMany({
      where: {
        id: { in: input.items.map((item) => item.productId) },
        isActive: true,
        slug: { notIn: getHiddenStorefrontProductSlugs() },
      },
      select: {
        id: true,
        slug: true,
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

    const promo = await resolvePromoCodeDiscount(subtotalCents, input.promoCode);
    const amounts = computeOrderAmounts(subtotalCents, promo.discountCents);

    const order = await tx.order.create({
      data: {
        orderNumber: nextOrderNumber(),
        userId: input.userId ?? undefined,
        customerEmail: input.customerEmail,
        customerName: input.customerName,
        promoCode: promo.appliedCode,
        paymentMethod: input.paymentMethod,
        paymentProvider: input.paymentMethod === "STRIPE" ? "stripe" : "manual",
        subtotalCents: amounts.subtotalCents,
        discountCents: amounts.discountCents,
        taxCents: amounts.taxCents,
        shippingCents: amounts.shippingCents,
        totalCents: amounts.totalCents,
        currency: "CAD",
        shippingLine1: effectiveAddress.shippingLine1,
        shippingCity: effectiveAddress.shippingCity,
        shippingRegion: effectiveAddress.shippingRegion,
        shippingPostal: effectiveAddress.shippingPostal,
        shippingCountry: effectiveAddress.shippingCountry,
        deliverySlotId: deliverySelection.deliverySlotId,
        deliveryWindowStartAt: deliverySelection.deliveryWindowStartAt,
        deliveryWindowEndAt: deliverySelection.deliveryWindowEndAt,
        deliveryStatus: deliverySelection.deliveryStatus,
        deliveryInstructions: effectiveAddress.deliveryInstructions,
        deliveryPhone: effectiveAddress.deliveryPhone,
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
        actorUserId: input.userId ?? null,
        action: "ORDER_CREATED",
        entity: "Order",
        entityId: order.id,
        metadata: JSON.stringify({
          paymentMethod: input.paymentMethod,
          itemCount: input.items.length,
          deliverySlotId: deliverySelection.deliverySlotId,
          promoCode: promo.appliedCode,
        }),
      },
    });

    if (input.userId && savedAddress && !selectedAddressChanged) {
      await markDeliveryAddressUsed(input.userId, savedAddress.id, tx);
    } else if (input.userId && input.saveDeliveryAddress) {
      const matchingAddress = await findMatchingDeliveryAddressForUser(
        input.userId,
        {
          shippingLine1: effectiveAddress.shippingLine1,
          shippingCity: effectiveAddress.shippingCity,
          shippingRegion: effectiveAddress.shippingRegion,
          shippingPostal: effectiveAddress.shippingPostal,
          shippingCountry: effectiveAddress.shippingCountry,
        },
        tx,
      );

      if (matchingAddress) {
        await markDeliveryAddressUsed(input.userId, matchingAddress.id, tx);
      } else {
        try {
          const createdAddress = await createDeliveryAddressForUser(
            input.userId,
            {
              label: input.deliveryAddressLabel?.trim() || getDefaultDeliveryAddressLabel(effectiveAddress),
              shippingLine1: effectiveAddress.shippingLine1,
              shippingCity: effectiveAddress.shippingCity,
              shippingRegion: effectiveAddress.shippingRegion,
              shippingPostal: effectiveAddress.shippingPostal,
              shippingCountry: effectiveAddress.shippingCountry,
              deliveryPhone: effectiveAddress.deliveryPhone,
              deliveryInstructions: effectiveAddress.deliveryInstructions,
            },
            tx,
          );
          await markDeliveryAddressUsed(input.userId, createdAddress.id, tx);
        } catch (error) {
          if (!(error instanceof DeliveryAddressLimitError)) {
            throw error;
          }
        }
      }
    }

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
  return markOrderPaidFromStripeSession(session, "success_url", userId);
}

export async function syncOrderPaymentFromStripeSession(sessionId: string, expectedUserId?: string) {
  if (!stripeEnabled || !stripe) {
    return;
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  return markOrderPaidFromStripeSession(session, "return_url", expectedUserId);
}

const getStripeOrderIdFromSession = (session: Stripe.Checkout.Session) =>
  session.client_reference_id ?? session.metadata?.orderId ?? null;

export async function markOrderPaidFromStripeSession(
  session: Stripe.Checkout.Session,
  source: string,
  expectedUserId?: string,
) {
  const orderId = getStripeOrderIdFromSession(session);

  if (!orderId || session.payment_status !== "paid") {
    return { orderId, transitionedToPaid: false, reason: "NOT_PAID_OR_MISSING_ORDER" as const };
  }

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      ...(expectedUserId ? { userId: expectedUserId } : {}),
    },
    include: {
      user: true,
      items: true,
    },
  });

  if (!order) {
    return { orderId, transitionedToPaid: false, reason: "ORDER_NOT_FOUND" as const };
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
        action: "STRIPE_ORDER_PAID",
        entity: "Order",
        entityId: order.id,
        metadata: JSON.stringify({
          sessionId: session.id,
          source,
          paymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id,
          totalCents: order.totalCents,
        }),
      },
    });

    return { transitionedToPaid: true };
  });

  if (!result.transitionedToPaid) {
    return { orderId: order.id, transitionedToPaid: false, reason: "ALREADY_FINALIZED" as const };
  }

  await sendOrderConfirmationEmail({
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    orderCreatedAt: order.createdAt,
    subtotalCents: order.subtotalCents,
    discountCents: order.discountCents,
    shippingCents: order.shippingCents,
    totalCents: order.totalCents,
    currency: order.currency,
    language: (order.user?.language === "en" || session.metadata?.customerLanguage === "en") ? "en" : "fr",
    paymentMethod: order.paymentMethod,
    deliveryStatus: order.deliveryStatus,
    shippingLine1: order.shippingLine1,
    shippingCity: order.shippingCity,
    shippingRegion: order.shippingRegion,
    shippingPostal: order.shippingPostal,
    shippingCountry: order.shippingCountry,
    deliveryPhone: order.deliveryPhone,
    deliveryInstructions: order.deliveryInstructions,
    deliveryWindowStartAt: order.deliveryWindowStartAt,
    deliveryWindowEndAt: order.deliveryWindowEndAt,
    items: order.items.map((item) => ({
        name: (order.user?.language === "en" || session.metadata?.customerLanguage === "en")
          ? item.productNameSnapshotEn
          : item.productNameSnapshotFr,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      lineTotalCents: item.lineTotalCents,
    })),
  });

  return { orderId: order.id, transitionedToPaid: true };
}

const restockReasonForStripeFailure = (source: string) =>
  source === "checkout.session.expired"
    ? "STRIPE_CHECKOUT_EXPIRED_RESTOCK"
    : "STRIPE_PAYMENT_FAILED_RESTOCK";

export async function markOrderStripePaymentFailed(orderId: string, source: string, stripeSessionId?: string | null) {
  if (!orderId) {
    return { orderId, transitionedToFailed: false, reason: "MISSING_ORDER" as const };
  }

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        paymentStatus: true,
        status: true,
        stripeSessionId: true,
        items: {
          select: {
            productId: true,
            quantity: true,
          },
        },
      },
    });

    if (!order) {
      return { orderId, transitionedToFailed: false, reason: "ORDER_NOT_FOUND" as const };
    }

    if (order.paymentStatus !== "PENDING") {
      return { orderId, transitionedToFailed: false, reason: "ALREADY_FINALIZED" as const };
    }

    const updated = await tx.order.updateMany({
      where: { id: order.id, paymentStatus: "PENDING" },
      data: {
        paymentStatus: "FAILED",
        stripeSessionId: stripeSessionId ?? order.stripeSessionId,
      },
    });

    if (updated.count === 0) {
      return { orderId, transitionedToFailed: false, reason: "ALREADY_FINALIZED" as const };
    }

    const restockReason = restockReasonForStripeFailure(source);

    for (const item of order.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });

      await tx.inventoryMovement.create({
        data: {
          productId: item.productId,
          orderId: order.id,
          quantityChange: item.quantity,
          reason: restockReason,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        actorUserId: order.userId,
        action: "STRIPE_ORDER_PAYMENT_FAILED",
        entity: "Order",
        entityId: order.id,
        metadata: JSON.stringify({
          source,
          sessionId: stripeSessionId ?? order.stripeSessionId,
          from: "PENDING",
          to: "FAILED",
        }),
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: order.userId,
        action: "STRIPE_ORDER_RESTOCKED",
        entity: "Order",
        entityId: order.id,
        metadata: JSON.stringify({
          source,
          reason: restockReason,
          itemCount: order.items.length,
          quantity: order.items.reduce((sum, item) => sum + item.quantity, 0),
        }),
      },
    });

    return { orderId: order.id, transitionedToFailed: true };
  });
}

export async function markOrderStripeCheckoutExpired(session: Stripe.Checkout.Session, source = "checkout.session.expired") {
  const orderId = getStripeOrderIdFromSession(session);
  if (!orderId) {
    return { orderId, transitionedToFailed: false, reason: "MISSING_ORDER" as const };
  }

  return markOrderStripePaymentFailed(orderId, source, session.id);
}
