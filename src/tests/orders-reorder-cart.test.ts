export {};

const prismaMock = vi.hoisted(() => ({
  order: {
    findFirst: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/stripe", () => ({
  stripeEnabled: false,
  stripe: null,
}));

vi.mock("@/lib/business", () => ({
  sendOrderConfirmationEmail: vi.fn(),
}));

vi.mock("@/lib/promo", () => ({
  resolvePromoCodeDiscount: vi.fn(),
}));

vi.mock("@/lib/launch-guards", () => ({
  getHiddenStorefrontProductSlugs: () => [],
}));

vi.mock("@/lib/taxes", () => ({
  computeOrderAmounts: vi.fn(),
}));

vi.mock("@/lib/delivery-zone", () => ({
  isRimouskiDeliveryAddress: vi.fn(),
}));

vi.mock("@/lib/delivery", () => ({
  resolveDeliverySelectionForOrder: vi.fn(),
}));

vi.mock("@/lib/delivery-addresses", () => ({
  assertDeliveryAddressComplete: vi.fn(),
  createDeliveryAddressForUser: vi.fn(),
  DeliveryAddressLimitError: class DeliveryAddressLimitError extends Error {},
  findMatchingDeliveryAddressForUser: vi.fn(),
  getDeliveryAddressForUser: vi.fn(),
  markDeliveryAddressUsed: vi.fn(),
  normalizeDeliveryAddressInput: vi.fn((input) => input),
}));

describe("buildReorderCart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ajoute seulement les produits actifs disponibles et ajuste les quantités", async () => {
    prismaMock.order.findFirst.mockResolvedValue({
      id: "order_1",
      orderNumber: "MO-1",
      items: [
        {
          productId: "prod_ok",
          quantity: 2,
          productNameSnapshotFr: "Croquettes",
          productNameSnapshotEn: "Kibble",
          product: {
            id: "prod_ok",
            slug: "croquettes",
            nameFr: "Croquettes",
            nameEn: "Kibble",
            imageUrl: "/prod.jpg",
            stock: 4,
            isActive: true,
          },
        },
        {
          productId: "prod_low",
          quantity: 3,
          productNameSnapshotFr: "Biscuits",
          productNameSnapshotEn: "Biscuits",
          product: {
            id: "prod_low",
            slug: "biscuits",
            nameFr: "Biscuits",
            nameEn: "Biscuits",
            imageUrl: null,
            stock: 1,
            isActive: true,
          },
        },
        {
          productId: "prod_out",
          quantity: 1,
          productNameSnapshotFr: "Os",
          productNameSnapshotEn: "Bone",
          product: {
            id: "prod_out",
            slug: "os",
            nameFr: "Os",
            nameEn: "Bone",
            imageUrl: null,
            stock: 0,
            isActive: true,
          },
        },
        {
          productId: "prod_inactive",
          quantity: 1,
          productNameSnapshotFr: "Jouet",
          productNameSnapshotEn: "Toy",
          product: {
            id: "prod_inactive",
            slug: "jouet",
            nameFr: "Jouet",
            nameEn: "Toy",
            imageUrl: null,
            stock: 9,
            isActive: false,
          },
        },
      ],
    });

    const { buildReorderCart } = await import("@/lib/orders");
    const result = await buildReorderCart("order_1", "user_1");

    expect(result.lines).toEqual([
      expect.objectContaining({ productId: "prod_ok", quantity: 2 }),
      expect.objectContaining({ productId: "prod_low", quantity: 1 }),
    ]);
    expect(result.adjustedItems).toEqual([
      expect.objectContaining({ productId: "prod_low", requestedQuantity: 3, availableQuantity: 1 }),
    ]);
    expect(result.unavailableItems).toEqual([
      expect.objectContaining({ productId: "prod_out", reason: "out_of_stock" }),
      expect.objectContaining({ productId: "prod_inactive", reason: "inactive" }),
    ]);
  });

  it("refuse une commande qui n'appartient pas au client", async () => {
    prismaMock.order.findFirst.mockResolvedValue(null);
    const { buildReorderCart } = await import("@/lib/orders");

    await expect(buildReorderCart("order_other", "user_1")).rejects.toThrow("ORDER_NOT_FOUND");
    expect(prismaMock.order.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "order_other", userId: "user_1" },
    }));
  });
});
