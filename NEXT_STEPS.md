# Maison Olive — Next Steps (ordre d'exécution)

Ce document sert de runbook court pour le prochain sprint de mise en production.

## 1) Variables production (obligatoire)

1. Copier le template:
   ```bash
   cp .env.production.example .env.production.local
   ```
2. Renseigner au minimum:
   - `SESSION_SECRET` (fort, 32+ chars)
   - `NEXT_PUBLIC_SITE_URL` (domaine réel)
   - `DATABASE_URL`
3. Valider:
   ```bash
   npm run validate:env:prod
   ```

### Générer un SESSION_SECRET rapidement

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 2) Déploiement contrôlé

```bash
npm ci
npm run prisma:generate
npm run build
npm run start
```

Si c'est le premier déploiement DB:

```bash
npm run prisma:migrate -- --name prod-init
```

## 3) Smoke tests post-déploiement

App en ligne, exécuter:

```bash
NEXT_PUBLIC_SITE_URL="https://ton-domaine" npm run smoke
```

Attendu:
- `/api/health` => OK
- `/api/admin/orders` => 401/403 sans session
- `/api/admin/customers` => 401/403 sans session
- `/api/admin/taxes` => 401/403 sans session

## 4) Validation business finale

- Créer compte client
- Passer commande
- Vérifier historique
- Vérifier panel admin
- Si Stripe activé: confirmer webhook `checkout.session.completed`
- Si Resend activé: confirmer email réel reçu

## 5) Go / No-Go

**GO** seulement si:
- `validate:env:prod` vert
- build vert
- smoke vert
- parcours client/admin vert

Sinon: **NO-GO**, corriger puis retester.
