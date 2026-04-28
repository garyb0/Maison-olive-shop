export {};

const applyRateLimitMock = vi.fn();
const getCurrentUserMock = vi.fn();
const createOrderSafelyMock = vi.fn();
const logApiEventMock = vi.fn();
const stripeSessionsCreateMock = vi.fn();
const buildCheckoutConfirmationMock = vi.fn();

const prismaMock = {
  order: {
    update: vi.fn(),
    findUnique: vi.fn(),
  },
};

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: (...args: unknown[]) => applyRateLimitMock(...args),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: (...args: unknown[]) => getCurrentUserMock(...args),
}));

vi.mock("@/lib/orders", () => ({
  createOrderSafely: (...args: unknown[]) => createOrderSafelyMock(...args),
  getOrdersForUser: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  stripeEnabled: true,
  stripe: {
    checkout: {
      sessions: {
        create: (...args: unknown[]) => stripeSessionsCreateMock(...args),
      },
    },
  },
}));

vi.mock("@/lib/checkout-confirmation", () => ({
  buildCheckoutConfirmation: (...args: unknown[]) => buildCheckoutConfirmationMock(...args),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/business", () => ({
  sendOrderConfirmationEmail: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: {
    siteUrl: "https://chezolive.ca",
  },
}));

vi.mock("@/lib/observability", () => ({
  logApiEvent: (...args: unknown[]) => logApiEventMock(...args),
}));

