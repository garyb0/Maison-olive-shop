import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentLanguage } from "@/lib/language";
import { getOwnerTodaySnapshot } from "@/lib/owner-dashboard";
import {
  getAppNotificationPreferences,
  getWebPushPublicKey,
  listAppNotificationsForUser,
  type AppNotificationDTO,
  type AppNotificationPreferencesDTO,
} from "@/lib/app-notifications";
import { prisma } from "@/lib/prisma";
import { AppMobileNav } from "./app-mobile-nav";
import { PwaAppHeader } from "./pwa-app-header";
import { AppNotificationCenter } from "./app-notification-center";
import { PwaDriverAccessCard } from "./pwa-driver-access-card";
import { PwaInstallPanel } from "./pwa-install-panel";
import { PwaServiceWorkerRegister } from "./pwa-service-worker-register";
import { NativeAppRuntime } from "./native-app-runtime";
import { CartResumeBanner } from "./cart-resume-banner";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";
import { NavIcon } from "@/components/NavIcon";
import { isGoogleOAuthConfigured } from "@/lib/google-oauth";
import type { NavigationIconKey } from "@/lib/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Application",
  description: "Point d'entree mobile pour Chez Olive.",
  alternates: {
    canonical: "/app",
  },
};

type HubLink = {
  href: string;
  eyebrow: string;
  title: string;
  text: string;
};

type PremiumAction = {
  href: string;
  icon: NavigationIconKey;
  title: string;
  text: string;
  meta: string;
};

type CustomerSnapshot = {
  orderCount: number;
  dogCount: number;
  dogWithoutPhoneCount: number;
  deliveryAddressCount: number;
  activeSupportCount: number;
  latestOrder: {
    orderNumber: string;
    status: string;
    totalCents: number;
  } | null;
};

type NotificationSnapshot = {
  notifications: AppNotificationDTO[];
  unreadCount: number;
  preferences: AppNotificationPreferencesDTO;
};

type AdminSnapshot = {
  todayOrderCount: number;
  ordersToPrepareCount: number;
  deliveryOrderCount: number;
  waitingSupportCount: number;
  activeRunCount: number;
  todaySalesCents: number;
  outOfStockCount: number;
  lowStockCount: number;
  backupStatus: "ok" | "warn" | "unknown";
  backupAgeHours: number | null;
  latestRun: {
    dateKey: string;
    status: string;
    stopCount: number;
  } | null;
  nextOrder: {
    orderNumber: string;
    customerName: string;
  } | null;
  nextDelivery: {
    orderNumber: string;
    customerName: string;
    city: string | null;
    status: string;
  } | null;
  nextSupport: {
    customerName: string;
    status: string;
  } | null;
  criticalProduct: {
    nameFr: string;
    nameEn: string;
    stock: number;
  } | null;
};

function HubCard({ item }: { item: HubLink }) {
  return (
    <Link className="pwa-hub-card" href={item.href}>
      <span>{item.eyebrow}</span>
      <strong>{item.title}</strong>
      <p>{item.text}</p>
    </Link>
  );
}

function PremiumActionCard({ item }: { item: PremiumAction }) {
  return (
    <Link className="pwa-premium-action-card" href={item.href}>
      <span className="pwa-premium-action-icon">
        <NavIcon name={item.icon} size={20} />
      </span>
      <span className="pwa-premium-action-copy">
        <strong>{item.title}</strong>
        <small>{item.text}</small>
      </span>
      <em>{item.meta}</em>
    </Link>
  );
}

function StatCard({
  href,
  label,
  value,
  help,
}: {
  href?: string;
  label: string;
  value: string;
  help: string;
}) {
  const content = (
    <>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{help}</p>
    </>
  );

  if (href) {
    return (
      <Link className="pwa-stat-card" href={href}>
        {content}
      </Link>
    );
  }

  return <div className="pwa-stat-card">{content}</div>;
}

