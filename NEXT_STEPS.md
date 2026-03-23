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

## 2.1) Local-first sans perte (recommandé)

Avant toute migration locale, utilise la commande safe:

```bash
npm run prisma:migrate:safe -- local-change-name
```

Cette commande:
- crée un backup SQLite dans `backups/` (avec manifest JSON),
- puis lance la migration Prisma.

Backup manuel:

```bash
npm run db:backup -- manual
```

Restore du dernier backup:

```bash
npm run db:restore
```

Restore d’un backup précis:

```bash
npm run db:restore -- backups/mon-backup.db
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

## 3.1) Observabilité minimale (maintenant en place)

- Les routes API clés loggent des événements JSON (`INFO/WARN/ERROR`) pour faciliter le debug.
- Le health endpoint retourne maintenant:
  - `ok`
  - `service`
  - `version`
  - `timestamp`

En cas d’incident, commence par:
1. vérifier `/api/health`,
2. relancer `npm run smoke`,
3. inspecter les logs JSON des routes API concernées.

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
