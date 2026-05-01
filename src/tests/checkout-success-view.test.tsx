import type { AnchorHTMLAttributes } from "react";
import { render, screen } from "@testing-library/react";
import { CheckoutSuccessView } from "@/components/CheckoutSuccessView";
import type { CheckoutConfirmation } from "@/lib/types";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const confirmation: CheckoutConfirmation = {
  orderId: "order_1",
  orderNumber: "MO-20260428-0001",
  registerEmail: "client@example.com",
  paymentMode: "stripe",
  orderCreatedAt: "2026-04-28T16:00:00.000Z",
  currency: "CAD",
  subtotalCents: 6999,
  discountCents: 0,
  shippingCents: 899,
  gstCents: 395,
  qstCents: 788,
  taxCents: 1183,
  totalCents: 9081,
  items: [
    {
      id: "item_1",
      nameFr: "Produit test",
      nameEn: "Test product",
      quantity: 1,
      lineTotalCents: 6999,
    },
  ],
};

describe("CheckoutSuccessView", () => {
  it("n'affiche pas une confirmation quand la commande est introuvable", () => {
    render(
      <CheckoutSuccessView
        language="fr"
        user={null}
        confirmation={null}
        fallbackOrderNumber="MO-FAKE"
        fallbackRegisterEmail="client@example.com"
        fallbackPaymentMode="stripe"
      />,
    );

    expect(screen.getByText("Confirmation à vérifier")).toBeInTheDocument();
    expect(screen.getByText("On n’a pas pu confirmer cette commande.")).toBeInTheDocument();
    expect(screen.getByText("MO-FAKE")).toBeInTheDocument();
    expect(screen.queryByText(/Merci/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Retour au checkout" })).toHaveAttribute("href", "/checkout");
  });

  it("affiche la confirmation seulement quand elle vient d'une vraie commande", () => {
    render(
      <CheckoutSuccessView
        language="fr"
        user={null}
        confirmation={confirmation}
        fallbackOrderNumber="MO-FAKE"
        fallbackRegisterEmail="fake@example.com"
        fallbackPaymentMode="stripe"
      />,
    );

    expect(screen.getByText("Commande confirmée")).toBeInTheDocument();
    expect(screen.getAllByText(/MO-20260428-0001/).length).toBeGreaterThan(0);
    expect(screen.queryByText("MO-FAKE")).not.toBeInTheDocument();
    expect(screen.getByText("Produit test")).toBeInTheDocument();
  });
});
