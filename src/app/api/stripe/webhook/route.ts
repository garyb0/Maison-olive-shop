import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { SubscriptionStatus } from '@prisma/client'

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

const getStripeClient = () => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  if (!stripeSecretKey) return null

  return new Stripe(stripeSecretKey, {
    apiVersion: '2025-08-27.basil',
  })
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

export async function POST(request: Request) {
  const stripe = getStripeClient()
  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe is not configured' }, { status: 503 })
  }

  const sig = request.headers.get('stripe-signature')!
  const rawBody = Buffer.from(await request.arrayBuffer())
  
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown webhook error'
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 })
  }

  try {
    const { prisma } = await import('@/lib/prisma')

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode === 'subscription' && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
          const sub = subscription as unknown as StripeSubscriptionSnapshot
          
          await prisma.subscription.create({
            data: {
              stripeSubscriptionId: sub.id,
              userId: session.metadata!.userId,
              productId: session.metadata!.productId,
              quantity: parseInt(session.metadata!.quantity || '1'),
              currentPeriodStart: new Date(sub.current_period_start * 1000),
              currentPeriodEnd: new Date(sub.current_period_end * 1000),
              nextPaymentDate: new Date(sub.current_period_end * 1000),
            }
          })
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as unknown as StripeSubscriptionSnapshot
        
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            status: mapStripeSubscriptionStatus(subscription.status),
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
            nextPaymentDate: new Date(subscription.current_period_end * 1000),
          }
        })
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        
        await prisma.subscription.updateMany({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            status: 'CANCELED',
            canceledAt: new Date(),
          }
        })
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object as unknown as StripeInvoiceSnapshot
        if (invoice.subscription && invoice.status_transitions?.paid_at) {
          await prisma.subscription.updateMany({
            where: { stripeSubscriptionId: invoice.subscription },
            data: {
              lastPaymentDate: new Date(invoice.status_transitions.paid_at * 1000),
            }
          })
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as unknown as StripeInvoiceSnapshot
        if (invoice.subscription) {
          await prisma.subscription.updateMany({
            where: { stripeSubscriptionId: invoice.subscription },
            data: {
              status: 'PAST_DUE',
            }
          })
        }
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook handler error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}