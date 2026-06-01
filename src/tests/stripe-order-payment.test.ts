export {};

const sendOrderConfirmationEmailMock = vi.fn();
const transactionMock = vi.fn();
const orderFindFirstMock = vi.fn();
const orderFindUniqueMock = vi.fn();
const orderUpdateManyMock = vi.fn();
const auditLogCreateMock = vi.fn();
const productUpdateMock = vi.fn();
const productUpdateManyMock = vi.fn();
const productVariantUpdateMock = vi.fn();
const productVariantUpdateManyMock = vi.fn();
const inventoryMovementCreateMock = vi.fn();
const sendOrderSmsNotificationMock = vi.fn();
const createAdminAppNotificationMock = vi.fn();

vi.mock("@/lib/business", () => ({
  sendOrderConfirmationEmail: (...args: unknown[]) => sendOrderConfirmationEmailMock(...args),
}));

vi.mock("@/lib/sms", () => ({
  sendOrderSmsNotification: (...args: unknown[]) => sendOrderSmsNotificationMock(...args),
}));

vi.mock("@/lib/app-notifications", () => ({
  createAdminAppNotification: (...args: unknown[]) => createAdminAppNotificationMock(...args),
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
      updateMany: (...args: unknown[]) => productUpdateManyMock(...args),
    },
    productVariant: {
      update: (...args: unknown[]) => productVariantUpdateMock(...args),
      updateMany: (...args: unknown[]) => productVariantUpdateManyMock(...args),
    },
    inventoryMovement: {
      create: (...args: unknown[]) => inventoryMovementCreateMock(...args),
    },
  },
}));

function stripeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "order_1",
    userId: "user_1",
    stripeSessionId: "cs_test_1",
    orderNumber: "MO-1",
    customerName: "Gary",
    customerEmail: "gary@example.com",
    createdAt: new Date("2026-04-17T10:00:00Z"),
    paymentMethod: "STRIPE",
    paymentStatus: "PENDING",
    status: "PENDING",
    deliveryStatus: "SCHEDULED",
    shippingLine1: "123 Rue Olive",
    shippingCity: "Rimouski",
    shippingRegion: "QC",
    shippingPostal: "G5L 0A1",
    shippingCountry: "CA",
    deliveryPhone: "418-555-0000",
    deliveryInstructions: "Laisser a la porte",
    deliverySlotId: null,
    deliveryWindowStartAt: null,
    deliveryWindowEndAt: null,
    inventoryReservedAt: null,
    deliveryCapacityReservedAt: null,
    items: [
      {
        productId: "prod_1",
        variantId: null,
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
    user: { language: "fr" },
    ...overrides,
  };
}

function paidSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "cs_test_1",
    mode: "payment",
    payment_status: "paid",
    amount_total: 2499,
    currency: "cad",
    client_reference_id: "order_1",
    metadata: { orderId: "order_1" },
    ...overrides,
  };
}

