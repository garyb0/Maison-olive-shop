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

  it("ne selectionne pas costCents pour la page admin/products", async () => {
    const { getAdminProducts } = await import("@/lib/admin");

    await getAdminProducts();

    expect(productFindManyMock).toHaveBeenCalledTimes(1);
    const select = productFindManyMock.mock.calls[0]?.[0]?.select;

    expect(select).toMatchObject({
      _count: {
        select: {
          orderItems: true,
        },
      },
    });
    expect(select).not.toHaveProperty("costCents");
  });
});
