export {};

const applyRateLimitMock = vi.fn();
const logApiEventMock = vi.fn();
const getGoogleOAuthConfigMock = vi.fn();
const createGoogleOAuthStateMock = vi.fn();
const buildGoogleAuthorizationUrlMock = vi.fn();
const readGoogleOAuthStateMock = vi.fn();
const exchangeGoogleAuthorizationCodeMock = vi.fn();
const verifyGoogleIdTokenMock = vi.fn();
const loginOrRegisterGoogleUserMock = vi.fn();
const getCurrentLanguageMock = vi.fn();
let oauthStateCookie = "";

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: (...args: unknown[]) => applyRateLimitMock(...args),
}));

vi.mock("@/lib/observability", () => ({
  logApiEvent: (...args: unknown[]) => logApiEventMock(...args),
}));

vi.mock("@/lib/google-oauth", () => ({
  getGoogleOAuthConfig: (...args: unknown[]) => getGoogleOAuthConfigMock(...args),
  createGoogleOAuthState: (...args: unknown[]) => createGoogleOAuthStateMock(...args),
  buildGoogleAuthorizationUrl: (...args: unknown[]) => buildGoogleAuthorizationUrlMock(...args),
  readGoogleOAuthState: (...args: unknown[]) => readGoogleOAuthStateMock(...args),
  exchangeGoogleAuthorizationCode: (...args: unknown[]) => exchangeGoogleAuthorizationCodeMock(...args),
  verifyGoogleIdToken: (...args: unknown[]) => verifyGoogleIdTokenMock(...args),
  sanitizeGoogleOAuthReturnTo: (value: string | null | undefined) => {
    const raw = value?.trim();
    if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/account";
    return raw;
  },
}));

vi.mock("@/lib/auth", () => ({
  loginOrRegisterGoogleUser: (...args: unknown[]) => loginOrRegisterGoogleUserMock(...args),
}));

vi.mock("@/lib/language", () => ({
  getCurrentLanguage: (...args: unknown[]) => getCurrentLanguageMock(...args),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn((name: string) => (name === "chezolive_google_oauth_state" && oauthStateCookie ? { value: oauthStateCookie } : undefined)),
  })),
}));

