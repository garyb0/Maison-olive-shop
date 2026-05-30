import type { AnchorHTMLAttributes } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { CartClient } from "@/app/cart/cart-client";
import { CheckoutClient } from "@/app/checkout/checkout-client";
import { ProductAddToCartButton } from "@/app/products/[slug]/product-add-to-cart-button";
import { ProductSubscriptionInlineClient } from "@/app/products/[slug]/product-subscription-inline-panel";
import { StorefrontClient } from "@/app/storefront-client";
import { getDictionary } from "@/lib/i18n";
import { hasAvailableSubscription } from "@/lib/subscription-availability";

const fetchMock = vi.fn();
const trackConversionEventMock = vi.fn();
const getConversionSessionKeyMock = vi.fn(() => "session-test-123");

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

vi.mock("@/app/app/pwa-app-header", () => ({
  PwaAppHeader: () => <header data-testid="checkout-pwa-header" />,
}));

vi.mock("@/components/StripeInlineCheckoutSurface", () => ({
  StripeInlineCheckout: () => <div data-testid="stripe-inline-checkout" />,
}));

vi.mock("@/lib/conversion-tracker", () => ({
  trackConversionEvent: (type: unknown, payload?: unknown) => trackConversionEventMock(type, payload),
  getConversionSessionKey: () => getConversionSessionKeyMock(),
}));

const productIndex = {
  prod_cart: {
    id: "prod_cart",
    name: "Lit Douillet Anti-Stress",
    priceCents: 6999,
    currency: "CAD",
    priceLabel: "69,99 $",
    stock: 5,
  },
};

