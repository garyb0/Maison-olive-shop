# Maison Olive Shop 🐾

Site e-commerce complet pour vendre des produits pour animaux, construit pour **Olive** (notre bulldog français adoré).

## ⚡ TL;DR (Quoi faire maintenant)

Si tu veux juste lancer et tester tout de suite:

```bash
npm install
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run seed
npm run dev
```

Puis ouvre `http://localhost:3000`.

> 📋 Pour une mise en production étape par étape, utilise la checklist dédiée: **`PRODUCTION_CHECKLIST.md`**
>
> 🛟 Pour une migration sans perte (local -> infra publique), consulte: **`MIGRATION_GUIDE.md`**
>
> 🖥️ Pour héberger sur ton PC (Windows) de façon stable: **`LOCAL_HOSTING_RUNBOOK.md`**

### Parcours de test rapide
1. Crée un compte client
2. Passe une commande
3. Ouvre Prisma Studio (`npm run prisma:studio`) et passe ton utilisateur en `ADMIN`
4. Reconnecte-toi et ouvre `/admin`

## 🎯 Fonctionnalités

### Côté Client
- ✅ Catalogue de produits bilingue (FR/EN)
- ✅ Panier d'achat et checkout
- ✅ Création de compte et authentification sécurisée
- ✅ Historique des commandes
- ✅ Re-commander rapidement depuis l'historique
- ✅ Interface responsive et moderne
- ✅ Pages business prêtes à vendre: FAQ, CGV, politique de retours

### Côté Admin
- ✅ Panneau d'administration complet
- ✅ Gestion des commandes avec filtres (statut, client)
- ✅ Gestion des clients
- ✅ Rapport de taxes (avec export CSV)
- ✅ Suivi de l'inventaire
- ✅ Audit logs pour toutes les actions critiques

### Techniques
- ✅ Next.js 16 (App Router)
- ✅ TypeScript strict
- ✅ Prisma v7 avec SQLite (via LibSQL adapter)
- ✅ Stripe intégration (optionnelle)
- ✅ Paiements manuels supportés
- ✅ Taxes canadiennes (TPS/TVQ) calculées automatiquement
- ✅ Transactions DB sécurisées pour les commandes + inventaire
- ✅ Sessions sécurisées avec tokens
- ✅ Email de confirmation de commande (placeholder prêt à brancher à un provider)

## 🚀 Démarrage Rapide

### Prérequis
- Node.js 18+ 
- npm ou yarn

### Installation

```bash
# 1. Installer les dépendances
npm install

# 2. Créer ton .env local depuis le template
cp .env.example .env
# puis ajuste les valeurs sensibles

# 3. Générer le client Prisma
npm run prisma:generate

# 4. Initialiser la base de données
npm run prisma:migrate -- --name init

# 5. Seed des données de test (produits)
npm run seed

# 6. Lancer en développement
npm run dev
```

Le site sera accessible sur `http://localhost:3000`

## 📦 Scripts Disponibles

```bash
npm run dev          # Démarrage en mode développement
npm run build        # Build de production
npm run start        # Démarrage du serveur de production
npm run lint         # Vérification du code
npm run validate:env:dev   # Validation env en mode développement
npm run validate:env:prod  # Validation env en mode production
npm run validate      # validate:env:dev + lint + build
npm run smoke         # Smoke checks API (health + protections admin)
npm run db:backup -- <label>      # Backup SQLite local dans /backups
npm run db:restore -- [file.db]   # Restore SQLite (backup sécurité auto avant restore)
npm run prisma:migrate:safe -- <name> # Backup auto + migration Prisma
npm run prisma:generate  # Génération du client Prisma
npm run prisma:migrate   # Exécution des migrations
npm run prisma:studio    # Interface visuelle pour la DB
```

## 🛟 Local-first sans perte de données (important)

Pour minimiser le risque de perte pendant les évolutions locales:

```bash
# 1) Backup manuel
npm run db:backup -- before-change

# 2) Migration sûre (backup auto + migration)
npm run prisma:migrate:safe -- add-new-field

# 3) Si besoin, restauration (backup sécurité auto avant restore)
npm run db:restore -- backups/ton-backup.db
```