describe("Stripe order payment helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    sendOrderSmsNotificationMock.mockResolvedValue({ sent: false });
    createAdminAppNotificationMock.mockResolvedValue([]);
    productUpdateManyMock.mockResolvedValue({ count: 1 });
    productVariantUpdateManyMock.mockResolvedValue({ count: 1 });

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
          updateMany: productUpdateManyMock,
        },
        productVariant: {
          update: productVariantUpdateMock,
          updateMany: productVariantUpdateManyMock,
        },
        inventoryMovement: {
          create: inventoryMovementCreateMock,
        },
      }),
    );
  });

  it("marque une commande Stripe payee une seule fois et reserve le stock au webhook", async () => {
    orderFindFirstMock.mockResolvedValue(stripeOrder());
    orderFindUniqueMock.mockResolvedValue(stripeOrder());
    orderUpdateManyMock.mockResolvedValue({ count: 1 });

    const { markOrderPaidFromStripeSession } = await import("@/lib/orders");
    const result = await markOrderPaidFromStripeSession(
      paidSession() as never,
      "checkout.session.completed",
    );

    expect(result).toEqual({ orderId: "order_1", transitionedToPaid: true });
    expect(productUpdateManyMock).toHaveBeenCalledWith({
      where: { id: "prod_1", stock: { gte: 2 } },
      data: { stock: { decrement: 2 } },
    });
    expect(inventoryMovementCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          productId: "prod_1",
          quantityChange: -2,
          reason: "STRIPE_PAYMENT_SETTLED",
        }),
      }),
    );
    expect(orderUpdateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "order_1", paymentStatus: "PENDING" },
        data: expect.objectContaining({
          paymentStatus: "PAID",
          status: "PAID",
          stripeSessionId: "cs_test_1",
          inventoryReservedAt: expect.any(Date),
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
    expect(sendOrderSmsNotificationMock).toHaveBeenCalledWith({
      orderId: "order_1",
      type: "ORDER_PAID",
    });
  });

  it("rejette une session Stripe dont le montant ne correspond pas", async () => {
    orderFindFirstMock.mockResolvedValue(stripeOrder());

    const { markOrderPaidFromStripeSession } = await import("@/lib/orders");
    const result = await markOrderPaidFromStripeSession(
      paidSession({ amount_total: 1 }) as never,
      "checkout.session.completed",
    );

    expect(result).toEqual({
      orderId: "order_1",
      transitionedToPaid: false,
      reason: "AMOUNT_MISMATCH",
    });
    expect(orderFindUniqueMock).not.toHaveBeenCalled();
    expect(productUpdateManyMock).not.toHaveBeenCalled();
    expect(sendOrderConfirmationEmailMock).not.toHaveBeenCalled();
    expect(auditLogCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "STRIPE_ORDER_SESSION_REJECTED",
        }),
      }),
    );
  });

  it("ignore un webhook paye duplique sans reserver ni confirmer", async () => {
    orderFindFirstMock.mockResolvedValue(stripeOrder());
    orderFindUniqueMock.mockResolvedValue(stripeOrder({ paymentStatus: "PAID" }));

    const { markOrderPaidFromStripeSession } = await import("@/lib/orders");
    const result = await markOrderPaidFromStripeSession(
      paidSession() as never,
      "checkout.session.completed",
    );

    expect(result).toEqual({
      orderId: "order_1",
      transitionedToPaid: false,
      reason: "ALREADY_FINALIZED",
    });
    expect(productUpdateManyMock).not.toHaveBeenCalled();
    expect(auditLogCreateMock).not.toHaveBeenCalled();
    expect(sendOrderConfirmationEmailMock).not.toHaveBeenCalled();
  });

  it("demande un remboursement si stock indisponible apres paiement", async () => {
    orderFindFirstMock.mockResolvedValue(stripeOrder());
    orderFindUniqueMock.mockResolvedValue(stripeOrder());
    productUpdateManyMock.mockResolvedValue({ count: 0 });
    orderUpdateManyMock.mockResolvedValue({ count: 1 });

    const { markOrderPaidFromStripeSession } = await import("@/lib/orders");
    const result = await markOrderPaidFromStripeSession(
      paidSession() as never,
      "checkout.session.completed",
    );

    expect(result).toEqual({
      orderId: "order_1",
      transitionedToPaid: false,
      reason: "REQUIRES_REFUND",
    });
    expect(sendOrderConfirmationEmailMock).not.toHaveBeenCalled();
    expect(auditLogCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "STRIPE_ORDER_REQUIRES_REFUND",
        }),
      }),
    );
    expect(createAdminAppNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ADMIN_ORDER",
        title: "Remboursement Stripe requis",
      }),
    );
  });

  it("marque une session expiree failed sans restock si Stripe n'avait pas reserve le stock", async () => {
    orderFindUniqueMock.mockResolvedValue({
      id: "order_1",
      userId: "user_1",
      paymentStatus: "PENDING",
      status: "PENDING",
      stripeSessionId: "cs_expired_1",
      inventoryReservedAt: null,
      deliveryCapacityReservedAt: null,
      items: [
        { productId: "prod_1", variantId: null, quantity: 2 },
        { productId: "prod_2", variantId: null, quantity: 1 },
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
          inventoryReservedAt: null,
          deliveryCapacityReservedAt: null,
        }),
      }),
    );
    expect(productUpdateMock).not.toHaveBeenCalled();
    expect(inventoryMovementCreateMock).not.toHaveBeenCalled();
    expect(auditLogCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "STRIPE_ORDER_PAYMENT_FAILED",
        }),
      }),
    );
  });

  it("restocke une session expiree seulement si le stock avait deja ete reserve", async () => {
    orderFindUniqueMock.mockResolvedValue({
      id: "order_1",
      userId: "user_1",
      paymentStatus: "PENDING",
      status: "PENDING",
      stripeSessionId: "cs_expired_1",
      inventoryReservedAt: new Date("2026-04-17T10:00:00Z"),
      deliveryCapacityReservedAt: null,
      items: [
        { productId: "prod_1", variantId: null, quantity: 2 },
        { productId: "prod_2", variantId: null, quantity: 1 },
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
      inventoryReservedAt: null,
      deliveryCapacityReservedAt: null,
      items: [{ productId: "prod_1", variantId: null, quantity: 2 }],
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
