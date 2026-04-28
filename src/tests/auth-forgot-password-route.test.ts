export {}

const applyRateLimitMock = vi.fn()
const requestPasswordResetMock = vi.fn()
const logApiEventMock = vi.fn()

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: (...args: unknown[]) => applyRateLimitMock(...args),
}))

vi.mock("@/lib/auth", () => ({
  requestPasswordReset: (...args: unknown[]) => requestPasswordResetMock(...args),
}))

vi.mock("@/lib/observability", () => ({
  logApiEvent: (...args: unknown[]) => logApiEventMock(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(),
  buildPasswordResetEmailFr: () => ({ subject: "reset", html: "<p>reset</p>" }),
  buildPasswordResetEmailEn: () => ({ subject: "reset", html: "<p>reset</p>" }),
}))

describe("POST /api/auth/forgot-password", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it("retourne 429 si la limite est atteinte", async () => {
    applyRateLimitMock.mockReturnValue({ ok: false, remaining: 0, retryAfterSeconds: 600 })

    const { POST } = await import("@/app/api/auth/forgot-password/route")
    const req = new Request("http://localhost:3101/api/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "test@example.com" }),
    })

    const res = await POST(req)
    const payload = (await res.json()) as { error?: string }

    expect(res.status).toBe(429)
    expect(payload.error).toBe("Too many requests")
    expect(requestPasswordResetMock).not.toHaveBeenCalled()
  })

  it("retourne 400 pour un payload invalide", async () => {
    applyRateLimitMock.mockReturnValue({ ok: true, remaining: 9, retryAfterSeconds: 600 })

    const { POST } = await import("@/app/api/auth/forgot-password/route")
    const req = new Request("http://localhost:3101/api/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "not-an-email" }),
    })

    const res = await POST(req)
    const payload = (await res.json()) as { error?: string }

    expect(res.status).toBe(400)
    expect(payload.error).toBe("Invalid request payload")
    expect(requestPasswordResetMock).not.toHaveBeenCalled()
    expect(logApiEventMock).toHaveBeenCalled()
  })
})
