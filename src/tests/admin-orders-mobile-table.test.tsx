import type { AnchorHTMLAttributes } from "react";
import { render, screen } from "@testing-library/react";
import { AdminOrdersClient } from "@/app/admin/orders/admin-orders-client";
import { getDictionary } from "@/lib/i18n";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("AdminOrdersClient mobile table labels", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("expose des labels par cellule pour le rendu mobile en cartes", () => {
    const { container } = render(
      <AdminOrdersClient
        language="fr"
        t={getDictionary("fr")}
        orders={[
          {
            id: "order_1",
            customerType: "guest",
            orderNumber: "MO-20260428-0001",
            customerEmail: "client@example.com",
            customerName: "Client Invite",
            promoCode: null,
            status: "PENDING",
            paymentStatus: "PENDING",
            totalLabel: "90,81 $",
            createdAtLabel: "28 avril 2026",
            deliveryWindowLabel: "AM",
            deliveryStatus: "UNSCHEDULED",
            deliveryPhone: "4185551212",
            deliveryInstructions: null,
          },
        ]}
      />,
    );

    expect(container.querySelector(".admin-orders-table-wrap")).not.toBeNull();
    expect(container.querySelector(".admin-orders-table")).not.toBeNull();
    expect(screen.getByText("MO-20260428-0001").closest("td")).toHaveAttribute("data-label", "Commande");
    expect(screen.getByText("client@example.com").closest("td")).toHaveAttribute("data-label", "Email");
    expect(screen.getByText("90,81 $").closest("td")).toHaveAttribute("data-label", "Total");
    expect(screen.getByText("Voir détails").closest("td")).toHaveClass("admin-order-actions-cell");
  });
});
