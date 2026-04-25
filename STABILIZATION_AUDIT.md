# Stabilization Audit

Last updated: 2026-04-13

## Goal

This phase is no longer about adding major features first. The current priority is to make the existing product easier to operate, safer to ship, and more coherent across the admin and QR dog flows.

## Current Source Of Truth

- Admin shell and navigation:
  - `src/app/admin/layout.tsx`
  - `src/app/admin/admin-sidebar.tsx`
- Admin dashboards and main sections:
  - `src/app/admin/page.tsx`
  - `src/app/admin/orders/**`
  - `src/app/admin/customers/**`
  - `src/app/admin/delivery/**`
  - `src/app/admin/dogs/**`
  - `src/app/admin/products/**`
  - `src/app/admin/support/**`
  - `src/app/admin/taxes/**`
- Dog QR public and account flows:
  - `src/app/dog/**`
  - `src/app/account/dogs/**`
  - `src/app/api/account/dogs/**`
  - `src/app/api/admin/dogs/**`
  - `src/lib/dogs.ts`
- Support chat:
  - `src/components/SupportChatWidget.tsx`
  - `src/components/AdminSupportPanel.tsx`
  - `src/components/ConditionalSupportChat.tsx`
  - `src/components/GlobalSupportChat.tsx`
- Maintenance:
  - `src/app/maintenance/page.tsx`
  - `src/lib/maintenance.ts`

## QR Production Rules

- Every medal must use one unique URL.
- The public format is `SITE_URL/dog/<publicToken>`.
- Only active and unclaimed tokens should be exported for fabrication.
- Claimed tokens are customer-owned and should not be sent to the vendor.
- Disabled tokens should not be sent to the vendor.
- `NEXT_PUBLIC_SITE_URL` must be set to the real public domain before creating the final vendor export.

## Recommended Vendor Export

Use `admin/dogs` and export only:

- active tokens
- unclaimed tokens
- production domain, never localhost

Keep one row per medal:

- `publicToken`
- `relativeUrl`
- `fullUrl`

Optionally provide a TXT file with one full URL per line for QR generation.

## Critical Checks Before Real Use

- `npx tsc --noEmit`
- `npm run build`
- `npm run test:critical`
- `npx vitest run src/tests/account-dogs-route.test.ts src/tests/admin-dogs-route.test.ts src/tests/admin-orders-delivery-status-route.test.ts`

## Known Operational Notes

- The repository is still in a very dirty state. Do not assume `git status` reflects one isolated feature branch.
- Several new routes and screens are still untracked. Before release, make sure the intended files are actually committed.
- If QR exports still show `localhost`, stop and fix `NEXT_PUBLIC_SITE_URL` before sharing links outside the machine.
