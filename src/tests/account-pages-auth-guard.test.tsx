import type { AnchorHTMLAttributes } from "react";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

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

  it("renders account order cards with translated statuses and readable delivery windows", async () => {
    getCurrentUserMock.mockResolvedValue({
      id: "user_1",
      role: "CUSTOMER",
      firstName: "Gary",
      lastName: "Olive",
      email: "gary@example.com",
    });
    prismaMock.order.findMany.mockResolvedValue([
      {
        id: "order_1",
        orderNumber: "MO-20260424-8558",
        createdAt: new Date("2026-04-24T22:46:00-04:00"),
        status: "PENDING",
        paymentStatus: "PENDING",
        paymentMethod: "MANUAL",
        deliveryStatus: "DELIVERED",
        deliveryWindowStartAt: new Date("2026-04-25T08:00:00-04:00"),
        deliveryWindowEndAt: new Date("2026-04-25T10:00:00-04:00"),
        totalCents: 58,
        currency: "CAD",
        items: [
          {
            id: "item_1",
            productNameSnapshotFr: "Biscuits au saumon",
            productNameSnapshotEn: "Salmon biscuits",
            quantity: 2,
            createdAt: new Date("2026-04-24T22:46:00-04:00"),
          },
        ],
      },
    ]);

    const { default: AccountOrdersPage } = await import("@/app/account/orders/page");
    render(await AccountOrdersPage());

    expect(screen.getByRole("heading", { name: "Mes commandes" })).toBeInTheDocument();
    expect(screen.getByText("#MO-20260424-8558")).toBeInTheDocument();
    expect(screen.getByText("Commande reçue")).toBeInTheDocument();
    expect(screen.getByText("Paiement en attente")).toBeInTheDocument();
    expect(screen.getByText("Livraison terminée")).toBeInTheDocument();
    expect(screen.getByText("Paiement local")).toBeInTheDocument();
    expect(screen.getByText("2 articles")).toBeInTheDocument();
    expect(screen.getByText("Biscuits au saumon")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voir la facture" })).toHaveAttribute("href", "/account/orders/order_1");
    expect(screen.queryByText("PENDING")).not.toBeInTheDocument();
  });
});