function formatCurrency(cents: number, language: "fr" | "en") {
  return new Intl.NumberFormat(language === "fr" ? "fr-CA" : "en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(cents / 100);
}

function orderStatusLabel(status: string, language: "fr" | "en") {
  const fr: Record<string, string> = {
    PENDING: "en attente",
    PAID: "payée",
    PROCESSING: "en préparation",
    SHIPPED: "expédiée",
    DELIVERED: "livrée",
    CANCELLED: "annulée",
  };
  const en: Record<string, string> = {
    PENDING: "pending",
    PAID: "paid",
    PROCESSING: "processing",
    SHIPPED: "shipped",
    DELIVERED: "delivered",
    CANCELLED: "cancelled",
  };
  return (language === "fr" ? fr : en)[status] ?? status.toLowerCase();
}

function runStatusLabel(status: string, language: "fr" | "en") {
  const fr: Record<string, string> = {
    DRAFT: "brouillon",
    PUBLISHED: "publiée",
    IN_PROGRESS: "en cours",
    COMPLETED: "terminée",
    CANCELLED: "annulée",
  };
  const en: Record<string, string> = {
    DRAFT: "draft",
    PUBLISHED: "published",
    IN_PROGRESS: "in progress",
    COMPLETED: "completed",
    CANCELLED: "cancelled",
  };
  return (language === "fr" ? fr : en)[status] ?? status.toLowerCase();
}

function deliveryStatusLabel(status: string, language: "fr" | "en") {
  const fr: Record<string, string> = {
    SCHEDULED: "planifiée",
    OUT_FOR_DELIVERY: "sur la route",
    DELIVERED: "livrée",
    FAILED: "échec",
    RESCHEDULED: "à replanifier",
  };
  const en: Record<string, string> = {
    SCHEDULED: "scheduled",
    OUT_FOR_DELIVERY: "out for delivery",
    DELIVERED: "delivered",
    FAILED: "failed",
    RESCHEDULED: "rescheduled",
  };
  return (language === "fr" ? fr : en)[status] ?? status.toLowerCase();
}

function supportStatusLabel(status: string, language: "fr" | "en") {
  const fr: Record<string, string> = {
    WAITING: "attend une reponse",
    OPEN: "ouverte",
    ASSIGNED: "assignee",
    CLOSED: "fermee",
  };
  const en: Record<string, string> = {
    WAITING: "waiting",
    OPEN: "open",
    ASSIGNED: "assigned",
    CLOSED: "closed",
  };
  return (language === "fr" ? fr : en)[status] ?? status.toLowerCase();
}

async function getCustomerSnapshot(user?: { id: string }): Promise<CustomerSnapshot | null> {
  if (!user?.id) return null;

  try {
    const [orderCount, dogCount, dogWithoutPhoneCount, deliveryAddressCount, activeSupportCount, latestOrder] = await Promise.all([
      prisma.order.count({ where: { userId: user.id } }),
      prisma.dogProfile.count({ where: { userId: user.id, isActive: true } }),
      prisma.dogProfile.count({
        where: {
          userId: user.id,
          isActive: true,
          OR: [{ ownerPhone: null }, { ownerPhone: "" }],
        },
      }),
      prisma.userDeliveryAddress.count({ where: { userId: user.id } }),
      prisma.supportConversation.count({
        where: {
          customerUserId: user.id,
          status: { in: ["WAITING", "OPEN", "ASSIGNED"] },
        },
      }),
      prisma.order.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        select: {
          orderNumber: true,
          status: true,
          totalCents: true,
        },
      }),
    ]);

    return { orderCount, dogCount, dogWithoutPhoneCount, deliveryAddressCount, activeSupportCount, latestOrder };
  } catch (error) {
    console.error("Unable to load PWA customer snapshot", error);
    return null;
  }
}

async function getNotificationSnapshot(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>): Promise<NotificationSnapshot> {
  const [notificationResult, preferences] = await Promise.all([
    listAppNotificationsForUser(user, 8).catch(() => ({ notifications: [], unreadCount: 0 })),
    getAppNotificationPreferences(user.id),
  ]);

  return {
    notifications: notificationResult.notifications,
    unreadCount: notificationResult.unreadCount,
    preferences,
  };
}

