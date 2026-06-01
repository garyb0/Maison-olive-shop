# Security

## Reporting

Security issues should be handled privately. Do not publish secrets, tokens, customer data, order data, driver links, Stripe payloads, or database files in issues, chats, screenshots, or commits.

## Local Secret Policy

Sensitive local artifacts must stay outside the project root:

- Android signing files and keystores.
- Credential-bearing helper scripts.
- Cloudflare tunnel/DDNS configs that are not examples.
- Local or production-like SQLite databases.
- Non-example `.env*` files.

Run the local gate before release:

```bash
npm run security:audit
```

## Required Production Controls

- `SESSION_SECRET` must be strong and unique.
- `APP_TRUST_PROXY` must be `cloudflare` only when requests are known to arrive through Cloudflare; otherwise use `none`.
- `WEB_PUSH_ALLOWED_HOSTS` may add approved Web Push hosts; the default allowlist covers FCM, Mozilla, Apple and Windows push endpoints.
- Stripe webhooks must be verified with `STRIPE_WEBHOOK_SECRET`.
- No aggressive live testing: no origin bypass, brute force, fuzzing, load tests, or production scans.

## Current Hardening Notes

- Sessions are stored by HMAC token hash, not raw token.
- The session migration intentionally deletes existing sessions and forces global logout.
- Stripe one-time orders reserve inventory only after a validated paid webhook.
- Subscription creation requires a matching local `SubscriptionCheckoutIntent`.
- Driver GPS samples are bounded by age, future skew, accuracy, monotonic timestamp, and implied speed.
