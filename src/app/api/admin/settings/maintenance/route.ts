import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getMaintenanceState, setMaintenanceState } from '@/lib/maintenance'
import { logApiEvent } from '@/lib/observability'
import { maintenanceSettingsSchema } from '@/lib/validators'

export async function GET() {
  const user = await getCurrentUser()
  
  if (user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  return NextResponse.json(getMaintenanceState())
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  
  if (user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const body = await request.json().catch(() => null)
    const parsed = maintenanceSettingsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 })
    }

    const { enabled, message, openAt } = parsed.data

    const previousState = getMaintenanceState()

    const parsedOpenAt =
      typeof openAt === 'string'
        ? new Date(openAt)
        : openAt == null
          ? null
          : undefined

    if (parsedOpenAt === undefined || Number.isNaN(parsedOpenAt?.getTime())) {
      return NextResponse.json({ error: 'Invalid openAt date' }, { status: 400 })
    }

    const normalizedMessage = typeof message === 'string' ? message.trim() || null : null

    if (enabled && parsedOpenAt && parsedOpenAt.getTime() <= Date.now()) {
      return NextResponse.json({ error: 'openAt must be in the future' }, { status: 400 })
    }

    const newState = setMaintenanceState(enabled, {
      message: normalizedMessage,
      openAt: enabled ? parsedOpenAt : null,
      updatedBy: user.email
    })

    logApiEvent({
      level: 'INFO',
      route: '/api/admin/settings/maintenance',
      event: 'MAINTENANCE_CHANGED',
      status: 200,
      details: {
        userId: user.id,
        userEmail: user.email,
        previousEnabled: previousState.enabled,
        enabled: newState.enabled,
        openAt: newState.openAt?.toISOString() ?? null
      }
    })

    return NextResponse.json(newState)

  } catch (error) {
    logApiEvent({
      level: 'WARN',
      route: '/api/admin/settings/maintenance',
      event: 'MAINTENANCE_CHANGE_FAILED',
      status: 400,
      details: { error }
    })
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}