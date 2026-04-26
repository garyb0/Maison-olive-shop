# Chez Olive — Guide de migration (sans perte)

Ce guide couvre 2 cas:

1. **Migration de schéma locale** (SQLite -> SQLite, même projet)
2. **Migration vers un hébergement/DB managée** (cutover futur)

---

## 1) Migration locale (recommandé au quotidien)

### Procédure standard

```bash
# 1) Backup explicite (optionnel mais recommandé)
npm run db:backup -- before-change

# 2) Migration safe (backup auto + migration Prisma)
npm run prisma:migrate:safe -- nom-de-la-migration

# 3) Vérifications rapides
npm run validate:env:dev
npm run smoke
```

### Rollback rapide si problème

```bash
# restaure le dernier backup (et fait un backup de sécurité avant restore)
npm run db:restore

# ou restaure un backup précis
npm run db:restore -- backups/ton-backup.db
```

---

## 2) Migration vers infra publique (plan sans perte)

Quand tu migreras vers une vraie infra (URL publique + DB distante), fais ce runbook:

1. **Freeze des écritures** (fenêtre maintenance courte).
2. **Backup complet avant cutover**:
   - `npm run db:backup -- pre-cutover`
   - backup Git (`git tag`, `git push`, `git bundle`)
3. **Préparer l’infra cible** (staging d’abord).
4. **Configurer variables** (`DATABASE_URL`, `NEXT_PUBLIC_SITE_URL`, `SESSION_SECRET`, etc.).
5. **Lancer migrations sur cible** (`prisma migrate` côté cible).
6. **Importer/synchroniser les données** (selon provider).
7. **Valider techniquement**:
   - `npm run validate:env:prod`
   - `npm run smoke`
8. **Valider fonctionnellement** (client + admin + checkout).
9. **Go-live**.
10. **Plan rollback prêt** (revenir DB+URL précédente + restore backup).

---

## Règles d’or anti-perte

- Toujours faire un backup **avant** migration/restore.
- Ne jamais committer les dumps DB et secrets.
- Tester d’abord en local/staging.
- Si doute: **NO-GO** et rollback.

---

## Commandes utiles (rappel)

```bash
npm run db:backup -- <label>
npm run db:restore -- [backup.db]
npm run prisma:migrate:safe -- <migration-name>
npm run validate:env:prod
npm run smoke
```

