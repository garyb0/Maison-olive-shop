import { createElement, type AnchorHTMLAttributes, type ImgHTMLAttributes } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import manifest from "@/app/manifest";
import { PwaDriverAccessCard } from "@/app/app/pwa-driver-access-card";
import { PwaAppHeader } from "@/app/app/pwa-app-header";
import { PwaInstallPanel } from "@/app/app/pwa-install-panel";
import { AppNotificationCenter } from "@/app/app/app-notification-center";
import { PwaSupportButton } from "@/app/app/pwa-support-button";

const prismaMock = vi.hoisted(() => ({
  order: {
    count: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    aggregate: vi.fn(),
  },
  dogProfile: {
    count: vi.fn(),
  },
  userDeliveryAddress: {
    count: vi.fn(),
  },
  supportConversation: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
  deliveryRun: {
    count: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
  product: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ alt, src, priority: _priority, ...props }: ImgHTMLAttributes<HTMLImageElement> & { src: string; priority?: boolean }) =>
    createElement("img", { alt, src, ...props }),
}));

const getCurrentUserMock = vi.fn();
const getCurrentLanguageMock = vi.fn();
const getAppNotificationPreferencesMock = vi.fn();
const getWebPushPublicKeyMock = vi.fn();
const listAppNotificationsForUserMock = vi.fn();
const getAdminNotificationOpsSnapshotMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  getCurrentUser: (...args: unknown[]) => getCurrentUserMock(...args),
}));

vi.mock("@/lib/language", () => ({
  getCurrentLanguage: (...args: unknown[]) => getCurrentLanguageMock(...args),
}));

vi.mock("@/lib/app-notifications", () => ({
  getAppNotificationPreferences: (...args: unknown[]) => getAppNotificationPreferencesMock(...args),
  getWebPushPublicKey: (...args: unknown[]) => getWebPushPublicKeyMock(...args),
  listAppNotificationsForUser: (...args: unknown[]) => listAppNotificationsForUserMock(...args),
  getAdminNotificationOpsSnapshot: (...args: unknown[]) => getAdminNotificationOpsSnapshotMock(...args),
}));

