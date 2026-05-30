import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ProductShareButton } from "@/components/ProductShareButton";
import {
  buildEmailShareUrl,
  buildFacebookSendDialogUrl,
  buildFacebookShareUrl,
  buildMessengerFallbackUrl,
  buildProductShareText,
  buildProductShareUrl,
  buildSmsShareUrl,
  buildWhatsAppShareUrl,
} from "@/lib/product-share";

const originalFacebookAppId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
const originalFacebookRedirectUrl = process.env.NEXT_PUBLIC_FACEBOOK_SEND_REDIRECT_URL;

describe("ProductShareButton", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    delete process.env.NEXT_PUBLIC_FACEBOOK_SEND_REDIRECT_URL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window.navigator, "share", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    if (originalFacebookAppId === undefined) {
      delete process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    } else {
      process.env.NEXT_PUBLIC_FACEBOOK_APP_ID = originalFacebookAppId;
    }
    if (originalFacebookRedirectUrl === undefined) {
      delete process.env.NEXT_PUBLIC_FACEBOOK_SEND_REDIRECT_URL;
    } else {
      process.env.NEXT_PUBLIC_FACEBOOK_SEND_REDIRECT_URL = originalFacebookRedirectUrl;
    }
    document.documentElement.classList.remove("is-capacitor-native");
    vi.unstubAllGlobals();
  });

  it("ouvre le compositeur avec le message produit pre-rempli", () => {
    render(
      <ProductShareButton
        slug="lit-douillet"
        name="Lit douillet"
        priceLabel="69,99 $"
        language="fr"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Partager" }));

    expect(screen.getByText("Envoyer à quelqu’un")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue(
      buildProductShareText({
        language: "fr",
        name: "Lit douillet",
        priceLabel: "69,99 $",
        url: buildProductShareUrl("lit-douillet", window.location.origin),
      }),
    );
  });

  it("envoie le commentaire modifie via navigator.share", async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, "share", {
      configurable: true,
      value: shareMock,
    });
    document.documentElement.classList.add("is-capacitor-native");

    render(
      <ProductShareButton
        slug="lit-douillet"
        name="Lit douillet"
        priceLabel="69,99 $"
        language="fr"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Partager" }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Regarde ce lit: https://chezolive.ca/products/lit-douillet" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Envoyer avec mon/ }));

    await waitFor(() => {
      expect(shareMock).toHaveBeenCalledWith({
        title: "Lit douillet",
        text: "Regarde ce lit: https://chezolive.ca/products/lit-douillet",
        url: buildProductShareUrl("lit-douillet", window.location.origin),
      });
    });
  });

  it("affiche Messenger et l'envoie via le partage natif", async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, "share", {
      configurable: true,
      value: shareMock,
    });
    document.documentElement.classList.add("is-capacitor-native");

    render(
      <ProductShareButton
        slug="lit-douillet"
        name="Lit douillet"
        priceLabel="69,99 $"
        language="fr"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Partager" }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Pour toi: https://chezolive.ca/products/lit-douillet" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Messenger" }));

    await waitFor(() => {
      expect(shareMock).toHaveBeenCalledWith({
        title: "Lit douillet",
        text: "Pour toi: https://chezolive.ca/products/lit-douillet",
        url: buildProductShareUrl("lit-douillet", window.location.origin),
      });
    });
  });

  it("genere les liens prives et copie le commentaire modifie", async () => {
    const copyMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: copyMock,
      },
    });

    render(
      <ProductShareButton
        slug="collier-en-pause"
        name="Collier en pause"
        priceLabel="24,99 $"
        language="fr"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Partager" }));
    const customMessage = "Regarde ca pour Olive: https://chezolive.ca/products/collier-en-pause";
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: customMessage },
    });

    const productUrl = buildProductShareUrl("collier-en-pause", window.location.origin);
    expect(screen.getByRole("link", { name: "SMS" })).toHaveAttribute("href", buildSmsShareUrl(customMessage));
    expect(screen.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", buildWhatsAppShareUrl(customMessage));
    expect(screen.getByRole("link", { name: "Courriel" })).toHaveAttribute(
      "href",
      buildEmailShareUrl("Collier en pause chez Chez Olive", customMessage),
    );
    expect(screen.getByRole("link", { name: "Facebook" })).toHaveAttribute("href", buildFacebookShareUrl(productUrl));

    fireEvent.click(screen.getByRole("button", { name: "Copier" }));

    await waitFor(() => {
      expect(copyMock).toHaveBeenCalledWith(customMessage);
      expect(screen.getByRole("status")).toHaveTextContent("Copié");
    });
  });

  it("copie le message et affiche un guide Messenger sur desktop sans App ID", async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    const copyMock = vi.fn().mockResolvedValue(undefined);
    const openMock = vi.fn();
    Object.defineProperty(window.navigator, "share", {
      configurable: true,
      value: shareMock,
    });
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: copyMock,
      },
    });
    vi.stubGlobal("open", openMock);

    render(
      <ProductShareButton
        slug="collier-en-pause"
        name="Collier en pause"
        priceLabel="24,99 $"
        language="fr"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Partager" }));
    const customMessage = "Message prive: https://chezolive.ca/products/collier-en-pause";
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: customMessage },
    });
    fireEvent.click(screen.getByRole("button", { name: "Messenger" }));

    await waitFor(() => {
      expect(shareMock).not.toHaveBeenCalled();
      expect(copyMock).toHaveBeenCalledWith(customMessage);
      expect(openMock).not.toHaveBeenCalled();
      expect(screen.getByRole("status")).toHaveTextContent("Message copié. Colle-le dans Messenger.");
    });
    expect(screen.getByText("Messenger prêt")).toBeInTheDocument();
    expect(screen.getByText("Le message est copié. Ouvre Messenger, choisis la personne, puis colle le message.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ouvrir Messenger" }));

    expect(openMock).toHaveBeenCalledWith(buildMessengerFallbackUrl(), "_blank", "noopener,noreferrer");
  });

  it("ouvre le Send Dialog Messenger quand l'App ID Meta est configure", async () => {
    const copyMock = vi.fn().mockResolvedValue(undefined);
    const openMock = vi.fn();
    process.env.NEXT_PUBLIC_FACEBOOK_APP_ID = "123456789";
    process.env.NEXT_PUBLIC_FACEBOOK_SEND_REDIRECT_URL = "https://chezolive.ca/boutique";
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: copyMock,
      },
    });
    vi.stubGlobal("open", openMock);

    render(
      <ProductShareButton
        slug="collier-en-pause"
        name="Collier en pause"
        priceLabel="24,99 $"
        language="fr"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Partager" }));
    fireEvent.click(screen.getByRole("button", { name: "Messenger" }));

    const productUrl = buildProductShareUrl("collier-en-pause", window.location.origin);
    expect(copyMock).not.toHaveBeenCalled();
    expect(openMock).toHaveBeenCalledWith(
      buildFacebookSendDialogUrl({
        appId: "123456789",
        link: productUrl,
        redirectUri: "https://chezolive.ca/boutique",
      }),
      "_blank",
      "noopener,noreferrer",
    );
    expect(screen.getByRole("status")).toHaveTextContent("Choisis le destinataire dans Messenger.");
  });

  it("evite le Send Dialog Messenger en contexte app mobile sans partage natif", async () => {
    const copyMock = vi.fn().mockResolvedValue(undefined);
    const openMock = vi.fn();
    process.env.NEXT_PUBLIC_FACEBOOK_APP_ID = "123456789";
    process.env.NEXT_PUBLIC_FACEBOOK_SEND_REDIRECT_URL = "https://chezolive.ca/boutique";
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: copyMock,
      },
    });
    document.documentElement.classList.add("is-capacitor-native");
    vi.stubGlobal("open", openMock);

    render(
      <ProductShareButton
        slug="collier-en-pause"
        name="Collier en pause"
        priceLabel="24,99 $"
        language="fr"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Partager" }));
    fireEvent.click(screen.getByRole("button", { name: "Messenger" }));

    await waitFor(() => {
      expect(openMock).not.toHaveBeenCalled();
      expect(copyMock).toHaveBeenCalledWith(
        buildProductShareText({
          language: "fr",
          name: "Collier en pause",
          priceLabel: "24,99 $",
          url: buildProductShareUrl("collier-en-pause", window.location.origin),
        }),
      );
      expect(screen.getByRole("status")).toHaveTextContent("Message copié. Colle-le dans Messenger.");
    });
    expect(screen.getByText("Messenger prêt")).toBeInTheDocument();
  });

  it("genere un lien Facebook encode vers la fiche produit", () => {
    const productUrl = "https://chezolive.ca/products/lit-douillet";
    expect(buildFacebookShareUrl(productUrl)).toBe(
      "https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fchezolive.ca%2Fproducts%2Flit-douillet",
    );
  });
});
