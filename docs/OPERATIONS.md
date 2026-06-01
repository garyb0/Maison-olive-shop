# Operations

## Backups

Manual backups are allowed:

```bash
npm run db:backup -- manual
```

Do not reactivate these Windows scheduled tasks unless Gary explicitly asks:

- `MaisonOlive-DB-Backup`
- `MaisonOlive-DB-Backup-Hourly`
- `MaisonOlive-DB-Backup-Health`

## Environment

Production validation:

```bash
npm run validate:env:prod
```

Important security vars:

- `APP_TRUST_PROXY=cloudflare|none`
- `WEB_PUSH_ALLOWED_HOSTS=host1,host2`
- `SESSION_SECRET`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_SITE_URL`

## Release Gate

```bash
npm run release:solid
npm run security:audit
npm run validate:env:prod
```

`release:solid` includes `security:audit`.

## Production Checks

```bash
npm run verify:prod
```

Checks must remain benign: no brute force, no origin bypass, no fuzzing, no load test.
