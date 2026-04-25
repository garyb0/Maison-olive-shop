# Chez Olive — Checklist de Cutover Domaine

## 1. Préparer l'environnement

1. Copier `.env.production.example` vers `.env.production.local`
2. Remplir au minimum:
   - `NEXT_PUBLIC_SITE_URL=https://chezolive.ca`
   - `DATABASE_URL`
   - `SESSION_SECRET`
   - `BUSINESS_SUPPORT_EMAIL`
3. Ajouter si utilisé:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `RESEND_API_KEY`
   - `RESEND_FROM_EMAIL`

## 2. Vérifier avant bascule

1. `npx tsx scripts/validate-env.ts production`
2. `npx tsc --noEmit`
3. `npm run build`
4. `NEXT_PUBLIC_SITE_URL="https://ton-domaine" npm run smoke`

## 3. Vérifier les flux critiques

1. Accueil
2. Login / register / reset password
3. Panier / checkout
4. Commande / confirmation
5. Admin
6. QR chien public
7. `account/dogs`
8. Support

## 4. QR chiens

1. Vérifier que `admin/dogs` n'affiche plus d'avertissement `localhost`
2. Tester un token vierge sur le vrai domaine
3. Générer les exports vendeur seulement après ce test

## 5. DNS et hébergement

1. Pointer le domaine vers la machine cible
   - `chezolive.ca`
   - `www.chezolive.ca`
   - optionnel: `chezolive.com` et `www.chezolive.com` si tu veux la redirection
2. Activer HTTPS
3. Vérifier `/api/health`
4. Démarrer l'app avec PM2 ou l'équivalent
5. Confirmer les backups DB quotidiens

Note reseau actuelle:

- le port `80` n'est pas disponible sur le reseau local
- le port `21` n'est pas disponible non plus
- ne pas choisir une strategie qui depend de HTTP-01 sur `80` ou de FTP sur `21`
- si on reste sur PC, prevoir DNS challenge Cloudflare, tunnel Cloudflare, ou autre approche sans port `80`

Strategie active:

- utiliser `Cloudflare Tunnel`
- garder `chezolive-tunnel` online dans PM2
- ne pas reactiver la tache `chezolive-Cloudflare-DDNS` tant que le tunnel est utilise
- verifier `https://chezolive.ca/api/health` depuis un navigateur ou un telephone hors reseau local

## 6. Go live

Tu peux considérer la bascule prête quand:

- `validate-env` prod est vert
- le build est vert
- `/api/health` est vert
- un QR chien fonctionne sur le vrai domaine
- un flux commande complet a été testé
