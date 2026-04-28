export {};

const getCurrentUserMock = vi.fn();
const getCurrentLanguageMock = vi.fn();
const syncOrderPaymentFromStripeSessionForUserMock = vi.fn();

const prismaMock = {
  order: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
  subscription: {
    count: vi.fn(),
  },
};

vi.mock("@/lib/auth", () => ({
  getCurrentUser: (...args: unknown[]) => getCurrentUserMock(...args),
}));

vi.mock("@/lib/language", () => ({
  getCurrentLanguage: (...args: unknown[]) => getCurrentLanguageMock(...args),
}));

vi.mock("@/lib/orders", () => ({
  syncOrderPaymentFromStripeSessionForUser: (...args: unknown[]) =>
    syncOrderPaymentFromStripeSessionForUserMock(...args),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

describe("account pages auth guard", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    getCurrentUserMock.mockResolvedValue(null);
    getCurrentLanguageMock.mockResolvedValue("fr");
  });

  it("returns null on the account dashboard when no user is logged in", async () => {
    const { default: AccountDashboardPage } = await import("@/app/account/page");
    const page = await AccountDashboardPage({ searchParams: Promise.resolve({}) });

    expect(page).toBeNull();
    expect(prismaMock.order.count).not.toHaveBeenCalled();
    expect(prismaMock.subscription.count).not.toHaveBeenCalled();
    expect(syncOrderPaymentFromStripeSessionForUserMock).not.toHaveBeenCalled();
  });

  it("returns null on the account orders page when no user is logged in", async () => {
    const { default: AccountOrdersPage } = await import("@/app/account/orders/page");
    const page = await AccountOrdersPage();

    expect(page).toBeNull();
    expect(prismaMock.order.findMany).not.toHaveBeenCalled();
  });
});
