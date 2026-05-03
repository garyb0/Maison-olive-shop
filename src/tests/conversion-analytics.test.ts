export {};

const conversionEventCreateMock = vi.fn();
const conversionEventFindManyMock = vi.fn();
const productFindManyMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    conversionEvent: {
      create: (...args: unknown[]) => conversionEventCreateMock(...args),
      findMany: (...args: unknown[]) => conversionEventFindManyMock(...args),
    },
    product: {
      findMany: (...args: unknown[]) => productFindManyMock(...args),
    },
  },
}));

describe("conversion analytics", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("hash la session et minimise les champs stockes", async () => {
    conversionEventCreateMock.mockResolvedValue({ id: "event_1" });

    const { createConversionEvent } = await import("@/lib/conversion-analytics");
    await createConversionEvent(
      {
        type: "CART_ADD",
        sessionKey: "session-public-123",
        productId: "prod_1",
        productSlug: "lit-douillet",
        quantity: 2,
        path: "https://chezolive.ca/products/lit-douillet?utm=secret",
        metadata: { source: "card", position: 1 },
      },
      { userId: "user_1", userAgent: "Mozilla/5.0 (iPhone)" },
    );

    expect(conversionEventCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "CART_ADD",
        userId: "user_1",
        productId: "prod_1",
        productSlug: "lit-douillet",
        quantity: 2,
        device: "mobile",
        path: "/products/lit-douillet",
        metadataJson: JSON.stringify({ source: "card", position: 1 }),
      }),
    });
    const storedSession = conversionEventCreateMock.mock.calls[0][0].data.sessionKey;
    expect(storedSession).not.toBe("session-public-123");
    expect(storedSession).toHaveLength(48);
  });

  it("aggrege le tunnel et les produits abandonnes", async () => {
    const { summarizeConversionEvents } = await import("@/lib/conversion-analytics");
    const productLabels = new Map([
      ["prod_1", { slug: "lit-douillet", nameFr: "Lit douillet", nameEn: "Cozy bed" }],
      ["prod_2", { slug: "collier-qr", nameFr: "Collier QR", nameEn: "QR collar" }],
    ]);
    const events = [
      { type: "SHOP_VIEW", sessionKey: "s1", productId: null, productSlug: null, quantity: null, createdAt: new Date() },
      { type: "PRODUCT_VIEW", sessionKey: "s1", productId: "prod_1", productSlug: "lit-douillet", quantity: null, createdAt: new Date() },
      { type: "CART_ADD", sessionKey: "s1", productId: "prod_1", productSlug: "lit-douillet", quantity: 1, createdAt: new Date() },
      { type: "CHECKOUT_START", sessionKey: "s1", productId: null, productSlug: null, quantity: null, createdAt: new Date() },
      { type: "ORDER_CREATED", sessionKey: "s1", productId: null, productSlug: null, quantity: null, createdAt: new Date() },
      { type: "SHOP_VIEW", sessionKey: "s2", productId: null, productSlug: null, quantity: null, createdAt: new Date() },
      { type: "PRODUCT_VIEW", sessionKey: "s2", productId: "prod_2", productSlug: "collier-qr", quantity: null, createdAt: new Date() },
      { type: "CART_ADD", sessionKey: "s2", productId: "prod_2", productSlug: "collier-qr", quantity: 2, createdAt: new Date() },
      { type: "CHECKOUT_ERROR", sessionKey: "s2", productId: null, productSlug: null, quantity: null, metadataJson: JSON.stringify({ reason: "payment_declined" }), createdAt: new Date() },
      { type: "SHOP_VIEW", sessionKey: "s3", productId: null, productSlug: null, quantity: null, createdAt: new Date() },
      { type: "PRODUCT_VIEW", sessionKey: "s3", productId: "prod_1", productSlug: "lit-douillet", quantity: null, createdAt: new Date() },
    ] as const;

    const summary = summarizeConversionEvents([...events], productLabels);

    expect(summary.shopVisitors).toBe(3);
    expect(summary.productViews).toBe(3);
    expect(summary.productViewSessions).toBe(3);
    expect(summary.cartAdds).toBe(2);
    expect(summary.cartAddSessions).toBe(2);
    expect(summary.checkoutStarts).toBe(1);
    expect(summary.ordersCreated).toBe(1);
    expect(summary.checkoutErrors).toBe(1);
    expect(summary.shopToCartRate).toBeCloseTo(2 / 3);
    expect(summary.productToCartRate).toBeCloseTo(2 / 3);
    expect(summary.cartToCheckoutRate).toBe(0.5);
    expect(summary.checkoutToOrderRate).toBe(1);
    expect(summary.productViewDropOffCount).toBe(1);
    expect(summary.cartToCheckoutDropOffCount).toBe(1);
    expect(summary.checkoutToOrderDropOffCount).toBe(0);
    expect(summary.topAddedProducts[0]).toEqual(expect.objectContaining({ nameFr: "Collier QR", quantity: 2 }));
    expect(summary.topAbandonedProducts).toEqual([
      expect.objectContaining({ nameFr: "Collier QR", quantity: 2 }),
    ]);
    expect(summary.topViewedNotAddedProducts).toEqual([
      expect.objectContaining({ nameFr: "Lit douillet", addCount: 1 }),
    ]);
    expect(summary.checkoutErrorReasons).toEqual([{ reason: "payment_declined", count: 1 }]);
  });
});
