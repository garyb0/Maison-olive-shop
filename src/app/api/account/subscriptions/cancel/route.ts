import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { logApiEvent } from '@/lib/observability'
import { createStripeServerClient } from '@/lib/stripe-server'
import { subscriptionCancelSchema } from '@/lib/validators'

const getStripeClient = () => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  if (!stripeSecretKey) return null

  return createStripeServerClient(stripeSecretKey)
}

export async function POST(request: Request) {
  try {
    const stripe = getStripeClient()
    if (!stripe) {
      logApiEvent({
        level: 'WARN',
        route: '/api/account/subscriptions/cancel',
        event: 'STRIPE_NOT_CONFIGURED',
        status: 503,
      })
      return NextResponse.json({ error: 'Stripe is not configured' }, { status: 503 })
    }

    const { prisma } = await import('@/lib/prisma')

    const user = await getCurrentUser()
    if (!user) {
      logApiEvent({
        level: 'WARN',
        route: '/api/account/subscriptions/cancel',
        event: 'UNAUTHORIZED',
        status: 401,
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const parsed = subscriptionCancelSchema.safeParse(body)
    if (!parsed.success) {
      logApiEvent({
        level: 'WARN',
        route: '/api/account/subscriptions/cancel',
        event: 'INVALID_PAYLOAD',
        status: 400,
        details: {
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            code: issue.code,
            message: issue.message,
          })),
          userId: user.id,
        },
      })
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const { subscriptionId } = parsed.data

    const subscription = await prisma.subscription.findFirst({
      where: { id: subscriptionId, userId: user.id },
    })

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    })

    await prisma.subscription.updateMany({
      where: { id: subscriptionId, userId: user.id },
      data: { cancelAtPeriodEnd: true },
    })

    logApiEvent({
      level: 'INFO',
      route: '/api/account/subscriptions/cancel',
      event: 'SUBSCRIPTION_CANCEL_AT_PERIOD_END_SET',
      status: 200,
      details: {
        userId: user.id,
        subscriptionId,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logApiEvent({
      level: 'ERROR',
      route: '/api/account/subscriptions/cancel',
      event: 'SUBSCRIPTION_CANCEL_FAILED',
      status: 500,
      details: { error },
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
