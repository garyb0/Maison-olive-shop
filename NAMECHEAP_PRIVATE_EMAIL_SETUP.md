# Namecheap Private Email Setup

This guide documents the production setup for `support@chezolive.ca` using
Namecheap Private Email with DNS hosted on Cloudflare.

## Goal

Set up a real mailbox that can receive and send email now, while keeping the
domain portable for future migration to another provider.

## Current assumptions

- Mail provider: Namecheap Private Email
- DNS provider: Cloudflare
- Primary support mailbox: `support@chezolive.ca`
- Transactional app sender is not migrated in this pass

## Required DNS records

Remove any old Namecheap forwarding MX records (`eforward*.registrar-servers.com`)
before adding these.

### MX

| Type | Name | Value | Priority | Proxy |
| --- | --- | --- | --- | --- |
| MX | `@` | `mx1.privateemail.com` | `10` | DNS only |
| MX | `@` | `mx2.privateemail.com` | `10` | DNS only |

### SPF

| Type | Name | Value |
| --- | --- | --- |
| TXT | `@` | `v=spf1 include:spf.privateemail.com ~all` |

### Service CNAMEs

These records must stay **DNS only** in Cloudflare.

| Type | Name | Value |
| --- | --- | --- |
| CNAME | `mail` | `privateemail.com` |
| CNAME | `autoconfig` | `privateemail.com` |
| CNAME | `autodiscover` | `privateemail.com` |

### DMARC

Start with observation mode:

| Type | Name | Value |
| --- | --- | --- |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:support@chezolive.ca` |

### DKIM

Add the DKIM TXT record exactly as provided by Namecheap after the mailbox is
created. The selector can vary, so copy the provider value directly.

## Namecheap steps

1. Buy or activate `Private Email Starter` for `chezolive.ca`.
2. Create mailbox `support@chezolive.ca`.
3. Open the Namecheap Private Email dashboard.
4. Confirm the mailbox is active.
5. Copy the DKIM host/value if Namecheap does not add it automatically.

## Cloudflare steps

1. Open the DNS zone for `chezolive.ca`.
2. Delete existing forwarding MX records.
3. Add MX, SPF, CNAME, and DMARC records from this document.
4. Add DKIM from Namecheap once available.
5. Leave mail-related CNAME records in **DNS only** mode.

## Validation workflow

Run:

```bash
npm run mail:check
```

Optional DKIM validation:

```bash
npm run mail:check -- --dkim-host <selector._domainkey.chezolive.ca>
```

Then manually validate:

1. Log in to Namecheap webmail with `support@chezolive.ca`
2. Send a message from an external mailbox to `support@chezolive.ca`
3. Reply from `support@chezolive.ca`
4. Inspect message headers for SPF and DKIM pass
5. Re-run tests after 15 to 60 minutes of DNS propagation

## Future migration

The public address stays `support@chezolive.ca` even if the provider changes.
Migration later requires:

- moving mailbox history if desired
- replacing MX/SPF/DKIM/DMARC DNS records
- re-testing send/receive
