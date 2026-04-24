export {};

const applyRateLimitMock = vi.fn();
const beginTwoFactorSetupForCurrentUserMock = vi.fn();
const confirmTwoFactorSetupForCurrentUserMock = vi.fn();
const disableTwoFactorForCurrentUserMock = vi.fn();
const logApiEventMock = vi.fn();

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: (...args: unknown[]) => applyRateLimitMock(...args),
}));

vi.mock("@/lib/auth", () => ({
  beginTwoFactorSetupForCurrentUser: (...args: unknown[]) => beginTwoFactorSetupForCurrentUserMock(...args),
  confirmTwoFactorSetupForCurrentUser: (...args: unknown[]) => confirmTwoFactorSetupForCurrentUserMock(...args),
  disableTwoFactorForCurrentUser: (...args: unknown[]) => disableTwoFactorForCurrentUserMock(...args),
}));

vi.mock("@/lib/observability", () => ({
  logApiEvent: (...args: unknown[]) => logApiEventMock(...args),
}));

describe("account two-factor routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    applyRateLimitMock.mockReturnValue({ ok: true, remaining: 5, retryAfterSeconds: 600 });
  });

  it("démarre la configuration 2FA", async () => {
    beginTwoFactorSetupForCurrentUserMock.mockResolvedValue({
      manualEntryKey: "ABCD EFGH IJKL",
      otpauthUri: "otpauth://totp/Chez%20Olive:admin@test.com?secret=ABC",
    });

    const { POST } = await import("@/app/api/account/two-factor/setup/route");
    const req = new Request("http://localhost:3101/api/account/two-factor/setup", { method: "POST" });

    const res = await POST(req);
    const payload = (await res.json()) as { manualEntryKey?: string };

    expect(res.status).toBe(200);
    expect(payload.manualEntryKey).toBe("ABCD EFGH IJKL");
  });

  it("active le 2FA et retourne les codes de secours", async () => {
    confirmTwoFactorSetupForCurrentUserMock.mockResolvedValue({
      backupCodes: ["AAAA-BBBB-CCCC", "DDDD-EEEE-FFFF"],
    });

    const { POST } = await import("@/app/api/account/two-factor/route");
    const req = new Request("http://localhost:3101/api/account/two-factor", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currentPassword: "secret", code: "123456" }),
    });

    const res = await POST(req);
    const payload = (await res.json()) as { backupCodes?: string[]; ok?: boolean };

    expect(res.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.backupCodes).toHaveLength(2);
  });

  it("désactive le 2FA", async () => {
    disableTwoFactorForCurrentUserMock.mockResolvedValue(undefined);

    const { DELETE } = await import("@/app/api/account/two-factor/route");
    const req = new Request("http://localhost:3101/api/account/two-factor", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currentPassword: "secret", code: "AAAA-BBBB-CCCC" }),
    });

    const res = await DELETE(req);
    const payload = (await res.json()) as { ok?: boolean };

    expect(res.status).toBe(200);
    expect(payload.ok).toBe(true);
  });
});
