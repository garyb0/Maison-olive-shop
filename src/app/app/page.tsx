import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentLanguage } from "@/lib/language";
import {
  getAppNotificationPreferences,
  type AppNotificationPreferencesDTO,
} from "@/lib/app-notifications";
import { prisma } from "@/lib/prisma";
import { AppMobileNav } from "./app-mobile-nav";
import { PwaAppHeader } from "./pwa-app-header";
import { PwaSupportActionCard } from "./pwa-support-button";
import { PwaServiceWorkerRegister } from "./pwa-service-worker-register";
import { NativeAppRuntime } from "./native-app-runtime";
import { CartResumeBanner } from "./cart-resume-banner";
import { NavIcon } from "@/components/NavIcon";
import type { NavigationIconKey } from "@/lib/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Application",
  description: "Point d'entrée mobile pour Chez Olive.",
  alternates: {
    canonical: "/app",
  },
};

type PremiumAction = {
  href: string;
  icon: NavigationIconKey;
  title: string;
  text: string;
  meta: string;
  opensSupport?: boolean;
};

type CustomerSnapshot = {
  deliveryAddressCount: number;
  activeSupportCount: number;
  latestOrder: {
    orderNumber: string;
    status: string;
  } | null;
};

type NotificationSnapshot = {
  preferences: AppNotificationPreferencesDTO;
};

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
  href: string;
  label: string;
  value: string;
  help: string;
}) {
  return (
    <Link className="pwa-stat-card" href={href}>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{help}</p>
    </Link>
  );
}

function orderStatusLabel(status: string, language: "fr" | "en") {
  const fr: Record<string, string> = {
    PENDING: "En attente",
    PAID: "Payée",
    PROCESSING: "En préparation",
    SHIPPED: "Expédiée",
    DELIVERED: "Livrée",
    CANCELLED: "Annulée",
  };
  const en: Record<string, string> = {
    PENDING: "Pending",
    PAID: "Paid",
    PROCESSING: "Processing",
    SHIPPED: "Shipped",
    DELIVERED: "Delivered",
    CANCELLED: "Cancelled",
  };
  return (language === "fr" ? fr : en)[status] ?? status.toLowerCase();
}

function getLoginHrefForReturnTo(returnTo: string) {
  return `/login?returnTo=${encodeURIComponent(returnTo)}`;
}

async function getCustomerSnapshot(user?: { id: string }): Promise<CustomerSnapshot | null> {
  if (!user?.id) return null;

  try {
    const [deliveryAddressCount, activeSupportCount, latestOrder] = await Promise.all([
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
        },
      }),
    ]);

    return { deliveryAddressCount, activeSupportCount, latestOrder };
  } catch (error) {
    console.error("Unable to load PWA customer snapshot", error);
    return null;
  }
}

async function getNotificationSnapshot(
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>,
): Promise<NotificationSnapshot> {
  return {
    preferences: await getAppNotificationPreferences(user.id),
  };
}

