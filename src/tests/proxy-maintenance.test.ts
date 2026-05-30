export {};

const isMaintenanceEnabledMock = vi.fn();

vi.mock("@/lib/maintenance", () => ({
  isMaintenanceEnabled: (...args: unknown[]) => isMaintenanceEnabledMock(...args),
}));

describe("proxy maintenance", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    isMaintenanceEnabledMock.mockReturnValue(true);
  });

  it("redirige HTTP public vers HTTPS avant la maintenance", async () => {
    const { NextRequest } = await import("next/server");
    const { proxy } = await import("@/proxy");

    const request = new NextRequest("http://localhost:3101/products/example?ref=test", {
      headers: {
        "x-forwarded-host": "chezolive.ca",
        "x-forwarded-proto": "http",
      },
    });

    const response = await proxy(request);

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("https://chezolive.ca/products/example?ref=test");
  });

  it("ne force pas HTTPS pour localhost", async () => {
    isMaintenanceEnabledMock.mockReturnValue(false);

    const { NextRequest } = await import("next/server");
    const { proxy } = await import("@/proxy");

    const request = new NextRequest("http://localhost:3101/products/example");
    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("reecrit un visiteur public vers maintenance", async () => {
    const { NextRequest } = await import("next/server");
    const { proxy } = await import("@/proxy");

    const request = new NextRequest("http://localhost:3101/products/example");
    const response = await proxy(request);

    expect(response.headers.get("x-middleware-rewrite")).toContain("/maintenance");
  });

  it("laisse passer un admin avec cookie signe", async () => {
    const { NextRequest } = await import("next/server");
    const { createAdminAccessCookieValue, ADMIN_ACCESS_COOKIE_NAME } = await import("@/lib/admin-access-cookie");
    const { env } = await import("@/lib/env");
    const { proxy } = await import("@/proxy");

    const sessionToken = "session_123";
    const adminCookie = await createAdminAccessCookieValue({
      sessionToken,
      expiresAt: new Date(Date.now() + 60_000),
      secret: env.sessionSecret,
    });

    const request = new NextRequest("http://localhost:3101/products/example", {
      headers: {
        cookie: `${env.sessionCookieName}=${sessionToken}; ${ADMIN_ACCESS_COOKIE_NAME}=${adminCookie}`,
      },
    });

    const response = await proxy(request);

    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("refuse un cookie admin falsifie", async () => {
    const { NextRequest } = await import("next/server");
    const { ADMIN_ACCESS_COOKIE_NAME } = await import("@/lib/admin-access-cookie");
    const { env } = await import("@/lib/env");
    const { proxy } = await import("@/proxy");

    const request = new NextRequest("http://localhost:3101/products/example", {
      headers: {
        cookie: `${env.sessionCookieName}=session_123; ${ADMIN_ACCESS_COOKIE_NAME}=1`,
      },
    });

    const response = await proxy(request);

    expect(response.headers.get("x-middleware-rewrite")).toContain("/maintenance");
  });

  it("bloque une mutation API cross-site avant les routes sensibles", async () => {
    isMaintenanceEnabledMock.mockReturnValue(false);

    const { NextRequest } = await import("next/server");
    const { proxy } = await import("@/proxy");

    const request = new NextRequest("https://chezolive.ca/api/admin/orders", {
      method: "POST",
      headers: {
        origin: "https://attacker.example",
        "sec-fetch-site": "cross-site",
      },
    });

    const response = await proxy(request);
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(403);
    expect(payload.error).toBe("FORBIDDEN_CROSS_SITE_REQUEST");
  });

  it("laisse passer une mutation API same-origin", async () => {
    isMaintenanceEnabledMock.mockReturnValue(false);

    const { NextRequest } = await import("next/server");
    const { proxy } = await import("@/proxy");

    const request = new NextRequest("https://chezolive.ca/api/orders", {
      method: "POST",
      headers: {
        origin: "https://chezolive.ca",
        "sec-fetch-site": "same-origin",
      },
    });

    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("ne bloque pas le webhook Stripe sans Origin", async () => {
    isMaintenanceEnabledMock.mockReturnValue(false);

    const { NextRequest } = await import("next/server");
    const { proxy } = await import("@/proxy");

    const request = new NextRequest("https://chezolive.ca/api/stripe/webhook", {
      method: "POST",
    });

    const response = await proxy(request);

    expect(response.status).toBe(200);
  });
});
