# Maison Olive — Local Hosting Runbook (Windows)

Ce runbook permet d’héberger l’app sur ton ordinateur en mode stable, en attendant la mise en ligne publique.

## 1) Pré-requis (déjà en place)

- Build production OK
- PM2 configuré (`ecosystem.config.cjs`)
- Backup quotidien DB configuré via tâche planifiée `MaisonOlive-DB-Backup`
- Migration safe disponible (`npm run prisma:migrate:safe -- <name>`)

## 2) Commandes quotidiennes

Depuis `C:\Cline\maison-olive-shop`:

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
