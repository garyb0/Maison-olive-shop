export {}

const getCurrentUserMock = vi.fn()
const getMaintenanceStateMock = vi.fn()
const setMaintenanceStateMock = vi.fn()
const logApiEventMock = vi.fn()

vi.mock('@/lib/auth', () => ({
  getCurrentUser: (...args: unknown[]) => getCurrentUserMock(...args),
}))

vi.mock('@/lib/maintenance', () => ({
  getMaintenanceState: (...args: unknown[]) => getMaintenanceStateMock(...args),
  setMaintenanceState: (...args: unknown[]) => setMaintenanceStateMock(...args),
}))

vi.mock('@/lib/observability', () => ({
  logApiEvent: (...args: unknown[]) => logApiEventMock(...args),
}))

describe('POST /api/admin/settings/maintenance', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    getCurrentUserMock.mockResolvedValue({
      id: 'admin_1',
      email: 'admin@chez-olive.local',
      role: 'ADMIN',
    })

    getMaintenanceStateMock.mockReturnValue({
      enabled: false,
      message: null,
      openAt: null,
      updatedAt: new Date(),
      updatedBy: null,
    })

    setMaintenanceStateMock.mockImplementation((enabled: boolean, options?: { openAt?: Date | null }) => ({
      enabled,
      message: null,
      openAt: options?.openAt ?? null,
      updatedAt: new Date(),
      updatedBy: 'admin@chez-olive.local',
    }))
  })

  it('refuse openAt dans le passé', async () => {
    const { POST } = await import('@/app/api/admin/settings/maintenance/route')

    const pastIso = new Date(Date.now() - 60_000).toISOString()
    const req = new Request('http://localhost:3101/api/admin/settings/maintenance', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: true, openAt: pastIso }),
    })

    const res = await POST(req)
    const payload = (await res.json()) as { error?: string }

    expect(res.status).toBe(400)
    expect(payload.error).toBe('openAt must be in the future')
    expect(setMaintenanceStateMock).not.toHaveBeenCalled()
  })

  it('accepte openAt futur et active maintenance', async () => {
    const { POST } = await import('@/app/api/admin/settings/maintenance/route')

    const futureIso = new Date(Date.now() + 60_000).toISOString()
    const req = new Request('http://localhost:3101/api/admin/settings/maintenance', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: true, openAt: futureIso }),
    })

    const res = await POST(req)
    const payload = (await res.json()) as { enabled?: boolean; openAt?: string | null }

    expect(res.status).toBe(200)
    expect(payload.enabled).toBe(true)
    expect(payload.openAt).not.toBeNull()
    expect(setMaintenanceStateMock).toHaveBeenCalledTimes(1)
    expect(logApiEventMock).toHaveBeenCalled()
  })

  it('retourne 400 quand le payload est invalide (enabled manquant)', async () => {
    const { POST } = await import('@/app/api/admin/settings/maintenance/route')

    const req = new Request('http://localhost:3101/api/admin/settings/maintenance', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'maintenance planifiée' }),
    })

    const res = await POST(req)
    const payload = (await res.json()) as { error?: string }

    expect(res.status).toBe(400)
    expect(payload.error).toBe('Invalid request payload')
    expect(setMaintenanceStateMock).not.toHaveBeenCalled()
  })
})
