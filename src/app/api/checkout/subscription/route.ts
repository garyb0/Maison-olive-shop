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

    const body = await request.json() as {
      productId?: unknown
      interval?: unknown
      quantity?: unknown
    }

    const productId = typeof body.productId === 'string' ? body.productId : null
    const interval = typeof body.interval === 'string' ? body.interval : null
    const quantity = typeof body.quantity === 'number' ? body.quantity : 1

    if (!productId || !interval) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const product = await prisma.product.findUnique({
      where: { id: productId, isSubscription: true, isActive: true },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found or not a subscription' }, { status: 404 })
    }

    const intervalMap = {
      WEEKLY: 'week',
      BIWEEKLY: 'week',
      MONTHLY: 'month',
      QUARTERLY: 'month',
    } as const

    const intervalCountMap = {
      WEEKLY: 1,
      BIWEEKLY: 2,
      MONTHLY: 1,
      QUARTERLY: 3,
    } as const

    const priceFieldMap = {
      WEEKLY: 'stripePriceWeekly',
      BIWEEKLY: 'stripePriceBiweekly',
      MONTHLY: 'stripePriceMonthly',
      QUARTERLY: 'stripePriceQuarterly',
    } as const

    const unitAmountFieldMap = {
      WEEKLY: 'priceWeekly',
      BIWEEKLY: 'priceBiweekly',
      MONTHLY: 'priceMonthly',
      QUARTERLY: 'priceQuarterly',
    } as const

    if (!(interval in intervalMap)) {
      return NextResponse.json({ error: 'Invalid subscription interval' }, { status: 400 })
    }

    const intervalKey = interval as keyof typeof intervalMap
    const priceField = priceFieldMap[intervalKey]
    const unitAmountField = unitAmountFieldMap[intervalKey]
    const recurringInterval = intervalMap[intervalKey]
    const recurringIntervalCount = intervalCountMap[intervalKey]

    let stripePriceId = product[priceField]

    if (!stripePriceId) {
      const unitAmount = product[unitAmountField]
      if (!unitAmount || unitAmount <= 0) {
        return NextResponse.json({ error: 'Missing subscription price for selected interval' }, { status: 400 })
      }

      const stripeProduct = await stripe.products.create({
        name: product.nameFr,
        description: product.descriptionFr,
        metadata: {
          productId: product.id,
          interval,
        },
      })

      const price = await stripe.prices.create({
        product: stripeProduct.id,
        unit_amount: unitAmount,
        currency: product.currency.toLowerCase(),
        recurring: {
          interval: recurringInterval,
          interval_count: recurringIntervalCount,
        },
      })

      stripePriceId = price.id

      const updateDataByField = {
        stripePriceWeekly: { stripePriceWeekly: price.id },
        stripePriceBiweekly: { stripePriceBiweekly: price.id },
        stripePriceMonthly: { stripePriceMonthly: price.id },
        stripePriceQuarterly: { stripePriceQuarterly: price.id },
      } as const

      await prisma.product.update({
        where: { id: product.id },
        data: updateDataByField[priceField],
      })
    }

    const host = request.headers.get('host') || 'localhost:3101'
    const protocol = host.startsWith('localhost') ? 'http' : 'https'
    const baseUrl = `${protocol}://${host}`

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: user.email,
      line_items: [
        {
          price: stripePriceId,
          quantity: quantity,
        },
      ],
      success_url: `${baseUrl}/account/subscriptions?success=true`,
      cancel_url: `${baseUrl}/products/${product.slug}?canceled=true`,
      metadata: {
        userId: user.id,
        productId: product.id,
        quantity: quantity.toString(),
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          productId: product.id,
        },
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Subscription checkout error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}