import { jsonError, jsonOk } from "@/lib/http";
import { createOrderSafely, getOrdersForUser } from "@/lib/orders";
import { requireUser } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/auth";
import { checkoutSchema } from "@/lib/validators";
import { stripe, stripeEnabled } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { sendOrderConfirmationEmail } from "@/lib/business";
import { env } from "@/lib/env";
import { logApiEvent } from "@/lib/observability";
import { applyRateLimit } from "@/lib/rate-limit";
import { buildCheckoutConfirmation } from "@/lib/checkout-confirmation";
import { resolvePublicSiteUrl } from "@/lib/site-url";

const stripeMinimumAmountMessage =
  "Stripe exige un total d'au moins 0,50 $ CAD. Augmente légèrement le montant de la commande ou retire le rabais de test.";

export async function GET() {
  try {
    const user = await requireUser();
    const orders = await getOrdersForUser(user.id);

    logApiEvent({
      level: "INFO",
      route: "/api/orders",
      event: "ORDERS_FETCH_SUCCESS",
      status: 200,
      details: { userId: user.id, count: orders.length },
    });

    return jsonOk({ orders });
  } catch (error) {
    logApiEvent({
      level: "WARN",
      route: "/api/orders",
      event: "ORDERS_FETCH_UNAUTHORIZED",
      status: 401,
      details: { error },
    });

    return jsonError("Unauthorized", 401);
  }
}

