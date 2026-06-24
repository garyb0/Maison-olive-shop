import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createElement, type AnchorHTMLAttributes, type ImgHTMLAttributes } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Capacitor } from "@capacitor/core";
import manifest from "@/app/manifest";
import { PwaDriverAccessCard } from "@/app/app/pwa-driver-access-card";
import { PwaAppHeader } from "@/app/app/pwa-app-header";
import { PwaInstallPanel } from "@/app/app/pwa-install-panel";
import { AppNotificationCenter } from "@/app/app/app-notification-center";
import { PwaSupportButton } from "@/app/app/pwa-support-button";
import { PwaServiceWorkerRegister } from "@/app/app/pwa-service-worker-register";

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
  productVariant: {
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
  default: ({ alt, src, priority, ...props }: ImgHTMLAttributes<HTMLImageElement> & { src: string; priority?: boolean }) => {
    void priority;
    return createElement("img", { alt, src, ...props });
  },
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
  CLIENT_HIDDEN_NOTIFICATION_TYPES: ["DOG_QR_UPDATE"],
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

const lockedAppSourceHashes = {
  "public/sw.js": "717cc08527ad69833b1ff5f1ce7218d9ceb13de0c4f4b10bf124ac0902974d75",
  "src/app/app/app-mobile-nav.tsx": "c8be9d72172dadd1e396be0691dd790c59f9c23c4ee47b00d01243886b2d8937",
  "src/app/app/page.tsx": "8f025806239f8e40dc0aec0e0e587df860ddf9dac5aa2b90738de86014d866a1",
  "src/app/app/pwa-service-worker-register.tsx": "6c7fc913096408b0776cad975038b53afd6b195573d28e3bda12134baa142ed1",
  "src/app/app/pwa-support-button.tsx": "fde89b7ae3b7ce2b114afa234efb469406256eabc4df9bc829ce22abf20215e6",
} as const;

function stableSourceHash(path: string) {
  return createHash("sha256")
    .update(readFileSync(path, "utf8").replace(/\r\n/g, "\n"))
    .digest("hex");
}

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
    prismaMock.productVariant.count.mockResolvedValue(0);
    prismaMock.productVariant.findMany.mockResolvedValue([]);
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

  it("verrouille les sources APP stabilisees", () => {
    const currentHashes = Object.fromEntries(
      Object.keys(lockedAppSourceHashes).map((path) => [path, stableSourceHash(path)]),
    );

    expect(currentHashes).toEqual(lockedAppSourceHashes);
  });

  it("enregistre le service worker sans forcer le reload de l'app", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const waitingPostMessage = vi.fn();
    const registrationAddEventListener = vi.fn();
    const serviceWorkerAddEventListener = vi.fn();
    const serviceWorkerRegister = vi.fn().mockResolvedValue({
      addEventListener: registrationAddEventListener,
      update,
      waiting: { postMessage: waitingPostMessage },
    });

    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        addEventListener: serviceWorkerAddEventListener,
        register: serviceWorkerRegister,
      },
    });

    render(<PwaServiceWorkerRegister />);

    await waitFor(() => expect(serviceWorkerRegister).toHaveBeenCalledWith("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    }));
    expect(update).toHaveBeenCalledTimes(1);
    expect(waitingPostMessage).not.toHaveBeenCalled();
    expect(registrationAddEventListener).not.toHaveBeenCalled();
    expect(serviceWorkerAddEventListener).not.toHaveBeenCalledWith("controllerchange", expect.any(Function));
  });

  it("rend un accueil deconnecte aligne sur la structure connectee", async () => {
    const { default: PwaAppPage } = await import("@/app/app/page");
    const { container } = render(await PwaAppPage());
    const hrefs = Array.from(container.querySelectorAll("a")).map((link) => link.getAttribute("href"));
    const hero = container.querySelector(".pwa-home-hero--guest");
    const css = readFileSync("src/app/globals.css", "utf8");

    expect(screen.getByRole("banner", { name: "En-tete application" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Chez Olive App/ })).toHaveAttribute("href", "/app");
    expect(screen.getByRole("heading", { name: "Bienvenue chez Olive" })).toBeInTheDocument();
    expect(screen.queryByText("Prochaine action")).not.toBeInTheDocument();
    expect(screen.getByText("Commencer")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Magasiner chez Olive" })).toBeInTheDocument();
    expect(container.querySelector(".pwa-home-hero__eyebrow-row")).toBeNull();
    expect(container.querySelector(".pwa-home-hero__image")).toBeNull();
    expect(hero).not.toBeNull();
    expect(css).toContain('url("/images/chez-olive/family-dogs.png")');
    expect(screen.getAllByText("Application client")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Magasiner" })).toHaveAttribute("href", "/boutique");
    expect(screen.getByRole("link", { name: "Me connecter" })).toHaveAttribute("href", "/login");
    expect(screen.getAllByRole("link", { name: "Boutique" }).map((link) => link.getAttribute("href"))).toContain(
      "/boutique",
    );
    expect(screen.getByRole("link", { name: /Mes commandes/ })).toHaveAttribute(
      "href",
      "/login?returnTo=%2Faccount%2Forders",
    );
    expect(screen.getAllByRole("link", { name: /Support/ }).map((link) => link.getAttribute("href"))).toContain(
      "/faq",
    );
    expect(screen.getAllByRole("link", { name: /Compte/ }).map((link) => link.getAttribute("href"))).toContain(
      "/login",
    );
    expect(screen.getAllByText("Connexion").length).toBeLessThanOrEqual(2);
    expect(hrefs).toContain("/faq");
    expect(hrefs).toContain("/login");
    expect(screen.queryByRole("link", { name: /Profil/ })).not.toBeInTheDocument();
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
    prismaMock.supportConversation.count.mockResolvedValue(1);
    prismaMock.order.findFirst.mockResolvedValue({
      orderNumber: "CO-4242",
      status: "PROCESSING",
      totalCents: 4599,
    });

    const { default: PwaAppPage } = await import("@/app/app/page");
    const { container } = render(await PwaAppPage());

    expect(screen.getByRole("heading", { name: "Bonjour, Gary" })).toBeInTheDocument();
    expect(container.querySelector(".pwa-home-hero__eyebrow-row")).toBeNull();
    expect(screen.getByText("Prochaine action")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Commande #CO-4242" })).toBeInTheDocument();
    expect(screen.getByText("En préparation. Voir le suivi.")).toBeInTheDocument();
    expect(container.querySelectorAll(".pwa-next-action-card")).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "À compléter" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Liens rapides" })).not.toBeInTheDocument();
    expect(screen.queryByText("Centre d'actions")).not.toBeInTheDocument();
    expect(screen.getByText("Conversation ouverte ou en attente.")).toBeInTheDocument();
    expect(screen.getByText("À ajouter")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Boutique/ }).map((link) => link.getAttribute("href"))).toContain("/boutique");
    expect(screen.getAllByRole("link", { name: /Commandes/ }).map((link) => link.getAttribute("href"))).toContain("/account/orders");
    expect(screen.getAllByRole("link", { name: /Support/ }).map((link) => link.getAttribute("href"))).toContain("/account/support");
    expect(screen.getByRole("button", { name: /Support/ })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Profil/ }).map((link) => link.getAttribute("href"))).toContain("/account/profile");
    expect(screen.queryByRole("heading", { name: "Resume utile" })).not.toBeInTheDocument();
    expect(screen.queryByText(/A surveiller|À surveiller|Worth checking|Plus dans l'app|More in the app/)).not.toBeInTheDocument();
    expect(screen.queryByText("Commande active")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Tout pour ton compte" })).not.toBeInTheDocument();
    expect(screen.queryByText("Panier en cours")).not.toBeInTheDocument();
    expect(screen.queryByText(/45,99/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Chiens QR/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/QR/)).not.toBeInTheDocument();
    expect(container.querySelector('a[href="/account/dogs"]')).toBeNull();
    expect(prismaMock.dogProfile.count).not.toHaveBeenCalled();
    expect(listAppNotificationsForUserMock).not.toHaveBeenCalled();
    expect(getAppNotificationPreferencesMock).toHaveBeenCalledWith("user_1");
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
    expect(screen.queryByText("Chiens QR")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Actualiser" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tester une notification" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Commande confirmee/ })).toHaveAttribute(
      "href",
      "/account/orders/order_1",
    );
    expect(screen.getByRole("button", { name: "Activer les alertes utiles" })).toBeDisabled();
  });

  it("masque les notifications QR du centre d'actions client", () => {
    render(
      <AppNotificationCenter
        language="fr"
        publicKey=""
        userRole="CUSTOMER"
        initialNotifications={[
          {
            id: "notif_qr",
            type: "DOG_QR_UPDATE",
            audience: "CUSTOMER",
            title: "Profil QR consulté",
            body: "Olive vient d'être consultée depuis son médaillon.",
            href: "/account/dogs",
            readAt: null,
            createdAt: "2026-05-03T16:00:00.000Z",
          },
          {
            id: "notif_order",
            type: "ORDER_UPDATE",
            audience: "CUSTOMER",
            title: "Commande confirmee",
            body: "Ta commande est bien creee.",
            href: "/account/orders/order_1",
            readAt: null,
            createdAt: "2026-05-03T16:01:00.000Z",
          },
        ]}
        initialUnreadCount={2}
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

    expect(screen.getByText("1 non lue(s)")).toBeInTheDocument();
    expect(screen.queryByText("Profil QR consulté")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Profil QR/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Commande confirmee/ })).toHaveAttribute(
      "href",
      "/account/orders/order_1",
    );
  });

  it("masque le panneau d'installation PWA en mode Capacitor natif", async () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);

    const { container } = render(<PwaInstallPanel language="fr" />);

    await waitFor(() => expect(container.querySelector(".pwa-install-panel")).toBeNull());
  });

  it("active les alertes natives Capacitor via les preferences existantes", async () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    const fetchMock = vi.fn(async () =>
      Response.json({
        preferences: {
          pushEnabled: true,
          orderUpdates: true,
          deliveryUpdates: true,
          supportUpdates: true,
          dogQrUpdates: true,
          adminAlerts: true,
          driverRunUpdates: true,
        },
      }),
    );
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

    const button = screen.getByRole("button", { name: "Activer les alertes utiles" });
    expect(button).not.toBeDisabled();
    fireEvent.click(button);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/notifications/preferences",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ pushEnabled: true }),
      }),
    ));
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

  it("ne rend plus de cockpit admin dans l'accueil client", async () => {
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

    expect(container.querySelector(".pwa-admin-lite")).toBeNull();
    expect(screen.queryByText("Admin quotidien")).not.toBeInTheDocument();
    expect(screen.queryByText("Prochaine #CO-9001 - Client Admin.")).not.toBeInTheDocument();
    expect(screen.queryByText(/#CO-9002/)).not.toBeInTheDocument();
    expect(screen.queryByText("Client Support - attend une reponse.")).not.toBeInTheDocument();
    expect(screen.queryByText("2026-05-03 - en cours - 7 arrets")).not.toBeInTheDocument();
    expect(screen.queryByText("Collier test - 2 en stock.")).not.toBeInTheDocument();
    expect(hrefs).toContain("/admin");
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
    await screen.findByRole("heading", { name: /Mode app activ/i });
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
