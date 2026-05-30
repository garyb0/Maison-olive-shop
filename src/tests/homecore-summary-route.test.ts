export {};

const getAdminProductsMock = vi.fn();
const getAdminProductInventoryMetricsMock = vi.fn();
const getRecentInventoryMovementsMock = vi.fn();
const getAdminOrdersMock = vi.fn();
const logApiEventMock = vi.fn();

vi.mock("@/lib/admin", () => ({
  getAdminProducts: (...args: unknown[]) => getAdminProductsMock(...args),
  getAdminProductInventoryMetrics: (...args: unknown[]) => getAdminProductInventoryMetricsMock(...args),
  getRecentInventoryMovements: (...args: unknown[]) => getRecentInventoryMovementsMock(...args),
  getAdminOrders: (...args: unknown[]) => getAdminOrdersMock(...args),
}));

vi.mock("@/lib/observability", () => ({
  logApiEvent: (...args: unknown[]) => logApiEventMock(...args),
}));

const originalToken = process.env.HOMECORE_INTERNAL_TOKEN;

function request(token?: string) {
  return new Request("http://localhost:3101/api/internal/homecore/summary", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

describe("GET /api/internal/homecore/summary", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.HOMECORE_INTERNAL_TOKEN = "test-homecore-token";
    getAdminProductsMock.mockResolvedValue([
      {
        id: "prod_low",
        slug: "low-stock-product",
        sku: "LOW-1",
        nameFr: "Produit bas",
        nameEn: "Low product",
        stock: 2,
        isActive: true,
      },
      {
        id: "prod_out",
        slug: "out-stock-product",
        sku: "OUT-1",
        nameFr: "Produit rupture",
        nameEn: "Out product",
        stock: 0,
        isActive: true,
      },
      {
        id: "prod_inactive",
        slug: "inactive-product",
        sku: "INACTIVE-1",
        nameFr: "Produit inactif",
        nameEn: "Inactive product",
        stock: 0,
        isActive: false,
      },
    ]);
    getAdminProductInventoryMetricsMock.mockResolvedValue({
      summary: {
        stockValueAtCostCents: 12000,
        stockValueAtRetailCents: 26000,
        grossRevenueCents: 50000,
        estimatedGrossProfitCents: 23000,
      },
      rows: [],
    });
    getRecentInventoryMovementsMock.mockResolvedValue([
      {
        createdAt: new Date("2026-05-13T10:00:00.000Z"),
        quantityChange: -1,
        reason: "ORDER_PAID",
        product: {
          sku: "LOW-1",
          nameFr: "Produit bas",
          nameEn: "Low product",
        },
      },
    ]);
    getAdminOrdersMock.mockResolvedValue([
      {
        id: "order_1",
        status: "PAID",
        paymentStatus: "PAID",
        customerEmail: "client@example.com",
        shippingLine1: "123 Rue privée",
      },
      {
        id: "order_2",
        status: "PENDING",
        paymentStatus: "PENDING",
        customerEmail: "pending@example.com",
      },
    ]);
  });

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env.HOMECORE_INTERNAL_TOKEN;
    } else {
      process.env.HOMECORE_INTERNAL_TOKEN = originalToken;
    }
  });

  it("returns 503 when the internal token is not configured", async () => {
    delete process.env.HOMECORE_INTERNAL_TOKEN;
    const { GET } = await import("@/app/api/internal/homecore/summary/route");

    const response = await GET(request("test-homecore-token"));

    expect(response.status).toBe(503);
    expect(getAdminProductsMock).not.toHaveBeenCalled();
  });

  it("returns 401 without a bearer token", async () => {
    const { GET } = await import("@/app/api/internal/homecore/summary/route");

    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(getAdminProductsMock).not.toHaveBeenCalled();
  });

  it("returns 401 with an invalid token", async () => {
    const { GET } = await import("@/app/api/internal/homecore/summary/route");

    const response = await GET(request("wrong-token"));

    expect(response.status).toBe(401);
    expect(getAdminProductsMock).not.toHaveBeenCalled();
  });

  it("returns a private owner summary with the valid token", async () => {
    const { GET } = await import("@/app/api/internal/homecore/summary/route");

    const response = await GET(request("test-homecore-token"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.storeId).toBe("maison-olive-shop");
    expect(payload.inventorySummary).toMatchObject({
      totalProducts: 3,
      activeProducts: 2,
      lowStockCount: 1,
      outOfStockCount: 1,
      stockValueAtCostCents: 12000,
    });
    expect(payload.financialSummary).toMatchObject({
      grossRevenueCents: 50000,
      estimatedGrossProfitCents: 23000,
    });
    expect(payload.ordersSummary).toMatchObject({
      pendingOrders: 1,
      ordersToPrepareCount: 1,
    });
    expect(payload.lowStockProducts).toHaveLength(1);
    expect(payload.outOfStockProducts).toHaveLength(1);
    expect(getRecentInventoryMovementsMock).toHaveBeenCalledWith(10);
  });

  it("does not expose customer-sensitive data", async () => {
    const { GET } = await import("@/app/api/internal/homecore/summary/route");

    const response = await GET(request("test-homecore-token"));
    const text = await response.text();

    expect(text).not.toContain("client@example.com");
    expect(text).not.toContain("pending@example.com");
    expect(text).not.toContain("123 Rue privée");
    expect(text).not.toContain("HOMECORE_INTERNAL_TOKEN");
    expect(text).not.toContain("test-homecore-token");
  });
});