vi.mock("@/lib/i18n", () => ({
  getDictionary: () => ({
    navHome: "Accueil",
    navAccount: "Mon compte",
    navAdmin: "Admin",
    navFaq: "FAQ",
    login: "Connexion",
  }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/components/Navigation", () => ({
  Navigation: () => <nav data-testid="pwa-navigation" />,
}));

describe("PWA Chez Olive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    getCurrentLanguageMock.mockResolvedValue("fr");
    getCurrentUserMock.mockResolvedValue(null);
    prismaMock.order.count.mockResolvedValue(0);
    prismaMock.order.findMany.mockResolvedValue([]);
    prismaMock.order.findFirst.mockResolvedValue(null);
    prismaMock.order.aggregate.mockResolvedValue({ _sum: { totalCents: 0 } });
    prismaMock.dogProfile.count.mockResolvedValue(0);
    prismaMock.userDeliveryAddress.count.mockResolvedValue(0);
    prismaMock.supportConversation.count.mockResolvedValue(0);
    prismaMock.supportConversation.findMany.mockResolvedValue([]);
    prismaMock.deliveryRun.count.mockResolvedValue(0);
    prismaMock.deliveryRun.findMany.mockResolvedValue([]);
    prismaMock.deliveryRun.findFirst.mockResolvedValue(null);
    prismaMock.product.count.mockResolvedValue(0);
    prismaMock.product.findMany.mockResolvedValue([]);
    getWebPushPublicKeyMock.mockReturnValue("");
    getAppNotificationPreferencesMock.mockResolvedValue({
      pushEnabled: false,
      orderUpdates: true,
      deliveryUpdates: true,
      supportUpdates: true,
      dogQrUpdates: true,
      adminAlerts: true,
      driverRunUpdates: true,
    });
    listAppNotificationsForUserMock.mockResolvedValue({ notifications: [], unreadCount: 0 });
    getAdminNotificationOpsSnapshotMock.mockResolvedValue({
      recent: [],
      unreadCount: 0,
      disabledPushSubscriptionCount: 0,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  });

  it("expose un manifest installable qui demarre sur /app", () => {
    const payload = manifest();

    expect(payload.name).toBe("Chez Olive");
    expect(payload.start_url).toBe("/app");
    expect(payload.display).toBe("standalone");
    expect(payload.theme_color).toBe("#545D2E");
    expect(payload.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: "/pwa-icon-192.png", sizes: "192x192" }),
        expect.objectContaining({ src: "/pwa-icon-512.png", sizes: "512x512" }),
        expect.objectContaining({ src: "/pwa-maskable-512.png", purpose: "maskable" }),
      ]),
    );
  });

  it("rend le hub public sans section admin quand aucun utilisateur n'est connecte", async () => {
    const { default: PwaAppPage } = await import("@/app/app/page");
    const { container } = render(await PwaAppPage());
    const hrefs = Array.from(container.querySelectorAll("a")).map((link) => link.getAttribute("href"));

    expect(screen.getByRole("banner", { name: "En-tete application" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Chez Olive App/ })).toHaveAttribute("href", "/app");
    expect(screen.getByRole("heading", { name: "Chez Olive" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ouvrir la boutique" })).toHaveAttribute("href", "/boutique");
    expect(screen.getByRole("link", { name: "Se connecter" })).toHaveAttribute("href", "/login");
    expect(hrefs).toContain("/faq");
    expect(hrefs).toContain("/login");
    expect(screen.queryByText("Admin leger")).not.toBeInTheDocument();
    expect(prismaMock.order.count).not.toHaveBeenCalled();
  });

  it("rend un header app compact avec panier, compte et admin optionnel", async () => {
    window.localStorage.setItem("chezolive_cart_v1", JSON.stringify([{ productId: "prod_1", quantity: 2 }]));

    render(<PwaAppHeader language="fr" userRole="ADMIN" />);

    expect(screen.getByRole("banner", { name: "En-tete application" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Chez Olive App/ })).toHaveAttribute("href", "/app");
    expect(screen.getByRole("link", { name: "Compte" })).toHaveAttribute("href", "/account");
    expect(screen.getByRole("link", { name: "Admin" })).toHaveAttribute("href", "/admin");
    await waitFor(() => expect(screen.getByRole("link", { name: "Panier 2" })).toHaveAttribute("href", "/cart"));
  });

  it("affiche un resume connecte avec les dernieres infos client", async () => {
    getCurrentUserMock.mockResolvedValue({
      id: "user_1",
      email: "client@chezolive.ca",
      firstName: "Gary",
      lastName: "Olive",
      role: "CUSTOMER",
      language: "fr",
    });
    prismaMock.order.count.mockResolvedValue(2);
    prismaMock.dogProfile.count.mockResolvedValue(1);
    prismaMock.supportConversation.count.mockResolvedValue(1);
    prismaMock.order.findFirst.mockResolvedValue({
      orderNumber: "CO-4242",
      status: "PROCESSING",
      totalCents: 4599,
    });

    const { default: PwaAppPage } = await import("@/app/app/page");
    render(await PwaAppPage());

    expect(screen.getByRole("heading", { name: "Bonjour, Gary" })).toBeInTheDocument();
    expect(screen.getByText("Derniere #CO-4242 - en preparation - 45,99 $")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Chiens QR/ })).toHaveAttribute("href", "/account/dogs");
    expect(prismaMock.dogProfile.count).toHaveBeenCalledWith({ where: { userId: "user_1", isActive: true } });
  });

  it("affiche le centre de notifications in-app sans forcer le push", () => {
    render(
      <AppNotificationCenter
        language="fr"
        publicKey=""
        initialNotifications={[
          {
            id: "notif_1",
            type: "ORDER_UPDATE",
            audience: "CUSTOMER",
            title: "Commande confirmee",
            body: "Ta commande est bien creee.",
            href: "/account/orders/order_1",
            readAt: null,
            createdAt: "2026-05-03T16:00:00.000Z",
          },
        ]}
        initialUnreadCount={1}
        initialPreferences={{
          pushEnabled: false,
          orderUpdates: true,
          deliveryUpdates: true,
          supportUpdates: true,
          dogQrUpdates: true,
          adminAlerts: true,
          driverRunUpdates: true,
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Centre d'actions" })).toBeInTheDocument();
    expect(screen.getByText("1 non lue(s)")).toBeInTheDocument();
    expect(screen.getByText("In-app actif")).toBeInTheDocument();
    expect(screen.getByText("Non supporte ici")).toBeInTheDocument();
    expect(screen.getByText("Types d'alertes")).toBeInTheDocument();
    expect(screen.getByText("Commandes").closest("label")?.querySelector("input")).toBeChecked();
    expect(screen.getByRole("button", { name: "Actualiser" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tester une notification" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Commande confirmee/ })).toHaveAttribute(
      "href",
      "/account/orders/order_1",
    );
    expect(screen.getByRole("button", { name: "Activer les alertes utiles" })).toBeDisabled();
  });

  it("permet de creer une notification test in-app", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/notifications/test")) {
        return Response.json({
          notification: { id: "notif_test" },
          pushConfigured: false,
          pushAttempted: false,
        });
      }
      if (url.endsWith("/api/notifications")) {
        return Response.json({
          notifications: [
            {
              id: "notif_test",
              type: "SYSTEM",
              audience: "CUSTOMER",
              title: "Notification test",
              body: "Ton centre d'actions Chez Olive fonctionne.",
              href: "/app",
              readAt: null,
              createdAt: "2026-05-03T16:01:00.000Z",
            },
          ],
          unreadCount: 1,
        });
      }
      return Response.json({});
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AppNotificationCenter
        language="fr"
        publicKey=""
        userRole="CUSTOMER"
        initialNotifications={[]}
        initialUnreadCount={0}
        initialPreferences={{
          pushEnabled: false,
          orderUpdates: true,
          deliveryUpdates: true,
          supportUpdates: true,
          dogQrUpdates: true,
          adminAlerts: true,
          driverRunUpdates: true,
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Tester une notification" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/notifications/test",
      expect.objectContaining({ method: "POST" }),
    ));
    expect(await screen.findByText("Notification test creee dans l'app. Le push n'a pas ete tente.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Notification test/ })).toHaveAttribute("href", "/app");
  });

  it("affiche l'admin leger seulement pour un admin avec cockpit mobile", async () => {
    getCurrentUserMock.mockResolvedValue({
      id: "admin_1",
      email: "admin@chezolive.ca",
      firstName: "Admin",
      lastName: "Olive",
      role: "ADMIN",
      language: "fr",
    });
    prismaMock.order.count.mockResolvedValue(3);
    prismaMock.order.findMany
      .mockResolvedValueOnce([
        {
          id: "order_1",
          orderNumber: "CO-9001",
          customerName: "Client Admin",
          status: "PAID",
          paymentStatus: "PAID",
          totalCents: 4599,
          currency: "CAD",
          createdAt: new Date("2026-05-03T13:00:00.000Z"),
          _count: { items: 2 },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "order_delivery_1",
          orderNumber: "CO-9002",
          customerName: "Client Livraison",
          deliveryStatus: "SCHEDULED",
          deliveryWindowStartAt: new Date("2026-05-03T14:00:00.000Z"),
          deliveryWindowEndAt: new Date("2026-05-03T17:00:00.000Z"),
          shippingCity: "Rimouski",
          _count: { items: 1 },
        },
      ]);
    prismaMock.supportConversation.count.mockResolvedValue(4);
    prismaMock.supportConversation.findMany.mockResolvedValue([
      {
        id: "support_1",
        customerName: "Client Support",
        customerEmail: "support@chezolive.ca",
        status: "WAITING",
        priority: "NORMAL",
        lastMessageAt: new Date("2026-05-03T12:00:00.000Z"),
        slaDueAt: null,
        order: null,
      },
    ]);
    prismaMock.deliveryRun.count.mockResolvedValue(1);
    prismaMock.deliveryRun.findMany.mockResolvedValue([
      {
        id: "run_1",
        dateKey: "2026-05-03",
        status: "IN_PROGRESS",
        startedAt: new Date("2026-05-03T13:30:00.000Z"),
        deliverySlot: {
          startAt: new Date("2026-05-03T13:00:00.000Z"),
          endAt: new Date("2026-05-03T17:00:00.000Z"),
        },
        _count: { stops: 7 },
      },
    ]);
    prismaMock.order.aggregate.mockResolvedValue({ _sum: { totalCents: 12999 } });
    prismaMock.product.count.mockResolvedValue(2);
    prismaMock.product.findMany.mockResolvedValue([
      {
        id: "prod_1",
        slug: "collier-test",
        nameFr: "Collier test",
        nameEn: "Test collar",
        stock: 2,
      },
    ]);

    const { default: PwaAppPage } = await import("@/app/app/page");
    const { container } = render(await PwaAppPage());
    const hrefs = Array.from(container.querySelectorAll("a")).map((link) => link.getAttribute("href"));

    expect(screen.getByText("Admin quotidien")).toBeInTheDocument();
    expect(screen.getByText("Prochaine #CO-9001 - Client Admin.")).toBeInTheDocument();
    expect(screen.getByText("#CO-9002 - Rimouski - planifiee.")).toBeInTheDocument();
    expect(screen.getByText("Client Support - attend une reponse.")).toBeInTheDocument();
    expect(screen.getByText("2026-05-03 - en cours - 7 arrets")).toBeInTheDocument();
    expect(screen.getByText("Collier test - 2 en stock.")).toBeInTheDocument();
    expect(hrefs).toContain("/admin/orders");
    expect(hrefs).toContain("/admin/delivery");
    expect(hrefs).toContain("/admin/delivery/runs");
    expect(hrefs).toContain("/admin/support");
  });

  it("rend la page hors ligne sans cache agressif sensible", async () => {
    const { default: OfflinePage } = await import("@/app/offline/page");
    render(await OfflinePage());

    expect(screen.getByRole("heading", { name: "Mode hors ligne" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Retour a l'app" })).toHaveAttribute("href", "/app");
    expect(screen.getByText("Checkout protege")).toBeInTheDocument();
  });

  it("ouvre le prompt d'installation Chromium quand beforeinstallprompt existe", async () => {
    render(<PwaInstallPanel language="fr" />);
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
      prompt: typeof prompt;
      userChoice: Promise<{ outcome: "accepted"; platform: string }>;
    };
    Object.defineProperty(event, "prompt", { value: prompt });
    Object.defineProperty(event, "userChoice", {
      value: Promise.resolve({ outcome: "accepted", platform: "web" }),
    });

    window.dispatchEvent(event);

    const installButton = await screen.findByRole("button", { name: "Installer l'app" });
    fireEvent.click(installButton);

    await waitFor(() => expect(prompt).toHaveBeenCalledTimes(1));
    await screen.findByRole("heading", { name: "Mode app active." });
  });

  it("affiche l'aide iPhone quand le prompt natif n'existe pas", async () => {
    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    );

    render(<PwaInstallPanel language="fr" />);

    expect(await screen.findByText(/Sur iPhone: ouvre Partager/)).toBeInTheDocument();
  });

  it("signale clairement l'etat hors ligne", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });

    render(<PwaInstallPanel language="fr" />);

    expect(await screen.findByRole("status")).toHaveTextContent("Tu es hors ligne");
    expect(screen.getByRole("link", { name: "Voir la page hors ligne" })).toHaveAttribute("href", "/offline");
  });

  it("conserve un lien chauffeur local sans appel API", () => {
    render(<PwaDriverAccessCard language="fr" />);

    fireEvent.change(screen.getByLabelText("Lien chauffeur ou token"), {
      target: { value: "https://chezolive.ca/driver/run/token_123456789012" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Garder ce lien" }));

    expect(screen.getByText("Dernier lien livreur")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ouvrir ma tournee" })).toHaveAttribute(
      "href",
      "/driver/run/token_123456789012",
    );
    expect(localStorage.getItem("chezolive_last_driver_run_href")).toBe("/driver/run/token_123456789012");
  });

  it("dispatch l'evenement support depuis le hub", () => {
    const listener = vi.fn();
    window.addEventListener("chezolive:support-open", listener);

    render(<PwaSupportButton language="fr" />);
    fireEvent.click(screen.getByRole("button", { name: "Ecrire a l'equipe" }));

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener("chezolive:support-open", listener);
  });
});
