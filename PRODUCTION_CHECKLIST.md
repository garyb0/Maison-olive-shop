# Maison Olive — Checklist Go‑Live (Production)

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

Stripe (si activé):
- [ ] `STRIPE_SECRET_KEY` (live)
- [ ] `STRIPE_WEBHOOK_SECRET` (live)

Email transactionnel (Resend):
- [ ] `RESEND_API_KEY`
- [ ] `RESEND_FROM_EMAIL` (domaine vérifié)

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
- [ ] Health check API répond OK (`/api/health`)
- [ ] Erreurs runtime surveillées (logs)

### Commandes utiles

```bash
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

### Email
- [ ] Email confirmation commande reçu
- [ ] Expéditeur vérifié (pas d’adresse sandbox en prod)

---

## 7) Validation fonctionnelle (UAT)

- [ ] Création compte client
- [ ] Login/logout
- [ ] Ajout panier + checkout
- [ ] Historique commandes
- [ ] Re-commande depuis historique
- [ ] Admin: vue commandes / clients / taxes / inventaire

---

## 8) Monitoring & exploitation

- [ ] Logs applicatifs centralisés
- [ ] Alertes minimales (erreurs 5xx, downtime)
- [ ] Suivi des commandes en erreur
- [ ] Processus de support documenté

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
git bundle create maison-olive-backup.bundle --all

# 5) Tester la restauration depuis le bundle
git clone maison-olive-backup.bundle maison-olive-restore-test
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
