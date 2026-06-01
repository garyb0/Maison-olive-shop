import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { SubscriptionStatus } from '@prisma/client'
import { logApiEvent } from '@/lib/observability'
import {
  markOrderPaidFromStripeSession,
  markOrderStripeCheckoutExpired,
} from '@/lib/orders'
import { createStripeServerClient } from '@/lib/stripe-server'

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

const getStripeClient = () => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  if (!stripeSecretKey) return null

  return createStripeServerClient(stripeSecretKey)
}

function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case 'active':
    case 'trialing':
      return SubscriptionStatus.ACTIVE
    case 'past_due':
    case 'unpaid':
    case 'incomplete':
    case 'incomplete_expired':
      return SubscriptionStatus.PAST_DUE
    case 'canceled':
      return SubscriptionStatus.CANCELED
    case 'paused':
      return SubscriptionStatus.PAUSED
    default:
      return SubscriptionStatus.EXPIRED
  }
}

type StripeSubscriptionSnapshot = {
  id: string
  status: Stripe.Subscription.Status
  current_period_start: number
  current_period_end: number
  cancel_at_period_end: boolean
  canceled_at: number | null
}

type StripeInvoiceSnapshot = {
  subscription?: string | null
  status_transitions?: {
    paid_at?: number | null
  }
}

type SubscriptionCheckoutIntentForWebhook = {
  id: string
  userId: string
  productId: string
  priceId: string
  interval: string
  quantity: number
  amountCents: number
  currency: string
  stripeSessionId: string
  status: string
}

function getPrismaDuplicateErrorCode(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error ? (error as { code?: string }).code : undefined
}

async function markWebhookEventFailed(event: Stripe.Event, error: unknown) {
  const { prisma } = await import('@/lib/prisma')
  const message = error instanceof Error ? error.message : 'Unknown webhook error'

  await prisma.stripeWebhookEvent.upsert({
    where: { stripeEventId: event.id },
    create: {
      stripeEventId: event.id,
      stripeEventType: event.type,
      status: 'failed',
      lastError: message,
    },
    update: {
      status: 'failed',
      lastError: message,
      stripeEventType: event.type,
    },
  })
}

async function markWebhookEventProcessed(event: Stripe.Event) {
  const { prisma } = await import('@/lib/prisma')

  await prisma.stripeWebhookEvent.upsert({
    where: { stripeEventId: event.id },
    create: {
      stripeEventId: event.id,
      stripeEventType: event.type,
      status: 'processed',
    },
    update: {
      status: 'processed',
      stripeEventType: event.type,
    },
  })
}

function validateSubscriptionCheckoutSession(
  session: Stripe.Checkout.Session,
  intent: SubscriptionCheckoutIntentForWebhook,
) {
  const metadata = session.metadata ?? {}

  if (session.id !== intent.stripeSessionId) return 'SESSION_MISMATCH'
  if (session.mode !== 'subscription') return 'MODE_MISMATCH'
  if (!session.subscription) return 'SUBSCRIPTION_MISSING'
  if (session.payment_status && !['paid', 'no_payment_required'].includes(session.payment_status)) {
    return 'PAYMENT_NOT_SETTLED'
  }
  if (session.client_reference_id && session.client_reference_id !== intent.productId) {
    return 'CLIENT_REFERENCE_MISMATCH'
  }
  if (session.amount_total !== intent.amountCents) return 'AMOUNT_MISMATCH'
  if ((session.currency ?? '').toUpperCase() !== intent.currency.toUpperCase()) return 'CURRENCY_MISMATCH'
  if (metadata.userId !== intent.userId) return 'USER_MISMATCH'
  if (metadata.productId !== intent.productId) return 'PRODUCT_MISMATCH'
  if (metadata.priceId !== intent.priceId) return 'PRICE_MISMATCH'
  if (metadata.interval !== intent.interval) return 'INTERVAL_MISMATCH'
  if (metadata.quantity !== String(intent.quantity)) return 'QUANTITY_MISMATCH'
  if (metadata.amountCents !== String(intent.amountCents)) return 'METADATA_AMOUNT_MISMATCH'
  if ((metadata.currency ?? '').toUpperCase() !== intent.currency.toUpperCase()) return 'METADATA_CURRENCY_MISMATCH'

  return null
}

