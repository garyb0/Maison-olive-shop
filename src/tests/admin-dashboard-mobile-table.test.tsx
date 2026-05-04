import type { AnchorHTMLAttributes } from "react";
import { render, screen } from "@testing-library/react";
import { AdminDashboardClient } from "@/app/admin/admin-dashboard-client";
import { getDictionary } from "@/lib/i18n";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("AdminDashboardClient mobile table labels", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("expose des labels mobiles pour rentabilite et commandes recentes", () => {
    const { container } = render(
      <AdminDashboardClient
        language="fr"
        t={getDictionary("fr")}
        oliveMode="princess"
        initialMaintenanceEnabled={false}
        initialMaintenanceOpenAt={null}
        stats={{
          totalProducts: 1,
          activeProducts: 1,
          totalOrders: 1,
          pendingOrders: 1,
          totalCustomers: 1,
          taxTotal: "11,83 $",
        }}
        todayCockpit={{
          dateKey: "2026-05-03",
          todayOrderCount: 2,
          ordersToPrepareCount: 1,
          deliveryOrderCount: 1,
          openSupportCount: 1,
          activeRunCount: 1,
          todaySalesLabel: "90,81 $",
          outOfStockCount: 1,
          outOfStockProducts: [{ id: "prod_out", name: "Produit rupture", slug: "produit-rupture", stock: 0 }],
          lowStockCount: 2,
          lowStockProducts: [{ id: "prod_1", name: "Produit test", slug: "produit-test", stock: 3 }],
          actionQueues: {
            ordersToPrepare: [
              {
                id: "order_1",
                href: "/admin/orders/order_1",
                title: "#MO-20260428-0001",
                meta: "Client Invite",
                detail: "1 article(s) - 90,81 $ - Paiement a verifier",
                badge: "A verifier",
              },
            ],
            deliveryOrders: [
              {
                id: "order_delivery_1",
                href: "/admin/orders/order_delivery_1",
                title: "#MO-20260428-0002",
                meta: "Client Livraison - Rimouski",
                detail: "3 mai, 09 h 00 - 3 mai, 12 h 00",
                badge: "Planifiee",
              },
            ],
            supportQueue: [
              {
                id: "support_1",
                href: "/admin/support",
                title: "Client Support",
                meta: "support@chezolive.ca",
                detail: "Dernier message 3 mai, 08 h 00",
                badge: "Attend une reponse - NORMAL",
              },
            ],
            activeRuns: [
              {
                id: "run_1",
                href: "/admin/delivery/runs",
                title: "2026-05-03",
                meta: "3 mai, 09 h 00 - 3 mai, 12 h 00",
                detail: "4 arret(s)",
                badge: "Publiee",
              },
            ],
          },
          backup: {
            status: "ok",
            label: "Backup recent",
            latestName: "hourly-test.db",
            ageHours: 0.25,
          },
          conversion: {
            today: {
              shopVisitors: 12,
              productViews: 18,
              productViewSessions: 10,
              cartAdds: 5,
              cartAddSessions: 5,
              cartViews: 4,
              checkoutStarts: 3,
              ordersCreated: 2,
              checkoutErrors: 1,
              shopToCartRateLabel: "42 %",
              productToCartRateLabel: "50 %",
              cartToCheckoutRateLabel: "60 %",
              checkoutToOrderRateLabel: "67 %",
              productViewDropOffCount: 5,
              cartToCheckoutDropOffCount: 2,
              checkoutToOrderDropOffCount: 1,
            },
            sevenDays: {
              shopVisitors: 40,
              productViews: 64,
              productViewSessions: 30,
              cartAdds: 20,
              cartAddSessions: 18,
              cartViews: 15,
              checkoutStarts: 10,
              ordersCreated: 6,
              checkoutErrors: 2,
              shopToCartRateLabel: "45 %",
              productToCartRateLabel: "60 %",
              cartToCheckoutRateLabel: "50 %",
              checkoutToOrderRateLabel: "60 %",
              productViewDropOffCount: 12,
              cartToCheckoutDropOffCount: 8,
              checkoutToOrderDropOffCount: 4,
            },
            topAddedProducts: [
              { key: "prod_1", name: "Produit test", quantity: 8, addCount: 5 },
            ],
            topAbandonedProducts: [
              { key: "prod_2", name: "Produit abandonne", quantity: 3, addCount: 2 },
            ],
            topViewedNotAddedProducts: [
              { key: "prod_3", name: "Produit regarde", quantity: 4, addCount: 4 },
            ],
            checkoutErrorReasons: [
              { reason: "payment_declined", count: 2 },
            ],
          },
          notifications: {
            unreadCount: 1,
            disabledPushSubscriptionCount: 1,
            recent: [
              {
                id: "notif_admin_1",
                type: "ADMIN_ORDER",
                title: "Nouvelle commande",
                body: "Commande #MO-20260428-0001 recue.",
                href: "/admin/orders/order_1",
                read: false,
                createdAtLabel: "3 mai, 08 h 30",
              },
            ],
          },
          siteStatus: "Site ouvert",
        }}
        profitabilitySummary={{
          stockValueAtCostLabel: "10,00 $",
          stockValueAtRetailLabel: "20,00 $",
          grossRevenueLabel: "90,81 $",
          estimatedGrossProfitLabel: "30,00 $",
        }}
        profitabilityRows={[
          {
            id: "prod_1",
            name: "Produit test",
            slug: "produit-test",
            stock: 3,
            quantityAdded: 5,
            quantitySold: 2,
            quantityAdjusted: 0,
            estimatedGrossProfitLabel: "30,00 $",
          },
        ]}
        recentOrders={[
          {
            id: "order_1",
            orderNumber: "MO-20260428-0001",
            customerName: "Client Invite",
            status: "PENDING",
            totalLabel: "90,81 $",
          },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "À faire maintenant" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Commandes à préparer" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Support à répondre" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Voir les commandes/ })).toHaveAttribute("href", "/admin/orders");
    expect(screen.getByRole("link", { name: /Ouvrir support/ })).toHaveAttribute("href", "/admin/support");
    expect(screen.getByText("Backup")).toBeInTheDocument();
    expect(screen.getByText("Produit rupture")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Conversion" })).toBeInTheDocument();
    expect(screen.getByText("Vus sans ajout")).toBeInTheDocument();
    expect(screen.getByText("Paniers sans checkout")).toBeInTheDocument();
    expect(screen.getByText("Checkouts sans commande")).toBeInTheDocument();
    expect(screen.getByText(/Regarde ces fiches/)).toBeInTheDocument();
    expect(screen.getAllByText("Visiteurs boutique").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Produit vers panier").length).toBeGreaterThan(0);
    expect(screen.getByText("Produits les plus ajoutés")).toBeInTheDocument();
    expect(screen.getByText("Produit abandonne")).toBeInTheDocument();
    expect(screen.getByText("Produits vus sans ajout")).toBeInTheDocument();
    expect(screen.getByText("Produit regarde")).toBeInTheDocument();
    expect(screen.getByText("payment_declined")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Notifications et push" })).toBeInTheDocument();
    expect(screen.getByText("Nouvelle commande")).toBeInTheDocument();
    expect(screen.getByText("Push désactivés")).toBeInTheDocument();
    expect(container.querySelectorAll(".admin-dashboard-table-wrap")).toHaveLength(2);
    expect(container.querySelectorAll(".admin-dashboard-table")).toHaveLength(2);
    const productTableCell = screen.getAllByText("Produit test").find((element) => element.closest("td"))?.closest("td");
    expect(productTableCell).toHaveAttribute("data-label", "Produit");
    expect(screen.getByText("MO-20260428-0001").closest("td")).toHaveAttribute("data-label", "Commande");
    const customerTableCell = screen.getAllByText("Client Invite").find((element) => element.closest("td"))?.closest("td");
    expect(customerTableCell).toHaveAttribute("data-label", "Client");
  });
});
