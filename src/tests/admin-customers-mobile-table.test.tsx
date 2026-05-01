import type { AnchorHTMLAttributes } from "react";
import { render, screen } from "@testing-library/react";
import { AdminCustomersClient } from "@/app/admin/customers/admin-customers-client";
import { getDictionary } from "@/lib/i18n";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("AdminCustomersClient mobile table labels", () => {
  it("expose des labels par cellule pour le rendu mobile en cartes", () => {
    const { container } = render(
      <AdminCustomersClient
        language="fr"
        t={getDictionary("fr")}
        customers={[
          {
            id: "user_1",
            email: "client@example.com",
            fullName: "Client Invite",
            role: "CUSTOMER",
            ordersCount: 2,
            createdAtLabel: "28 avril 2026",
            detailsHref: "/admin/customers/user_1",
          },
        ]}
      />,
    );

    expect(container.querySelector(".admin-mobile-table-wrap")).not.toBeNull();
    expect(container.querySelector(".admin-mobile-table")).not.toBeNull();
    expect(screen.getByText("Client Invite").closest("td")).toHaveAttribute("data-label", "Nom");
    expect(screen.getByText("client@example.com").closest("td")).toHaveAttribute("data-label", "Email");
    expect(container.querySelector('td[data-label="Rôle"]')).toHaveTextContent("CUSTOMER");
    expect(screen.getByText("Voir profil").closest("td")).toHaveClass("admin-mobile-actions-cell");
  });
});
