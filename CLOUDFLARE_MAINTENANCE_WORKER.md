# Cloudflare Maintenance Worker

This runbook adds an **external maintenance page** served by Cloudflare, independent
from the Next.js app, PM2, and the local PC.

Use this only for **major incidents** or emergency maintenance.

## Why this exists

The current in-app maintenance mode depends on:

- the local machine being online
- PM2 being healthy
- the app responding
- Cloudflare Tunnel reaching the origin

If one of those fails, the visitor can still get an origin error. This Worker is
the hard fallback.

## What it does

- returns a static HTML page from Cloudflare Workers
- returns HTTP `503 Service Unavailable`
- sets `Retry-After`
- bypasses the origin entirely while active

## Worker file

Use:

`scripts/cloudflare/chezolive-maintenance-worker.js`

## Worker name

Recommended:

`chezolive-maintenance`

## Domains to cover

Attach the Worker to all public domains:

- `chezolive.ca/*`
- `www.chezolive.ca/*`
- `chezolive.com/*`
- `www.chezolive.com/*`

## Normal operating mode

Do **not** leave the routes attached permanently.

Routine behavior should remain:

- normal traffic -> Cloudflare Tunnel -> local app
- planned maintenance -> in-app `/maintenance`

## When to use the Worker

Activate the Worker when:

- the local PC is offline
- PM2 is down
- the app is failing hard
- the tunnel is broken
- you need an emergency public stop page

Do not use it for everyday scheduled maintenance that is already handled inside the app.

## How to create it in Cloudflare

1. Open Cloudflare dashboard
2. Go to `Workers & Pages`
3. Create a new Worker
4. Name it `chezolive-maintenance`
5. Replace the default script with the content of:
   - `scripts/cloudflare/chezolive-maintenance-worker.js`
6. Deploy the Worker

## How to activate it

1. Open the Worker in Cloudflare
2. Add these routes:
   - `chezolive.ca/*`
   - `www.chezolive.ca/*`
   - `chezolive.com/*`
   - `www.chezolive.com/*`
3. Save routes
4. Test each public domain

Expected result:

- the maintenance page is shown
- response status is `503`
- `/admin` and `/api/health` are also blocked publicly

## How to deactivate it

1. Open the Worker routes in Cloudflare
2. Remove or disable the 4 public routes
3. Re-test public domains

Expected result:

- traffic returns to the tunnel/app
- normal homepage and app routes are back

## Validation checklist

### Before activation

- `https://chezolive.ca` loads the real app
- `https://www.chezolive.ca` loads the real app
- `https://chezolive.com` follows normal behavior
- `https://www.chezolive.com` follows normal behavior

### During Cloudflare maintenance

- all 4 domains show the external page
- status code is `503`
- public `/admin` is blocked
- public `/api/health` is blocked

### After deactivation

- all 4 domains return to the live app
- the normal in-app maintenance system still works

## Relationship with the current maintenance mode

### In-app maintenance

- good for planned maintenance
- supports scheduled reopening
- admin/login/API exceptions exist
- depends on the origin being reachable

### Cloudflare maintenance

- good for origin outage or emergency stop
- fully external to the app
- no public bypass
- manual activation only

## Recommendation

Keep both systems:

- use **app maintenance** for planned work
- use **Cloudflare maintenance** for emergency public failover
