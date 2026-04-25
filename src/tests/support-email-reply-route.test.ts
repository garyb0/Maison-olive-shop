export {}

const verifyEmailReplyTokenMock = vi.fn()
const createSupportMessageAsAdminMock = vi.fn()
const logApiEventMock = vi.fn()
const prismaUserFindUniqueMock = vi.fn()

vi.mock("@/lib/support-email", () => ({
  verifyEmailReplyToken: (...args: unknown[]) => verifyEmailReplyTokenMock(...args),
}))

vi.mock("@/lib/support", () => ({
  createSupportMessageAsAdmin: (...args: unknown[]) => createSupportMessageAsAdminMock(...args),
}))

vi.mock("@/lib/observability", () => ({
  logApiEvent: (...args: unknown[]) => logApiEventMock(...args),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => prismaUserFindUniqueMock(...args),
    },
  },
}))

describe("POST /api/support/email-reply", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it("utilise l'email du token pour identifier l'admin", async () => {
    verifyEmailReplyTokenMock.mockReturnValue({
      conversationId: "conv_1",
      adminEmail: "admin@chezolive.ca",
    })

    prismaUserFindUniqueMock.mockResolvedValue({
      id: "admin_1",
      email: "admin@chezolive.ca",
      firstName: "Admin",
      lastName: "Olive",
      role: "ADMIN",
    })

    createSupportMessageAsAdminMock.mockResolvedValue({
      id: "conv_1",
      status: "ASSIGNED",
      messages: [{ id: "msg_1" }],
    })

    const { POST } = await import("@/app/api/support/email-reply/route")
    const req = new Request("http://localhost:3101/api/support/email-reply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token: "token",
        content: "  Bonjour support  ",
        fromEmail: "ADMIN@CHEZOLIVE.CA",
      }),
    })

    const res = await POST(req as never)
    const payload = (await res.json()) as { success?: boolean }

    expect(res.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(prismaUserFindUniqueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: "admin@chezolive.ca" },
      }),
    )
    expect(createSupportMessageAsAdminMock).toHaveBeenCalledWith(
      "conv_1",
      expect.objectContaining({ id: "admin_1", role: "ADMIN" }),
      "Bonjour support",
    )
  })
})

