import { existsSync, writeFileSync, unlinkSync, readFileSync } from 'fs'
import { join } from 'path'
import { logApiEvent } from '@/lib/observability'

// Chemin du fichier lock — dans le dossier racine du projet
const LOCK_FILE = join(process.cwd(), '.maintenance-lock')

export type MaintenanceState = {
  enabled: boolean
  message: string | null
  openAt: Date | null
  updatedAt: Date
  updatedBy: string | null
}

function getFallbackState(updatedBy: string | null = null): MaintenanceState {
  const enabledFromEnv = process.env.MAINTENANCE_MODE === 'true'
  return {
    enabled: enabledFromEnv,
    message: null,
    openAt: null,
    updatedAt: new Date(),
    updatedBy
  }
}

function readLockFile(): MaintenanceState | null {
  if (!existsSync(LOCK_FILE)) return null
  
  try {
    const raw = readFileSync(LOCK_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    return {
      ...parsed,
      openAt: parsed.openAt ? new Date(parsed.openAt) : null,
      updatedAt: new Date(parsed.updatedAt)
    }
  } catch {
    return null
  }
}

export function getMaintenanceState(): MaintenanceState {
  // Vérifier le fichier lock d'abord
  const locked = readLockFile()
  if (locked) {
    const lockedOpenAt = locked.openAt
    const shouldAutoOpen =
      locked.enabled &&
      lockedOpenAt !== null &&
      lockedOpenAt.getTime() <= Date.now()

    if (shouldAutoOpen) {
      logApiEvent({
        level: 'INFO',
        route: 'maintenance:state',
        event: 'AUTO_REOPEN_TRIGGERED',
        status: 200,
        details: {
          openAt: lockedOpenAt.toISOString(),
          updatedBy: locked.updatedBy,
        },
      })
      setMaintenanceState(false, { updatedBy: 'system:auto-open' })
      return getFallbackState('system:auto-open')
    }

    return locked
  }

  // Fallback sur la variable env (déploiement initial)
  return getFallbackState()
}

export function setMaintenanceState(
  enabled: boolean,
  options?: {
    message?: string | null
    openAt?: Date | null
    updatedBy?: string | null
  }
): MaintenanceState {
  const state: MaintenanceState = {
    enabled,
    message: options?.message ?? null,
    openAt: options?.openAt ?? null,
    updatedAt: new Date(),
    updatedBy: options?.updatedBy ?? null
  }

  if (enabled) {
    // Activer: écrire le fichier lock
    writeFileSync(LOCK_FILE, JSON.stringify(state), 'utf-8')
  } else {
    // Désactiver: supprimer le fichier lock
    if (existsSync(LOCK_FILE)) {
      unlinkSync(LOCK_FILE)
    }
  }

  return state
}

// Vérification simple pour le middleware (lecture de fichier seulement)
export function isMaintenanceEnabled(): boolean {
  return getMaintenanceState().enabled
}