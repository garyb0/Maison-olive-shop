import type { AnchorHTMLAttributes } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CheckoutClient } from "@/app/checkout/checkout-client";
import { getDictionary } from "@/lib/i18n";
import type { CurrentUser, DeliveryAddress } from "@/lib/types";

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

vi.mock("@/components/PromoBanner", () => ({
  PromoBanner: () => null,
}));

vi.mock("@/components/StripeInlineCheckoutSurface", () => ({
  StripeInlineCheckout: ({ headline, description }: { headline: string; description: string }) => (
    <div data-testid="stripe-inline-checkout">
      <strong>{headline}</strong>
      <span>{description}</span>
    </div>
  ),
}));

const user: CurrentUser = {
  id: "user_1",
  email: "gary@example.com",
  firstName: "Gary",
  lastName: "Boucher",
  role: "CUSTOMER",
  language: "fr",
};

const address: DeliveryAddress = {
  id: "addr_1",
  label: "Maison",
  shippingLine1: "22 rue de l'etang",
  shippingCity: "Rimouski",
  shippingRegion: "QC",
  shippingPostal: "G0L1B0",
  shippingCountry: "CA",
  deliveryPhone: "4183183984",
  deliveryInstructions: "",
  createdAt: "2026-04-21T12:00:00.000Z",
  updatedAt: "2026-04-21T12:00:00.000Z",
  lastUsedAt: "2026-04-21T12:00:00.000Z",
};

