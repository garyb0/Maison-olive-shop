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
});
