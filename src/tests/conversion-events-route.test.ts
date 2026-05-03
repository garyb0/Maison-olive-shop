export {};

const applyRateLimitMock = vi.fn();
const getCurrentUserMock = vi.fn();
const createConversionEventMock = vi.fn();

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: (...args: unknown[]) => applyRateLimitMock(...args),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: (...args: unknown[]) => getCurrentUserMock(...args),
}));

vi.mock("@/lib/conversion-analytics", () => ({
  createConversionEvent: (...args: unknown[]) => createConversionEventMock(...args),
}));

vi.mock("@/lib/observability", () => ({
  logApiEvent: vi.fn(),
}));

describe("POST /api/conversion-events", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    applyRateLimitMock.mockResolvedValue({ ok: true, remaining: 79, retryAfterSeconds: 60 });
    getCurrentUserMock.mockResolvedValue({ id: "user_1" });
    createConversionEventMock.mockResolvedValue({ id: "event_1" });
  });

  it("accepte un evenement de conversion minimal et attache l'utilisateur courant", async () => {
    const { POST } = await import("@/app/api/conversion-events/route");
    const request = new Request("http://localhost:3101/api/conversion-events", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      },
      body: JSON.stringify({
        type: "CART_ADD",
        sessionKey: "session-public-123",
        productId: "prod_1",
        productSlug: "lit-douillet",
        quantity: 1,
        language: "fr",
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { ok?: boolean };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(createConversionEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "CART_ADD",
        sessionKey: "session-public-123",
        productId: "prod_1",
        quantity: 1,
      }),
      expect.objectContaining({
        userId: "user_1",
        userAgent: expect.stringContaining("iPhone"),
      }),
    );
  });

  it("rejette un payload qui tente d'envoyer des donnees sensibles", async () => {
    const { POST } = await import("@/app/api/conversion-events/route");
    const request = new Request("http://localhost:3101/api/conversion-events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "CHECKOUT_START",
        sessionKey: "session-public-123",
        customerEmail: "client@example.com",
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(createConversionEventMock).not.toHaveBeenCalled();
  });

  it("applique le rate limit public", async () => {
    applyRateLimitMock.mockResolvedValueOnce({ ok: false, remaining: 0, retryAfterSeconds: 60 });

    const { POST } = await import("@/app/api/conversion-events/route");
    const request = new Request("http://localhost:3101/api/conversion-events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "SHOP_VIEW", sessionKey: "session-public-123" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(429);
    expect(createConversionEventMock).not.toHaveBeenCalled();
  });
});
