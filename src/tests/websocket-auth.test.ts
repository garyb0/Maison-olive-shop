export {};

const findUniqueMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    session: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
    },
  },
}));

vi.mock("@/lib/env", () => ({
  DEV_SESSION_SECRET: "dev-secret",
  env: {
    sessionCookieName: "chezolive_session",
    sessionSecret: "socket-test-secret",
  },
}));

describe("resolveSocketUserFromCookieHeader", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("ignore le role envoye par le client et utilise la session serveur", async () => {
    findUniqueMock.mockResolvedValue({
      token: "server-token",
      expiresAt: new Date(Date.now() + 60_000),
      user: {
        id: "user_1",
        email: "client@example.com",
        firstName: "Client",
        lastName: "Olive",
        role: "CUSTOMER",
      },
    });

    const { resolveSocketUserFromCookieHeader } = await import("@/lib/websocket");
    const { hashSessionToken } = await import("@/lib/auth");
    const user = await resolveSocketUserFromCookieHeader("chezolive_session=server-token; userRole=ADMIN");

    expect(user).toEqual({
      userId: "user_1",
      userEmail: "client@example.com",
      userRole: "CUSTOMER",
      userName: "Client Olive",
    });
    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { tokenHash: hashSessionToken("server-token") },
      include: { user: true },
    });
  });

  it("refuse une connexion sans cookie de session", async () => {
    const { resolveSocketUserFromCookieHeader } = await import("@/lib/websocket");
    const user = await resolveSocketUserFromCookieHeader("userRole=ADMIN");

    expect(user).toBeNull();
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("refuse une session expiree", async () => {
    findUniqueMock.mockResolvedValue({
      token: "expired-token",
      expiresAt: new Date(Date.now() - 60_000),
      user: {
        id: "admin_1",
        email: "admin@example.com",
        firstName: "Admin",
        lastName: "Olive",
        role: "ADMIN",
      },
    });

    const { resolveSocketUserFromCookieHeader } = await import("@/lib/websocket");
    const user = await resolveSocketUserFromCookieHeader("chezolive_session=expired-token");

    expect(user).toBeNull();
  });
});
