# Chez Olive Project Lock

Status: ACTIVE
Activated: 2026-06-21

The current project state is locked. Do not change, build, restart, deploy,
migrate, open/close, or sync the site/app unless Gary gives two explicit
confirmations in the current conversation.

The two confirmations must cover:

1. The exact scope of the change.
2. Permission to execute the change now.

Protected npm commands require these environment variables in the same shell:

```powershell
$env:CHEZ_OLIVE_UNLOCK_CONFIRMATION_1 = "GARY_CONFIRM_SCOPE"
$env:CHEZ_OLIVE_UNLOCK_CONFIRMATION_2 = "GARY_CONFIRM_EXECUTE"
$env:CHEZ_OLIVE_UNLOCK_REASON = "Short reason approved by Gary"
```

After the protected command finishes, remove them:

```powershell
Remove-Item Env:\CHEZ_OLIVE_UNLOCK_CONFIRMATION_1 -ErrorAction SilentlyContinue
Remove-Item Env:\CHEZ_OLIVE_UNLOCK_CONFIRMATION_2 -ErrorAction SilentlyContinue
Remove-Item Env:\CHEZ_OLIVE_UNLOCK_REASON -ErrorAction SilentlyContinue
```

Useful command:

```powershell
npm run project:lock:status
```

This lock protects the project through npm scripts. It does not prevent a
manual shell command from bypassing npm, so agents must also follow the human
rule in `AGENTS.md`.
