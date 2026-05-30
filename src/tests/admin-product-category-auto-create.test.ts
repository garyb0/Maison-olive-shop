export {};

const transactionMock = vi.fn();
const categoryUpsertMock = vi.fn();
const productSubcategoryUpsertMock = vi.fn();
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
        productSubcategory: {
          upsert: (...args: unknown[]) => productSubcategoryUpsertMock(...args),
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
      sku: "GENERAL-TEST",
      stock: 5,
    });
    auditLogCreateMock.mockResolvedValue({});
    inventoryMovementCreateMock.mockResolvedValue({});

    const { createAdminProduct } = await import("@/lib/admin");

    await createAdminProduct(
      {
        slug: "test",
        sku: "GENERAL-TEST",
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
          subcategoryId: undefined,
          sku: "GENERAL-TEST",
        }),
      }),
    );
  });

  it("associe une sous-categorie guidee valide a la categorie du produit", async () => {
    categoryUpsertMock.mockResolvedValue({ id: "cat_accessories", name: "Accessories" });
    productSubcategoryUpsertMock.mockResolvedValue({
      id: "sub_harnais",
      slug: "harnais",
      nameFr: "Harnais",
      nameEn: "Harnesses",
    });
    productCreateMock.mockResolvedValue({
      id: "prod_2",
      slug: "harnais-test",
      sku: "ACCESSORIES-HARNAIS-TEST",
      stock: 2,
    });
    auditLogCreateMock.mockResolvedValue({});
    inventoryMovementCreateMock.mockResolvedValue({});

    const { createAdminProduct } = await import("@/lib/admin");

    await createAdminProduct(
      {
        slug: "harnais-test",
        sku: "ACCESSORIES-HARNAIS-TEST",
        category: "Accessories",
        subcategorySlug: "harnais",
        nameFr: "Harnais test",
        nameEn: "Test harness",
        descriptionFr: "Description test",
        descriptionEn: "Test description",
        imageUrl: undefined,
        priceCents: 1299,
        costCents: 0,
        currency: "CAD",
        stock: 2,
        isActive: true,
        isSubscription: false,
      },
      "admin_1",
    );

    expect(productSubcategoryUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          categoryId_slug: {
            categoryId: "cat_accessories",
            slug: "harnais",
          },
        },
      }),
    );
    expect(productCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          categoryId: "cat_accessories",
          subcategoryId: "sub_harnais",
          sku: "ACCESSORIES-HARNAIS-TEST",
        }),
      }),
    );
  });

  it("refuse une sous-categorie qui ne correspond pas a la categorie", async () => {
    categoryUpsertMock.mockResolvedValue({ id: "cat_food", name: "Food" });

    const { createAdminProduct } = await import("@/lib/admin");

    await expect(
      createAdminProduct(
        {
          slug: "harnais-test",
          sku: "FOOD-HARNAIS-TEST",
          category: "Food",
          subcategorySlug: "harnais",
          nameFr: "Harnais test",
          nameEn: "Test harness",
          descriptionFr: "Description test",
          descriptionEn: "Test description",
          imageUrl: undefined,
          priceCents: 1299,
          costCents: 0,
          currency: "CAD",
          stock: 2,
          isActive: true,
          isSubscription: false,
        },
        "admin_1",
      ),
    ).rejects.toThrow("INVALID_SUBCATEGORY");

    expect(productSubcategoryUpsertMock).not.toHaveBeenCalled();
    expect(productCreateMock).not.toHaveBeenCalled();
  });
});