describe("Google OAuth routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    oauthStateCookie = "state.1";
    applyRateLimitMock.mockResolvedValue({ ok: true, remaining: 29, retryAfterSeconds: 600 });
    getGoogleOAuthConfigMock.mockReturnValue({
      clientId: "google-client",
      clientSecret: "secret",
      redirectUri: "https://chezolive.ca/api/auth/google/callback",
    });
    createGoogleOAuthStateMock.mockReturnValue({
      state: "state.1",
      payload: { nonce: "nonce.1", returnTo: "/checkout" },
    });
    buildGoogleAuthorizationUrlMock.mockReturnValue(
      new URL(
        "https://accounts.google.com/o/oauth2/v2/auth?client_id=google-client&redirect_uri=https%3A%2F%2Fchezolive.ca%2Fapi%2Fauth%2Fgoogle%2Fcallback&scope=openid+email+profile&state=state.1",
      ),
    );
    readGoogleOAuthStateMock.mockReturnValue({ returnTo: "/checkout", nonce: "nonce.1" });
    exchangeGoogleAuthorizationCodeMock.mockResolvedValue({ idToken: "id-token" });
    verifyGoogleIdTokenMock.mockResolvedValue({
      sub: "google-sub",
      email: "client@gmail.com",
      emailVerified: true,
      givenName: "Client",
      familyName: "Google",
    });
    loginOrRegisterGoogleUserMock.mockResolvedValue({
      id: "u_1",
      email: "client@gmail.com",
      role: "CUSTOMER",
    });
    getCurrentLanguageMock.mockResolvedValue("fr");
  });

  it("redirige vers Google avec state et cookie", async () => {
    const { GET } = await import("@/app/api/auth/google/start/route");
    const req = new Request("https://chezolive.ca/api/auth/google/start?returnTo=/checkout");

    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("https://accounts.google.com/o/oauth2/v2/auth");
    expect(res.headers.get("set-cookie")).toContain("chezolive_google_oauth_state=state.1");
    expect(createGoogleOAuthStateMock).toHaveBeenCalledWith("/checkout");
    expect(buildGoogleAuthorizationUrlMock).toHaveBeenCalledWith(
      expect.objectContaining({
        state: "state.1",
        nonce: "nonce.1",
      }),
    );
  });

  it("masque le flow si Google OAuth n'est pas configure", async () => {
    getGoogleOAuthConfigMock.mockReturnValue(null);

    const { GET } = await import("@/app/api/auth/google/start/route");
    const req = new Request("https://chezolive.ca/api/auth/google/start");

    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://chezolive.ca/login?google=not_configured");
    expect(buildGoogleAuthorizationUrlMock).not.toHaveBeenCalled();
  });

  it("ne redirige pas vers localhost quand OAuth part derriere le proxy public", async () => {
    getGoogleOAuthConfigMock.mockReturnValue(null);

    const { GET } = await import("@/app/api/auth/google/start/route");
    const req = new Request("http://localhost:3101/api/auth/google/start", {
      headers: {
        "x-forwarded-host": "chezolive.ca",
        "x-forwarded-proto": "https",
      },
    });

    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://chezolive.ca/login?google=not_configured");
    expect(res.headers.get("location")).not.toContain("localhost");
    expect(buildGoogleAuthorizationUrlMock).not.toHaveBeenCalled();
  });

  it("refuse un callback avec state invalide", async () => {
    const { GET } = await import("@/app/api/auth/google/callback/route");
    const req = new Request("https://chezolive.ca/api/auth/google/callback?state=bad&code=abc");

    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://chezolive.ca/login?google=invalid_state");
    expect(loginOrRegisterGoogleUserMock).not.toHaveBeenCalled();
  });

  it("connecte un client Google valide et revient au returnTo interne", async () => {
    const { GET } = await import("@/app/api/auth/google/callback/route");
    const req = new Request("https://chezolive.ca/api/auth/google/callback?state=state.1&code=abc");

    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(exchangeGoogleAuthorizationCodeMock).toHaveBeenCalledWith("abc", expect.objectContaining({ clientId: "google-client" }));
    expect(verifyGoogleIdTokenMock).toHaveBeenCalledWith({
      idToken: "id-token",
      clientId: "google-client",
      nonce: "nonce.1",
    });
    expect(loginOrRegisterGoogleUserMock).toHaveBeenCalledWith(
      expect.objectContaining({ email: "client@gmail.com", emailVerified: true }),
      "fr",
    );
    expect(res.headers.get("location")).toBe("https://chezolive.ca/checkout");
    expect(res.headers.get("set-cookie")).toContain("chezolive_google_oauth_state=");
  });

  it("redirige clairement quand Google ne verifie pas le courriel", async () => {
    loginOrRegisterGoogleUserMock.mockRejectedValue(new Error("GOOGLE_EMAIL_NOT_VERIFIED"));

    const { GET } = await import("@/app/api/auth/google/callback/route");
    const req = new Request("https://chezolive.ca/api/auth/google/callback?state=state.1&code=abc");

    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://chezolive.ca/login?google=email_not_verified");
  });

  it("redirige clairement quand le courriel Google appartient a un admin", async () => {
    loginOrRegisterGoogleUserMock.mockRejectedValue(new Error("GOOGLE_ADMIN_FORBIDDEN"));

    const { GET } = await import("@/app/api/auth/google/callback/route");
    const req = new Request("https://chezolive.ca/api/auth/google/callback?state=state.1&code=abc");

    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://chezolive.ca/login?google=admin_not_allowed");
  });
});
