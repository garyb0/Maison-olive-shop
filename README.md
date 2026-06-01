# Chez Olive Shop

Application e-commerce Chez Olive: catalogue, checkout, commandes, support, notifications, Stripe, livraisons et outils admin.

## Documentation

- [Security](SECURITY.md)
- [Security runbook](docs/SECURITY_RUNBOOK.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Operations](docs/OPERATIONS.md)
- [Stripe payments](docs/PAYMENTS_STRIPE.md)
- [Delivery driver](docs/DELIVERY_DRIVER.md)
- [Production checklist](PRODUCTION_CHECKLIST.md)

## Local Start

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run seed
npm run dev
```

Local URL: `http://localhost:3101`.

## Main Gates

```bash
npm run test:critical
npm run lint
npx tsc --noEmit
npm run build
npm run validate:env:prod
npm run security:audit
```

Before risky database work, run a manual backup:

```bash
npm run db:backup -- manual
```

Do not reactivate the Windows scheduled backup tasks unless Gary explicitly asks.
