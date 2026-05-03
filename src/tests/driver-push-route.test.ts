export {};

const applyRateLimitMock = vi.fn();
const getDriverRunSnapshotMock = vi.fn();
const registerWebPushSubscriptionForDriverTokenMock = vi.fn();
const unregisterWebPushSubscriptionForDriverTokenMock = vi.fn();

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: (...args: unknown[]) => applyRateLimitMock(...args),
}));

vi.mock("@/lib/delivery-runs", () => ({
  getDriverRunSnapshot: (...args: unknown[]) => getDriverRunSnapshotMock(...args),
  mapDeliveryRunError: (error: unknown) => ({
    message: error instanceof Error ? error.message : "Driver run error",
    status: error instanceof Error && error.message === "DELIVERY_RUN_NOT_FOUND" ? 404 : 500,
  }),
}));

vi.mock("@/lib/app-notifications", () => ({
  registerWebPushSubscriptionForDriverToken: (...args: unknown[]) =>
    registerWebPushSubscriptionForDriverTokenMock(...args),
  unregisterWebPushSubscriptionForDriverToken: (...args: unknown[]) =>
    unregisterWebPushSubscriptionForDriverTokenMock(...args),
}));

const validSubscription = {
  endpoint: "https://push.example.test/driver/subscription/123",
  keys: {
    p256dh: "abcdefghijklmnopqrstuvwxyz123456",
    auth: "driver-auth-token",
  },
};

describe("driver push subscription route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    applyRateLimitMock.mockResolvedValue({ ok: true, remaining: 19, retryAfterSeconds: 0 });
    getDriverRunSnapshotMock.mockResolvedValue({ id: "run_1" });
    registerWebPushSubscriptionForDriverTokenMock.mockResolvedValue({ id: "push_1", enabled: true });
    unregisterWebPushSubscriptionForDriverTokenMock.mockResolvedValue({ ok: true });
  });

  it("abonne un token livreur valide aux notifications de tournee", async () => {
    const { POST } = await import("@/app/api/driver/run/[token]/push/subscribe/route");

    const response = await POST(
      new Request("http://localhost:3101/api/driver/run/token_123/push/subscribe", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "Driver Mobile",
        },
        body: JSON.stringify(validSubscription),
      }),
      { params: Promise.resolve({ token: "token_123" }) },
    );

    expect(response.status).toBe(200);
    expect(registerWebPushSubscriptionForDriverTokenMock).toHaveBeenCalledWith({
      token: "token_123",
      runId: "run_1",
      subscription: validSubscription,
      userAgent: "Driver Mobile",
    });
  });

  it("refuse un token livreur invalide", async () => {
    getDriverRunSnapshotMock.mockRejectedValueOnce(new Error("DELIVERY_RUN_NOT_FOUND"));
    const { POST } = await import("@/app/api/driver/run/[token]/push/subscribe/route");

    const response = await POST(
      new Request("http://localhost:3101/api/driver/run/bad_token/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(validSubscription),
      }),
      { params: Promise.resolve({ token: "bad_token" }) },
    );

    expect(response.status).toBe(404);
    expect(registerWebPushSubscriptionForDriverTokenMock).not.toHaveBeenCalled();
  });

  it("desabonne un endpoint livreur sans compte", async () => {
    const { DELETE } = await import("@/app/api/driver/run/[token]/push/subscribe/route");

    const response = await DELETE(
      new Request("http://localhost:3101/api/driver/run/token_123/push/subscribe", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: validSubscription.endpoint }),
      }),
      { params: Promise.resolve({ token: "token_123" }) },
    );

    expect(response.status).toBe(200);
    expect(unregisterWebPushSubscriptionForDriverTokenMock).toHaveBeenCalledWith(
      "token_123",
      validSubscription.endpoint,
    );
  });
});
