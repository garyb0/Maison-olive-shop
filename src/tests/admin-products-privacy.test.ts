export {};

const productFindManyMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    product: {
      findMany: (...args: unknown[]) => productFindManyMock(...args),
    },
  },
}));

describe("admin products privacy", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    productFindManyMock.mockResolvedValue([]);
  });

  it("selectionne les champs internes requis par la page admin/products", async () => {
    const { getAdminProducts } = await import("@/lib/admin");

    await getAdminProducts();

    expect(productFindManyMock).toHaveBeenCalledTimes(1);
    const select = productFindManyMock.mock.calls[0]?.[0]?.select;

    expect(select).toMatchObject({
      sku: true,
      barcode: true,
      costCents: true,
      _count: {
        select: {
          orderItems: true,
        },
      },
    });
  });
});