export async function POST(request: Request) {
  const rate = await applyRateLimit(request, { namespace: "orders:create", windowMs: 60_000, max: 12 });
  if (!rate.ok) {
    return jsonError("Too many requests", 429);
  }

  try {
    const user = await getCurrentUser();
    const body = await request.json();
    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      const hasInvalidDeliveryPhone = parsed.error.issues.some(
        (issue) =>
          issue.message === "INVALID_DELIVERY_PHONE" ||
          issue.path.includes("deliveryPhone"),
      );
      if (hasInvalidDeliveryPhone) {
        return jsonError("Numéro de téléphone invalide. Utilise un numéro de 10 chiffres (ou 11 avec l'indicatif 1).", 400);
      }
      return jsonError("Invalid checkout request", 400);
    }
    const input = parsed.data;

    if (!user && input.paymentMethod === "MANUAL") {
      return jsonError(
        "Le paiement manuel nécessite un compte pour faciliter le suivi de la commande et la livraison.",
        401,
      );
    }

    if (!user && (!input.customerEmail || !input.customerName)) {
      return jsonError("Guest checkout requires customer name and email", 400);
    }

    if (input.paymentMethod === "STRIPE" && (!stripeEnabled || !stripe)) {
      return jsonError("Stripe is not configured", 503);
    }

    const customerEmail = user?.email ?? input.customerEmail!;
    const customerLanguage = user?.language ?? input.customerLanguage ?? "fr";
    const order = await createOrderSafely({
      userId: user?.id ?? null,
      customerEmail,
      customerName: user ? `${user.firstName} ${user.lastName}` : input.customerName!,
      paymentMethod: input.paymentMethod,
      promoCode: input.promoCode,
      items: input.items,
      deliveryAddressId: input.deliveryAddressId,
      deliveryAddressLabel: input.deliveryAddressLabel,
      saveDeliveryAddress: input.saveDeliveryAddress,
      shippingLine1: input.shippingLine1,
      shippingCity: input.shippingCity,
      shippingRegion: input.shippingRegion,
      shippingPostal: input.shippingPostal,
      shippingCountry: input.shippingCountry,
      deliverySlotId: input.deliverySlotId,
      deliveryWindowStartAt: input.deliveryWindowStartAt,
      deliveryWindowEndAt: input.deliveryWindowEndAt,
      deliveryInstructions: input.deliveryInstructions,
      deliveryPhone: input.deliveryPhone,
    });

    const orderForResponse = await prisma.order.findUnique({
      where: { id: order.id },
      include: { items: true },
    });

    if (!orderForResponse) {
      return jsonError("Unable to load created order", 500);
    }

    const confirmation = buildCheckoutConfirmation(orderForResponse);

    if (input.paymentMethod === "STRIPE" && stripeEnabled && stripe) {
      const siteUrl = resolvePublicSiteUrl({
        request,
        configuredUrl: env.siteUrl,
        nodeEnv: env.nodeEnv,
      });
      const returnUrl = `${siteUrl}/checkout?order=${encodeURIComponent(order.orderNumber)}&email=${encodeURIComponent(customerEmail)}&mode=stripe&session_id={CHECKOUT_SESSION_ID}`;

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        ui_mode: "custom",
        return_url: returnUrl,
        customer_email: customerEmail,
        client_reference_id: order.id,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "cad",
              unit_amount: order.totalCents,
              product_data: {
                name: `Order ${order.orderNumber}`,
                description: "Chez Olive checkout",
              },
            },
          },
        ],
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          userId: user?.id ?? "",
          customerEmail,
          customerLanguage,
          customerType: user ? "account" : "guest",
        },
        payment_intent_data: {
          metadata: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            userId: user?.id ?? "",
            customerEmail,
            customerLanguage,
            customerType: user ? "account" : "guest",
          },
        },
      });

      if (!session.client_secret) {
        return jsonError("Stripe checkout unavailable", 502);
      }

      await prisma.order.update({
        where: { id: order.id },
        data: { stripeSessionId: session.id },
      });

      logApiEvent({
        level: "INFO",
        route: "/api/orders",
        event: "ORDER_CREATED_STRIPE",
        status: 200,
        details: { userId: user?.id ?? null, guest: !user, orderId: order.id, orderNumber: order.orderNumber },
      });

      return jsonOk({
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          customerEmail,
        },
        confirmation,
        stripeCheckout: {
          uiMode: "custom",
          clientSecret: session.client_secret,
          sessionId: session.id,
          returnUrl,
        },
      });
    }

    if (orderForResponse) {
      await sendOrderConfirmationEmail({
        orderNumber: orderForResponse.orderNumber,
        customerName: orderForResponse.customerName,
        customerEmail: orderForResponse.customerEmail,
        orderCreatedAt: orderForResponse.createdAt,
        subtotalCents: orderForResponse.subtotalCents,
        discountCents: orderForResponse.discountCents,
        shippingCents: orderForResponse.shippingCents,
        totalCents: orderForResponse.totalCents,
        currency: orderForResponse.currency,
        language: customerLanguage,
        paymentMethod: orderForResponse.paymentMethod,
        deliveryStatus: orderForResponse.deliveryStatus,
        shippingLine1: orderForResponse.shippingLine1,
        shippingCity: orderForResponse.shippingCity,
        shippingRegion: orderForResponse.shippingRegion,
        shippingPostal: orderForResponse.shippingPostal,
        shippingCountry: orderForResponse.shippingCountry,
        deliveryPhone: orderForResponse.deliveryPhone,
        deliveryInstructions: orderForResponse.deliveryInstructions,
        deliveryWindowStartAt: orderForResponse.deliveryWindowStartAt,
        deliveryWindowEndAt: orderForResponse.deliveryWindowEndAt,
        items: orderForResponse.items.map((item) => ({
          name: customerLanguage === "en" ? item.productNameSnapshotEn : item.productNameSnapshotFr,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          lineTotalCents: item.lineTotalCents,
        })),
      });
    }

    logApiEvent({
      level: "INFO",
      route: "/api/orders",
      event: "ORDER_CREATED_MANUAL",
      status: 200,
      details: { userId: user?.id ?? null, guest: !user, orderId: order.id, orderNumber: order.orderNumber },
    });

    return jsonOk({
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        customerEmail,
      },
      confirmation,
      stripeCheckout: null,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      logApiEvent({
        level: "WARN",
        route: "/api/orders",
        event: "ORDER_CREATE_UNAUTHORIZED",
        status: 401,
        details: { error },
      });
      return jsonError("Unauthorized", 401);
    }
    if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") {
      logApiEvent({
        level: "WARN",
        route: "/api/orders",
        event: "ORDER_CREATE_INSUFFICIENT_STOCK",
        status: 409,
        details: { error },
      });
      return jsonError("Insufficient stock", 409);
    }
    if (error instanceof Error && error.message === "OUTSIDE_DELIVERY_ZONE") {
      logApiEvent({
        level: "WARN",
        route: "/api/orders",
        event: "ORDER_CREATE_OUTSIDE_DELIVERY_ZONE",
        status: 400,
        details: { error },
      });
      return jsonError("Adresse hors zone de livraison", 400);
    }
    if (error instanceof Error && error.message === "DELIVERY_ADDRESS_INCOMPLETE") {
      logApiEvent({
        level: "WARN",
        route: "/api/orders",
        event: "ORDER_CREATE_DELIVERY_ADDRESS_INCOMPLETE",
        status: 400,
        details: { error },
      });
      return jsonError("Adresse incomplete. Rue, ville, region, code postal et pays sont requis.", 400);
    }
    if (error instanceof Error && error.message === "DELIVERY_ADDRESS_NOT_FOUND") {
      logApiEvent({
        level: "WARN",
        route: "/api/orders",
        event: "ORDER_CREATE_DELIVERY_ADDRESS_NOT_FOUND",
        status: 404,
        details: { error },
      });
      return jsonError("Adresse de livraison introuvable", 404);
    }

    if (error instanceof Error && error.message === "DELIVERY_PHONE_REQUIRED") {
      logApiEvent({
        level: "WARN",
        route: "/api/orders",
        event: "ORDER_CREATE_DELIVERY_PHONE_REQUIRED",
        status: 400,
        details: { error },
      });
      return jsonError("Numéro de téléphone requis pour planifier la livraison", 400);
    }

    if (error instanceof Error && error.message === "INVALID_DELIVERY_PHONE") {
      logApiEvent({
        level: "WARN",
        route: "/api/orders",
        event: "ORDER_CREATE_INVALID_DELIVERY_PHONE",
        status: 400,
        details: { error },
      });
      return jsonError("Numéro de téléphone invalide. Utilise un numéro de 10 chiffres (ou 11 avec l'indicatif 1).", 400);
    }

    if (error instanceof Error && error.message === "DELIVERY_DYNAMIC_DISABLED") {
      return jsonError("Le mode de livraison expÃ©rimental est dÃ©sactivÃ©", 409);
    }

    if (error instanceof Error && error.message === "DELIVERY_WINDOW_INCOMPLETE") {
      return jsonError("La fenÃªtre de livraison est incomplÃ¨te", 400);
    }

    if (error instanceof Error && error.message === "DELIVERY_SLOT_NOT_FOUND") {
      logApiEvent({
        level: "WARN",
        route: "/api/orders",
        event: "ORDER_CREATE_DELIVERY_SLOT_NOT_FOUND",
        status: 400,
        details: { error },
      });
      return jsonError("Créneau de livraison introuvable", 400);
    }

    if (error instanceof Error && error.message === "DELIVERY_SLOT_CLOSED") {
      logApiEvent({
        level: "WARN",
        route: "/api/orders",
        event: "ORDER_CREATE_DELIVERY_SLOT_CLOSED",
        status: 409,
        details: { error },
      });
      return jsonError("Le créneau sélectionné est fermé", 409);
    }

    if (error instanceof Error && error.message === "DELIVERY_SLOT_FULL") {
      logApiEvent({
        level: "WARN",
        route: "/api/orders",
        event: "ORDER_CREATE_DELIVERY_SLOT_FULL",
        status: 409,
        details: { error },
      });
      return jsonError("Le créneau sélectionné est complet", 409);
    }

    if (error instanceof Error && error.message === "DELIVERY_SLOT_OUTSIDE_BOOKING_WINDOW") {
      logApiEvent({
        level: "WARN",
        route: "/api/orders",
        event: "ORDER_CREATE_DELIVERY_SLOT_OUTSIDE_BOOKING_WINDOW",
        status: 409,
        details: { error },
      });
      return jsonError("Le créneau est hors fenêtre de réservation", 409);
    }

    if (error instanceof Error && error.message === "DELIVERY_WINDOW_PAST") {
      return jsonError("La fenêtre de livraison sélectionnée est déjà passée", 409);
    }
    if (error instanceof Error && error.message === "DELIVERY_WINDOW_INVALID_DURATION") {
      return jsonError("Durée de fenêtre de livraison invalide", 400);
    }
    if (error instanceof Error && error.message === "DELIVERY_WINDOW_INVALID_PERIOD") {
      return jsonError("PÃ©riode de livraison invalide", 400);
    }
    if (error instanceof Error && error.message === "DELIVERY_WINDOW_FULL") {
      return jsonError("La fenêtre de livraison sélectionnée est complète", 409);
    }

    if (
      error instanceof Error &&
      error.message.includes("total amount due must add up to at least $0.50 cad")
    ) {
      logApiEvent({
        level: "WARN",
        route: "/api/orders",
        event: "ORDER_CREATE_STRIPE_MINIMUM_AMOUNT",
        status: 400,
        details: { error },
      });
      return jsonError(stripeMinimumAmountMessage, 400);
    }

    if (
      error instanceof Error &&
      ["EMPTY_CART", "PRODUCT_NOT_FOUND", "INVALID_QUANTITY"].includes(error.message)
    ) {
      logApiEvent({
        level: "WARN",
        route: "/api/orders",
        event: "ORDER_CREATE_INVALID_REQUEST",
        status: 400,
        details: { error },
      });
      return jsonError("Invalid checkout request", 400);
    }

    logApiEvent({
      level: "ERROR",
      route: "/api/orders",
      event: "ORDER_CREATE_UNHANDLED_ERROR",
      status: 400,
      details: { error },
    });

    return jsonError("Invalid checkout request", 400);
  }
}