async function getAdminSnapshot(): Promise<AdminSnapshot | null> {
  try {
    const ownerSnapshot = await getOwnerTodaySnapshot();
    const latestRun = ownerSnapshot.activeRuns[0] ?? null;
    const nextOrder = ownerSnapshot.ordersToPrepare[0] ?? null;
    const nextDelivery = ownerSnapshot.deliveryOrders[0] ?? null;
    const nextSupport = ownerSnapshot.supportQueue[0] ?? null;
    const criticalProduct = ownerSnapshot.outOfStockProducts[0] ?? ownerSnapshot.lowStockProducts[0] ?? null;

    return {
      todayOrderCount: ownerSnapshot.todayOrderCount,
      ordersToPrepareCount: ownerSnapshot.ordersToPrepareCount,
      deliveryOrderCount: ownerSnapshot.deliveryOrderCount,
      waitingSupportCount: ownerSnapshot.openSupportCount,
      activeRunCount: ownerSnapshot.activeRunCount,
      todaySalesCents: ownerSnapshot.todaySalesCents,
      outOfStockCount: ownerSnapshot.outOfStockCount,
      lowStockCount: ownerSnapshot.lowStockCount,
      backupStatus: ownerSnapshot.backup.status,
      backupAgeHours: ownerSnapshot.backup.ageHours,
      latestRun: latestRun
        ? {
            dateKey: latestRun.dateKey,
            status: latestRun.status,
            stopCount: latestRun.stopCount,
          }
        : null,
      nextOrder: nextOrder
        ? {
            orderNumber: nextOrder.orderNumber,
            customerName: nextOrder.customerName,
          }
        : null,
      nextDelivery: nextDelivery
        ? {
            orderNumber: nextDelivery.orderNumber,
            customerName: nextDelivery.customerName,
            city: nextDelivery.shippingCity,
            status: nextDelivery.deliveryStatus,
          }
        : null,
      nextSupport: nextSupport
        ? {
            customerName: nextSupport.customerName || nextSupport.customerEmail,
            status: nextSupport.status,
          }
        : null,
      criticalProduct: criticalProduct
        ? {
            nameFr: criticalProduct.nameFr,
            nameEn: criticalProduct.nameEn,
            stock: criticalProduct.stock,
          }
        : null,
    };
  } catch (error) {
    console.error("Unable to load PWA admin snapshot", error);
    return null;
  }
}