describe("POST /api/orders", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    applyRateLimitMock.mockResolvedValue({ ok: true, remaining: 11, retryAfterSeconds: 0 });
    getCurrentUserMock.mockResolvedValue({
      id: "user_1",
      email: "gary@example.com",
      firstName: "Gary",
      lastName: "Boucher",
      language: "fr",
    });
    createOrderSafelyMock.mockResolvedValue({
      id: "order_1",
      orderNumber: "MO-20260420-1234",
      totalCents: 12,
    });
    prismaMock.order.findUnique.mockResolvedValue({
      id: "order_1",
      orderNumber: "MO-20260420-1234",
      customerEmail: "gary@example.com",
      customerName: "Gary Boucher",
      totalCents: 12,
      subtotalCents: 12,
      discountCents: 0,
      shippingCents: 0,
      taxCents: 0,
      currency: "CAD",
      paymentMethod: "STRIPE",
      createdAt: new Date("2026-04-21T04:00:00.000Z"),
      items: [],
    });
    buildCheckoutConfirmationMock.mockReturnValue({
      orderId: "order_1",
      orderNumber: "MO-20260420-1234",
      registerEmail: "gary@example.com",
      paymentMode: "stripe",
      orderCreatedAt: "2026-04-21T04:00:00.000Z",
      currency: "CAD",
      subtotalCents: 12,
      discountCents: 0,
      shippingCents: 0,
      gstCents: 0,
      qstCents: 0,
      taxCents: 0,
      totalCents: 12,
      items: [],
    });
    stripeSessionsCreateMock.mockResolvedValue({
      id: "cs_test_1",
      client_secret: "cs_test_secret_1",
    });
  });

  it("returns an inline Stripe checkout session instead of a hosted checkout URL", async () => {
    const { POST } = await import("@/app/api/orders/route");
    const req = new Request("http://localhost:3101/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        items: [{ productId: "prod_test", quantity: 1 }],
        paymentMethod: "STRIPE",
        shippingLine1: "22 rue de l'etang",
        shippingCity: "Rimouski",
        shippingRegion: "QC",
        shippingPostal: "G0L1B0",
        shippingCountry: "CA",
      }),
    });

    const res = await POST(req);
    const payload = (await res.json()) as {
      order: { orderNumber: string };
      confirmation: { orderNumber: string };
      stripeCheckout: {
        uiMode: string;
        clientSecret: string;
        sessionId: string;
        returnUrl: string;
      } | null;
      stripeCheckoutUrl?: string | null;
    };

    expect(res.status).toBe(200);
    expect(payload.order.orderNumber).toBe("MO-20260420-1234");
    expect(payload.confirmation.orderNumber).toBe("MO-20260420-1234");
    expect(payload.stripeCheckout).toEqual(
      expect.objectContaining({
        uiMode: "custom",
        clientSecret: "cs_test_secret_1",
        sessionId: "cs_test_1",
      }),
    );
    expect(payload.stripeCheckout?.returnUrl).toContain("/checkout?");
    expect(payload).not.toHaveProperty("stripeCheckoutUrl");
    expect(stripeSessionsCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        ui_mode: "custom",
        return_url: expect.stringContaining("/checkout?"),
      }),
    );
    expect(prismaMock.order.update).toHaveBeenCalledWith({
      where: { id: "order_1" },
      data: { stripeSessionId: "cs_test_1" },
    });
  });

  it("retourne un message clair quand Stripe refuse un total inferieur a 0,50 $ CAD", async () => {
    stripeSessionsCreateMock.mockRejectedValue(
      new Error("The Checkout Session's total amount due must add up to at least $0.50 cad"),
    );

    const { POST } = await import("@/app/api/orders/route");
    const req = new Request("http://localhost:3101/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        items: [{ productId: "prod_test", quantity: 1 }],
        paymentMethod: "STRIPE",
        shippingLine1: "22 rue de l'etang",
        shippingCity: "Rimouski",
        shippingRegion: "QC",
        shippingPostal: "G0L1B0",
        shippingCountry: "CA",
      }),
    });

    const res = await POST(req);
    const payload = (await res.json()) as { error?: string };

    expect(res.status).toBe(400);
    expect(payload.error).toBe(
      "Stripe exige un total d'au moins 0,50 $ CAD. Augmente légèrement le montant de la commande ou retire le rabais de test.",
    );
    expect(logApiEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "ORDER_CREATE_STRIPE_MINIMUM_AMOUNT",
        status: 400,
      }),
    );
  });

  it("bloque une commande quand l'adresse de livraison effective est incomplete", async () => {
    createOrderSafelyMock.mockRejectedValue(new Error("DELIVERY_ADDRESS_INCOMPLETE"));

    const { POST } = await import("@/app/api/orders/route");
    const req = new Request("http://localhost:3101/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        items: [{ productId: "prod_test", quantity: 1 }],
        paymentMethod: "STRIPE",
        shippingPostal: "G0L1B0",
        shippingCountry: "CA",
      }),
    });

    const res = await POST(req);
    const payload = (await res.json()) as { error?: string };

    expect(res.status).toBe(400);
    expect(payload.error).toContain("Adresse incomplete");
    expect(logApiEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "ORDER_CREATE_DELIVERY_ADDRESS_INCOMPLETE",
        status: 400,
      }),
    );
  });

  it("retourne un message clair si le mode de livraison experimental est desactive", async () => {
    createOrderSafelyMock.mockRejectedValue(new Error("DELIVERY_DYNAMIC_DISABLED"));

    const { POST } = await import("@/app/api/orders/route");
    const req = new Request("http://localhost:3101/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        items: [{ productId: "prod_test", quantity: 1 }],
        paymentMethod: "STRIPE",
        shippingLine1: "22 rue de l'etang",
        shippingCity: "Rimouski",
        shippingRegion: "QC",
        shippingPostal: "G0L1B0",
        shippingCountry: "CA",
        deliveryWindowStartAt: "2026-05-01T12:00:00.000Z",
        deliveryWindowEndAt: "2026-05-01T14:00:00.000Z",
      }),
    });

    const res = await POST(req);
    const payload = (await res.json()) as { error?: string };

    expect(res.status).toBe(409);
    expect(payload.error).toBe("Le mode de livraison expÃ©rimental est dÃ©sactivÃ©");
  });
});
