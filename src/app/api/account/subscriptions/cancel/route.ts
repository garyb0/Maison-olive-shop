import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getCurrentUser } from '@/lib/auth'

const getStripeClient = () => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY
  if (!stripeSecretKey) return null

  return new Stripe(stripeSecretKey, {
    apiVersion: '2025-08-27.basil',
  })
}

export async function POST(request: Request) {
  try {
    const stripe = getStripeClient()
    if (!stripe) {
      return NextResponse.json({ error: 'Stripe is not configured' }, { status: 503 })
    }

    const { prisma } = await import('@/lib/prisma')

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { subscriptionId } = await request.json()

    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId, userId: user.id },
    })

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    })

    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { cancelAtPeriodEnd: true },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Cancel subscription error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}