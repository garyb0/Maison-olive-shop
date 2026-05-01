export {};

describe("observability redaction", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    Object.assign(process.env, originalEnv, { NODE_ENV: "production" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redacte les secrets et masque les donnees personnelles dans les logs", async () => {
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { logApiEvent } = await import("@/lib/observability");

    logApiEvent({
      level: "INFO",
      route: "/api/test",
      event: "SECURITY_TEST",
      details: {
        email: "client@example.com",
        token: "reset-token",
        stripeSecret: "sk_live_123456",
        nested: {
          deliveryPhone: "4185551212",
          url: "https://chezolive.ca/reset-password?token=abc123",
        },
      },
    });

    const line = String(consoleLog.mock.calls[0]?.[0] ?? "");

    expect(line).toContain("cl***@example.com");
    expect(line).toContain("[REDACTED]");
    expect(line).not.toContain("client@example.com");
    expect(line).not.toContain("reset-token");
    expect(line).not.toContain("sk_live_123456");
    expect(line).not.toContain("4185551212");
    expect(line).not.toContain("abc123");
  });
});
