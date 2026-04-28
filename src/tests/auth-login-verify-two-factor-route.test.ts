export {};

const applyRateLimitMock = vi.fn();
const verifyTwoFactorLoginMock = vi.fn();
const logApiEventMock = vi.fn();

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: (...args: unknown[]) => applyRateLimitMock(...args),
}));

vi.mock("@/lib/auth", () => ({
  verifyTwoFactorLogin: (...args: unknown[]) => verifyTwoFactorLoginMock(...args),
}));

vi.mock("@/lib/observability", () => ({
  logApiEvent: (...args: unknown[]) => logApiEventMock(...args),
}));

describe("POST /api/auth/login/verify-two-factor", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    applyRateLimitMock.mockReturnValue({ ok: true, remaining: 19, retryAfterSeconds: 300 });
  });

  it("retourne 200 quand le code 2FA est valide", async () => {
    verifyTwoFactorLoginMock.mockResolvedValue({
      id: "u_1",
      email: "admin@test.com",
      firstName: "Admin",
      lastName: "Root",
      role: "ADMIN",
    });

    const { POST } = await import("@/app/api/auth/login/verify-two-factor/route");
    const req = new Request("http://localhost:3101/api/auth/login/verify-two-factor", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "123456" }),
    });

    const res = await POST(req);
    const payload = (await res.json()) as { role?: string };

    expect(res.status).toBe(200);
    expect(payload.role).toBe("ADMIN");
    expect(logApiEventMock).toHaveBeenCalled();
  });

  it("retourne 401 quand le code 2FA est invalide", async () => {
    verifyTwoFactorLoginMock.mockRejectedValue(new Error("INVALID_TWO_FACTOR_CODE"));

    const { POST } = await import("@/app/api/auth/login/verify-two-factor/route");
    const req = new Request("http://localhost:3101/api/auth/login/verify-two-factor", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "000000" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
