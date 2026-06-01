# Security Runbook

## Before Remediation Or Deployment

1. Work from a clean branch or worktree.
2. Run the manual backup only:

```bash
npm run db:backup -- security-remediation-pre
```

3. Do not enable Windows scheduled backup tasks unless Gary explicitly requests it.
4. Run:

```bash
npm run security:audit
npm run validate:env:prod
```

## Secret Rotation

Treat exposed local artifacts as compromised until rotated externally:

- Android signing credentials.
- Cloudflare tokens/configs.
- Password reset helper credentials.
- Raw session tokens.

After `Session.tokenHash` deployment, all existing sessions are invalidated by migration.

## Release Verification

Run the full benign gate:

```bash
npm run test:module:auth
npm run test:module:stripe
npm run test:module:orders
npm run test:module:support
npm run test:critical
npm run lint
npx tsc --noEmit
npm run build
npm run validate:env:prod
npm run security:audit
```

After deploy, run only benign production checks:

```bash
npm run verify:prod
```

## Incident Handling

- Preserve logs and audit rows.
- Rotate the affected secret first.
- Revoke sessions if auth/session material may have leaked.
- Prefer reversible mitigations before data mutations.
- Document timeline, root cause, blast radius, and follow-up tests.
