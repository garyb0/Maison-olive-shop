export {};

const transactionMock = vi.fn();
const categoryUpsertMock = vi.fn();
const productCreateMock = vi.fn();
const productFindUniqueMock = vi.fn();
const productUpdateMock = vi.fn();
const auditLogCreateMock = vi.fn();
const inventoryMovementCreateMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: (...args: unknown[]) => transactionMock(...args),
  },
}));

describe("admin product categories", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    transactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        category: {
          upsert: (...args: unknown[]) => categoryUpsertMock(...args),
        },
        product: {
          create: (...args: unknown[]) => productCreateMock(...args),
          findUnique: (...args: unknown[]) => productFindUniqueMock(...args),
          update: (...args: unknown[]) => productUpdateMock(...args),
        },
        auditLog: {
          create: (...args: unknown[]) => auditLogCreateMock(...args),
        },
        inventoryMovement: {
          create: (...args: unknown[]) => inventoryMovementCreateMock(...args),
        },
      }),
    );
  });

  it("cree automatiquement une categorie manquante lors de la creation d'un produit", async () => {
    categoryUpsertMock.mockResolvedValue({ id: "cat_general", name: "General" });
    productCreateMock.mockResolvedValue({
      id: "prod_1",
      slug: "test",
      stock: 5,
    });
    auditLogCreateMock.mockResolvedValue({});
    inventoryMovementCreateMock.mockResolvedValue({});

    const { createAdminProduct } = await import("@/lib/admin");

    await createAdminProduct(
      {
        slug: "test",
        category: "General",
        nameFr: "Produit test",
        nameEn: "Test product",
        descriptionFr: "Description test",
        descriptionEn: "Test description",
        imageUrl: undefined,
        priceCents: 10,
        costCents: 0,
        currency: "CAD",
        stock: 5,
        isActive: true,
        isSubscription: false,
      },
      "admin_1",
    );

    expect(categoryUpsertMock).toHaveBeenCalledWith({
      where: { name: "General" },
      update: {},
      create: { name: "General" },
    });
    expect(productCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          categoryId: "cat_general",
        }),
      }),
    );
  });
});
