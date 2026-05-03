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

    expect(container.querySelectorAll(".admin-dashboard-table-wrap")).toHaveLength(2);
    expect(container.querySelectorAll(".admin-dashboard-table")).toHaveLength(2);
    expect(screen.getByText("Produit test").closest("td")).toHaveAttribute("data-label", "Produit");
    expect(screen.getByText("MO-20260428-0001").closest("td")).toHaveAttribute("data-label", "Commande");
    expect(screen.getByText("Client Invite").closest("td")).toHaveAttribute("data-label", "Client");
  });
});