describe("checkout stripe status", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    window.localStorage.clear();
    window.localStorage.setItem(
      "chezolive_cart_v1",
      JSON.stringify([{ productId: "prod_test", quantity: 1 }]),
    );

    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url.startsWith("/api/orders/quote")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            quote: {
              subtotalCents: 50,
              discountCents: 0,
              shippingCents: 0,
              gstCents: 3,
              qstCents: 5,
              taxCents: 8,
              totalCents: 58,
            },
          }),
        });
      }

      if (url.startsWith("/api/delivery/slots")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            slots: [
              {
                id: "slot_1",
                startAt: "2026-04-22T13:00:00.000Z",
                endAt: "2026-04-22T14:00:00.000Z",
                periodKey: "AM",
                periodLabel: "AM",
                capacity: 4,
                reservedCount: 1,
                remainingCapacity: 3,
                isOpen: true,
                note: null,
                dateKey: "2026-04-22",
              },
              {
                id: "slot_2",
                startAt: "2026-04-22T17:00:00.000Z",
                endAt: "2026-04-22T18:00:00.000Z",
                periodKey: "PM",
                periodLabel: "PM",
                capacity: 4,
                reservedCount: 0,
                remainingCapacity: 4,
                isOpen: true,
                note: null,
                dateKey: "2026-04-22",
              },
            ],
          }),
        });
      }

      if (url === "/api/orders") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            order: {
              id: "order_1",
              orderNumber: "MO-20260421-0001",
              customerEmail: "gary@example.com",
            },
            confirmation: {
              orderId: "order_1",
              orderNumber: "MO-20260421-0001",
              registerEmail: "gary@example.com",
              paymentMode: "stripe",
              orderCreatedAt: "2026-04-21T12:10:00.000Z",
              currency: "CAD",
              subtotalCents: 50,
              discountCents: 0,
              shippingCents: 0,
              gstCents: 3,
              qstCents: 5,
              taxCents: 8,
              totalCents: 58,
              items: [
                {
                  id: "prod_test",
                  nameFr: "Produit test",
                  nameEn: "Test product",
                  quantity: 1,
                  lineTotalCents: 50,
                },
              ],
            },
            stripeCheckout: {
              uiMode: "custom",
              clientSecret: "cs_test_secret",
              sessionId: "cs_test_1",
              returnUrl: "https://chezolive.ca/checkout?session_id=cs_test_1",
            },
          }),
        });
      }

      return Promise.resolve({
        ok: false,
        json: async () => ({}),
      });
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("n'affiche qu'un seul message d'etat quand Stripe inline est pret", async () => {
    const { container } = render(
      <CheckoutClient
        language="fr"
        t={getDictionary("fr")}
        user={user}
        productIndex={{
          prod_test: {
            id: "prod_test",
            name: "Produit test",
            priceCents: 50,
            currency: "CAD",
            priceLabel: "0,50 $",
          },
        }}
        initialDeliveryAddresses={[address]}
        shippingFlatCents={0}
        shippingFreeThresholdCents={7500}
        initialConfirmation={null}
        initialPaymentMode="manual"
        initialStripeNotice={null}
      />,
    );

    const stripeRadio = container.querySelector('input[value="STRIPE"]');
    expect(stripeRadio).not.toBeNull();
    fireEvent.click(stripeRadio as HTMLInputElement);

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url]) => String(url).startsWith("/api/orders/quote")),
      ).toBe(true),
    );

    const prepareButton = await screen.findByRole("button", { name: /Préparer le paiement/i });
    fireEvent.click(prepareButton);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/orders", expect.anything()));
    await waitFor(() => expect(screen.getByTestId("stripe-inline-checkout")).toBeInTheDocument());

    expect(
      screen.queryByText(
        "Ton paiement est prêt directement dans la page. Vérifie la carte ci-dessous pour confirmer.",
      ),
    ).not.toBeInTheDocument();

    expect(
      screen.getByText("Ton paiement est prêt ici. Vérifie la carte ci-dessous et confirme-la sans quitter la page."),
    ).toBeInTheDocument();
  });

  it("laisse vraiment passer en mode nouvelle adresse quand on clique sur le bouton dedie", async () => {
    const { container } = render(
      <CheckoutClient
        language="fr"
        t={getDictionary("fr")}
        user={user}
        productIndex={{
          prod_test: {
            id: "prod_test",
            name: "Produit test",
            priceCents: 50,
            currency: "CAD",
            priceLabel: "0,50 $",
          },
        }}
        initialDeliveryAddresses={[address]}
        shippingFlatCents={0}
        shippingFreeThresholdCents={7500}
        initialConfirmation={null}
        initialPaymentMode="manual"
        initialStripeNotice={null}
      />,
    );

    await waitFor(() => expect(screen.getByText("Adresse active")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Ajouter une nouvelle adresse/i }));

    expect(screen.getByText("Mode nouvelle adresse")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ex. 123 rue des Oliviers")).toBeInTheDocument();
    expect(screen.queryByText("Adresse active")).not.toBeInTheDocument();

    const saveAddressCheckbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    const selects = container.querySelectorAll("select");
    const postalInput = screen.getByPlaceholderText("Ex. G5L1A1") as HTMLInputElement;

    expect(saveAddressCheckbox).not.toBeNull();
    expect(saveAddressCheckbox?.checked).toBe(true);
    expect(selects).toHaveLength(2);
    expect((selects[0] as HTMLSelectElement).value).toBe("QC");
    expect((selects[1] as HTMLSelectElement).value).toBe("CA");

    fireEvent.change(postalInput, { target: { value: "g0l 1b3" } });
    expect(postalInput.value).toBe("G0L1B3");

    expect(
      screen.getByText(
        "Nouvelle adresse: l’enregistrement est activé par défaut. Tu peux le décocher si tu veux seulement l’utiliser pour cette commande.",
      ),
    ).toBeInTheDocument();
  });

  it("affiche seulement AM et PM pour le choix client", async () => {
    render(
      <CheckoutClient
        language="fr"
        t={getDictionary("fr")}
        user={user}
        productIndex={{
          prod_test: {
            id: "prod_test",
            name: "Produit test",
            priceCents: 50,
            currency: "CAD",
            priceLabel: "0,50 $",
          },
        }}
        initialDeliveryAddresses={[address]}
        shippingFlatCents={0}
        shippingFreeThresholdCents={7500}
        initialConfirmation={null}
        initialPaymentMode="manual"
        initialStripeNotice={null}
      />,
    );

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url]) => String(url).startsWith("/api/delivery/slots"))).toBe(true),
    );

    expect(await screen.findByText("AM")).toBeInTheDocument();
    expect(screen.getByText("PM")).toBeInTheDocument();
    expect(screen.getByText("2 périodes")).toBeInTheDocument();
    expect(screen.getByText("3 places disponibles")).toBeInTheDocument();
    expect(screen.getByText("4 places disponibles")).toBeInTheDocument();
    expect(screen.getByText(/mercredi 22 avril - AM/i)).toBeInTheDocument();
    expect(screen.queryByText(new RegExp("avr\\. \\u00b7 AM", "i"))).not.toBeInTheDocument();
    expect(screen.queryByText(/période\(s\)/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/place\(s\)/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Soir/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Plage actuelle/i)).not.toBeInTheDocument();
  });

  it("affiche le nom catalogue et une quantite lisible meme si le panier stocke seulement l'id", async () => {
    render(
      <CheckoutClient
        language="fr"
        t={getDictionary("fr")}
        user={user}
        productIndex={{
          prod_test: {
            id: "prod_test",
            name: "Produit test",
            priceCents: 50,
            currency: "CAD",
            priceLabel: "0,50 $",
          },
        }}
        initialDeliveryAddresses={[address]}
        shippingFlatCents={0}
        shippingFreeThresholdCents={7500}
        initialConfirmation={null}
        initialPaymentMode="manual"
        initialStripeNotice={null}
      />,
    );

    await waitFor(() => expect(screen.getAllByText(/Produit test/).length).toBeGreaterThanOrEqual(2));
    expect(
      screen.getByText((_content, element) => element?.textContent === `Produit test ${String.fromCharCode(215)}1`),
    ).toBeInTheDocument();
    expect(screen.queryByText(/\\u00d71/)).not.toBeInTheDocument();
  });
});
