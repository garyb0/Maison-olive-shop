# Chez Olive — Préparation migration domaine

Ce document sert de passerelle entre le local et la vraie mise en ligne.

## 1. Avant toute bascule

- définir le vrai domaine dans `NEXT_PUBLIC_SITE_URL`
- vérifier que `validateEnv("production")` ne remonte aucune erreur
- confirmer que `DATABASE_URL` ne pointe plus vers `dev.db`
- préparer `SESSION_SECRET`, email support, Stripe et email transactionnel

## 2. QR chiens

- ne jamais envoyer d'export vendeur si le domaine QR pointe encore vers `localhost`
- n'exporter au vendeur que les tokens `actifs + non reclames`
- refaire les exports QR apres configuration du vrai domaine

## 3. Paiement et emails

- verifier les URLs Stripe `success` / `cancel` / webhook
- verifier les liens de reset password et de confirmation email
- ne pas garder `Chez Olive <onboarding@resend.dev>` en production

## 4. Hebergement

Quel que soit le choix:

- HTTPS actif
- process manager actif
- `/api/health` vert
- backup quotidien de la base
- procedure de relance et rollback testee

## 4.1. Contrainte reseau actuelle

Note importante pour l'hebergement sur PC:

- le port `80` ne peut pas fonctionner sur le reseau local actuel
- le port `21` ne peut pas fonctionner non plus
- ne pas planifier de mise en ligne qui depend de `80` ou `21`

Impact:

- Caddy ne pourra pas utiliser le challenge HTTP classique sur le port `80`
- privilegier une solution HTTPS qui ne depend pas du port `80`, par exemple DNS challenge Cloudflare, tunnel Cloudflare, ou VPS
- FTP sur `21` n'est pas une option a retenir pour ce reseau

## 4.2. Strategie active retenue

La strategie active est maintenant `Cloudflare Tunnel`:

- aucun port routeur `80` ou `443` n'est requis
- `chezolive.ca` et `www.chezolive.ca` routent vers le tunnel `chezolive-local`
- PM2 supervise deux processus:
  - `chez-olive-shop`
  - `chezolive-tunnel`
- le DDNS Cloudflare a ete prepare, mais la tache `chezolive-Cloudflare-DDNS` est desactivee pour eviter les conflits avec le tunnel

## 4.3. Secours public externe

En cas de panne origin / tunnel / app, un mode maintenance externe Cloudflare
peut etre active pour afficher une page statique sans dependre du site local.

Reference:

- `CLOUDFLARE_MAINTENANCE_WORKER.md`

Regle pratique:

- maintenance planifiee -> utiliser le mode maintenance dans l'app
- incident majeur -> activer le Worker Cloudflare de secours

## 5. Validation finale

- accueil
- login / register / reset password
- panier / checkout
- commande / confirmation
- admin
- QR chien public
- account dogs
- support

Quand tout est bon, tu peux generer les exports vendeur definitifs.
