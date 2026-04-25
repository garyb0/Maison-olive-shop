export {}

describe("support guest access token", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("genere un token valide pour la meme conversation et le meme email", async () => {
    const { createSupportGuestAccessToken, verifySupportGuestAccessToken } = await import("@/lib/support")
    const token = createSupportGuestAccessToken("conv_123", "Guest@Example.com")

    expect(verifySupportGuestAccessToken(token, "conv_123", "guest@example.com")).toBe(true)
  })

  it("refuse un token quand la conversation ne correspond pas", async () => {
    const { createSupportGuestAccessToken, verifySupportGuestAccessToken } = await import("@/lib/support")
    const token = createSupportGuestAccessToken("conv_123", "guest@example.com")

    expect(verifySupportGuestAccessToken(token, "conv_456", "guest@example.com")).toBe(false)
  })

  it("refuse un token quand l'email ne correspond pas", async () => {
    const { createSupportGuestAccessToken, verifySupportGuestAccessToken } = await import("@/lib/support")
    const token = createSupportGuestAccessToken("conv_123", "guest@example.com")

    expect(verifySupportGuestAccessToken(token, "conv_123", "other@example.com")).toBe(false)
  })
})

