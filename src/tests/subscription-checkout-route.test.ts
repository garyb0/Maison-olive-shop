export {}

const getCurrentUserMock = vi.fn();
const logApiEventMock = vi.fn();

const prismaMock = {
  product: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
};

const stripeSessionsCreateMock = vi.fn();
const stripeProductsCreateMock = vi.fn();
const stripePricesCreateMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  getCurrentUser: (...args: unknown[]) => getCurrentUserMock(...args),
}));

vi.mock("@/lib/observability", () => ({
  logApiEvent: (...args: unknown[]) => logApiEventMock(...args),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/stripe", () => ({
  stripeEnabled: true,
  stripe: {
    checkout: {
      sessions: {
        create: (...args: unknown[]) => stripeSessionsCreateMock(...args),
      },
    },
    products: {
      create: (...args: unknown[]) => stripeProductsCreateMock(...args),
    },
    prices: {
      create: (...args: unknown[]) => stripePricesCreateMock(...args),
    },
  },
}));

describe("POST /api/checkout/subscription", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_mock";
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3101";

    getCurrentUserMock.mockResolvedValue({
      id: "user_1",
      email: "user@test.com",
    });

    prismaMock.product.findFirst.mockResolvedValue({
      id: "prod_1",
      slug: "croquettes-premium",
      nameFr: "Croquettes premium",
      descriptionFr: "Top qualité",
      currency: "CAD",
      stripePriceWeekly: "price_weekly_1",
      stripePriceBiweekly: null,
      stripePriceMonthly: null,
      stripePriceQuarterly: null,
      priceWeekly: 1299,
      priceBiweekly: null,
      priceMonthly: null,
      priceQuarterly: null,
    });

    stripeSessionsCreateMock.mockResolvedValue({
      id: "cs_test_1",
      client_secret: "cs_test_secret_1",
    });
  });

  it("retourne 400 quand le payload est invalide", async () => {
    const { POST } = await import("@/app/api/checkout/subscription/route");
    const req = new Request("http://localhost:3101/api/checkout/subscription", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ interval: "WEEKLY" }),
    });

    const res = await POST(req);
    const payload = (await res.json()) as { error?: string };

    expect(res.status).toBe(400);
    expect(payload.error).toBe("Invalid payload");
    expect(prismaMock.product.findFirst).not.toHaveBeenCalled();
  });

  it("retourne 401 quand l'utilisateur n'est pas connecté", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    const { POST } = await import("@/app/api/checkout/subscription/route");
    const req = new Request("http://localhost:3101/api/checkout/subscription", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        productId: "prod_1",
        interval: "WEEKLY",
        quantity: 2,
      }),
    });

    const res = await POST(req);
    const payload = (await res.json()) as { error?: string };

    expect(res.status).toBe(401);
    expect(payload.error).toBe("Unauthorized");
    expect(prismaMock.product.findFirst).not.toHaveBeenCalled();
    expect(stripeSessionsCreateMock).not.toHaveBeenCalled();
    expect(logApiEventMock).toHaveBeenCalled();
  });

  it("returns an inline subscription checkout session with a client secret", async () => {
    const { POST } = await import("@/app/api/checkout/subscription/route");
    const req = new Request("http://localhost:3101/api/checkout/subscription", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        productId: "prod_1",
        interval: "WEEKLY",
        quantity: 1,
      }),
    });

    const res = await POST(req);
    const payload = (await res.json()) as {
      uiMode: string;
      clientSecret: string;
      sessionId: string;
      returnUrl: string;
      url?: string;
    };

    expect(res.status).toBe(200);
    expect(payload).toEqual(
      expect.objectContaining({
        uiMode: "custom",
        clientSecret: "cs_test_secret_1",
        sessionId: "cs_test_1",
      }),
    );
    expect(payload.returnUrl).toContain("/products/croquettes-premium?");
    expect(payload.url).toBeUndefined();
    expect(stripeSessionsCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        ui_mode: "custom",
        return_url: expect.stringContaining("/products/croquettes-premium?"),
      }),
    );
  });
});