Notes:
- Les backups SQLite sont stockés dans `backups/`.
- Les fichiers `backups/*.db` et `backups/*.db.json` sont ignorés par Git.
- Pour une DB managée (non `file:`), utiliser aussi les snapshots/backup provider.

## 🧪 Smoke checks rapides

Avec l'app démarrée (`npm run dev` ou `npm run start`), exécute:

```bash
npm run smoke
```

Le script vérifie:
- `/api/health` répond OK
- `/api/admin/orders`, `/api/admin/customers`, `/api/admin/taxes` refusent sans session admin (401/403)

## 🔐 Variables d'Environnement

Créez un fichier `.env` à la racine:

```env
# Base de données
DATABASE_URL="file:./dev.db"

# Session (générez une clé aléatoire sécurisée)
SESSION_SECRET="votre-secret-session-super-secure-ici"

# Stripe (optionnel, laissez vide pour paiements manuels uniquement)
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# Environnement
NODE_ENV=development

# Business / support
BUSINESS_SUPPORT_EMAIL="support@maisonolive.local"

# Email transactionnel (Resend)
# Laisse vide pour fallback console log en local
RESEND_API_KEY=""
RESEND_FROM_EMAIL="Maison Olive <onboarding@resend.dev>"
```

### Email transactionnel réel (Resend)

Le projet envoie déjà les confirmations de commande via `sendOrderConfirmationEmail`.

- Si `RESEND_API_KEY` est vide: fallback en log serveur (dev)
- Si `RESEND_API_KEY` est défini: envoi réel via API Resend

Pour passer en production:
1. Crée une clé API sur Resend
2. Configure `RESEND_API_KEY`
3. Configure `RESEND_FROM_EMAIL` avec un domaine vérifié Resend
4. Passe une commande test et vérifie la réception email

## 🔒 Checklist sécurité (avant prod)

1. Génère un vrai `SESSION_SECRET` (min. 32+ caractères aléatoires)
2. Configure de vraies clés Stripe/Resend en variables d'environnement serveur
3. Vérifie que `.env` n'est jamais committé (déjà couvert par `.gitignore`)
4. Lance un build propre: `npm run build`
5. Teste les routes sensibles non authentifiées (`/api/admin/*` => 401)

## 👤 Créer un Compte Admin

Après avoir lancé l'application:

1. Créez un compte utilisateur via l'interface
2. Accédez à la base de données:
   ```bash
   npm run prisma:studio
   ```
3. Dans la table `User`, changez le `role` de `CUSTOMER` à `ADMIN`
4. Reconnectez-vous pour accéder à `/admin`

## 💳 Configuration Stripe (Optionnel)

Si vous souhaitez activer les paiements Stripe:

