# Delivery Change Workflow

Ce guide sert de garde-fou avant toute modification du systeme de livraison.

## Objectif

Pouvoir faire evoluer la livraison sans casser la prod, et revenir rapidement a un etat stable si besoin.

## Regles de base

- Ne jamais developper directement sur la version live.
- Garder `DELIVERY_EXPERIMENTAL_ROUTING_ENABLED="false"` en production tant que la nouvelle logique n'est pas validee.
- Travailler sur une branche dediee.
- Creer un checkpoint avant chaque changement de livraison important.

## Variables utiles

- `DELIVERY_EXPERIMENTAL_ROUTING_ENABLED`
  - `false` : comportement actuel, stable
  - `true` : active le mode de livraison experimental pour le checkout

## Workflow recommande

1. Se placer sur une branche dediee:

```powershell
git switch -c feature/delivery-km
```

2. Creer un checkpoint avant les changements:

```powershell
npm run delivery:checkpoint -- km-phase-1
```

Ce script:

- verifie que le worktree Git est propre
- cree un tag Git de checkpoint
- cree une sauvegarde SQLite si `DATABASE_URL` pointe vers un fichier local
- enregistre un manifest dans `backups/delivery-checkpoints`

Si le depot est sale mais que tu dois quand meme figer un point de reprise fiable:

```powershell
npm run delivery:checkpoint -- km-phase-1 --allow-dirty
```

Dans ce mode, le script:

- capture un snapshot Git exact du worktree courant dans un commit de checkpoint dedie
- n'altère ni ta branche courante ni ton index
- enregistre aussi le `git status`, le diff tracked et la liste des fichiers untracked dans `backups/delivery-checkpoints`

3. Developper localement.

4. Verifier les tests livraison avant chaque deploy:

```powershell
npm run delivery:verify
npm run build
```

Avant d'envisager d'activer `DELIVERY_EXPERIMENTAL_ROUTING_ENABLED`, lancer aussi:

```powershell
npm run delivery:preactivate
```

Ce check:

- evalue l'etat reel comme si le flag etait active, sans modifier les fichiers d'env
- verifie le dernier checkpoint livraison
- verifie DB + schema livraison + health runtime
- sonde un exemple de fenetres dynamiques checkout
- signale si Google Maps / depot / GPS restent incomplets
- imprime aussi un snippet pret a copier pour `.env.local` ou `.env.production.local` si la config route planning est incomplete

Smoke local reproductible pour rejouer les manipulations admin/chauffeur/checkout:

```powershell
$env:DELIVERY_SMOKE_ADMIN_EMAIL="admin@example.com"
$env:DELIVERY_SMOKE_ADMIN_PASSWORD="motdepasse"
npm run smoke:delivery
```

Notes:

- le script cible `http://127.0.0.1:3103` par defaut
- il seed une tournee de demo sauf si on passe `--no-seed-demo`
- il provisionne automatiquement un compte client dedie `delivery-smoke-customer@chezolive.local` si aucun compte client n'est fourni
- il reutilise l'admin seulement si on passe `--reuse-admin-account` ou `DELIVERY_SMOKE_REUSE_ADMIN_ACCOUNT=true`
- pour viser une autre URL, utiliser `DELIVERY_SMOKE_BASE_URL` ou `--base-url=...`
- par securite, il refuse les cibles non locales sans `--allow-remote`

5. Avant mise en ligne:

```powershell
npm run verify:prod
```

6. Si un changement est risqué ou touche les donnees live:

```powershell
npm run site:close
```

Puis deploy, verifier, et rouvrir:

```powershell
npm run preopen:check
npm run site:open
```

## Rollback

Pour afficher les etapes de retour arriere a partir du dernier checkpoint:

```powershell
npm run delivery:rollback:plan
```

Le plan imprime:

- la fermeture du site
- la restauration du code depuis le tag Git de checkpoint
- la restauration de la base si SQLite
- le rebuild
- le restart PM2
- la verification avant reouverture

Si le checkpoint a ete pris avec `--allow-dirty`, le rollback plan signale aussi:

- le type de snapshot (`head` ou `worktree`)
- le commit HEAD de base
- les chemins des artefacts Git captures (`status`, `diff`, `untracked`)

## Base de donnees

- Si `DATABASE_URL` est un fichier SQLite local, le checkpoint cree une vraie copie restaurable.
- Si `DATABASE_URL` pointe vers une base geree distante, le script te rappelle d'utiliser les snapshots du fournisseur.

## Recommendation pour la suite

Quand on commencera les calculs de km et la logique de routage:

- on garde le mode experimental derriere `DELIVERY_EXPERIMENTAL_ROUTING_ENABLED`
- on ajoute les nouvelles regles sans enlever tout de suite l'ancien mode
- on teste d'abord en local, puis en environnement controle
- on bascule seulement quand le nouveau moteur est assez solide
