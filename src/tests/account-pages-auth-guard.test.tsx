import type { AnchorHTMLAttributes } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { AccountOrdersClient, type AccountOrderListItem } from "@/app/account/orders/account-orders-client";

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

vi.mock("@/lib/favorites", () => ({
  getFavoriteProductsForUser: vi.fn().mockResolvedValue([]),
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
            productId: "prod_salmon",
            product: {
              id: "prod_salmon",
              slug: "biscuits-saumon",
              imageUrl: null,
              stock: 4,
              isActive: true,
            },
          },
        ],
      },
    ]);

    const { default: AccountOrdersPage } = await import("@/app/account/orders/page");
    render(await AccountOrdersPage());

    expect(screen.getByRole("heading", { name: "Centre de commandes" })).toBeInTheDocument();
    expect(screen.getAllByText("#MO-20260424-8558").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Commande reçue").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Paiement en attente").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Livraison terminée").length).toBeGreaterThan(0);
    expect(screen.getByText("Paiement local")).toBeInTheDocument();
    expect(screen.getByText("2 articles")).toBeInTheDocument();
    expect(screen.getByText("Biscuits au saumon")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voir le détail" })).toHaveAttribute("href", "/account/orders/order_1");
    expect(screen.queryByText("PENDING")).not.toBeInTheDocument();
  });

  it("filters and searches account orders without a network call", () => {
    const orders: AccountOrderListItem[] = [
      {
        id: "order_active",
        orderNumber: "MO-ACTIVE",
        createdAt: new Date("2026-04-26T10:00:00-04:00").toISOString(),
        status: "PROCESSING",
        paymentStatus: "PAID",
        paymentMethod: "STRIPE",
        deliveryStatus: "SCHEDULED",
        deliveryWindowStartAt: new Date("2026-04-27T08:00:00-04:00").toISOString(),
        deliveryWindowEndAt: new Date("2026-04-27T10:00:00-04:00").toISOString(),
        totalCents: 3299,
        currency: "CAD",
        items: [
          {
            id: "item_active",
            productId: "prod_harness",
            slug: "harnais-olive",
            imageUrl: null,
            currentStock: 6,
            isActive: true,
            productNameFr: "Harnais Olive",
            productNameEn: "Olive harness",
            quantity: 1,
          },
        ],
      },
      {
        id: "order_delivered",
        orderNumber: "MO-LIVREE",
        createdAt: new Date("2026-04-20T10:00:00-04:00").toISOString(),
        status: "DELIVERED",
        paymentStatus: "PAID",
        paymentMethod: "MANUAL",
        deliveryStatus: "DELIVERED",
        deliveryWindowStartAt: new Date("2026-04-21T08:00:00-04:00").toISOString(),
        deliveryWindowEndAt: new Date("2026-04-21T10:00:00-04:00").toISOString(),
        totalCents: 1899,
        currency: "CAD",
        items: [
          {
            id: "item_delivered",
            productId: "prod_shampoo",
            slug: "shampoing-doux",
            imageUrl: null,
            currentStock: 3,
            isActive: true,
            productNameFr: "Shampoing doux",
            productNameEn: "Soft shampoo",
            quantity: 1,
          },
        ],
      },
    ];

    const { container } = render(<AccountOrdersClient language="fr" orders={orders} favoriteProducts={[]} />);
    const ordersGrid = () => {
      const grid = container.querySelector(".account-orders-grid");
      expect(grid).not.toBeNull();
      return within(grid as HTMLElement);
    };

    fireEvent.click(screen.getByRole("button", { name: /Livrées/i }));
    expect(ordersGrid().getByText("#MO-LIVREE")).toBeInTheDocument();
    expect(ordersGrid().queryByText("#MO-ACTIVE")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Toutes/i }));
    fireEvent.change(screen.getByLabelText("Rechercher une commande"), { target: { value: "harnais" } });
    expect(ordersGrid().getByText("#MO-ACTIVE")).toBeInTheDocument();
    expect(ordersGrid().queryByText("#MO-LIVREE")).not.toBeInTheDocument();
  });

  it("rachète vers le panier local, ouvre le support prérempli et sauvegarde un favori", async () => {
    localStorage.clear();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/orders/reorder-cart") {
        return new Response(JSON.stringify({
          orderNumber: "MO-ACTIVE",
          lines: [{ productId: "prod_harness", name: "Harnais Olive", quantity: 1, currentStock: 5 }],
          unavailableItems: [{ productId: "prod_out", name: "Os", requestedQuantity: 1, reason: "out_of_stock" }],
          adjustedItems: [],
        }), { status: 200, headers: { "content-type": "application/json" } });
      }

      if (url === "/api/account/favorites" && init?.method === "POST") {
        return new Response(JSON.stringify({ favorite: { productId: "prod_harness" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      return new Response("{}", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const supportSpy = vi.fn();
    window.addEventListener("chezolive:support-open", supportSpy);

    const order: AccountOrderListItem = {
      id: "order_active",
      orderNumber: "MO-ACTIVE",
      createdAt: new Date("2026-04-26T10:00:00-04:00").toISOString(),
      status: "PROCESSING",
      paymentStatus: "PAID",
      paymentMethod: "STRIPE",
      deliveryStatus: "SCHEDULED",
      deliveryWindowStartAt: null,
      deliveryWindowEndAt: null,
      totalCents: 3299,
      currency: "CAD",
      items: [
        {
          id: "item_active",
          productId: "prod_harness",
          slug: "harnais-olive",
          imageUrl: null,
          currentStock: 5,
          isActive: true,
          productNameFr: "Harnais Olive",
          productNameEn: "Olive harness",
          quantity: 1,
        },
      ],
    };

    render(<AccountOrdersClient language="fr" orders={[order]} favoriteProducts={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "Acheter à nouveau" }));
    expect(await screen.findByText(/1 article\(s\) ajouté/)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("chezolive_cart_v1") ?? "[]")).toEqual([
      { productId: "prod_harness", name: "Harnais Olive", quantity: 1 },
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Demander de l’aide" }));
    expect(supportSpy).toHaveBeenCalled();
    expect((supportSpy.mock.calls[0]?.[0] as CustomEvent).detail).toMatchObject({
      orderId: "order_active",
      topic: "DELIVERY",
    });
    expect((supportSpy.mock.calls[0]?.[0] as CustomEvent).detail.draft).toContain("#MO-ACTIVE");

    fireEvent.click(screen.getByRole("button", { name: "Sauvegarder" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/account/favorites", expect.objectContaining({ method: "POST" }));

    window.removeEventListener("chezolive:support-open", supportSpy);
    vi.unstubAllGlobals();
  });
});
