# Architecture

## Runtime

- Next.js App Router route handlers under `src/app/api`.
- Prisma with SQLite/LibSQL adapter.
- Server-side domain logic under `src/lib`.
- Vitest regression tests under `src/tests`.

## Security Boundaries

- Auth/session code lives in `src/lib/auth.ts`.
- Rate limiting lives in `src/lib/rate-limit.ts`.
- Stripe order settlement lives in `src/lib/orders.ts` plus `src/app/api/stripe/webhook/route.ts`.
- Subscription checkout is tied to `SubscriptionCheckoutIntent`.
- Notifications and Web Push endpoint validation live in `src/lib/app-notifications.ts`.
- Driver run state and GPS validation live in `src/lib/delivery-runs.ts`.

## Data Flow Highlights

- Login creates a random session token, stores only `tokenHash`, and sends the raw token only in the HTTP-only cookie.
- Stripe one-time checkout creates a `PENDING` order without inventory reservation; the webhook validates Stripe and reserves inventory inside the paid transaction.
- Subscription checkout creates a local intent after Stripe session creation; the webhook must match that intent before creating or syncing a subscription.
- Public delivery slots accept only bounded date windows.
- Driver token routes are throttled by token hash.
