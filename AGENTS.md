<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Local Windows backup policy

Do not reactivate the Windows scheduled backup tasks
`MaisonOlive-DB-Backup`, `MaisonOlive-DB-Backup-Hourly`, or
`MaisonOlive-DB-Backup-Health` unless Gary explicitly asks for it. Manual
backups are still allowed with `npm run db:backup -- manual`.

## Project lock policy

The project is locked as of 2026-06-21. Do not edit, build, restart, deploy,
migrate, open/close, or sync the site/app unless Gary gives two explicit
confirmations in the current conversation:

1. Gary confirms the exact scope.
2. Gary confirms execution now.

Before any protected action, run `npm run project:lock:status`. Protected npm
scripts are blocked by `scripts/project-lock-guard.ts` unless these environment
variables are set in the same shell:

- `CHEZ_OLIVE_UNLOCK_CONFIRMATION_1=GARY_CONFIRM_SCOPE`
- `CHEZ_OLIVE_UNLOCK_CONFIRMATION_2=GARY_CONFIRM_EXECUTE`
- `CHEZ_OLIVE_UNLOCK_REASON=<approved reason>`

Remove those environment variables immediately after the approved command.
