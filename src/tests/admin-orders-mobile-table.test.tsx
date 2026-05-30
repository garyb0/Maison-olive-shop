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

describe("AdminOrdersClient operational inbox", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("affiche les files rapides, la recherche par numéro et le lien support lié", () => {
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
            supportConversations: [
              {
                id: "support_1",
                status: "OPEN",
                priority: "HIGH",
                lastMessageAtLabel: "28 avril 2026",
              },
            ],
          },
        ]}
      />,
    );

    expect(container.querySelector(".admin-order-queue-grid")).not.toBeNull();
    expect(screen.getByRole("button", { name: /À vérifier/i })).toBeInTheDocument();
    expect(screen.getByText("#MO-20260428-0001")).toBeInTheDocument();
    expect(screen.getByText(/client@example\.com/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Conversation support liée/i })).toHaveAttribute(
      "href",
      "/admin/support?conversationId=support_1",
    );
    expect(screen.getByRole("link", { name: "Détails" })).toHaveAttribute("href", "/admin/orders/order_1");
  });
});
