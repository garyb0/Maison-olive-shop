export {};

const applyRateLimitMock = vi.fn();
const registerUserMock = vi.fn();

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: (...args: unknown[]) => applyRateLimitMock(...args),
}));

vi.mock("@/lib/auth", () => ({
  registerUser: (...args: unknown[]) => registerUserMock(...args),
}));

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    applyRateLimitMock.mockReturnValue({ ok: true, remaining: 9, retryAfterSeconds: 600 });
  });

  it("garde le payload existant quand autoLogin est absent", async () => {
    registerUserMock.mockResolvedValue({
      id: "u_1",
      email: "client@example.com",
      firstName: "Olive",
      lastName: "Client",
      role: "CUSTOMER",
    });

    const { POST } = await import("@/app/api/auth/register/route");
    const req = new Request("http://localhost:3101/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "client@example.com",
        password: "password123",
        firstName: "Olive",
        lastName: "Client",
        language: "fr",
      }),
    });

    const res = await POST(req);
    const payload = (await res.json()) as { role?: string };

    expect(res.status).toBe(200);
    expect(payload).toEqual({
      id: "u_1",
      email: "client@example.com",
      firstName: "Olive",
      lastName: "Client",
    });
    expect(registerUserMock).toHaveBeenCalledWith(
      {
        email: "client@example.com",
        password: "password123",
        firstName: "Olive",
        lastName: "Client",
        language: "fr",
      },
      undefined,
    );
  });

  it("connecte automatiquement quand autoLogin vaut true", async () => {
    registerUserMock.mockResolvedValue({
      id: "u_2",
      email: "new@example.com",
      firstName: "New",
      lastName: "Client",
      role: "CUSTOMER",
    });

    const { POST } = await import("@/app/api/auth/register/route");
    const req = new Request("http://localhost:3101/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "new@example.com",
        password: "password123",
        firstName: "New",
        lastName: "Client",
        language: "fr",
        autoLogin: true,
      }),
    });

    const res = await POST(req);
    const payload = (await res.json()) as { role?: string };

    expect(res.status).toBe(200);
    expect(payload.role).toBe("CUSTOMER");
    expect(registerUserMock).toHaveBeenCalledWith(
      {
        email: "new@example.com",
        password: "password123",
        firstName: "New",
        lastName: "Client",
        language: "fr",
      },
      { autoLogin: true },
    );
  });

  it("retourne 409 quand le courriel existe deja", async () => {
    registerUserMock.mockRejectedValue(new Error("EMAIL_ALREADY_EXISTS"));

    const { POST } = await import("@/app/api/auth/register/route");
    const req = new Request("http://localhost:3101/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "client@example.com",
        password: "password123",
        firstName: "Olive",
        lastName: "Client",
      }),
    });

    const res = await POST(req);
    const payload = (await res.json()) as { error?: string };

    expect(res.status).toBe(409);
    expect(payload.error).toBe("Email already exists");
  });
});
