import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { logApiEvent } from '@/lib/observability'
import { resolvePublicSiteUrl } from '@/lib/site-url'
import { subscriptionCheckoutSchema } from '@/lib/validators'
import { stripe, stripeEnabled } from '@/lib/stripe'

export async function POST(request: Request) {
  try {
    if (!stripeEnabled || !stripe) {
      logApiEvent({
        level: 'WARN',
        route: '/api/checkout/subscription',
        event: 'STRIPE_NOT_CONFIGURED',
        status: 503,
      })
      return NextResponse.json({ error: 'Stripe is not configured' }, { status: 503 })
    }

    const user = await getCurrentUser()
    if (!user) {
      logApiEvent({
        level: 'WARN',
        route: '/api/checkout/subscription',
        event: 'UNAUTHORIZED',
        status: 401,
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const parsed = subscriptionCheckoutSchema.safeParse(body)
    if (!parsed.success) {
      logApiEvent({
        level: 'WARN',
        route: '/api/checkout/subscription',
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

    const { productId, interval, quantity } = parsed.data

    const { prisma } = await import('@/lib/prisma')

    const product = await prisma.product.findFirst({
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

    const intervalKey = interval
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

    const baseUrl = resolvePublicSiteUrl({ request })
    const returnUrl = `${baseUrl}/products/${product.slug}?subscription=1&session_id={CHECKOUT_SESSION_ID}`

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      ui_mode: 'custom',
      return_url: returnUrl,
      customer_email: user.email,
      line_items: [
        {
          price: stripePriceId,
          quantity: quantity,
        },
      ],
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

    if (!session.client_secret) {
      logApiEvent({
        level: 'ERROR',
        route: '/api/checkout/subscription',
        event: 'CHECKOUT_CLIENT_SECRET_MISSING',
        status: 500,
        details: { userId: user.id, productId: product.id, interval },
      })
      return NextResponse.json({ error: 'Unable to create checkout session' }, { status: 500 })
    }

    logApiEvent({
      level: 'INFO',
      route: '/api/checkout/subscription',
      event: 'CHECKOUT_SESSION_CREATED',
      status: 200,
      details: {
        userId: user.id,
        productId: product.id,
        interval,
        quantity,
        sessionId: session.id,
      },
    })

    return NextResponse.json({
      uiMode: 'custom',
      clientSecret: session.client_secret,
      sessionId: session.id,
      returnUrl,
    })
  } catch (error) {
    logApiEvent({
      level: 'ERROR',
      route: '/api/checkout/subscription',
      event: 'CHECKOUT_SUBSCRIPTION_FAILED',
      status: 500,
      details: { error },
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
