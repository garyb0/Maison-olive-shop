import { jsonError, jsonOk } from "@/lib/http";
import { createOrderSafely, getOrdersForUser } from "@/lib/orders";
import { requireUser } from "@/lib/permissions";
import { checkoutSchema } from "@/lib/validators";
import { stripe, stripeEnabled } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { sendOrderConfirmationEmail } from "@/lib/business";
import { env } from "@/lib/env";

export async function GET() {
  try {
    const user = await requireUser();
    const orders = await getOrdersForUser(user.id);
    return jsonOk({ orders });
  } catch {
    return jsonError("Unauthorized", 401);
  }
}

export async function POST(request: Request) {
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

    return jsonOk({ order, stripeCheckoutUrl: null });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }
    if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") {
      return jsonError("Insufficient stock", 409);
    }
    if (
      error instanceof Error &&
      ["EMPTY_CART", "PRODUCT_NOT_FOUND", "INVALID_QUANTITY"].includes(error.message)
    ) {
      return jsonError("Invalid checkout request", 400);
    }
    return jsonError("Invalid checkout request", 400);
  }
}
