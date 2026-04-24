import { existsSync, writeFileSync, unlinkSync, readFileSync } from 'fs'
import { join } from 'path'
import { logApiEvent } from '@/lib/observability'

// Chemin du fichier lock — dans le dossier racine du projet
const LOCK_FILE = join(process.cwd(), '.maintenance-lock')
const LOCK_CACHE_TTL_MS = 1000

export type MaintenanceState = {
  enabled: boolean
  message: string | null
  openAt: Date | null
  updatedAt: Date
  updatedBy: string | null
}

type MaintenanceLockCache = {
  value: MaintenanceState | null
  expiresAt: number
}

let maintenanceLockCache: MaintenanceLockCache | null = null

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

function toDateOrNull(value: unknown): Date | null {
  if (typeof value !== 'string') return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function toMaintenanceStateOrNull(value: unknown): MaintenanceState | null {
  if (!value || typeof value !== 'object') return null

  const raw = value as {
    enabled?: unknown
    message?: unknown
    openAt?: unknown
    updatedAt?: unknown
    updatedBy?: unknown
  }

  if (typeof raw.enabled !== 'boolean') return null

  const updatedAt = toDateOrNull(raw.updatedAt)
  if (!updatedAt) return null

  const openAt = raw.openAt == null ? null : toDateOrNull(raw.openAt)
  if (raw.openAt != null && !openAt) return null

  return {
    enabled: raw.enabled,
    message: typeof raw.message === 'string' ? raw.message : null,
    openAt,
    updatedAt,
    updatedBy: typeof raw.updatedBy === 'string' ? raw.updatedBy : null,
  }
}

function readLockFile(): MaintenanceState | null {
  const now = Date.now()
  if (maintenanceLockCache && maintenanceLockCache.expiresAt > now) {
    return maintenanceLockCache.value
  }

  if (!existsSync(LOCK_FILE)) {
    maintenanceLockCache = {
      value: null,
      expiresAt: now + LOCK_CACHE_TTL_MS,
    }
    return null
  }
  
  try {
    const raw = readFileSync(LOCK_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    const normalized = toMaintenanceStateOrNull(parsed)

    maintenanceLockCache = {
      value: normalized,
      expiresAt: now + LOCK_CACHE_TTL_MS,
    }

    return normalized
  } catch {
    maintenanceLockCache = {
      value: null,
      expiresAt: now + LOCK_CACHE_TTL_MS,
    }
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
    maintenanceLockCache = {
      value: state,
      expiresAt: Date.now() + LOCK_CACHE_TTL_MS,
    }
  } else {
    // Désactiver: supprimer le fichier lock
    if (existsSync(LOCK_FILE)) {
      unlinkSync(LOCK_FILE)
    }
    maintenanceLockCache = {
      value: null,
      expiresAt: Date.now() + LOCK_CACHE_TTL_MS,
    }
  }

  return state
}

// Vérification simple pour le middleware (lecture de fichier seulement)
export function isMaintenanceEnabled(): boolean {
  return getMaintenanceState().enabled
}