export {}

const logApiEventMock = vi.fn();
const markOrderPaidFromStripeSessionMock = vi.fn();
const markOrderStripeCheckoutExpiredMock = vi.fn();

const prismaMock = {
  subscription: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  stripeWebhookEvent: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  },
};

const stripeConstructEventMock = vi.fn();
const stripeSubscriptionsRetrieveMock = vi.fn();

vi.mock("@/lib/observability", () => ({
  logApiEvent: (...args: unknown[]) => logApiEventMock(...args),
}));

vi.mock("@/lib/orders", () => ({
  markOrderPaidFromStripeSession: (...args: unknown[]) => markOrderPaidFromStripeSessionMock(...args),
  markOrderStripeCheckoutExpired: (...args: unknown[]) => markOrderStripeCheckoutExpiredMock(...args),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("stripe", () => {
  class StripeMock {
    static API_VERSION = "2026-02-25.clover";

    webhooks = { constructEvent: stripeConstructEventMock };
    subscriptions = { retrieve: stripeSubscriptionsRetrieveMock };
  }

  return {
    __esModule: true,
    default: StripeMock,
  };
});

describe("POST /api/stripe/webhook", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    process.env.STRIPE_SECRET_KEY = "sk_test_mock";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_mock";

    prismaMock.subscription.findUnique.mockResolvedValue(null);
    prismaMock.subscription.create.mockResolvedValue({ id: "sub_1" });
    prismaMock.subscription.update.mockResolvedValue({ id: "sub_1" });
    prismaMock.subscription.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.stripeWebhookEvent.findUnique.mockResolvedValue(null);
    prismaMock.stripeWebhookEvent.create.mockResolvedValue({
      id: "we_1",
      stripeEventId: "evt_1",
      stripeEventType: "checkout.session.completed",
      status: "received",
    });
    prismaMock.stripeWebhookEvent.update.mockResolvedValue({
      id: "we_1",
      stripeEventId: "evt_1",
      stripeEventType: "checkout.session.completed",
      status: "processed",
    });
    prismaMock.stripeWebhookEvent.upsert.mockResolvedValue({
      id: "we_1",
      stripeEventId: "evt_1",
      stripeEventType: "checkout.session.completed",
      status: "processed",
    });
    markOrderPaidFromStripeSessionMock.mockResolvedValue({
      orderId: "order_1",
      transitionedToPaid: true,
    });
    markOrderStripeCheckoutExpiredMock.mockResolvedValue({
      orderId: "order_1",
      transitionedToFailed: true,
    });

    stripeSubscriptionsRetrieveMock.mockResolvedValue({
      id: "sub_stripe_1",
      status: "active",
      current_period_start: 1_700_000_000,
      current_period_end: 1_700_864_000,
      cancel_at_period_end: false,
      canceled_at: null,
    });
  });

  it("retourne 400 si la signature Stripe est absente", async () => {
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const req = new Request("http://localhost:3101/api/stripe/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ test: true }),
    });

    const res = await POST(req);
    const payload = (await res.json()) as { error?: string };

    expect(res.status).toBe(400);
    expect(payload.error).toBe("Missing stripe-signature header");
    expect(stripeConstructEventMock).not.toHaveBeenCalled();
  });

  it("retourne 400 quand la signature Stripe est invalide", async () => {
    stripeConstructEventMock.mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    const { POST } = await import("@/app/api/stripe/webhook/route");
    const req = new Request("http://localhost:3101/api/stripe/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": "t=1,v1=fake",
      },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    const payload = (await res.json()) as { error?: string };

    expect(res.status).toBe(400);
    expect(payload.error).toContain("Webhook Error");
    expect(prismaMock.subscription.findUnique).not.toHaveBeenCalled();
  });

  it("marque une commande ponctuelle payee sur checkout.session.completed", async () => {
    const session = {
      id: "cs_test_1",
      mode: "payment",
      payment_status: "paid",
      client_reference_id: "order_1",
      metadata: { orderId: "order_1" },
    };
    stripeConstructEventMock.mockReturnValue({
      id: "evt_1",
      type: "checkout.session.completed",
      data: { object: session },
    });

    const { POST } = await import("@/app/api/stripe/webhook/route");
    const req = new Request("http://localhost:3101/api/stripe/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": "t=1,v1=valid",
      },
      body: JSON.stringify({}),
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(markOrderPaidFromStripeSessionMock).toHaveBeenCalledWith(
      session,
      "checkout.session.completed",
    );
    expect(prismaMock.stripeWebhookEvent.findUnique).toHaveBeenCalledTimes(1);
    expect(prismaMock.stripeWebhookEvent.create).toHaveBeenCalledWith({
      data: {
        stripeEventId: "evt_1",
        stripeEventType: "checkout.session.completed",
        status: "received",
      },
    });
    expect(prismaMock.stripeWebhookEvent.upsert).toHaveBeenCalledWith({
      create: {
        status: "processed",
        stripeEventId: "evt_1",
        stripeEventType: "checkout.session.completed",
      },
      update: {
        status: "processed",
        stripeEventType: "checkout.session.completed",
      },
      where: {
        stripeEventId: "evt_1",
      },
    });
    expect(prismaMock.subscription.findUnique).not.toHaveBeenCalled();
  });

  it("marque une commande ponctuelle expiree et libere le stock", async () => {
    const session = {
      id: "cs_test_expired",
      mode: "payment",
      payment_status: "unpaid",
      client_reference_id: "order_1",
      metadata: { orderId: "order_1" },
    };
    stripeConstructEventMock.mockReturnValue({
      id: "evt_2",
      type: "checkout.session.expired",
      data: { object: session },
    });

    const { POST } = await import("@/app/api/stripe/webhook/route");
    const req = new Request("http://localhost:3101/api/stripe/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": "t=1,v1=valid",
      },
      body: JSON.stringify({}),
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(markOrderStripeCheckoutExpiredMock).toHaveBeenCalledWith(session);
    expect(prismaMock.subscription.findUnique).not.toHaveBeenCalled();
  });

  it("ignore un event webhook déjà reçu (idempotence)", async () => {
    prismaMock.stripeWebhookEvent.findUnique.mockResolvedValue({
      stripeEventId: "evt_3",
      stripeEventType: "checkout.session.completed",
      status: "processed",
    });
    stripeConstructEventMock.mockReturnValue({
      id: "evt_3",
      type: "checkout.session.completed",
      data: { object: {} },
    });

    const { POST } = await import("@/app/api/stripe/webhook/route");
    const req = new Request("http://localhost:3101/api/stripe/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": "t=1,v1=valid",
      },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(prismaMock.stripeWebhookEvent.findUnique).toHaveBeenCalledWith({
      where: { stripeEventId: "evt_3" },
    });
    expect(prismaMock.subscription.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.stripeWebhookEvent.create).not.toHaveBeenCalled();
    expect(prismaMock.stripeWebhookEvent.upsert).not.toHaveBeenCalled();
    expect(markOrderPaidFromStripeSessionMock).not.toHaveBeenCalled();
  });

  it("marque le webhook en échec quand le handler lève une erreur", async () => {
    prismaMock.stripeWebhookEvent.create.mockRejectedValueOnce(new Error("insert failed"));
    stripeConstructEventMock.mockReturnValue({
      id: "evt_4",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_failed",
          mode: "payment",
          metadata: { orderId: "order_1" },
        },
      },
    });
    markOrderPaidFromStripeSessionMock.mockRejectedValueOnce(new Error("mark failed"));

    const { POST } = await import("@/app/api/stripe/webhook/route");
    const req = new Request("http://localhost:3101/api/stripe/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": "t=1,v1=valid",
      },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    expect(prismaMock.stripeWebhookEvent.upsert).toHaveBeenCalledWith({
      create: {
        stripeEventId: "evt_4",
        stripeEventType: "checkout.session.completed",
        status: "failed",
        lastError: "insert failed",
      },
      update: {
        status: "failed",
        lastError: "insert failed",
        stripeEventType: "checkout.session.completed",
      },
      where: {
        stripeEventId: "evt_4",
      },
    });
    expect(markOrderPaidFromStripeSessionMock).not.toHaveBeenCalled();
  });
});
