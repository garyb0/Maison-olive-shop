export {};

const requireAdminMock = vi.fn();
const adjustAdminProductStockMock = vi.fn();
const createAdminAppNotificationMock = vi.fn();

vi.mock("@/lib/permissions", () => ({
  requireAdmin: (...args: unknown[]) => requireAdminMock(...args),
}));

vi.mock("@/lib/admin", () => ({
  adjustAdminProductStock: (...args: unknown[]) => adjustAdminProductStockMock(...args),
}));

vi.mock("@/lib/app-notifications", () => ({
  createAdminAppNotification: (...args: unknown[]) => createAdminAppNotificationMock(...args),
}));

vi.mock("@/lib/observability", () => ({
  logApiEvent: vi.fn(),
}));

function stockResult(previousStock: number, stock: number) {
  return {
    previousStock,
    product: {
      id: "prod_1",
      slug: "collier-test",
      nameFr: "Collier test",
      isActive: true,
      stock,
    },
    movement: { id: "move_1" },
  };
}

describe("POST /api/admin/products/stock", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireAdminMock.mockResolvedValue({ id: "admin_1" });
    createAdminAppNotificationMock.mockResolvedValue([]);
  });

  it("notifie l'admin quand le stock passe sous le seuil critique", async () => {
    adjustAdminProductStockMock.mockResolvedValueOnce(stockResult(5, 3));
    const { POST } = await import("@/app/api/admin/products/stock/route");

    const response = await POST(
      new Request("http://localhost:3101/api/admin/products/stock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productId: "prod_1",
          quantityChange: -2,
          reason: "TEST",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(createAdminAppNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ADMIN_STOCK",
        title: "Stock critique",
        metadata: expect.objectContaining({ productId: "prod_1", stock: 3 }),
      }),
    );
  });

  it("notifie l'admin seulement au passage vers la rupture", async () => {
    adjustAdminProductStockMock.mockResolvedValueOnce(stockResult(2, 0));
    const { POST } = await import("@/app/api/admin/products/stock/route");

    const response = await POST(
      new Request("http://localhost:3101/api/admin/products/stock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productId: "prod_1",
          quantityChange: -2,
          reason: "TEST",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(createAdminAppNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ADMIN_STOCK",
        metadata: expect.objectContaining({ productId: "prod_1" }),
      }),
    );
  });

  it("evite le spam quand le stock etait deja critique", async () => {
    adjustAdminProductStockMock.mockResolvedValueOnce(stockResult(3, 2));
    const { POST } = await import("@/app/api/admin/products/stock/route");

    const response = await POST(
      new Request("http://localhost:3101/api/admin/products/stock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productId: "prod_1",
          quantityChange: -1,
          reason: "TEST",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(createAdminAppNotificationMock).not.toHaveBeenCalled();
  });
});
