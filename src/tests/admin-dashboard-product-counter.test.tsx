export {};

const getCurrentLanguageMock = vi.fn();
const getCurrentUserMock = vi.fn();
const getAdminOrdersMock = vi.fn();
const getAdminCustomersMock = vi.fn();
const getTaxReportMock = vi.fn();
const getAdminProductsMock = vi.fn();
const getAdminProductInventoryMetricsMock = vi.fn();
const getMaintenanceStateMock = vi.fn();
const getOwnerTodaySnapshotMock = vi.fn();

vi.mock("@/lib/language", () => ({
  getCurrentLanguage: (...args: unknown[]) => getCurrentLanguageMock(...args),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: (...args: unknown[]) => getCurrentUserMock(...args),
}));

vi.mock("@/lib/admin", () => ({
  getAdminOrders: (...args: unknown[]) => getAdminOrdersMock(...args),
  getAdminCustomers: (...args: unknown[]) => getAdminCustomersMock(...args),
  getTaxReport: (...args: unknown[]) => getTaxReportMock(...args),
  getAdminProducts: (...args: unknown[]) => getAdminProductsMock(...args),
  getAdminProductInventoryMetrics: (...args: unknown[]) => getAdminProductInventoryMetricsMock(...args),
}));

vi.mock("@/lib/maintenance", () => ({
  getMaintenanceState: (...args: unknown[]) => getMaintenanceStateMock(...args),
}));

vi.mock("@/lib/owner-dashboard", () => ({
  getOwnerTodaySnapshot: (...args: unknown[]) => getOwnerTodaySnapshotMock(...args),
}));

function emptyConversionWindow() {
  return {
    shopVisitors: 0,
    productViews: 0,
    productViewSessions: 0,
    cartAdds: 0,
    cartAddSessions: 0,
    cartViews: 0,
    checkoutStarts: 0,
    ordersCreated: 0,
    checkoutErrors: 0,
    shopToCartRate: null,
    productToCartRate: null,
    cartToCheckoutRate: null,
    checkoutToOrderRate: null,
    productViewDropOffCount: 0,
    cartToCheckoutDropOffCount: 0,
    checkoutToOrderDropOffCount: 0,
  };
}

function emptyTodaySnapshot() {
  return {
    dateKey: "2026-06-05",
    todayOrderCount: 0,
    ordersToPrepareCount: 0,
    deliveryOrderCount: 0,
    openSupportCount: 0,
    activeRunCount: 0,
    todaySalesCents: 0,
    outOfStockCount: 0,
    outOfStockProducts: [],
    lowStockCount: 0,
    lowStockProducts: [],
    ordersToPrepare: [],
    deliveryOrders: [],
    supportQueue: [],
    activeRuns: [],
    backup: {
      status: "ok",
      label: "Backup recent",
      latestName: "prod.db",
      ageHours: 0.1,
    },
    conversion: {
      today: emptyConversionWindow(),
      sevenDays: {
        ...emptyConversionWindow(),
        topAddedProducts: [],
        topAbandonedProducts: [],
        topViewedNotAddedProducts: [],
        checkoutErrorReasons: [],
      },
    },
    notifications: {
      unreadCount: 0,
      disabledPushSubscriptionCount: 0,
      recent: [],
    },
  };
}

describe("AdminDashboardPage product counter", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    getCurrentLanguageMock.mockResolvedValue("fr");
    getCurrentUserMock.mockResolvedValue({ id: "admin_1", role: "ADMIN" });
    getAdminOrdersMock.mockResolvedValue([]);
    getAdminCustomersMock.mockResolvedValue([]);
    getTaxReportMock.mockResolvedValue({ summary: { totalCents: 0 } });
    getAdminProductInventoryMetricsMock.mockResolvedValue({
      summary: {
        stockValueAtCostCents: 0,
        stockValueAtRetailCents: 0,
        grossRevenueCents: 0,
        estimatedGrossProfitCents: 0,
      },
      rows: [],
    });
    getMaintenanceStateMock.mockReturnValue({ enabled: false, openAt: null });
    getOwnerTodaySnapshotMock.mockResolvedValue(emptyTodaySnapshot());
  });

  it("exclut les produits SMOKE du compteur produits actifs", async () => {
    getAdminProductsMock.mockResolvedValue([
      { sku: "REAL-001", isActive: true },
      { sku: "REAL-002", isActive: false },
      { sku: "SMOKE-ACCOUNT", isActive: false },
      { sku: "SMOKE-DELIVERY", isActive: true },
    ]);

    const { default: AdminDashboardPage } = await import("@/app/admin/page");
    const element = await AdminDashboardPage() as { props: { stats: { activeProducts: number; totalProducts: number } } };

    expect(element.props.stats).toMatchObject({
      activeProducts: 1,
      totalProducts: 2,
    });
  });
});
