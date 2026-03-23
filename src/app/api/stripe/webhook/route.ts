import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { sendOrderConfirmationEmail } from "@/lib/business";
import { env } from "@/lib/env";

export async function POST(request: Request) {
  if (!stripe) {
    return new Response("Stripe not configured", { status: 400 });
  }

  const sig = request.headers.get("stripe-signature");
  const webhookSecret = env.stripeWebhookSecret;

  if (!sig || !webhookSecret) {
    return new Response("Missing webhook signature", { status: 400 });
  }

  const body = await request.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId ?? session.client_reference_id;

    if (orderId) {
      const existingOrder = await prisma.order.findUnique({
        where: { id: orderId },
        include: { user: true },
      });

      if (existingOrder) {
        const result = await prisma.$transaction(async (tx) => {
          const updated = await tx.order.updateMany({
            where: { id: orderId, paymentStatus: "PENDING" },
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
              actorUserId: existingOrder.userId,
              action: "STRIPE_CHECKOUT_COMPLETED",
              entity: "Order",
              entityId: orderId,
              metadata: JSON.stringify({ sessionId: session.id }),
            },
          });

          return { transitionedToPaid: true };
        });

        if (!result.transitionedToPaid) {
          return new Response("ok", { status: 200 });
        }

        await sendOrderConfirmationEmail({
          orderNumber: existingOrder.orderNumber,
          customerName: existingOrder.customerName,
          customerEmail: existingOrder.customerEmail,
          totalCents: existingOrder.totalCents,
          currency: existingOrder.currency,
          language: existingOrder.user.language === "en" ? "en" : "fr",
        });
      }
    }
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId ?? session.client_reference_id;

    if (orderId) {
      await prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({
          where: { id: orderId },
          include: { items: true },
        });

        if (!order || order.paymentStatus !== "PENDING") {
          return;
        }

        await tx.order.update({
          where: { id: orderId },
          data: {
            paymentStatus: "FAILED",
            status: "CANCELLED",
            stripeSessionId: session.id,
          },
        });

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
              reason: "STRIPE_CHECKOUT_EXPIRED_RESTOCK",
            },
          });
        }

        await tx.auditLog.create({
          data: {
            actorUserId: order.userId,
            action: "STRIPE_CHECKOUT_EXPIRED",
            entity: "Order",
            entityId: orderId,
            metadata: JSON.stringify({ sessionId: session.id, restocked: true }),
          },
        });
      });
    }
  }

  return new Response("ok", { status: 200 });
}
