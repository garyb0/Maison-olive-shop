# Chez Olive — Checklist Go‑Live (Production)

Checklist opérationnelle pour passer de **"ça marche en local"** à **"prêt en production"**.

---

## 1) Préparation environnement

- [ ] Node.js version validée (>= 18)
- [ ] Déploiement cible choisi (VPS / PaaS / Docker)
- [ ] Domaine configuré + DNS prêt
- [ ] HTTPS/SSL actif (obligatoire)

---

## 2) Variables d’environnement (obligatoire)

Créer des variables **production** (jamais dans Git):

- [ ] `NODE_ENV=production`
- [ ] `NEXT_PUBLIC_SITE_URL=https://<ton-domaine>`
- [ ] `SESSION_SECRET=<secret_32+_chars>`
- [ ] `DATABASE_URL=<database_prod>`
- [ ] `BUSINESS_SUPPORT_EMAIL=<email_support>`
- [ ] `DATABASE_URL` ne pointe plus vers `dev.db`
- [ ] `NEXT_PUBLIC_SITE_URL` n'utilise pas `localhost`
- [ ] `NEXT_PUBLIC_SITE_URL` utilise bien `https`

Stripe (si activé):
- [ ] `STRIPE_SECRET_KEY` (live)
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (live, clé publique `pk_live_...`)
- [ ] `STRIPE_WEBHOOK_SECRET` (live)

Email transactionnel (Resend):
- [ ] `RESEND_API_KEY`
- [ ] `RESEND_FROM_EMAIL` (domaine vérifié)

Notifications / connexions optionnelles:
- [ ] Web Push configuré si les notifications navigateur sont offertes (`WEB_PUSH_*` + `NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY`)
- [ ] Firebase configuré si les notifications Android natives sont envoyées (`FIREBASE_*`)
- [ ] Google OAuth configuré si le bouton Google est visible (`GOOGLE_OAUTH_*`)

---

## 3) Base de données

- [ ] Backup initial avant toute migration
- [ ] Migrations appliquées sur la base de prod
- [ ] Seed exécuté si nécessaire (produits initiaux)
- [ ] Plan de backup récurrent (quotidien minimum)
- [ ] Procédure de restore testée

### Commandes utiles

```bash
npm ci
npm run prisma:generate
npm run prisma:migrate -- --name prod-init
npm run seed
```

---

## 4) Qualité technique (gates)

- [ ] Lint passe sans erreur
- [ ] Build production passe
- [ ] Gate solide passe (`npm run release:solid`)
- [ ] Captures mobile/PWA revues dans `test-results/solid-release/<runId>/`
- [ ] Health check API répond OK (`/api/health`)
- [ ] Erreurs runtime surveillées (logs)

### Commandes utiles

```bash
npm run release:solid
npm run lint
npm run build
npm run start
```

---

## 5) Sécurité

- [ ] `.env` jamais commité
- [ ] Secret session robuste et unique
- [ ] Routes admin/API sensibles testées non authentifiées (doivent refuser)
- [ ] Compte admin protégé (mot de passe fort)
- [ ] Journal d’audit actif
- [ ] Limitation des accès serveur (SSH, firewall, etc.)

---

## 6) Paiement & email (validation réelle)

### Stripe
- [ ] Checkout complet validé (commande -> paiement -> retour)
- [ ] Webhook reçu en prod et commande marquée `PAID`
- [ ] Cas annulation/expiration testé
- [ ] Si des produits récurrents sont vendus: abonnement Stripe validé end-to-end en live

Note:
- Les commandes Stripe one-time ont déjà été validées en production.
- Le flux abonnement Stripe n'est pas encore validé end-to-end en live au moment de cette note.

### Email
- [ ] Email confirmation commande reçu
- [ ] Expéditeur vérifié (pas d’adresse sandbox en prod)
- [ ] Liens email (reset password / support) pointent vers le vrai domaine

---

## 7) Validation fonctionnelle (UAT)

