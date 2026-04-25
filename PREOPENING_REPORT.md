# Rapport de pre-ouverture Chez Olive

Date: 2026-04-15

## Verdict court

Le socle technique est pret pour une validation pre-ouverture controlee. L'application, le tunnel Cloudflare, les domaines publics et les tests critiques sont verts. Les points qui restent avant une ouverture commerciale complete sont surtout operationnels: Stripe live, email transactionnel reel, dernier test manuel client/admin, puis decision d'ouvrir ou de rester en maintenance.

## Valide aujourd'hui

- Domaine principal conserve: `https://chezolive.ca`
- Alias fonctionnels via le meme tunnel:
  - `https://www.chezolive.ca`
  - `https://chezolive.com`
  - `https://www.chezolive.com`
- Healthchecks publics valides:
  - `https://chezolive.ca/api/health` -> 200
  - `https://www.chezolive.ca/api/health` -> 200
  - `https://chezolive.com/api/health` -> 200
  - `https://www.chezolive.com/api/health` -> 200
- PM2:
  - `chez-olive-shop` online
  - `chezolive-tunnel` online
- Backup:
  - tache `MaisonOlive-DB-Backup` active
  - prochain backup planifie le 2026-04-16 a 03:30
  - backup valide recent: `daily-20260415-070850.db`
- Environnement production:
  - `npx tsx scripts/validate-env.ts production` passe
  - `NEXT_PUBLIC_SITE_URL=https://chezolive.ca`
  - `DATABASE_URL=file:./prod.db`
  - `SESSION_SECRET` non-defaut configure

## Corrections faites dans cette passe

- `admin/products` ne selectionne plus `costCents` pour la page produits.
- Les retours API produits admin utilises par l'ecran produits restent centres sur vente/stock, sans transporter le cout.
- Ajout d'un test anti-fuite pour confirmer que la selection `admin/products` ne demande pas `costCents`.
- Confirmation que le widget support client ne contient plus le vieux parcours promo/lead capture.
- Confirmation que `/api/reset-test-password` retourne `404`.

## Validations executees

- `npx tsc --noEmit` -> OK
- Tests cibles securite/admin/QR:
  - 11 fichiers
  - 36 tests passes
- `npm run test:critical` -> OK
  - 7 fichiers
  - 19 tests passes
- `npm run build` -> OK
- PM2 redemarre et sauvegarde apres build -> OK
- Healthcheck local `http://localhost:3101/api/health` -> OK
- `npm run smoke` local -> OK
  - health OK
  - `/api/admin/orders` non connecte -> 401
  - `/api/admin/customers` non connecte -> 401
  - `/api/admin/taxes` non connecte -> 401

## Points a valider manuellement avant ouverture

- Parcours client complet:
  - inscription
  - connexion
  - mot de passe oublie
  - changement de mot de passe
  - panier
  - checkout
  - code postal valide
  - code postal hors zone
  - commande visible dans le compte
- Parcours admin complet:
  - ouvrir une commande
  - changer `status`, `paymentStatus`, `deliveryStatus`
  - verifier l'historique commande
  - gerer produits et stock
  - voir clients
  - exporter QR chiens vendeur
  - activer/desactiver maintenance
- Parcours QR chien:
  - token vierge
  - claim
  - creation fiche
  - upload photo
  - page publique
  - modification depuis compte

## Bloquants commerciaux restants

- Stripe live non configure:
  - `STRIPE_SECRET_KEY` vide
  - `STRIPE_WEBHOOK_SECRET` vide
- Email transactionnel reel non configure:
  - `RESEND_API_KEY` vide
  - `RESEND_FROM_EMAIL` encore sur valeur par defaut si Resend est active plus tard
- Tant que ces deux blocs ne sont pas configures, privilegier une ouverture controlee avec paiement manuel/validation admin.

## Recommandation d'ouverture

Garder le site en maintenance pendant le dernier test manuel. Quand les parcours client/admin sont confirmes, ouvrir progressivement sur `chezolive.ca`. Garder `chezolive.com` comme alias court terme, puis mettre une redirection permanente `.com -> .ca` quand tout est stable.
