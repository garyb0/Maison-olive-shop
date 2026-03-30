import { jsonError, jsonOk } from "@/lib/http";
import { createOrderSafely, getOrdersForUser } from "@/lib/orders";
import { requireUser } from "@/lib/permissions";
import { checkoutSchema } from "@/lib/validators";
import { stripe, stripeEnabled } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { sendOrderConfirmationEmail } from "@/lib/business";
import { env } from "@/lib/env";
import { logApiEvent } from "@/lib/observability";
import { applyRateLimit } from "@/lib/rate-limit";

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
  const rate = applyRateLimit(request, { namespace: "orders:create", windowMs: 60_000, max: 12 });
  if (!rate.ok) {
    return jsonError("Too many requests", 429);
  }

  try {
    const user = await requireUser();
    const body = await request.json();
    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid checkout request", 400);
    }
    const input = parsed.data;

    if (input.paymentMethod === "STRIPE" && (!stripeEnabled || !stripe)) {
      return jsonError("Stripe is not configured", 503);
    }

    const order = await createOrderSafely({
      userId: user.id,
      customerEmail: user.email,
      customerName: `${user.firstName} ${user.lastName}`,
      paymentMethod: input.paymentMethod,
      promoCode: input.promoCode,
      items: input.items,
      shippingLine1: input.shippingLine1,
      shippingCity: input.shippingCity,
      shippingRegion: input.shippingRegion,
      shippingPostal: input.shippingPostal,
      shippingCountry: input.shippingCountry,
    });

    if (input.paymentMethod === "STRIPE" && stripeEnabled && stripe) {
      const siteUrl = env.siteUrl;

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: user.email,
        client_reference_id: order.id,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "cad",
              unit_amount: order.totalCents,
              product_data: {
                name: `Order ${order.orderNumber}`,
                description: "Maison Olive checkout",
              },
            },
          },
        ],
        success_url: `${siteUrl}/account?paid=1&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}/account?cancelled=1`,
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          userId: user.id,
          customerEmail: user.email,
        },
      });

      if (!session.url) {
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
        details: { userId: user.id, orderId: order.id, orderNumber: order.orderNumber },
      });

      return jsonOk({ order, stripeCheckoutUrl: session.url });
    }

    await sendOrderConfirmationEmail({
      orderNumber: order.orderNumber,
      customerName: `${user.firstName} ${user.lastName}`,
      customerEmail: user.email,
      totalCents: order.totalCents,
      currency: order.currency,
      language: user.language,
    });

    logApiEvent({
      level: "INFO",
      route: "/api/orders",
      event: "ORDER_CREATED_MANUAL",
      status: 200,
      details: { userId: user.id, orderId: order.id, orderNumber: order.orderNumber },
    });

    return jsonOk({ order, stripeCheckoutUrl: null });
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
    if (
      error instanceof Error &&
      ["EMPTY_CART", "PRODUCT_NOT_FOUND", "INVALID_QUANTITY", "OUTSIDE_DELIVERY_ZONE"].includes(error.message)
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