export async function POST(request: Request) {
  const startedAt = Date.now()
  const stripe = getStripeClient()
  if (!stripe || !webhookSecret) {
    logApiEvent({
      level: 'WARN',
      route: '/api/stripe/webhook',
      event: 'STRIPE_WEBHOOK_NOT_CONFIGURED',
      status: 503,
    })
    return NextResponse.json({ error: 'Stripe is not configured' }, { status: 503 })
  }

  const sig = request.headers.get('stripe-signature')
  if (!sig) {
    logApiEvent({
      level: 'WARN',
      route: '/api/stripe/webhook',
      event: 'MISSING_STRIPE_SIGNATURE',
      status: 400,
    })
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  const rawBody = Buffer.from(await request.arrayBuffer())

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown webhook error'
    logApiEvent({
      level: 'WARN',
      route: '/api/stripe/webhook',
      event: 'WEBHOOK_SIGNATURE_VERIFICATION_FAILED',
      status: 400,
      details: { message },
    })
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 })
  }

  try {
    const { prisma } = await import('@/lib/prisma')

    const existingEvent = await prisma.stripeWebhookEvent.findUnique({
      where: { stripeEventId: event.id },
    })

    if (existingEvent?.status === "processed") {
      logApiEvent({
        level: 'INFO',
        route: '/api/stripe/webhook',
        event: 'WEBHOOK_DUPLICATE_EVENT',
        status: 200,
        details: {
          eventId: event.id,
          eventType: event.type,
        },
      })
      return NextResponse.json({ received: true })
    }

    if (existingEvent) {
      logApiEvent({
        level: 'WARN',
        route: '/api/stripe/webhook',
        event: 'WEBHOOK_RETRY_AFTER_FAILURE',
        status: 200,
        details: {
          eventId: event.id,
          eventType: event.type,
          previousStatus: existingEvent.status,
        },
      })

      await prisma.stripeWebhookEvent.update({
        where: { stripeEventId: event.id },
        data: { status: 'received', lastError: null },
      });
    } else {
      await prisma.stripeWebhookEvent.create({
        data: {
          stripeEventId: event.id,
          stripeEventType: event.type,
          status: 'received',
        },
      })
    }

    logApiEvent({
      level: 'INFO',
      route: '/api/stripe/webhook',
      event: 'WEBHOOK_EVENT_RECEIVED',
      status: 200,
      details: {
        eventId: event.id,
        eventType: event.type,
        durationMs: Date.now() - startedAt,
      },
    })

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode === 'payment') {
          const result = await markOrderPaidFromStripeSession(session, 'checkout.session.completed')

          logApiEvent({
            level: result.transitionedToPaid ? 'INFO' : 'WARN',
            route: '/api/stripe/webhook',
            event: result.transitionedToPaid ? 'STRIPE_ORDER_PAID' : 'STRIPE_ORDER_PAID_SKIPPED',
            status: 200,
            details: {
              eventId: event.id,
              orderId: result.orderId,
              reason: 'reason' in result ? result.reason : undefined,
            },
          })
        } else if (session.mode === 'subscription' && session.subscription) {
          const intent = await prisma.subscriptionCheckoutIntent.findUnique({
            where: { stripeSessionId: session.id },
          })

          if (!intent || intent.status !== 'PENDING') {
            logApiEvent({
              level: 'WARN',
              route: '/api/stripe/webhook',
              event: 'CHECKOUT_SUBSCRIPTION_INTENT_MISSING',
              status: 400,
              details: {
                eventId: event.id,
                sessionId: session.id,
                intentStatus: intent?.status,
              },
            })
            break
          }

          const validationError = validateSubscriptionCheckoutSession(session, intent)
          if (validationError) {
            await prisma.subscriptionCheckoutIntent.update({
              where: { id: intent.id },
              data: { status: 'REJECTED' },
            })

            logApiEvent({
              level: 'WARN',
              route: '/api/stripe/webhook',
              event: 'CHECKOUT_SUBSCRIPTION_INTENT_REJECTED',
              status: 400,
              details: {
                eventId: event.id,
                sessionId: session.id,
                intentId: intent.id,
                reason: validationError,
              },
            })
            break
          }

          const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
          const sub = subscription as unknown as StripeSubscriptionSnapshot

          const existing = await prisma.subscription.findUnique({
            where: { stripeSubscriptionId: sub.id },
          })

          const data = {
            userId: intent.userId,
            productId: intent.productId,
            quantity: intent.quantity,
            status: mapStripeSubscriptionStatus(sub.status),
            currentPeriodStart: new Date(sub.current_period_start * 1000),
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
            cancelAtPeriodEnd: sub.cancel_at_period_end,
            canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
            nextPaymentDate: new Date(sub.current_period_end * 1000),
          }

          if (existing) {
            await prisma.subscription.update({
              where: { stripeSubscriptionId: sub.id },
              data,
            })
          } else {
            await prisma.subscription.create({
              data: {
                stripeSubscriptionId: sub.id,
                ...data,
              },
            })
          }

          await prisma.subscriptionCheckoutIntent.update({
            where: { id: intent.id },
            data: { status: 'COMPLETED' },
          })

          logApiEvent({
            level: 'INFO',
            route: '/api/stripe/webhook',
            event: existing ? 'SUBSCRIPTION_SYNCED_FROM_CHECKOUT' : 'SUBSCRIPTION_CREATED_FROM_CHECKOUT',
            status: 200,
            details: {
              eventId: event.id,
              stripeSubscriptionId: sub.id,
              userId: intent.userId,
              productId: intent.productId,
              intentId: intent.id,
            },
          })
        }
        break
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session

        if (session.mode === 'payment') {
          const result = await markOrderStripeCheckoutExpired(session)

          logApiEvent({
            level: result.transitionedToFailed ? 'INFO' : 'WARN',
            route: '/api/stripe/webhook',
            event: result.transitionedToFailed ? 'STRIPE_ORDER_CHECKOUT_EXPIRED' : 'STRIPE_ORDER_CHECKOUT_EXPIRED_SKIPPED',
            status: 200,
            details: {
              eventId: event.id,
              orderId: result.orderId,
              reason: 'reason' in result ? result.reason : undefined,
            },
          })
        }
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const orderId = paymentIntent.metadata?.orderId

        logApiEvent({
          level: 'WARN',
          route: '/api/stripe/webhook',
          event: 'STRIPE_PAYMENT_INTENT_FAILED_RECEIVED',
          status: 200,
          details: {
            eventId: event.id,
            orderId,
            paymentIntentId: paymentIntent.id,
            status: paymentIntent.status,
          },
        })
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as unknown as StripeSubscriptionSnapshot

        const result = await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            status: mapStripeSubscriptionStatus(subscription.status),
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
            nextPaymentDate: new Date(subscription.current_period_end * 1000),
          },
        })

        if (result.count === 0) {
          logApiEvent({
            level: 'WARN',
            route: '/api/stripe/webhook',
            event: 'SUBSCRIPTION_UPDATED_NOT_FOUND',
            status: 200,
            details: {
              eventId: event.id,
              stripeSubscriptionId: subscription.id,
            },
          })
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription

        const result = await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            status: 'CANCELED',
            canceledAt: new Date(),
          },
        })

        if (result.count === 0) {
          logApiEvent({
            level: 'WARN',
            route: '/api/stripe/webhook',
            event: 'SUBSCRIPTION_DELETED_NOT_FOUND',
            status: 200,
            details: {
              eventId: event.id,
              stripeSubscriptionId: subscription.id,
            },
          })
        }
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object as unknown as StripeInvoiceSnapshot
        if (invoice.subscription && invoice.status_transitions?.paid_at) {
          const result = await prisma.subscription.updateMany({
            where: { stripeSubscriptionId: invoice.subscription },
            data: {
              lastPaymentDate: new Date(invoice.status_transitions.paid_at * 1000),
            },
          })

          if (result.count === 0) {
            logApiEvent({
              level: 'WARN',
              route: '/api/stripe/webhook',
              event: 'INVOICE_PAID_SUBSCRIPTION_NOT_FOUND',
              status: 200,
              details: {
                eventId: event.id,
                stripeSubscriptionId: invoice.subscription,
              },
            })
          }
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as unknown as StripeInvoiceSnapshot
        if (invoice.subscription) {
          const result = await prisma.subscription.updateMany({
            where: { stripeSubscriptionId: invoice.subscription },
            data: {
              status: 'PAST_DUE',
            },
          })

          if (result.count === 0) {
            logApiEvent({
              level: 'WARN',
              route: '/api/stripe/webhook',
              event: 'INVOICE_PAYMENT_FAILED_SUBSCRIPTION_NOT_FOUND',
              status: 200,
              details: {
                eventId: event.id,
                stripeSubscriptionId: invoice.subscription,
              },
            })
          }
        }
        break
      }

      default:
        logApiEvent({
          level: 'INFO',
          route: '/api/stripe/webhook',
          event: 'WEBHOOK_EVENT_IGNORED',
          status: 200,
          details: {
            eventId: event.id,
            eventType: event.type,
          },
        })
        break
    }

    await markWebhookEventProcessed(event)

    return NextResponse.json({ received: true })
  } catch (error) {
    const duplicateCode = getPrismaDuplicateErrorCode(error)
    if (duplicateCode === 'P2002') {
      logApiEvent({
        level: 'INFO',
        route: '/api/stripe/webhook',
        event: 'WEBHOOK_DUPLICATE_EVENT',
        status: 200,
        details: {
          eventId: event.id,
          eventType: event.type,
        },
      })
      return NextResponse.json({ received: true, duplicate: true })
    }

    await markWebhookEventFailed(event, error).catch(() => {})

    logApiEvent({
      level: 'ERROR',
      route: '/api/stripe/webhook',
      event: 'WEBHOOK_HANDLER_FAILED',
      status: 500,
      details: { error, eventType: event.type, eventId: event.id },
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