const blockedProductIndex = {
  ...productIndex,
  prod_out: {
    id: "prod_out",
    name: "Collier en pause",
    priceCents: 2499,
    currency: "CAD",
    priceLabel: "24,99 $",
    stock: 0,
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

const subscriptionProduct = {
  id: "prod_subscription",
  slug: "croquettes-premium-bulldog",
  isSubscription: true,
  priceWeekly: null,
  priceBiweekly: 2999,
  priceMonthly: null,
  priceQuarterly: null,
  currency: "CAD",
  nameFr: "Croquettes Premium Bulldog",
  nameEn: "Premium Bulldog Kibble",
};

describe("public cart and checkout flow", () => {
  beforeEach(() => {
    window.localStorage.clear();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ quote }),
    });
    trackConversionEventMock.mockReset();
    getConversionSessionKeyMock.mockClear();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calcule le badge abonnement seulement quand un prix recurrent est disponible", () => {
    expect(
      hasAvailableSubscription({
        isSubscription: true,
        priceWeekly: null,
        priceBiweekly: 2999,
        priceMonthly: null,
        priceQuarterly: null,
      }),
    ).toBe(true);
    expect(
      hasAvailableSubscription({
        isSubscription: true,
        priceWeekly: 0,
        priceBiweekly: null,
        priceMonthly: null,
        priceQuarterly: null,
      }),
    ).toBe(false);
    expect(
      hasAvailableSubscription({
        isSubscription: false,
        priceWeekly: 2999,
        priceBiweekly: null,
        priceMonthly: null,
        priceQuarterly: null,
      }),
    ).toBe(false);
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
            subcategorySlug: "lits",
            subcategoryLabel: "Lits",
            priceLabel: "69,99 $",
            priceCents: 6999,
            stock: 5,
            imageUrl: null,
            subscriptionAvailable: hasAvailableSubscription({
              isSubscription: true,
              priceWeekly: null,
              priceBiweekly: 6999,
              priceMonthly: null,
              priceQuarterly: null,
            }),
          },
          {
            id: "prod_out",
            slug: "collier-en-pause",
            name: "Collier en pause",
            description: "Produit temporairement indisponible.",
            category: "Accessoires",
            subcategorySlug: "harnais",
            subcategoryLabel: "Harnais",
            priceLabel: "24,99 $",
            priceCents: 2499,
            stock: 0,
            imageUrl: null,
            subscriptionAvailable: hasAvailableSubscription({
              isSubscription: true,
              priceWeekly: 0,
              priceBiweekly: null,
              priceMonthly: null,
              priceQuarterly: null,
            }),
          },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Catalogue" })).toBeInTheDocument();
    await waitFor(() => expect(trackConversionEventMock).toHaveBeenCalledWith("SHOP_VIEW", { language: "fr" }));
    expect(screen.getByText("Livraison locale et suivi humain.")).toBeInTheDocument();
    expect(screen.getByText("Visible pour consultation; achat bloqué tant que le stock revient.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Indisponible" })).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "Partager" })).toHaveLength(2);
    expect(screen.getAllByText("Abonnement")).toHaveLength(1);

    fireEvent.click(screen.getAllByRole("button", { name: "Ajouter au panier" })[0]);

    await waitFor(() => {
      expect(window.localStorage.getItem("chezolive_cart_v1")).toBe(
        JSON.stringify([{ productId: "prod_cart", name: "Lit Douillet Anti-Stress", quantity: 1 }]),
      );
    });
    expect(trackConversionEventMock).toHaveBeenCalledWith(
      "CART_ADD",
      expect.objectContaining({
        productId: "prod_cart",
        productSlug: "lit-douillet",
        quantity: 1,
        language: "fr",
      }),
    );
  });

  it("filtre la boutique par sous-categorie guidee", () => {
    render(
      <StorefrontClient
        surface="shop"
        language="fr"
        t={getDictionary("fr")}
        user={null}
        products={[
          {
            id: "prod_harness",
            slug: "harnais-confort-olive",
            name: "Harnais Confort Olive",
            description: "Harnais confortable.",
            category: "Accessoires",
            subcategorySlug: "harnais",
            subcategoryLabel: "Harnais",
            priceLabel: "32,99 $",
            priceCents: 3299,
            stock: 6,
            imageUrl: null,
          },
          {
            id: "prod_bowl",
            slug: "gamelle-olive",
            name: "Gamelle Olive",
            description: "Bol pratique.",
            category: "Accessoires",
            subcategorySlug: "gamelles",
            subcategoryLabel: "Gamelles",
            priceLabel: "18,99 $",
            priceCents: 1899,
            stock: 4,
            imageUrl: null,
          },
          {
            id: "prod_shampoo",
            slug: "shampoing-peau-sensible",
            name: "Shampoing Peau Sensible",
            description: "Soin doux.",
            category: "Hygiène",
            subcategorySlug: "shampoings",
            subcategoryLabel: "Shampoings",
            priceLabel: "18,99 $",
            priceCents: 1899,
            stock: 10,
            imageUrl: null,
          },
        ]}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: /Accessoires/ })[0]);
    expect(screen.getAllByRole("button", { name: "Harnais" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Gamelles" }).length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole("button", { name: "Harnais" })[0]);
    expect(screen.getByText("Harnais Confort Olive")).toBeInTheDocument();
    expect(screen.queryByText("Gamelle Olive")).not.toBeInTheDocument();
    expect(screen.queryByText("Shampoing Peau Sensible")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tout le catalogue" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Rechercher" }), {
      target: { value: "shampoings" },
    });
    expect(screen.getByText("Shampoing Peau Sensible")).toBeInTheDocument();
  });

  it("n'affiche pas le guide invite dans la boutique", () => {
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
            subscriptionAvailable: true,
          },
        ]}
      />,
    );

    expect(
      screen.queryByText("Sans compte: panier et paiement par carte. Compte requis pour les abonnements et le paiement local."),
    ).not.toBeInTheDocument();
  });

  it("ouvre un mini-guide abonnement pour les invites", async () => {
    render(<ProductSubscriptionInlineClient product={subscriptionProduct} language="fr" isAuthenticated={false} />);

    expect(await screen.findByText("Voulez-vous savoir comment nos abonnements fonctionnent?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Suivant" }));
    expect(screen.getByText("Choisissez votre fréquence")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Suivant" }));
    expect(screen.getByText("Connectez-vous pour confirmer")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Suivant" }));
    expect(screen.getByText("Vous gardez le contrôle")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "J'ai compris" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(window.localStorage.getItem("chezolive_subscription_guide_v1")).toBe("dismissed");
    expect(screen.getByRole("link", { name: "Se connecter pour s'abonner" })).toHaveAttribute(
      "href",
      "/login?returnTo=%2Fproducts%2Fcroquettes-premium-bulldog",
    );
    expect(screen.queryByRole("button", { name: "Préparer le paiement par carte" })).not.toBeInTheDocument();
  });

  it("garde l'action abonnement normale pour les clients connectes", () => {
    render(<ProductSubscriptionInlineClient product={subscriptionProduct} language="fr" isAuthenticated />);

    expect(screen.queryByText("Voulez-vous savoir comment nos abonnements fonctionnent?")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Préparer le paiement par carte" })).toBeDisabled();
  });

  it("n'affiche aucun guide abonnement pour un produit sans abonnement", () => {
    const { container } = render(
      <ProductSubscriptionInlineClient
        product={{ ...subscriptionProduct, isSubscription: false }}
        language="fr"
        isAuthenticated={false}
      />,
    );

    expect(container.firstChild).toBeNull();
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
    await waitFor(() => expect(trackConversionEventMock).toHaveBeenCalledWith(
      "CART_VIEW",
      expect.objectContaining({ itemCount: 1, cartTotalCents: 6999, language: "fr" }),
    ));
    expect(screen.getByText("1 article dans ton panier")).toBeInTheDocument();
    expect(screen.queryByText("Chargement du panier...")).not.toBeInTheDocument();
    const mobileCartSummary = screen.getByLabelText("Résumé mobile du panier");
    expect(mobileCartSummary).toHaveTextContent("1 article");
    expect(mobileCartSummary).toHaveTextContent("Prêt pour checkout");
    expect(mobileCartSummary).toHaveTextContent("Panier");
    await waitFor(() => expect(mobileCartSummary).toHaveTextContent("Total estimé"));
    expect(screen.getAllByRole("link", { name: "Passer à la caisse" })).toHaveLength(1);
    expect(screen.getByText("Visa, Mastercard; paiement local avec compte")).toBeInTheDocument();
    expect(screen.getByText("Ensuite au checkout")).toBeInTheDocument();
    expect(screen.getByText("Adresse locale")).toBeInTheDocument();
    expect(screen.getByText("Créneau de livraison")).toBeInTheDocument();
    expect(screen.getByText("Besoin d'aide avant de payer?")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voir l'aide commande" })).toHaveAttribute("href", "/faq#commandes");
    expect(screen.getByRole("link", { name: "Livraison locale" })).toHaveAttribute("href", "/faq#livraison");
    expect(screen.getByRole("link", { name: "Paiement" })).toHaveAttribute("href", "/faq#paiement");
  });

  it("bloque le checkout du panier si un article stocke est maintenant en rupture", async () => {
    window.localStorage.setItem("chezolive_cart_v1", JSON.stringify([{ productId: "prod_out", quantity: 1 }]));

    render(
      <CartClient
        language="fr"
        t={getDictionary("fr")}
        user={null}
        productIndex={blockedProductIndex}
        shippingFlatCents={899}
        shippingFreeThresholdCents={7500}
      />,
    );

    await waitFor(() => expect(screen.getAllByText("Collier en pause").length).toBeGreaterThan(0));
    const mobileCartSummary = screen.getByLabelText("Résumé mobile du panier");
    expect(mobileCartSummary).toHaveTextContent("Stock à ajuster");
    expect(screen.getByText("Rupture")).toBeInTheDocument();
    expect(screen.getByText(/Ce produit reste visible/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Checkout bloqué par le stock" })).toBeDisabled();
    expect(screen.queryByRole("link", { name: "Passer à la caisse" })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).startsWith("/api/orders/quote"))).toBe(false);
  });

  it("garde le bouton produit clair selon la disponibilite", async () => {
    const { rerender } = render(
      <ProductAddToCartButton
        productId="prod_cart"
        productName="Lit Douillet Anti-Stress"
        language="fr"
        maxQuantity={3}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Ajouter au panier" }));

    await waitFor(() => {
      expect(window.localStorage.getItem("chezolive_cart_v1")).toBe(
        JSON.stringify([{ productId: "prod_cart", name: "Lit Douillet Anti-Stress", quantity: 1 }]),
      );
    });
    expect(trackConversionEventMock).toHaveBeenCalledWith(
      "CART_ADD",
      expect.objectContaining({ productId: "prod_cart", quantity: 1, language: "fr" }),
    );

    rerender(
      <ProductAddToCartButton
        productId="prod_out"
        productName="Collier en pause"
        language="fr"
        disabled
        maxQuantity={0}
      />,
    );

    expect(screen.getByRole("button", { name: "Indisponible" })).toBeDisabled();
  });

  it("garde le sticky CTA produit branché sur le même ajout panier", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    Object.defineProperty(window, "scrollY", { configurable: true, value: 500 });

    render(
      <ProductAddToCartButton
        productId="prod_cart"
        productName="Lit Douillet Anti-Stress"
        language="fr"
        maxQuantity={3}
        priceLabel="69,99 $"
      />,
    );

    const stickyCta = await screen.findByRole("region", { name: "Achat rapide" });
    fireEvent.click(within(stickyCta).getByRole("button", { name: "Ajouter au panier" }));

    await waitFor(() => {
      expect(window.localStorage.getItem("chezolive_cart_v1")).toBe(
        JSON.stringify([{ productId: "prod_cart", name: "Lit Douillet Anti-Stress", quantity: 1 }]),
      );
    });
    expect(trackConversionEventMock).toHaveBeenCalledWith(
      "CART_ADD",
      expect.objectContaining({ productId: "prod_cart", quantity: 1, language: "fr" }),
    );

    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
  });

  it("ajoute la couleur choisie comme ligne de panier distincte", async () => {
    render(
      <ProductAddToCartButton
        productId="prod_bed"
        productName="Lit Douillet Anti-Stress"
        language="fr"
        variants={[
          {
            id: "variant_red",
            slug: "rouge",
            colorNameFr: "Rouge",
            colorNameEn: "Red",
            colorHex: "#c43",
            sizeNameFr: "Très grand 37 x 30 po",
            sizeNameEn: "Very large 37 x 30 in",
            sizeCode: "37x30",
            sizeSortOrder: 1,
            stock: 2,
            isActive: true,
            sortOrder: 0,
          },
          {
            id: "variant_blue",
            slug: "bleu",
            colorNameFr: "Bleu",
            colorNameEn: "Blue",
            colorHex: "#2563eb",
            sizeNameFr: "Très grand 37 x 30 po",
            sizeNameEn: "Very large 37 x 30 in",
            sizeCode: "37x30",
            sizeSortOrder: 1,
            stock: 3,
            isActive: true,
            sortOrder: 1,
          },
        ]}
      />,
    );

    expect(screen.getByText("Grandeur")).toBeInTheDocument();
    expect(screen.getAllByText("Très grand 37 x 30 po").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Bleu" }));
    fireEvent.click(screen.getByRole("button", { name: "Ajouter au panier" }));

    await waitFor(() => {
      expect(window.localStorage.getItem("chezolive_cart_v1")).toBe(
        JSON.stringify([
          {
            productId: "prod_bed",
            variantId: "variant_blue",
            name: "Lit Douillet Anti-Stress - Bleu / Très grand 37 x 30 po",
            quantity: 1,
          },
        ]),
      );
    });
  });

  it("filtre les couleurs quand plusieurs grandeurs existent", async () => {
    render(
      <ProductAddToCartButton
        productId="prod_bed"
        productName="Lit pour chien douillet"
        language="fr"
        variants={[
          {
            id: "variant_red_small",
            slug: "rouge-petit",
            colorNameFr: "Rouge",
            colorNameEn: "Red",
            colorHex: "#c43",
            sizeNameFr: "Petit 24 x 18 po",
            sizeNameEn: "Small 24 x 18 in",
            sizeCode: "24x18",
            sizeSortOrder: 1,
            stock: 2,
            isActive: true,
            sortOrder: 0,
          },
          {
            id: "variant_red_large",
            slug: "rouge-grand",
            colorNameFr: "Rouge",
            colorNameEn: "Red",
            colorHex: "#c43",
            sizeNameFr: "Très grand 37 x 30 po",
            sizeNameEn: "Very large 37 x 30 in",
            sizeCode: "37x30",
            sizeSortOrder: 2,
            stock: 4,
            isActive: true,
            sortOrder: 1,
          },
          {
            id: "variant_blue_large",
            slug: "bleu-grand",
            colorNameFr: "Bleu",
            colorNameEn: "Blue",
            colorHex: "#2563eb",
            sizeNameFr: "Très grand 37 x 30 po",
            sizeNameEn: "Very large 37 x 30 in",
            sizeCode: "37x30",
            sizeSortOrder: 2,
            stock: 3,
            isActive: true,
            sortOrder: 2,
          },
        ]}
      />,
    );

    expect(screen.getAllByText("Petit 24 x 18 po").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Bleu" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Très grand 37 x 30 po" }));

    expect(screen.getByRole("button", { name: "Bleu" })).toBeInTheDocument();
    expect(screen.getByText("Rouge: 4 en stock")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Bleu" }));
    expect(screen.getByText("Bleu: 3 en stock")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ajouter au panier" }));

    await waitFor(() => {
      expect(window.localStorage.getItem("chezolive_cart_v1")).toBe(
        JSON.stringify([
          {
            productId: "prod_bed",
            variantId: "variant_blue_large",
            name: "Lit pour chien douillet - Bleu / Très grand 37 x 30 po",
            quantity: 1,
          },
        ]),
      );
    });
  });

  it("explique quand une couleur n'a pas sa propre photo", () => {
    render(
      <ProductAddToCartButton
        productId="prod_bed"
        productName="Lit Douillet Anti-Stress"
        language="fr"
        variants={[
          {
            id: "variant_red",
            slug: "rouge",
            colorNameFr: "Rouge",
            colorNameEn: "Red",
            colorHex: "#c43",
            sizeNameFr: "Très grand 37 x 30 po",
            sizeNameEn: "Very large 37 x 30 in",
            sizeCode: "37x30",
            sizeSortOrder: 1,
            stock: 2,
            isActive: true,
            sortOrder: 0,
          },
          {
            id: "variant_blue",
            slug: "bleu",
            colorNameFr: "Bleu",
            colorNameEn: "Blue",
            colorHex: "#2563eb",
            imageUrl: "/images/lits/bleu.jpg",
            sizeNameFr: "Très grand 37 x 30 po",
            sizeNameEn: "Very large 37 x 30 in",
            sizeCode: "37x30",
            sizeSortOrder: 1,
            stock: 3,
            isActive: true,
            sortOrder: 1,
          },
        ]}
      />,
    );

    expect(screen.getAllByText("Très grand 37 x 30 po").length).toBeGreaterThan(0);
    expect(screen.getByText("Photo du modèle. Couleur sélectionnée: Rouge.")).toBeInTheDocument();
    expect(screen.getByText("Rouge: 2 en stock")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Bleu" }));

    expect(screen.getByRole("img", { name: "Lit Douillet Anti-Stress - Bleu / Très grand 37 x 30 po" })).toHaveAttribute(
      "src",
      "/images/lits/bleu.jpg",
    );
    expect(screen.getByText("Bleu: 3 en stock")).toBeInTheDocument();
    expect(screen.queryByText("Photo du modèle. Couleur sélectionnée: Bleu.")).not.toBeInTheDocument();
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
    await waitFor(() => expect(trackConversionEventMock).toHaveBeenCalledWith(
      "CHECKOUT_START",
      expect.objectContaining({ itemCount: 1, cartTotalCents: 6999, paymentMethod: "STRIPE", language: "fr" }),
    ));
    expect(trackConversionEventMock).toHaveBeenCalledWith(
      "PAYMENT_SELECTED",
      expect.objectContaining({ paymentMethod: "STRIPE", language: "fr" }),
    );
    expect(screen.getByText("Commande en invité")).toBeInTheDocument();
    expect(screen.getByText("Livraison locale (Rimouski) — paiement par carte en invité; paiement local avec compte.")).toBeInTheDocument();
    expect(screen.getByText("En invité, seul le paiement par carte est disponible. Ton paiement est confirmé immédiatement et ton courriel sert au reçu.")).toBeInTheDocument();

    const mobileSummary = screen.getByLabelText("Résumé mobile du checkout");
    expect(mobileSummary).toHaveTextContent("Total actuel");
    expect(mobileSummary).toHaveTextContent("1 article");
    expect(mobileSummary).toHaveTextContent("Paiement: Carte");
    expect(mobileSummary).toHaveTextContent("Infos");
    expect(screen.getAllByRole("button", { name: /Préparer le paiement/i })).toHaveLength(1);

    expect(screen.getByText("Carte en invite, paiement local avec compte, et support si quelque chose bloque.")).toBeInTheDocument();
    expect(screen.getByText("Stripe sécurise les cartes.")).toBeInTheDocument();
    expect(screen.getByText("Le paiement local apparaît après connexion.")).toBeInTheDocument();
    expect(screen.getByText("Le prochain bouton prépare le paiement par carte sans quitter la page.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Paiement" })).toHaveAttribute("href", "/faq#paiement");
    expect(screen.getByRole("link", { name: "Voir l'aide paiement" })).toHaveAttribute("href", "/faq#paiement");
    expect(screen.getByRole("link", { name: "Probleme" })).toHaveAttribute("href", "/faq#retours");

    const manualPayment = container.querySelector('input[value="MANUAL"]') as HTMLInputElement | null;
    const stripePayment = container.querySelector('input[value="STRIPE"]') as HTMLInputElement | null;

    expect(manualPayment).not.toBeNull();
    expect(manualPayment).toBeDisabled();
    expect(stripePayment).not.toBeNull();
    expect(stripePayment).toBeChecked();
  });

  it("bloque le checkout si le panier contient un article en rupture", async () => {
    window.localStorage.setItem("chezolive_cart_v1", JSON.stringify([{ productId: "prod_out", quantity: 1 }]));

    render(
      <CheckoutClient
        language="fr"
        t={getDictionary("fr")}
        user={null}
        productIndex={blockedProductIndex}
        initialDeliveryAddresses={[]}
        shippingFlatCents={899}
        shippingFreeThresholdCents={7500}
        initialConfirmation={null}
        initialPaymentMode="stripe"
        initialStripeNotice={null}
      />,
    );

    await waitFor(() => expect(screen.getAllByText("Collier en pause").length).toBeGreaterThan(0));
    expect(screen.getByText("Stock à ajuster")).toBeInTheDocument();
    expect(screen.getByText("Rupture: retire cet article pour continuer.")).toBeInTheDocument();
    expect(screen.getByText("Paiement bloqué: ajuste le panier avant de confirmer.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Préparer le paiement/i })).toBeDisabled();
    expect(fetchMock.mock.calls.some(([url]) => String(url).startsWith("/api/orders/quote"))).toBe(false);
  });
});