- [ ] Création compte client
- [ ] Login/logout
- [ ] Ajout panier + checkout
- [ ] Historique commandes
- [ ] Re-commande depuis historique
- [ ] Admin: vue commandes / clients / taxes / inventaire
- [ ] QR chiens: scan -> claim -> fiche publique
- [ ] Export vendeur QR généré uniquement avec le vrai domaine

---

## 8) Monitoring & exploitation

- [ ] Logs applicatifs centralisés
- [ ] Alertes minimales (erreurs 5xx, downtime)
- [ ] Suivi des commandes en erreur
- [ ] Processus de support documenté
- [ ] Procédure de maintenance Cloudflare de secours documentée
- [ ] Worker Cloudflare de maintenance prêt à activer en cas de panne origin
- [ ] `npm run ops:status` passe sans `FAIL`
- [ ] `ops:status` confirme PM2, release, backups, push/env et dernier smoke account
- [ ] Politique backup respectée: ne pas réactiver `MaisonOlive-DB-Backup`, `MaisonOlive-DB-Backup-Hourly` ou `MaisonOlive-DB-Backup-Health` sans demande explicite de Gary
- [ ] Backup manuel récent effectué avant release sensible: `npm run db:backup -- manual`
- [ ] Si Gary demande de réactiver le backup Windows: diagnostic backup horaire OK (`npm run ops:backup-hourly:diagnose`)

### Backup Windows

```powershell
# Backup manuel autorisé
npm run db:backup -- manual

# Réinstaller/forcer la tâche horaire cachée seulement si Gary le demande explicitement
npm run ops:backup-hourly:install

# Voir état, action, dernier résultat et logs récents seulement si la tâche est volontairement active
npm run ops:backup-hourly:diagnose

# Santé complète ops
npm run ops:status
```

Notes:
- Ne pas réactiver les tâches Windows `MaisonOlive-DB-Backup`, `MaisonOlive-DB-Backup-Hourly` ou `MaisonOlive-DB-Backup-Health` sans demande explicite de Gary.
- La tâche horaire doit utiliser `powershell.exe -WindowStyle Hidden -File scripts/windows/db-backup-hourly-hidden.ps1`.
- Le vieux wrapper `scripts/windows/db-backup-hourly.cmd` ne doit pas être l'action de la tâche horaire.
- Les logs horaires sont dans `maison-olive-data/logs` et le wrapper garde environ 14 jours de logs.
- Le compte `smoke.admin@chezolive.local` est réservé aux smokes automatisés; ses secrets restent dans les variables d'environnement Windows utilisateur, jamais dans Git.

---

## 9) Backup Git (code) ✅

Objectif: ne jamais dépendre d’une seule copie du code.

- [ ] Repo poussé sur un remote principal (`origin`)
- [ ] 2e backup Git configuré (mirror sur autre provider ou repo privé backup)
- [ ] Branche `main` protégée (pas de push direct non contrôlé)
- [ ] Tag de release créé avant chaque déploiement (ex: `v1.0.0`)
- [ ] Export offline périodique via `git bundle`
- [ ] Test de restauration Git fait au moins 1 fois (clone depuis backup/bundle)

### Commandes utiles (backup Git)

```bash
# 1) Vérifier les remotes
git remote -v

# 2) Ajouter un remote backup (exemple)
git remote add backup <url-du-repo-backup>

# 3) Pousser vers origin + backup
git push origin main --tags
git push backup main --tags

# 4) Créer un bundle offline complet
git bundle create Chez-olive-backup.bundle --all

# 5) Tester la restauration depuis le bundle
git clone Chez-olive-backup.bundle Chez-olive-restore-test
```

---

## 10) Plan de rollback

- [ ] Procédure rollback applicative documentée
- [ ] Procédure rollback DB documentée
- [ ] Personne responsable identifiée

---

## 11) Go/No-Go final

Critères **GO**:

- [ ] Gates techniques OK (lint/build/health)
- [ ] Flux commande/paiement/email OK
- [ ] Sécurité minimale validée
- [ ] Backup + restore validés

Si un point critique échoue => **NO-GO** jusqu’à correction.

---

## Commandes de lancement production (rappel)

```bash
npm ci
npm run prisma:generate
npm run build
npm run start
```

