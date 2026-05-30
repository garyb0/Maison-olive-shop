<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Local Windows backup policy

Do not reactivate the Windows scheduled backup tasks
`MaisonOlive-DB-Backup`, `MaisonOlive-DB-Backup-Hourly`, or
`MaisonOlive-DB-Backup-Health` unless Gary explicitly asks for it. Manual
backups are still allowed with `npm run db:backup -- manual`.