export default async function PwaAppPage() {
  const [language, user] = await Promise.all([getCurrentLanguage(), getCurrentUser()]);
  const [customerSnapshot, notificationSnapshot] = await Promise.all([
    getCustomerSnapshot(user ?? undefined),
    user ? getNotificationSnapshot(user) : Promise.resolve(null),
  ]);
  const latestOrder = customerSnapshot?.latestOrder ?? null;
  const latestOrderText = latestOrder
    ? language === "fr"
      ? `${orderStatusLabel(latestOrder.status, language)}. Voir le suivi.`
      : `${orderStatusLabel(latestOrder.status, language)}. View tracking.`
    : language === "fr"
      ? "Aucune commande active"
      : "No active order";

  const primaryAction: PremiumAction | null = latestOrder
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
          title: language === "fr" ? "Préparer une commande" : "Prepare an order",
          text: language === "fr" ? "Boutique locale et livraison à domicile." : "Local shop and home delivery.",
          meta: language === "fr" ? "Magasiner" : "Shop",
        }
      : {
          href: "/boutique",
          icon: "catalog",
          title: language === "fr" ? "Magasiner chez Olive" : "Shop Chez Olive",
          text: language === "fr" ? "Découvre la boutique locale et la livraison à Rimouski." : "Browse the local shop and Rimouski delivery.",
          meta: language === "fr" ? "Magasiner" : "Shop",
        };

  const customerActions: PremiumAction[] = [
    {
      href: "/boutique",
      icon: "catalog",
      title: language === "fr" ? "Boutique" : "Shop",
      text: language === "fr" ? "Produits disponibles et recherche." : "Available products and search.",
      meta: language === "fr" ? "Magasiner" : "Shop",
    },
    {
      href: user ? "/account/orders" : "/login",
      icon: "orders",
      title: language === "fr" ? "Commandes" : "Orders",
      text: language === "fr" ? "Historique, statuts et suivi." : "History, statuses, and tracking.",
      meta: user ? (language === "fr" ? "Voir" : "Open") : (language === "fr" ? "Connexion" : "Sign in"),
    },
    {
      href: user ? "/account/support" : "/faq",
      icon: "support",
      title: "Support",
      text: language === "fr" ? "Aide après achat ou livraison." : "After-sale or delivery help.",
      meta: language === "fr" ? "Aide" : "Help",
      opensSupport: Boolean(user),
    },
    {
      href: user ? "/account/profile" : "/login",
      icon: "profile",
      title: language === "fr" ? "Profil" : "Profile",
      text: language === "fr" ? "Coordonnées, adresse et sécurité." : "Contact, address, and security.",
      meta: language === "fr" ? "Gérer" : "Manage",
    },
  ];

  const guestActions: PremiumAction[] = [
    {
      href: "/boutique",
      icon: "catalog",
      title: language === "fr" ? "Boutique" : "Shop",
      text: language === "fr" ? "Voir les produits disponibles." : "Browse available products.",
      meta: language === "fr" ? "Magasiner" : "Shop",
    },
    {
      href: getLoginHrefForReturnTo("/account/orders"),
      icon: "orders",
      title: language === "fr" ? "Mes commandes" : "My orders",
      text: language === "fr" ? "Suivre une commande existante." : "Track an existing order.",
      meta: language === "fr" ? "Suivi" : "Track",
    },
    {
      href: "/faq",
      icon: "support",
      title: "Support",
      text: language === "fr" ? "Livraison, paiement et support." : "Delivery, payment, and support.",
      meta: "FAQ",
    },
    {
      href: "/login",
      icon: "profile",
      title: language === "fr" ? "Compte" : "Account",
      text: language === "fr" ? "Connecte-toi à ton espace." : "Sign in to your space.",
      meta: language === "fr" ? "Connexion" : "Sign in",
    },
  ];

  const visibleActions = user ? customerActions : guestActions;
  const accountSignals: Array<{ href: string; label: string; value: string; help: string }> = [];
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
      value: language === "fr" ? "À ajouter" : "To add",
      help: language === "fr" ? "Utile pour accélérer la commande." : "Helps speed up checkout.",
    });
  }

  const accountNeedsAttention = accountSignals.length > 0;

  return (
    <div className="app-shell pwa-app-shell">
      <PwaServiceWorkerRegister />
      <NativeAppRuntime nativePushEnabled={notificationSnapshot?.preferences.pushEnabled ?? false} />
      <PwaAppHeader language={language} userRole={user?.role ?? null} />

      <main className="pwa-hub" aria-labelledby="pwa-hub-title">
        <section className={`pwa-hero pwa-home-hero pwa-home-hero--compact${user ? "" : " pwa-home-hero--guest"}`}>
          <div className="pwa-home-hero__copy">
            <h1 id="pwa-hub-title">
              {user
                ? language === "fr"
                  ? `Bonjour, ${user.firstName || "ami"}`
                  : `Hi, ${user.firstName || "friend"}`
                : language === "fr"
                  ? "Bienvenue chez Olive"
                  : "Welcome to Chez Olive"}
            </h1>
            <p>
              {user
                ? language === "fr"
                  ? "Voici l'essentiel pour agir vite."
                  : "Here are the essentials to move quickly."
                : language === "fr"
                  ? "Boutique locale, commandes et livraison à Rimouski."
                  : "Local shop, orders, and delivery in Rimouski."}
            </p>
          </div>
        </section>

        <section
          className={`pwa-premium-dashboard pwa-premium-dashboard--focused${user ? "" : " pwa-premium-dashboard--guest"}`}
          aria-label={language === "fr" ? (user ? "Tableau de bord client" : "Raccourcis") : user ? "Customer dashboard" : "Shortcuts"}
        >
          {primaryAction ? (
            <div className="pwa-next-action-card">
              <div className="pwa-next-action-copy">
                <p className="pwa-kicker">{language === "fr" ? (user ? "Prochaine action" : "Commencer") : user ? "Next action" : "Start"}</p>
                <h2>{primaryAction.title}</h2>
                <p>{primaryAction.text}</p>
              </div>
              <div className="pwa-next-action-actions">
                <Link className="btn" href={primaryAction.href}>
                  <NavIcon name={primaryAction.icon} size={18} />
                  {primaryAction.meta}
                </Link>
                {!user ? (
                  <Link className="btn btn-secondary" href="/login">
                    {language === "fr" ? "Me connecter" : "Sign in"}
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className={`pwa-premium-action-grid pwa-core-action-grid${user ? "" : " pwa-guest-action-grid"}`}>
            {visibleActions.map((item) =>
              item.opensSupport ? (
                <PwaSupportActionCard
                  key={`${item.href}-${item.title}`}
                  title={item.title}
                  text={item.text}
                  meta={item.meta}
                />
              ) : (
                <PremiumActionCard item={item} key={`${item.href}-${item.title}`} />
              ),
            )}
          </div>
        </section>

        <CartResumeBanner language={language} />

        {user && accountNeedsAttention ? (
          <section
            className="pwa-hub-section pwa-account-snapshot pwa-account-snapshot--compact"
            aria-label={language === "fr" ? "À compléter" : "To complete"}
          >
            <div className="pwa-section-head">
              <div>
                <h2>{language === "fr" ? "À compléter" : "To complete"}</h2>
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
      </main>
      <AppMobileNav language={language} userRole={user?.role ?? null} showSecondary={false} />
    </div>
  );
}
