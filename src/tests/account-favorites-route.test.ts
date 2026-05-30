export {};

const requireUserMock = vi.fn();
const getFavoriteProductsForUserMock = vi.fn();
const addProductFavoriteForUserMock = vi.fn();
const removeProductFavoriteForUserMock = vi.fn();

vi.mock("@/lib/permissions", () => ({
  requireUser: () => requireUserMock(),
}));

vi.mock("@/lib/language", () => ({
  getCurrentLanguage: vi.fn().mockResolvedValue("fr"),
}));

vi.mock("@/lib/favorites", () => ({
  getFavoriteProductsForUser: (...args: unknown[]) => getFavoriteProductsForUserMock(...args),
  addProductFavoriteForUser: (...args: unknown[]) => addProductFavoriteForUserMock(...args),
  removeProductFavoriteForUser: (...args: unknown[]) => removeProductFavoriteForUserMock(...args),
}));

describe("account favorites routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireUserMock.mockResolvedValue({ id: "user_1" });
  });

  it("liste, ajoute et supprime les favoris du compte", async () => {
    getFavoriteProductsForUserMock.mockResolvedValue([
      {
        product: {
          id: "prod_1",
          slug: "biscuits",
          nameFr: "Biscuits",
          nameEn: "Biscuits",
          imageUrl: null,
          priceCents: 1299,
          currency: "CAD",
          stock: 3,
          isActive: true,
        },
      },
    ]);
    addProductFavoriteForUserMock.mockResolvedValue({ productId: "prod_1" });

    const favoritesRoute = await import("@/app/api/account/favorites/route");
    const getResponse = await favoritesRoute.GET();
    await expect(getResponse.json()).resolves.toMatchObject({
      favorites: [expect.objectContaining({ id: "prod_1", name: "Biscuits" })],
    });

    const postResponse = await favoritesRoute.POST(new Request("http://localhost/api/account/favorites", {
      method: "POST",
      body: JSON.stringify({ productId: "prod_1" }),
    }));
    expect(postResponse.status).toBe(200);
    expect(addProductFavoriteForUserMock).toHaveBeenCalledWith("user_1", "prod_1");

    const deleteRoute = await import("@/app/api/account/favorites/[productId]/route");
    const deleteResponse = await deleteRoute.DELETE(new Request("http://localhost/api/account/favorites/prod_1"), {
      params: Promise.resolve({ productId: "prod_1" }),
    });
    expect(deleteResponse.status).toBe(200);
    expect(removeProductFavoriteForUserMock).toHaveBeenCalledWith("user_1", "prod_1");
  });

  it("refuse les favoris sans session", async () => {
    requireUserMock.mockRejectedValue(new Error("UNAUTHORIZED"));
    const favoritesRoute = await import("@/app/api/account/favorites/route");
    const response = await favoritesRoute.POST(new Request("http://localhost/api/account/favorites", {
      method: "POST",
      body: JSON.stringify({ productId: "prod_1" }),
    }));

    expect(response.status).toBe(401);
  });
});