export default async function PwaAppPage() {
  const [language, user] = await Promise.all([getCurrentLanguage(), getCurrentUser()]);
  const googleOAuthEnabled = isGoogleOAuthConfigured();
  const [customerSnapshot, adminSnapshot, notificationSnapshot] = await Promise.all([
    getCustomerSnapshot(user ?? undefined),
    user?.role === "ADMIN" ? getAdminSnapshot() : Promise.resolve(null),
    user ? getNotificationSnapshot(user) : Promise.resolve(null),
  ]);
  const webPushPublicKey = getWebPushPublicKey();
  const latestOrder = customerSnapshot?.latestOrder ?? null;
  const latestOrderText = latestOrder
    ? `${orderStatusLabel(latestOrder.status, language)} - ${formatCurrency(latestOrder.totalCents, language)}`
    : language === "fr"
      ? "Aucune commande active"
      : "No active order";

  const primaryAction: PremiumAction = latestOrder
    ? {
        href: "/account/orders",
        icon: "orders",
        title: language === "fr" ? `Commande #${latestOrder.orderNumber}` : `Order #${latestOrder.orderNumber}`,
        text: latestOrderText,
        meta: language === "fr" ? "Suivre" : "Track",
      }
    : user
      ? {
          href: "/boutique",
          icon: "catalog",
          title: language === "fr" ? "Preparer une commande locale" : "Prepare a local order",
          text: language === "fr" ? "Boutique, panier et livraison Rimouski." : "Shop, cart, and Rimouski delivery.",
          meta: language === "fr" ? "Magasiner" : "Shop",
        }
      : {
          href: "/login",
          icon: "profile",
          title: language === "fr" ? "Retrouver mon espace client" : "Open my customer space",
          text: language === "fr" ? "Commandes, profils chiens QR et support." : "Orders, QR dog profiles, and support.",
          meta: language === "fr" ? "Connexion" : "Sign in",
        };

  const coreActions: PremiumAction[] = [
    {
      href: "/boutique",
      icon: "catalog",
      title: language === "fr" ? "Boutique" : "Shop",
      text: language === "fr" ? "Recherche, categories et produits disponibles." : "Search, categories, and available products.",
      meta: language === "fr" ? "Achat rapide" : "Quick buy",
    },
    {
      href: user ? "/account/orders" : "/login",
      icon: "orders",
      title: language === "fr" ? "Commandes" : "Orders",
      text: latestOrder
        ? latestOrderText
        : language === "fr"
          ? "Historique, statuts et suivi."
          : "History, statuses, and tracking.",
      meta: user ? (language === "fr" ? "Voir" : "Open") : (language === "fr" ? "Connexion" : "Sign in"),
    },
    {
      href: user ? "/account/support" : "/faq",
      icon: "support",
      title: "Support",
      text: language === "fr" ? "Question, livraison ou aide apres achat." : "Questions, delivery, or after-sale help.",
      meta: language === "fr" ? "Aide" : "Help",
    },
    {
      href: user ? "/account/dogs" : "/login",
      icon: "dog",
      title: language === "fr" ? "Chiens QR" : "QR dogs",
      text: language === "fr" ? "Profils utiles pour les colliers QR." : "Useful profiles for QR collars.",
      meta: user ? "QR" : (language === "fr" ? "Compte" : "Account"),
    },
  ];

  const secondaryActions: PremiumAction[] = [
    {
      href: "/cart",
      icon: "cart",
      title: language === "fr" ? "Panier" : "Cart",
      text: language === "fr" ? "Revoir les articles avant le paiement." : "Review items before payment.",
      meta: language === "fr" ? "Verifier" : "Review",
    },
    {
      href: user ? "/account/profile" : "/login",
      icon: "security",
      title: language === "fr" ? "Profil et securite" : "Profile and security",
      text: language === "fr" ? "Adresses, sessions et preferences." : "Addresses, sessions, and preferences.",
      meta: language === "fr" ? "Gerer" : "Manage",
    },
    {
      href: "/faq",
      icon: "support",
      title: language === "fr" ? "Centre d'aide" : "Help center",
      text: language === "fr" ? "Livraison, retours, paiement et support." : "Delivery, returns, payment, and support.",
      meta: "FAQ",
    },
  ];

  const notificationSummary = notificationSnapshot
    ? notificationSnapshot.unreadCount > 0
      ? language === "fr"
        ? `${notificationSnapshot.unreadCount} alerte(s) a lire`
        : `${notificationSnapshot.unreadCount} alert(s) to read`
      : notificationSnapshot.preferences.pushEnabled
        ? language === "fr"
          ? "Alertes push actives"
          : "Push alerts active"
        : language === "fr"
          ? "Alertes visibles dans l'app"
          : "Alerts visible in app"
    : language === "fr"
      ? "Installation, profil et options"
      : "Install, profile, and options";

  const accountSignals: Array<{ href: string; label: string; value: string; help: string }> = [];
  if (latestOrder) {
    accountSignals.push({
      href: "/account/orders",
      label: language === "fr" ? "Commande active" : "Active order",
      value: `#${latestOrder.orderNumber}`,
      help: latestOrderText,
    });
  }
  if ((customerSnapshot?.dogWithoutPhoneCount ?? 0) > 0) {
    accountSignals.push({
      href: "/account/dogs",
      label: language === "fr" ? "Chiens QR" : "QR dogs",
      value: String(customerSnapshot?.dogWithoutPhoneCount ?? 0),
      help: language === "fr" ? "Profil(s) sans telephone." : "Profile(s) missing phone.",
    });
  }
  if ((customerSnapshot?.activeSupportCount ?? 0) > 0) {
    accountSignals.push({
      href: "/account/support",
      label: "Support",
      value: String(customerSnapshot?.activeSupportCount ?? 0),
      help: language === "fr" ? "Conversation ouverte ou en attente." : "Open or waiting conversation.",
    });
  }
  if (customerSnapshot && customerSnapshot.deliveryAddressCount === 0) {
    accountSignals.push({
      href: "/account/profile",
      label: language === "fr" ? "Adresse" : "Address",
      value: language === "fr" ? "A ajouter" : "To add",
      help: language === "fr" ? "Utile pour accelerer le checkout." : "Helps speed up checkout.",
    });
  }

  const accountNeedsAttention = accountSignals.length > 0;

  const adminLinks: HubLink[] = [
    {
      href: "/admin/orders",
      eyebrow: "Admin",
      title: language === "fr" ? "Commandes" : "Orders",
      text: language === "fr" ? "Voir les commandes et statuts importants." : "Review orders and important statuses.",
    },
    {
      href: "/admin/delivery",
      eyebrow: language === "fr" ? "Livraison" : "Delivery",
      title: language === "fr" ? "Planification" : "Planning",
      text: language === "fr" ? "Surveiller les slots et la capacite." : "Monitor slots and capacity.",
    },
    {
      href: "/admin/delivery/runs",
      eyebrow: language === "fr" ? "Terrain" : "Field",
      title: language === "fr" ? "Tournees" : "Runs",
      text: language === "fr" ? "Suivre les tournées chauffeur." : "Track driver runs.",
    },
    {
      href: "/admin/support",
      eyebrow: "Support",
      title: language === "fr" ? "Conversations" : "Conversations",
      text: language === "fr" ? "Repondre aux clients rapidement." : "Reply to customers quickly.",
    },
  ];

  return (
    <div className="app-shell pwa-app-shell">
      <PwaServiceWorkerRegister />
      <NativeAppRuntime nativePushEnabled={notificationSnapshot?.preferences.pushEnabled ?? false} />
      <PwaAppHeader language={language} userRole={user?.role ?? null} />

      <main className="pwa-hub" aria-labelledby="pwa-hub-title">
        <section className="pwa-hero pwa-home-hero pwa-home-hero--compact">
          <div className="pwa-home-hero__copy">
            <div className="pwa-home-hero__eyebrow-row">
              <p className="pwa-kicker">{language === "fr" ? "Application client" : "Customer app"}</p>
              <span>{language === "fr" ? "Rimouski" : "Local"}</span>
            </div>
            <h1 id="pwa-hub-title">
              {user
                ? language === "fr"
                  ? `Bonjour, ${user.firstName || "ami"}`
                  : `Hi, ${user.firstName || "friend"}`
                : language === "fr"
                  ? "Bienvenue"
                  : "Welcome"}
            </h1>
            <p>
              {user
                ? language === "fr"
                  ? "Les actions utiles d'abord; le reste reste disponible dans Plus."
                  : "Useful actions first; everything else stays under More."
                : language === "fr"
                  ? "Boutique locale, commandes, profils QR et support dans un seul espace."
                  : "Local shop, orders, QR profiles, and support in one place."}
            </p>
          </div>
          {!user ? (
            <div className="pwa-hero-actions">
              <Link className="btn" href="/boutique">
                {language === "fr" ? "Boutique" : "Shop"}
              </Link>
              {googleOAuthEnabled ? (
                <GoogleAuthButton language={language} returnTo="/app" />
              ) : (
                <Link className="btn btn-secondary" href="/login">
                  {language === "fr" ? "Connexion" : "Sign in"}
                </Link>
              )}
            </div>
          ) : null}
        </section>

        <section
          className="pwa-premium-dashboard pwa-premium-dashboard--focused"
          aria-label={language === "fr" ? "Tableau de bord client" : "Customer dashboard"}
        >
          <div className="pwa-next-action-card">
            <div className="pwa-next-action-copy">
              <p className="pwa-kicker">{language === "fr" ? "Prochaine action" : "Next action"}</p>
              <h2>{primaryAction.title}</h2>
              <p>{primaryAction.text}</p>
            </div>
            <Link className="btn" href={primaryAction.href}>
              <NavIcon name={primaryAction.icon} size={18} />
              {primaryAction.meta}
            </Link>
          </div>

          <div className="pwa-premium-action-grid pwa-core-action-grid">
            {coreActions.map((item) => <PremiumActionCard item={item} key={`${item.href}-${item.title}`} />)}
          </div>
        </section>

        <CartResumeBanner language={language} />

        {user && accountNeedsAttention ? (
          <section className="pwa-hub-section pwa-account-snapshot pwa-account-snapshot--compact" aria-label={language === "fr" ? "Resume du compte" : "Account summary"}>
            <div className="pwa-section-head">
              <div>
                <p className="pwa-kicker">{language === "fr" ? "A surveiller" : "Worth checking"}</p>
                <h2>{language === "fr" ? "Resume utile" : "Useful summary"}</h2>
              </div>
            </div>
            <div className="pwa-stat-grid">
              {accountSignals.map((signal) => (
                <StatCard
                  href={signal.href}
                  label={signal.label}
                  value={signal.value}
                  help={signal.help}
                  key={`${signal.href}-${signal.label}`}
                />
              ))}
            </div>
          </section>
        ) : null}

        <section className="pwa-hub-section pwa-more-section" aria-label={language === "fr" ? "Options secondaires" : "Secondary options"}>
          <details className="pwa-more-panel">
            <summary>
              <span className="pwa-more-panel__title">{language === "fr" ? "Plus dans l'app" : "More in the app"}</span>
              <span className="pwa-more-panel__meta">{notificationSummary}</span>
            </summary>
            <div className="pwa-more-content">
              <div className="pwa-secondary-action-grid">
                {secondaryActions.map((item) => <PremiumActionCard item={item} key={`${item.href}-${item.title}`} />)}
              </div>

              {user && notificationSnapshot ? (
                <AppNotificationCenter
                  language={language}
                  publicKey={webPushPublicKey}
                  userRole={user.role}
                  initialNotifications={notificationSnapshot.notifications}
                  initialUnreadCount={notificationSnapshot.unreadCount}
                  initialPreferences={notificationSnapshot.preferences}
                />
              ) : null}

              <PwaInstallPanel language={language} />
              <PwaDriverAccessCard language={language} />
            </div>
          </details>
        </section>

        {user?.role === "ADMIN" ? (
          <section className="pwa-hub-section pwa-admin-lite">
            <div className="pwa-section-head">
              <div>
                <p className="pwa-kicker">{language === "fr" ? "Equipe" : "Team"}</p>
                <h2>{language === "fr" ? "Admin quotidien" : "Daily admin"}</h2>
              </div>
              <Link className="btn btn-secondary" href="/admin">
                {language === "fr" ? "Admin complet" : "Full admin"}
              </Link>
            </div>
            <div className="pwa-stat-grid pwa-admin-stats">
              <StatCard
                href="/admin/orders"
                label={language === "fr" ? "A preparer" : "To prepare"}
                value={String(adminSnapshot?.ordersToPrepareCount ?? 0)}
                help={
                  adminSnapshot?.nextOrder
                    ? language === "fr"
                      ? `Prochaine #${adminSnapshot.nextOrder.orderNumber} - ${adminSnapshot.nextOrder.customerName}.`
                      : `Next #${adminSnapshot.nextOrder.orderNumber} - ${adminSnapshot.nextOrder.customerName}.`
                    : language === "fr"
                      ? `${formatCurrency(adminSnapshot?.todaySalesCents ?? 0, language)} aujourd'hui; rien en attente.`
                      : `${formatCurrency(adminSnapshot?.todaySalesCents ?? 0, language)} today; nothing waiting.`
                }
              />
              <StatCard
                href="/admin/delivery"
                label={language === "fr" ? "Livraison" : "Delivery"}
                value={String(adminSnapshot?.deliveryOrderCount ?? 0)}
                help={
                  adminSnapshot?.nextDelivery
                    ? language === "fr"
                      ? `#${adminSnapshot.nextDelivery.orderNumber} - ${adminSnapshot.nextDelivery.city ?? adminSnapshot.nextDelivery.customerName} - ${deliveryStatusLabel(adminSnapshot.nextDelivery.status, language)}.`
                      : `#${adminSnapshot.nextDelivery.orderNumber} - ${adminSnapshot.nextDelivery.city ?? adminSnapshot.nextDelivery.customerName} - ${deliveryStatusLabel(adminSnapshot.nextDelivery.status, language)}.`
                    : language === "fr"
                      ? "Aucune livraison active."
                      : "No active delivery."
                }
              />
              <StatCard
                href="/admin/support"
                label="Support"
                value={String(adminSnapshot?.waitingSupportCount ?? 0)}
                help={
                  adminSnapshot?.nextSupport
                    ? language === "fr"
                      ? `${adminSnapshot.nextSupport.customerName} - ${supportStatusLabel(adminSnapshot.nextSupport.status, language)}.`
                      : `${adminSnapshot.nextSupport.customerName} - ${supportStatusLabel(adminSnapshot.nextSupport.status, language)}.`
                    : language === "fr"
                      ? "Aucune conversation active."
                      : "No active conversation."
                }
              />
              <StatCard
                href="/admin/delivery/runs"
                label={language === "fr" ? "Tournees" : "Runs"}
                value={String(adminSnapshot?.activeRunCount ?? 0)}
                help={
                  adminSnapshot?.latestRun
                    ? language === "fr"
                      ? `${adminSnapshot.latestRun.dateKey} - ${runStatusLabel(adminSnapshot.latestRun.status, language)} - ${adminSnapshot.latestRun.stopCount} arrets`
                      : `${adminSnapshot.latestRun.dateKey} - ${runStatusLabel(adminSnapshot.latestRun.status, language)} - ${adminSnapshot.latestRun.stopCount} stops`
                    : language === "fr"
                      ? "Aucune tournée active."
                      : "No active run."
                }
              />
              <StatCard
                href="/admin/products"
                label={language === "fr" ? "Stock critique" : "Critical stock"}
                value={
                  (adminSnapshot?.outOfStockCount ?? 0) > 0
                    ? `${adminSnapshot?.outOfStockCount ?? 0}/${adminSnapshot?.lowStockCount ?? 0}`
                    : String(adminSnapshot?.lowStockCount ?? 0)
                }
                help={
                  adminSnapshot?.criticalProduct
                    ? language === "fr"
                      ? `${adminSnapshot.criticalProduct.nameFr} - ${adminSnapshot.criticalProduct.stock} en stock.`
                      : `${adminSnapshot.criticalProduct.nameEn} - ${adminSnapshot.criticalProduct.stock} in stock.`
                    : language === "fr"
                      ? "Aucun produit critique."
                      : "No critical product."
                }
              />
              <StatCard
                label="Backup"
                value={
                  adminSnapshot?.backupAgeHours == null
                    ? "-"
                    : adminSnapshot.backupAgeHours < 1
                      ? "<1h"
                      : `${adminSnapshot.backupAgeHours.toFixed(1)}h`
                }
                help={
                  adminSnapshot?.backupStatus === "ok"
                    ? language === "fr" ? "Backup recent." : "Recent backup."
                    : language === "fr" ? "Verifier npm run ops:status." : "Check npm run ops:status."
                }
              />
            </div>
            <div className="pwa-hub-grid pwa-hub-grid--admin">
              {adminLinks.map((item) => <HubCard key={item.href} item={item} />)}
            </div>
          </section>
        ) : null}
      </main>
      <AppMobileNav language={language} userRole={user?.role ?? null} />
    </div>
  );
}