1. Créez un compte sur [stripe.com](https://stripe.com)
2. Récupérez vos clés API (mode test pour commencer)
3. Ajoutez-les dans `.env`
4. Configurez le webhook Stripe pointant vers `/api/stripe/webhook`

**Sans Stripe:** Les clients peuvent toujours commander, le statut sera "PENDING" et un admin peut manuellement marquer la commande comme payée.

### ✅ Parcours Stripe mode test (end-to-end)

Le projet est prêt pour un flux Stripe test complet (checkout + webhook + mise à jour commande).

#### 1) Variables `.env`

Renseigne au minimum:

```env
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

> `STRIPE_WEBHOOK_SECRET` est fourni par Stripe CLI quand tu fais le forwarding local.

#### 2) Lancer l’app

```bash
npm run dev
```

#### 3) Installer Stripe CLI (si absent)

Windows (winget):

```bash
winget install Stripe.StripeCLI
```

Puis connexion:

```bash
stripe login
```

#### 4) Forward webhook Stripe vers l’app locale

```bash
stripe listen --forward-to http://localhost:3000/api/stripe/webhook
```

Copie le secret `whsec_...` affiché et mets-le dans `STRIPE_WEBHOOK_SECRET`.

#### 5) Tester un paiement Stripe

1. Crée/ouvre un compte client
2. Va sur `/checkout`
3. Choisis **Payer avec Stripe**
4. Utilise la carte test Stripe: `4242 4242 4242 4242`
5. Validation attendue:
   - retour sur `/account?paid=1`
   - commande marquée `PAID`
   - log d’audit `STRIPE_CHECKOUT_COMPLETED`

#### 6) Tester expiration/cancel (optionnel)

- Annule le checkout Stripe ou laisse la session expirer.
- Validation attendue:
  - retour sur `/account?cancelled=1`
  - commande `FAILED` + `CANCELLED`
  - log d’audit `STRIPE_CHECKOUT_EXPIRED`

## 🧾 Pages business (vente)

- FAQ: `/faq`
- Conditions générales de vente: `/terms`
- Politique de retours: `/returns`

## 📊 Structure du Projet

```
maison-olive-shop/
├── prisma/
│   ├── schema.prisma       # Schéma de la base de données
│   └── migrations/         # Historique des migrations
├── src/
│   ├── app/               # Pages Next.js (App Router)
│   │   ├── page.tsx       # Page d'accueil (catalogue)
│   │   ├── account/       # Espace client
│   │   ├── admin/         # Panneau admin
│   │   ├── checkout/      # Processus de commande
│   │   └── api/           # Routes API
│   │       ├── auth/      # Authentification
│   │       ├── orders/    # Gestion commandes
│   │       ├── products/  # Catalogue
│   │       └── admin/     # Admin API
│   └── lib/               # Logique métier
│       ├── prisma.ts      # Client DB
│       ├── auth.ts        # Gestion auth/session
│       ├── orders.ts      # Logique commandes
│       ├── catalog.ts     # Gestion produits
│       ├── admin.ts       # Fonctions admin
│       ├── taxes.ts       # Calcul taxes
│       └── ...
├── .env                   # Variables d'environnement
└── package.json
```

## 🛡️ Sécurité

- ✅ Mots de passe hashés avec bcrypt
- ✅ Sessions sécurisées avec expiration
- ✅ Protection CSRF via cookies HTTP-only
- ✅ Validation stricte des entrées utilisateur
- ✅ Transactions DB pour préserver l'intégrité des données
- ✅ Audit logs pour actions sensibles

## 🌍 Internationalisation

Le site supporte le français et l'anglais. La langue se sélectionne automatiquement selon la préférence du navigateur ou via le sélecteur de langue.

## 📝 Base de Données

Le projet utilise SQLite via Prisma pour sa simplicité. Pour passer en production, vous pouvez facilement migrer vers PostgreSQL en changeant la datasource dans `prisma/schema.prisma`.

### Modèles Principaux
- `User` - Clients et administrateurs
- `Product` - Catalogue produits (bilingue)
- `Order` - Commandes avec statuts
- `OrderItem` - Lignes de commande (snapshot des produits)
- `InventoryMovement` - Suivi des mouvements de stock
- `AuditLog` - Journal d'audit

## 🤝 Contribution

Le projet suit des pratiques strictes de sécurité des données. Consultez `CRITICAL_DATA_POLICY.md` avant toute modification.

## 📄 Licence

Ce projet est privé et destiné à un usage personnel.

---

**Fait avec ❤️ pour Olive 🐾**

## Production deployment checklist (quick)

1. **Production environment variables**
   - `SESSION_SECRET` strong secret (32+ random chars)
   - `NEXT_PUBLIC_SITE_URL` set to your real domain (`https://...`)
   - `DATABASE_URL` for production (not `dev.db`)
   - Stripe live keys (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) if card payments are enabled
   - Resend keys (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`) for real transactional emails

2. **Database**
   - Run migrations: `npm run prisma:migrate -- --name prod-init`
   - Seed initial data if needed: `npm run seed`
   - Configure regular backups

3. **Build and start**
   ```bash
   npm ci
   npm run prisma:generate
   npm run build
   npm run start
   ```

4. **Post-deploy validation**
   - Create account, login, logout
   - Place a test order
   - Verify `/admin` access with ADMIN account
   - Verify Stripe webhook and confirmation email

> Note: Turbopack root warning is handled in `next.config.ts` with `turbopack.root`.
