import type { AnchorHTMLAttributes } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CartClient } from "@/app/cart/cart-client";
import { CheckoutClient } from "@/app/checkout/checkout-client";
import { StorefrontClient } from "@/app/storefront-client";
import { getDictionary } from "@/lib/i18n";

const fetchMock = vi.fn();

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/Navigation", () => ({
  Navigation: () => null,
}));

vi.mock("@/components/StripeInlineCheckoutSurface", () => ({
  StripeInlineCheckout: () => <div data-testid="stripe-inline-checkout" />,
}));

const productIndex = {
  prod_cart: {
    id: "prod_cart",
    name: "Lit Douillet Anti-Stress",
    priceCents: 6999,
    currency: "CAD",
    priceLabel: "69,99 $",
  },
};

const quote = {
  subtotalCents: 6999,
  discountCents: 0,
  shippingCents: 899,
  gstCents: 395,
  qstCents: 788,
  taxCents: 1183,
  totalCents: 9081,
};

describe("public cart and checkout flow", () => {
  beforeEach(() => {
    window.localStorage.clear();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ quote }),
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ajoute un produit public au panier local", async () => {
    render(
      <StorefrontClient
        surface="shop"
        language="fr"
        t={getDictionary("fr")}
        user={null}
        products={[
          {
            id: "prod_cart",
            slug: "lit-douillet",
            name: "Lit Douillet Anti-Stress",
            description: "Un lit confortable pour chien.",
            category: "Literie",
            priceLabel: "69,99 $",
            priceCents: 6999,
            stock: 5,
            imageUrl: null,
          },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Catalogue" })).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Ajouter" })[0]);

    await waitFor(() => {
      expect(window.localStorage.getItem("chezolive_cart_v1")).toBe(
        JSON.stringify([{ productId: "prod_cart", name: "Lit Douillet Anti-Stress", quantity: 1 }]),
      );
    });
  });

  it("lit le panier local sur la page panier", async () => {
    window.localStorage.setItem("chezolive_cart_v1", JSON.stringify([{ productId: "prod_cart", quantity: 1 }]));

    render(
      <CartClient
        language="fr"
        t={getDictionary("fr")}
        user={null}
        productIndex={productIndex}
        shippingFlatCents={899}
        shippingFreeThresholdCents={7500}
      />,
    );

    await waitFor(() => expect(screen.getAllByText("Lit Douillet Anti-Stress").length).toBeGreaterThan(0));
    expect(screen.getByText("1 article dans ton panier")).toBeInTheDocument();
    expect(screen.queryByText("Chargement du panier...")).not.toBeInTheDocument();
    expect(screen.getByText("Visa, Mastercard; paiement local avec compte")).toBeInTheDocument();
  });

  it("reprend le panier local au checkout invite et garde le paiement local connecte seulement", async () => {
    window.localStorage.setItem("chezolive_cart_v1", JSON.stringify([{ productId: "prod_cart", quantity: 1 }]));

    const { container } = render(
      <CheckoutClient
        language="fr"
        t={getDictionary("fr")}
        user={null}
        productIndex={productIndex}
        initialDeliveryAddresses={[]}
        shippingFlatCents={899}
        shippingFreeThresholdCents={7500}
        initialConfirmation={null}
        initialPaymentMode="stripe"
        initialStripeNotice={null}
      />,
    );

    await waitFor(() => expect(screen.getAllByText("Lit Douillet Anti-Stress").length).toBeGreaterThan(0));
    expect(screen.getByText("Commande en invité")).toBeInTheDocument();
    expect(screen.getByText("Livraison locale (Rimouski) — paiement par carte en invité; paiement local avec compte.")).toBeInTheDocument();
    expect(screen.getByText("En invité, seul le paiement par carte est disponible. Ton paiement est confirmé immédiatement et ton courriel sert au reçu.")).toBeInTheDocument();

    const manualPayment = container.querySelector('input[value="MANUAL"]') as HTMLInputElement | null;
    const stripePayment = container.querySelector('input[value="STRIPE"]') as HTMLInputElement | null;

    expect(manualPayment).not.toBeNull();
    expect(manualPayment).toBeDisabled();
    expect(stripePayment).not.toBeNull();
    expect(stripePayment).toBeChecked();
  });
});
