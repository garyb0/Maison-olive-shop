# Stripe Payments

## One-Time Checkout

Creation path:

1. `/api/orders` validates checkout input.
2. A local order is created as `PENDING`.
3. Inventory and delivery capacity are not reserved for Stripe at creation time.
4. Stripe Checkout Session is created with `client_reference_id=order.id` and order metadata.
5. `stripeSessionId` is saved on the order.

Webhook path:

1. Stripe signature is verified.
2. `checkout.session.completed` for `payment` is accepted only when session id, mode, payment status, amount, currency, client reference, and metadata match the local order.
3. Stock and delivery capacity are reserved inside the paid transaction.
4. Confirmation email/SMS are sent only after the reservation succeeds.
5. If stock or capacity is unavailable after payment, the order is flagged by audit/admin notification as `STRIPE_ORDER_REQUIRES_REFUND`.

## Subscriptions

Creation path:

1. `/api/checkout/subscription` resolves the expected Stripe price.
2. Stripe session is created with product/user/price/interval/quantity/amount/currency metadata.
3. A local `SubscriptionCheckoutIntent` is stored with `stripeSessionId`.

Webhook path:

1. `checkout.session.completed` for `subscription` must find a `PENDING` intent by `stripeSessionId`.
2. Session metadata, amount, currency, and product/user/price fields must match the intent.
3. Only then is the Stripe subscription retrieved and the local subscription created or synced.
4. Mismatched intents are marked `REJECTED`; no subscription is created.
