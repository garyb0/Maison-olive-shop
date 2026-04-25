export {}

const getCurrentUserMock = vi.fn();
const logApiEventMock = vi.fn();

const prismaMock = {
  subscription: {
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
};

const stripeSubscriptionsUpdateMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  getCurrentUser: (...args: unknown[]) => getCurrentUserMock(...args),
}));

vi.mock("@/lib/observability", () => ({
  logApiEvent: (...args: unknown[]) => logApiEventMock(...args),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("stripe", () => {
  class StripeMock {
    static API_VERSION = "2026-02-25.clover";

    subscriptions = { update: stripeSubscriptionsUpdateMock };
  }

  return {
    __esModule: true,
    default: StripeMock,
  };
});

describe("POST /api/account/subscriptions/cancel", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_mock";

    getCurrentUserMock.mockResolvedValue({
      id: "user_1",
      email: "user@test.com",
    });

    prismaMock.subscription.findFirst.mockResolvedValue({
      id: "sub_1",
      userId: "user_1",
      stripeSubscriptionId: "sub_stripe_1",
    });

    prismaMock.subscription.updateMany.mockResolvedValue({ count: 1 });
    stripeSubscriptionsUpdateMock.mockResolvedValue({ id: "sub_stripe_1" });
  });

  it("retourne 400 quand le payload est invalide", async () => {
    const { POST } = await import("@/app/api/account/subscriptions/cancel/route");
    const req = new Request("http://localhost:3101/api/account/subscriptions/cancel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    const payload = (await res.json()) as { error?: string };

    expect(res.status).toBe(400);
    expect(payload.error).toBe("Invalid payload");
    expect(prismaMock.subscription.findFirst).not.toHaveBeenCalled();
  });

  it("retourne 401 quand l'utilisateur n'est pas connecté", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    const { POST } = await import("@/app/api/account/subscriptions/cancel/route");
    const req = new Request("http://localhost:3101/api/account/subscriptions/cancel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subscriptionId: "sub_1" }),
    });

    const res = await POST(req);
    const payload = (await res.json()) as { error?: string };

    expect(res.status).toBe(401);
    expect(payload.error).toBe("Unauthorized");
    expect(prismaMock.subscription.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.subscription.updateMany).not.toHaveBeenCalled();
    expect(stripeSubscriptionsUpdateMock).not.toHaveBeenCalled();
    expect(logApiEventMock).toHaveBeenCalled();
  });
});
