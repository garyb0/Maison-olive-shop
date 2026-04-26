# Chez Olive — Local Hosting Runbook (Windows)

Ce runbook permet d’héberger l’app sur ton ordinateur en mode stable, en attendant la mise en ligne publique.

## 1) Pré-requis (déjà en place)

- Build production OK
- PM2 configuré (`ecosystem.config.cjs`)
- Backup quotidien DB configuré via tâche planifiée `chezolive-DB-Backup`
- Migration safe disponible (`npm run prisma:migrate:safe -- <name>`)

## 2) Commandes quotidiennes

Depuis la racine du projet (ex: `C:\Cline\maison-olive-shop`):

```bash
npm run host:pm2:status
npm run host:pm2:logs
npm run host:pm2:restart
npm run host:pm2:stop
```

Vérifier la santé:

```bash
curl http://localhost:3101/api/health
set NEXT_PUBLIC_SITE_URL=http://localhost:3101&& npm run smoke
```

## 2.1) Procédure mode maintenance (recommandée)

### Activer / désactiver

1. Ouvrir `http://localhost:3101/admin`
2. Aller sur le bloc **Mode Maintenance**
3. Choisir:
   - fermeture immédiate, ou
   - fermeture avec **réouverture planifiée** (`openAt`)
4. Valider avec le bouton `FERMER LE SITE` / `OUVRIR LE SITE`

### Vérification rapide après changement

- Public:
  - une page publique doit afficher `/maintenance` quand le mode est actif
- Admin:
  - `/admin` reste accessible
- Santé:
  - `curl http://localhost:3101/api/health`

### Signaux attendus dans les logs

- Changement manuel: `MAINTENANCE_CHANGED`
- Réouverture automatique après `openAt`: `AUTO_REOPEN_TRIGGERED`

### Dépannage lock file

L’état est persisté dans le fichier:

`<racine-projet>\\.maintenance-lock` (ex: `C:\Cline\maison-olive-shop\.maintenance-lock`)

Si l’état semble bloqué/incohérent:

1. vérifier l’état via `/admin`
2. corriger depuis l’UI admin
3. en dernier recours, arrêter l’app et supprimer `.maintenance-lock`, puis redémarrer PM2

## 2.2) Maintenance Cloudflare externe (secours)

Utiliser cette option uniquement si l'app locale n'est plus joignable ou si une
coupure publique d'urgence est necessaire.

Documentation dediee:

`CLOUDFLARE_MAINTENANCE_WORKER.md`

### Quand l'utiliser

- PC local indisponible
- PM2 en panne
- tunnel Cloudflare HS
- incident applicatif majeur
- coupure publique d'urgence

### Quand ne pas l'utiliser

- maintenance planifiee normale
- fermeture avec reouverture programmee
- maintenance courante deja geree par `/maintenance`

### Effet attendu

- tous les visiteurs publics voient une page Cloudflare externe
- aucun trafic public n'atteint l'app
- `/admin` et `/api/health` sont aussi bloques publiquement

### Principe d'exploitation

- mode normal: routes Worker non attachees
- urgence: attacher le Worker `chezolive-maintenance` aux 4 domaines publics
- retour normal: retirer les routes Worker

## 3) Auto-start au login (si tâche ONLOGON refusée)

Si Windows refuse la création de la tâche planifiée ONLOGON, utilise le script:

```bash
scripts\windows\install-startup-pm2.cmd
```

Ce script copie `pm2-resurrect.cmd` dans le dossier Startup utilisateur.

Option admin (Task Scheduler ONLOGON):

```bash
scripts\windows\create-onlogon-task-admin.cmd
```

## 3.1) Ouverture LAN (port 3101)

Pour accès depuis d'autres appareils du réseau local, ouvrir le port 3101 en **terminal administrateur**:

```bash
scripts\windows\open-firewall-3101-admin.cmd
```

## 4) Backups et restauration

Backup manuel:

```bash
npm run db:backup -- manual
```

Restore dernier backup:

```bash
npm run db:restore
```

Restore backup précis:

```bash
npm run db:restore -- backups\<fichier>.db
```

## 5) Migrations sans perte

Toujours passer par:

```bash
npm run prisma:migrate:safe -- <nom-migration>
```

Cette commande crée un backup avant migration.

## 6) Passage futur en Internet public (sans perte)

Quand tu seras prêt:

1. Backup final (`npm run db:backup -- pre-cutover`)
2. Domaine/DDNS + HTTPS + ouverture ports
3. Variables prod publiques (`NEXT_PUBLIC_SITE_URL` réel)
4. Smoke + validation client/admin
5. Rollback prêt via backup/restore

### Important pour les QR

- ne pas exporter les liens vendeur tant que `NEXT_PUBLIC_SITE_URL` pointe vers `localhost`
- une fois le vrai domaine en place, régénérer l'export vendeur depuis `admin/dogs`
- vérifier au moins un QR vierge complet sur le vrai domaine avant impression

### Contrainte réseau connue

- le port `80` ne peut pas fonctionner sur le réseau local actuel
- le port `21` ne peut pas fonctionner non plus
- ne pas baser l'hébergement local sur FTP (`21`) ni sur un certificat HTTPS qui exige HTTP-01 sur `80`
- si Caddy reste utilisé, prévoir une méthode sans port `80` comme DNS challenge Cloudflare, ou envisager un tunnel Cloudflare / VPS

### Cloudflare Tunnel actif

La mise en ligne locale utilise maintenant Cloudflare Tunnel:

```bash
npm run host:pm2:status
```

Les deux processus attendus:

- `chez-olive-shop`
- `chezolive-tunnel`

Ne pas ouvrir les ports `80` / `443` tant que le tunnel est utilisé.
Ne pas réactiver la tâche `chezolive-Cloudflare-DDNS` tant que les DNS pointent vers le tunnel.


