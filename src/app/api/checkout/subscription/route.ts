import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { logApiEvent } from '@/lib/observability'
import { resolvePublicSiteUrl } from '@/lib/site-url'
import { subscriptionCheckoutSchema } from '@/lib/validators'
import { stripe, stripeEnabled } from '@/lib/stripe'

type SubscriptionInterval = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY'

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

type SubscriptionProduct = {
  id: string
  slug: string
  nameFr: string
  descriptionFr: string
  currency: string
  stripePriceWeekly: string | null
  stripePriceBiweekly: string | null
  stripePriceMonthly: string | null
  stripePriceQuarterly: string | null
  priceWeekly: number | null
  priceBiweekly: number | null
  priceMonthly: number | null
  priceQuarterly: number | null
}

function isMissingStripePriceError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const record = error as { code?: unknown; message?: unknown }
  return (
    record.code === 'resource_missing' ||
    (typeof record.message === 'string' && /No such price/i.test(record.message))
  )
}

async function createSubscriptionPrice(product: SubscriptionProduct, interval: SubscriptionInterval) {
  if (!stripe) {
    throw new Error('Stripe is not configured')
  }

  const unitAmount = product[unitAmountFieldMap[interval]]
  if (!unitAmount || unitAmount <= 0) {
    return null
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
      interval: intervalMap[interval],
      interval_count: intervalCountMap[interval],
    },
  })

  return price.id
}

async function resolveSubscriptionPriceId(product: SubscriptionProduct, interval: SubscriptionInterval) {
  if (!stripe) {
    throw new Error('Stripe is not configured')
  }

  const priceField = priceFieldMap[interval]
  const stripePriceId = product[priceField]
  const unitAmount = product[unitAmountFieldMap[interval]]
  const currency = product.currency.toLowerCase()
  const expectedInterval = intervalMap[interval]
  const expectedIntervalCount = intervalCountMap[interval]

  if (!unitAmount || unitAmount <= 0) {
    return { priceId: null, shouldPersist: false, reason: 'missing-unit-amount' as const }
  }

  if (stripePriceId) {
    try {
      const existingPrice = await stripe.prices.retrieve(stripePriceId)
      const recurring = existingPrice.recurring
      const matchesCurrentProductPrice =
        existingPrice.active !== false &&
        existingPrice.unit_amount === unitAmount &&
        existingPrice.currency === currency &&
        recurring?.interval === expectedInterval &&
        (recurring?.interval_count ?? 1) === expectedIntervalCount

      if (matchesCurrentProductPrice) {
        return { priceId: stripePriceId, shouldPersist: false, reason: 'stored-price-valid' as const }
      }

      logApiEvent({
        level: 'WARN',
        route: '/api/checkout/subscription',
        event: 'STRIPE_PRICE_STALE',
        status: 200,
        details: {
          productId: product.id,
          interval,
          stripePriceId,
          storedAmount: existingPrice.unit_amount,
          expectedAmount: unitAmount,
          storedCurrency: existingPrice.currency,
          expectedCurrency: currency,
        },
      })
    } catch (error) {
      if (!isMissingStripePriceError(error)) {
        throw error
      }

      logApiEvent({
        level: 'WARN',
        route: '/api/checkout/subscription',
        event: 'STRIPE_PRICE_MISSING_OR_WRONG_MODE',
        status: 200,
        details: {
          productId: product.id,
          interval,
          stripePriceId,
          error,
        },
      })
    }
  }

  const createdPriceId = await createSubscriptionPrice(product, interval)
  return { priceId: createdPriceId, shouldPersist: Boolean(createdPriceId), reason: 'created-price' as const }
}

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

    const priceField = priceFieldMap[interval]
    const resolvedPrice = await resolveSubscriptionPriceId(product, interval)

    if (!resolvedPrice.priceId) {
      return NextResponse.json({ error: 'Missing subscription price for selected interval' }, { status: 400 })
    }

    if (resolvedPrice.shouldPersist) {
      const updateDataByField = {
        stripePriceWeekly: { stripePriceWeekly: resolvedPrice.priceId },
        stripePriceBiweekly: { stripePriceBiweekly: resolvedPrice.priceId },
        stripePriceMonthly: { stripePriceMonthly: resolvedPrice.priceId },
        stripePriceQuarterly: { stripePriceQuarterly: resolvedPrice.priceId },
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
          price: resolvedPrice.priceId,
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
