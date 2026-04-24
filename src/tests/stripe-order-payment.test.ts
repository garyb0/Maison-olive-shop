export {}

const sendOrderConfirmationEmailMock = vi.fn();
const transactionMock = vi.fn();
const orderFindFirstMock = vi.fn();
const orderFindUniqueMock = vi.fn();
const orderUpdateManyMock = vi.fn();
const auditLogCreateMock = vi.fn();
const productUpdateMock = vi.fn();
const inventoryMovementCreateMock = vi.fn();

vi.mock("@/lib/business", () => ({
  sendOrderConfirmationEmail: (...args: unknown[]) => sendOrderConfirmationEmailMock(...args),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: (...args: unknown[]) => transactionMock(...args),
    order: {
      findFirst: (...args: unknown[]) => orderFindFirstMock(...args),
      findUnique: (...args: unknown[]) => orderFindUniqueMock(...args),
      updateMany: (...args: unknown[]) => orderUpdateManyMock(...args),
    },
    auditLog: {
      create: (...args: unknown[]) => auditLogCreateMock(...args),
    },
    product: {
      update: (...args: unknown[]) => productUpdateMock(...args),
    },
    inventoryMovement: {
      create: (...args: unknown[]) => inventoryMovementCreateMock(...args),
    },
  },
}));

