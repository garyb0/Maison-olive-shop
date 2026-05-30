export {};

const prismaMock = vi.hoisted(() => ({
  order: {
    count: vi.fn(),
    findMany: vi.fn(),
    aggregate: vi.fn(),
  },
  supportConversation: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
  deliveryRun: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
  product: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
  productVariant: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/conversion-analytics", () => ({
  getConversionDashboardSnapshot: vi.fn().mockResolvedValue({
    today: {},
    sevenDays: {},
    topAddedProducts: [],
    topAbandonedProducts: [],
    topViewedNotAddedProducts: [],
    checkoutErrorReasons: [],
  }),
  getEmptyConversionDashboardSnapshot: vi.fn(() => ({
    today: {},
    sevenDays: {},
    topAddedProducts: [],
    topAbandonedProducts: [],
    topViewedNotAddedProducts: [],
    checkoutErrorReasons: [],
  })),
}));

vi.mock("@/lib/app-notifications", () => ({
  getAdminNotificationOpsSnapshot: vi.fn().mockResolvedValue({
    recent: [],
    unreadCount: 0,
    disabledPushSubscriptionCount: 0,
  }),
}));

const redBedVariant = {
  id: "variant_red",
  slug: "rouge",
  sku: "BED-ROUGE",
  colorNameFr: "Rouge",
  colorNameEn: "Red",
  sizeNameFr: null,
  sizeNameEn: null,
  sizeCode: null,
  stock: 0,
  product: {
    id: "prod_bed",
    slug: "lit-douillet",
    nameFr: "Lit Douillet Anti-Stress",
    nameEn: "Anti-Stress Cozy Bed",
    stock: 7,
  },
};

const simpleLowStockProduct = {
  id: "prod_bowl",
  slug: "bol-olive",
  nameFr: "Bol Olive",
  nameEn: "Olive Bowl",
  stock: 2,
};

describe("getOwnerTodaySnapshot variant stock alerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.order.count.mockResolvedValue(0);
    prismaMock.order.findMany.mockResolvedValue([]);
    prismaMock.order.aggregate.mockResolvedValue({ _sum: { totalCents: 0 } });
    prismaMock.supportConversation.count.mockResolvedValue(0);
    prismaMock.supportConversation.findMany.mockResolvedValue([]);
    prismaMock.deliveryRun.count.mockResolvedValue(0);
    prismaMock.deliveryRun.findMany.mockResolvedValue([]);
    prismaMock.productVariant.count.mockResolvedValue(1);
    prismaMock.productVariant.findMany.mockImplementation(({ where }: { where: { stock: { lte: number } } }) =>
      Promise.resolve(where.stock.lte === 0 ? [redBedVariant] : [redBedVariant]),
    );
    prismaMock.product.count.mockImplementation(({ where }: { where: { stock: { lte: number } } }) =>
      Promise.resolve(where.stock.lte === 0 ? 0 : 1),
    );
    prismaMock.product.findMany.mockImplementation(({ where }: { where: { stock: { lte: number } } }) =>
      Promise.resolve(where.stock.lte === 0 ? [] : [simpleLowStockProduct]),
    );
  });

  it("remonte une couleur en rupture meme si le produit parent a encore du stock", async () => {
    const { getOwnerTodaySnapshot } = await import("@/lib/owner-dashboard");

    const snapshot = await getOwnerTodaySnapshot();

    expect(snapshot.outOfStockCount).toBe(1);
    expect(snapshot.outOfStockProducts).toEqual([
      expect.objectContaining({
        id: "prod_bed",
        variantId: "variant_red",
        variantSku: "BED-ROUGE",
        variantNameFr: "Rouge",
        nameFr: "Lit Douillet Anti-Stress - Rouge",
        stock: 0,
        isVariant: true,
      }),
    ]);
    expect(snapshot.lowStockCount).toBe(2);
    expect(snapshot.lowStockProducts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          variantId: "variant_red",
          nameFr: "Lit Douillet Anti-Stress - Rouge",
          stock: 0,
        }),
        expect.objectContaining({
          id: "prod_bowl",
          nameFr: "Bol Olive",
          stock: 2,
          isVariant: false,
        }),
      ]),
    );
    expect(prismaMock.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          variants: { none: {} },
        }),
      }),
    );
  });
});
