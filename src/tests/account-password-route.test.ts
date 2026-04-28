export {};

const applyRateLimitMock = vi.fn();
const changePasswordForCurrentUserMock = vi.fn();
const logApiEventMock = vi.fn();

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: (...args: unknown[]) => applyRateLimitMock(...args),
}));

vi.mock("@/lib/auth", () => ({
  changePasswordForCurrentUser: (...args: unknown[]) => changePasswordForCurrentUserMock(...args),
}));

vi.mock("@/lib/observability", () => ({
  logApiEvent: (...args: unknown[]) => logApiEventMock(...args),
}));

describe("POST /api/account/password", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    applyRateLimitMock.mockReturnValue({ ok: true, remaining: 7, retryAfterSeconds: 600 });
  });

  it("change le mot de passe quand le payload est valide", async () => {
    changePasswordForCurrentUserMock.mockResolvedValue(undefined);

    const { POST } = await import("@/app/api/account/password/route");
    const req = new Request("http://localhost:3101/api/account/password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        currentPassword: "old-password",
        newPassword: "new-password-123",
        confirmPassword: "new-password-123",
      }),
    });

    const res = await POST(req);
    const payload = (await res.json()) as { ok?: boolean };

    expect(res.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(changePasswordForCurrentUserMock).toHaveBeenCalledWith("old-password", "new-password-123");
    expect(logApiEventMock).toHaveBeenCalled();
  });

  it("retourne 400 quand la confirmation ne correspond pas", async () => {
    const { POST } = await import("@/app/api/account/password/route");
    const req = new Request("http://localhost:3101/api/account/password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        currentPassword: "old-password",
        newPassword: "new-password-123",
        confirmPassword: "different-password",
      }),
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(changePasswordForCurrentUserMock).not.toHaveBeenCalled();
  });

  it("retourne 401 quand le mot de passe actuel est invalide", async () => {
    changePasswordForCurrentUserMock.mockRejectedValue(new Error("INVALID_CURRENT_PASSWORD"));

    const { POST } = await import("@/app/api/account/password/route");
    const req = new Request("http://localhost:3101/api/account/password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        currentPassword: "wrong-password",
        newPassword: "new-password-123",
        confirmPassword: "new-password-123",
      }),
    });

    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it("retourne 429 quand le rate limit est depasse", async () => {
    applyRateLimitMock.mockReturnValue({ ok: false, remaining: 0, retryAfterSeconds: 600 });

    const { POST } = await import("@/app/api/account/password/route");
    const req = new Request("http://localhost:3101/api/account/password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        currentPassword: "old-password",
        newPassword: "new-password-123",
        confirmPassword: "new-password-123",
      }),
    });

    const res = await POST(req);

    expect(res.status).toBe(429);
    expect(changePasswordForCurrentUserMock).not.toHaveBeenCalled();
  });
});