describe("Stripe order payment helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    transactionMock.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({
        order: {
          findUnique: orderFindUniqueMock,
          updateMany: orderUpdateManyMock,
        },
        auditLog: {
          create: auditLogCreateMock,
        },
        product: {
          update: productUpdateMock,
        },
        inventoryMovement: {
          create: inventoryMovementCreateMock,
        },
      }),
    );
  });

  it("marque une commande Stripe payee une seule fois et envoie la confirmation", async () => {
    orderFindFirstMock.mockResolvedValue({
      id: "order_1",
      userId: "user_1",
      orderNumber: "MO-1",
      customerName: "Gary",
      customerEmail: "gary@example.com",
      createdAt: new Date("2026-04-17T10:00:00Z"),
      paymentMethod: "STRIPE",
      deliveryStatus: "SCHEDULED",
      shippingLine1: "123 Rue Olive",
      shippingCity: "Rimouski",
      shippingRegion: "QC",
      shippingPostal: "G5L 0A1",
      shippingCountry: "CA",
      deliveryPhone: "418-555-0000",
      deliveryInstructions: "Laisser à la porte",
      items: [
        {
          productNameSnapshotFr: "Croquettes Olive",
          productNameSnapshotEn: "Olive Kibble",
          quantity: 2,
          unitPriceCents: 1250,
          lineTotalCents: 2500,
        },
      ],
      subtotalCents: 2500,
      discountCents: 0,
      shippingCents: 0,
      totalCents: 2499,
      currency: "CAD",
      deliveryWindowStartAt: null,
      deliveryWindowEndAt: null,
      user: { language: "fr" },
    });
    orderUpdateManyMock.mockResolvedValue({ count: 1 });

    const { markOrderPaidFromStripeSession } = await import("@/lib/orders");
    const result = await markOrderPaidFromStripeSession(
      {
        id: "cs_test_1",
        payment_status: "paid",
        client_reference_id: "order_1",
        metadata: { orderId: "order_1" },
      } as never,
      "checkout.session.completed",
    );

    expect(result).toEqual({ orderId: "order_1", transitionedToPaid: true });
    expect(orderUpdateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "order_1", paymentStatus: "PENDING" },
        data: expect.objectContaining({
          paymentStatus: "PAID",
          status: "PAID",
          stripeSessionId: "cs_test_1",
        }),
      }),
    );
    expect(auditLogCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "STRIPE_ORDER_PAID",
          entityId: "order_1",
        }),
      }),
    );
    expect(sendOrderConfirmationEmailMock).toHaveBeenCalledTimes(1);
  });

  it("ignore un webhook paye duplique sans renvoyer de confirmation", async () => {
    orderFindFirstMock.mockResolvedValue({
      id: "order_1",
      userId: "user_1",
      orderNumber: "MO-1",
      customerName: "Gary",
      customerEmail: "gary@example.com",
      createdAt: new Date("2026-04-17T10:00:00Z"),
      paymentMethod: "STRIPE",
      deliveryStatus: "SCHEDULED",
      shippingLine1: "123 Rue Olive",
      shippingCity: "Rimouski",
      shippingRegion: "QC",
      shippingPostal: "G5L 0A1",
      shippingCountry: "CA",
      deliveryPhone: "418-555-0000",
      deliveryInstructions: "Laisser à la porte",
      items: [
        {
          productNameSnapshotFr: "Croquettes Olive",
          productNameSnapshotEn: "Olive Kibble",
          quantity: 2,
          unitPriceCents: 1250,
          lineTotalCents: 2500,
        },
      ],
      subtotalCents: 2500,
      discountCents: 0,
      shippingCents: 0,
      totalCents: 2499,
      currency: "CAD",
      deliveryWindowStartAt: null,
      deliveryWindowEndAt: null,
      user: { language: "fr" },
    });
    orderUpdateManyMock.mockResolvedValue({ count: 0 });

    const { markOrderPaidFromStripeSession } = await import("@/lib/orders");
    const result = await markOrderPaidFromStripeSession(
      {
        id: "cs_test_1",
        payment_status: "paid",
        client_reference_id: "order_1",
        metadata: { orderId: "order_1" },
      } as never,
      "checkout.session.completed",
    );

    expect(result).toEqual({
      orderId: "order_1",
      transitionedToPaid: false,
      reason: "ALREADY_FINALIZED",
    });
    expect(auditLogCreateMock).not.toHaveBeenCalled();
    expect(sendOrderConfirmationEmailMock).not.toHaveBeenCalled();
  });

  it("marque une session expiree failed et restock une seule fois", async () => {
    orderFindUniqueMock.mockResolvedValue({
      id: "order_1",
      userId: "user_1",
      paymentStatus: "PENDING",
      status: "PENDING",
      stripeSessionId: "cs_expired_1",
      items: [
        { productId: "prod_1", quantity: 2 },
        { productId: "prod_2", quantity: 1 },
      ],
    });
    orderUpdateManyMock.mockResolvedValue({ count: 1 });

    const { markOrderStripeCheckoutExpired } = await import("@/lib/orders");
    const result = await markOrderStripeCheckoutExpired({
      id: "cs_expired_1",
      payment_status: "unpaid",
      client_reference_id: "order_1",
      metadata: { orderId: "order_1" },
    } as never);

    expect(result).toEqual({ orderId: "order_1", transitionedToFailed: true });
    expect(orderUpdateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "order_1", paymentStatus: "PENDING" },
        data: expect.objectContaining({
          paymentStatus: "FAILED",
          stripeSessionId: "cs_expired_1",
        }),
      }),
    );
    expect(productUpdateMock).toHaveBeenCalledTimes(2);
    expect(inventoryMovementCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          quantityChange: 2,
          reason: "STRIPE_CHECKOUT_EXPIRED_RESTOCK",
        }),
      }),
    );
    expect(auditLogCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "STRIPE_ORDER_RESTOCKED",
        }),
      }),
    );
  });

  it("ne restock pas une commande deja finalisee", async () => {
    orderFindUniqueMock.mockResolvedValue({
      id: "order_1",
      userId: "user_1",
      paymentStatus: "FAILED",
      status: "PENDING",
      stripeSessionId: "cs_expired_1",
      items: [{ productId: "prod_1", quantity: 2 }],
    });

    const { markOrderStripeCheckoutExpired } = await import("@/lib/orders");
    const result = await markOrderStripeCheckoutExpired({
      id: "cs_expired_1",
      payment_status: "unpaid",
      client_reference_id: "order_1",
      metadata: { orderId: "order_1" },
    } as never);

    expect(result).toEqual({
      orderId: "order_1",
      transitionedToFailed: false,
      reason: "ALREADY_FINALIZED",
    });
    expect(orderUpdateManyMock).not.toHaveBeenCalled();
    expect(productUpdateMock).not.toHaveBeenCalled();
    expect(inventoryMovementCreateMock).not.toHaveBeenCalled();
  });
});
