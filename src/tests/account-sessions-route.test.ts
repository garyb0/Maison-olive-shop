export {};

const applyRateLimitMock = vi.fn();
const revokeOtherSessionsForCurrentUserMock = vi.fn();
const logApiEventMock = vi.fn();

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: (...args: unknown[]) => applyRateLimitMock(...args),
}));

vi.mock("@/lib/auth", () => ({
  revokeOtherSessionsForCurrentUser: (...args: unknown[]) => revokeOtherSessionsForCurrentUserMock(...args),
}));

vi.mock("@/lib/observability", () => ({
  logApiEvent: (...args: unknown[]) => logApiEventMock(...args),
}));

describe("DELETE /api/account/sessions", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    applyRateLimitMock.mockReturnValue({ ok: true, remaining: 5, retryAfterSeconds: 600 });
  });

  it("revoque les autres sessions et garde la session courante", async () => {
    revokeOtherSessionsForCurrentUserMock.mockResolvedValue({ revokedCount: 2 });

    const { DELETE } = await import("@/app/api/account/sessions/route");
    const req = new Request("http://localhost:3101/api/account/sessions", { method: "DELETE" });

    const res = await DELETE(req);
    const payload = (await res.json()) as { ok?: boolean; revokedCount?: number };

    expect(res.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.revokedCount).toBe(2);
    expect(revokeOtherSessionsForCurrentUserMock).toHaveBeenCalledTimes(1);
  });

  it("retourne 401 sans session valide", async () => {
    revokeOtherSessionsForCurrentUserMock.mockRejectedValue(new Error("UNAUTHORIZED"));

    const { DELETE } = await import("@/app/api/account/sessions/route");
    const req = new Request("http://localhost:3101/api/account/sessions", { method: "DELETE" });

    const res = await DELETE(req);

    expect(res.status).toBe(401);
  });

  it("retourne 429 quand le rate limit est depasse", async () => {
    applyRateLimitMock.mockReturnValue({ ok: false, remaining: 0, retryAfterSeconds: 600 });

    const { DELETE } = await import("@/app/api/account/sessions/route");
    const req = new Request("http://localhost:3101/api/account/sessions", { method: "DELETE" });

    const res = await DELETE(req);

    expect(res.status).toBe(429);
    expect(revokeOtherSessionsForCurrentUserMock).not.toHaveBeenCalled();
  });
});
