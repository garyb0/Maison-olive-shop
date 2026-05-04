# Preparation release Chez Olive

Objectif: garder le code, les donnees et les secrets separes pour qu'une reprise, une migration serveur ou une demo stable soit propre.

## Structure cible

- Code: `maison-olive-shop`
- Donnees hors repo: `../maison-olive-data`
- Base SQLite prod: `../maison-olive-data/db/prod.db`
- Backups SQLite: `../maison-olive-data/backups`
- Logs PM2: `../maison-olive-data/logs`
- Secrets long terme: variables d'environnement du serveur/PM2, pas dans Git
- Fichiers secrets locaux serveur: `../maison-olive-data/secrets/chez-olive.production.env` et `../maison-olive-data/secrets/chez-olive.development.env`

## Preparation initiale

1. Lancer la preparation non destructive:

   ```bash
   npm run release:prepare-data-root
   ```

2. Verifier les valeurs suggerees par la commande:

   ```bash
   CHEZOLIVE_DATA_ROOT=../maison-olive-data
   DATABASE_URL=file:../maison-olive-data/db/prod.db
   CHEZOLIVE_BACKUP_DIR=../maison-olive-data/backups
   CHEZOLIVE_LOG_DIR=../maison-olive-data/logs
   ```

3. Copier ces valeurs dans l'environnement de production quand la bascule est desiree.

4. Garder `.env.production.local` hors Git. A terme, deplacer les vraies valeurs sensibles dans l'environnement du serveur ou de PM2.
   Sur ce serveur, `.env.production.local` est maintenant un stub: il ne contient pas les cles sensibles et pointe vers le fichier secret externe.

## Commandes utiles

```bash
npm run release:solid
npm run test:e2e:mobile-solid
npm run test:e2e:delivery-solid
npm run validate:env:prod
npm run db:backup -- release-check
npm run db:backup:hourly
npm run db:backup:health
npm run ops:status
npm run build
npm run host:pm2:restart
```

## Gate version solide

Avant une release visible, lancer:

```bash
npm run release:solid
```

La gate execute audit release, TypeScript, modules critiques, Playwright mobile/PWA, build et `ops:status`.
Les captures sont conservees dans `test-results/solid-release/<runId>/`.
Le smoke compte prod reste volontairement separe:

```bash
npm run db:backup -- --env=production before-solid-release
npm run smoke:account -- --env=production --base-url=https://chezolive.ca --allow-remote --cleanup=always
```

Pour la recette livreur sandbox complete:

```bash
npm run delivery:sandbox:setup
npm run delivery:sandbox:dev
npm run test:e2e:delivery-solid
```

## Regles de securite

- Ne jamais committer `.env*`, `*.db`, `backups/`, `logs/` ou des exports clients.
- Ne jamais mettre `SESSION_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_MAPS_API_KEY` ou donnees privees de depot dans les `.env*` du repo.
- Avant migration Prisma ou release sensible, lancer `npm run db:backup -- before-release`.
- Garder `MaisonOlive-DB-Backup` actif pour le backup quotidien et `MaisonOlive-DB-Backup-Health` actif pour verifier les backups.
- `MaisonOlive-DB-Backup-Hourly` doit utiliser `scripts/windows/db-backup-hourly-hidden.ps1` pour eviter les fenetres CMD visibles. Si la tache est desactivee temporairement, la reactiver avec `Enable-ScheduledTask -TaskName "MaisonOlive-DB-Backup-Hourly"` apres test manuel.
- Lancer `npm run db:backup:health` apres les changements serveur pour verifier que le dernier backup s'ouvre et passe `PRAGMA integrity_check`.
- Si un secret est affiche dans un log, le considerer compromis et le remplacer.
- Les vrais secrets Stripe, OpenAI, email et session doivent rester serveur-only.

## Recette telephone PWA

Cette recette complete les tests Playwright; elle ne remplace pas les smokes automatises.

1. Android Chrome:
   - Ouvrir `https://chezolive.ca/app`.
   - Installer avec le bouton navigateur ou le CTA Chez Olive.
   - Ouvrir l'app installee, verifier `/app`, boutique, panier et support.
   - Connecter un compte smoke/client, cliquer `Tester une notification`, puis verifier le centre d'actions.

2. iPhone Safari:
   - Ouvrir `https://chezolive.ca/app`.
   - Utiliser Partager > Sur l'ecran d'accueil.
   - Ouvrir l'icone installee, verifier que l'app reste optionnelle et que le site navigateur fonctionne encore.
   - Tester une notification depuis l'app installee si le push web est supporte et autorise.

3. Livreur:
   - Ouvrir un lien `/driver/run/<token>` sandbox.
   - Verifier Waze, demarrage, arrivee GPS suggeree et file hors ligne.
   - Activer `Recevoir les alertes de cette tournee` seulement en opt-in; la tournee doit rester livrable sans push.

4. Admin mobile:
   - Ouvrir `/app` avec le compte smoke admin.
   - Verifier Admin quotidien, centre d'actions, support, stock, livraison et sante.

## Reste a finaliser

- Remplacer les fichiers secrets locaux par un vrai gestionnaire hote/PM2/Windows env si le serveur est transfere a une autre machine.
- Ajouter une copie hors machine des backups: disque externe, NAS ou stockage cloud chiffre.
- Planifier une retention de backups: quotidien 14 jours, hebdomadaire 8 semaines, mensuel 12 mois.

## Etat de ce serveur

- Release live validee le 2026-05-03: `nFPiPrq3dnAW1Iu_Zm7Sr`.
- Backup avant release: `before-suite-release-20260503-071453.db`.
- PM2: `chez-olive-shop` et `chezolive-tunnel` en ligne apres reload.
- Smoke prod livraison: PASS, 35 checks, 0 warning, 0 fail.
- Smoke prod compte: PASS, 15 checks, 0 warning, 0 fail.
- `DATABASE_URL` production pointe deja vers `../maison-olive-data/db/prod.db`.
- Les DB de developpement locales pointent aussi vers `../maison-olive-data/db`.
- Les backups de verification sont dans `../maison-olive-data/backups`.
- Les vrais secrets ont ete deplaces vers `../maison-olive-data/secrets`.
- Les anciens fichiers `.env*` complets ont ete sauvegardes dans `../maison-olive-data/secrets/env-file-backups`.
- Les anciennes DB/backups/logs qui etaient dans le repo ont ete deplaces vers `../maison-olive-data/legacy-repo-sensitive-*`.

## Paquet de commit recommande

- Commit 1: hygiene serveur, backups, env validation, release audit et checklist.
- Commit 2: centre d'aide, PWA `/app`, page offline, navigation/footer mobile.
- Commit 3: compte client, chiens QR, boutique, panier et checkout mobile.
- Commit 4: support admin/client, workflows support et tests associes.
- Commit 5: livraison/livreur copilote, sandbox, smokes et tests Playwright.
