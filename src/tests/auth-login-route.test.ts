export {}

const applyRateLimitMock = vi.fn();
const loginUserMock = vi.fn();
const logApiEventMock = vi.fn();

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: (...args: unknown[]) => applyRateLimitMock(...args),
}));

vi.mock("@/lib/auth", () => ({
  loginUser: (...args: unknown[]) => loginUserMock(...args),
}));

vi.mock("@/lib/observability", () => ({
  logApiEvent: (...args: unknown[]) => logApiEventMock(...args),
}));

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("retourne 429 quand le rate limit est dépassé", async () => {
    applyRateLimitMock.mockReturnValue({ ok: false, remaining: 0, retryAfterSeconds: 42 });

    const { POST } = await import("@/app/api/auth/login/route");
    const req = new Request("http://localhost:3101/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "admin@test.com", password: "secret" }),
    });

    const res = await POST(req);
    const payload = (await res.json()) as { error?: string };

    expect(res.status).toBe(429);
    expect(payload.error).toBe("Too many requests");
    expect(loginUserMock).not.toHaveBeenCalled();
  });

  it("retourne 200 avec le user quand le login est valide", async () => {
    applyRateLimitMock.mockReturnValue({ ok: true, remaining: 19, retryAfterSeconds: 300 });
    loginUserMock.mockResolvedValue({
      requiresTwoFactor: false,
      user: {
        id: "u_1",
        email: "admin@test.com",
        firstName: "Admin",
        lastName: "Root",
        role: "ADMIN",
      },
    });

    const { POST } = await import("@/app/api/auth/login/route");
    const req = new Request("http://localhost:3101/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "admin@test.com", password: "secret" }),
    });

    const res = await POST(req);
    const payload = (await res.json()) as { role?: string; email?: string };

    expect(res.status).toBe(200);
    expect(payload.role).toBe("ADMIN");
    expect(payload.email).toBe("admin@test.com");
    expect(logApiEventMock).toHaveBeenCalled();
  });

  it("retourne le challenge 2FA quand requis", async () => {
    applyRateLimitMock.mockReturnValue({ ok: true, remaining: 19, retryAfterSeconds: 300 });
    loginUserMock.mockResolvedValue({
      requiresTwoFactor: true,
      user: {
        id: "u_2",
        email: "admin@test.com",
        firstName: "Admin",
        lastName: "Root",
        role: "ADMIN",
      },
    });

    const { POST } = await import("@/app/api/auth/login/route");
    const req = new Request("http://localhost:3101/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "admin@test.com", password: "secret" }),
    });

    const res = await POST(req);
    const payload = (await res.json()) as { requiresTwoFactor?: boolean; role?: string };

    expect(res.status).toBe(200);
    expect(payload.requiresTwoFactor).toBe(true);
    expect(payload.role).toBe("ADMIN");
  });
});
