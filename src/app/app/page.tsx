import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { getCurrentLanguage } from "@/lib/language";
import { getOwnerTodaySnapshot } from "@/lib/owner-dashboard";
import { prisma } from "@/lib/prisma";
import { Navigation } from "@/components/Navigation";
import { PwaDriverAccessCard } from "./pwa-driver-access-card";
import { PwaInstallPanel } from "./pwa-install-panel";
import { PwaSupportButton } from "./pwa-support-button";

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

type CustomerSnapshot = {
  orderCount: number;
  dogCount: number;
  activeSupportCount: number;
  latestOrder: {
    orderNumber: string;
    status: string;
    totalCents: number;
  } | null;
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
    PAID: "payee",
    PROCESSING: "en preparation",
    SHIPPED: "expediee",
    DELIVERED: "livree",
    CANCELLED: "annulee",
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
    PUBLISHED: "publiee",
    IN_PROGRESS: "en cours",
    COMPLETED: "terminee",
    CANCELLED: "annulee",
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
    SCHEDULED: "planifiee",
    OUT_FOR_DELIVERY: "sur la route",
    DELIVERED: "livree",
    FAILED: "echec",
    RESCHEDULED: "a replanifier",
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

async function getCustomerSnapshot(userId?: string): Promise<CustomerSnapshot | null> {
  if (!userId) return null;

  try {
    const [orderCount, dogCount, activeSupportCount, latestOrder] = await Promise.all([
      prisma.order.count({ where: { userId } }),
      prisma.dogProfile.count({ where: { userId, isActive: true } }),
      prisma.supportConversation.count({
        where: {
          customerUserId: userId,
          status: { in: ["WAITING", "OPEN", "ASSIGNED"] },
        },
      }),
      prisma.order.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: {
          orderNumber: true,
          status: true,
          totalCents: true,
        },
      }),
    ]);

    return { orderCount, dogCount, activeSupportCount, latestOrder };
  } catch (error) {
    console.error("Unable to load PWA customer snapshot", error);
    return null;
  }
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
  const t = getDictionary(language);
  const [customerSnapshot, adminSnapshot] = await Promise.all([
    getCustomerSnapshot(user?.id),
    user?.role === "ADMIN" ? getAdminSnapshot() : Promise.resolve(null),
  ]);

  const customerLinks: HubLink[] = [
    {
      href: "/boutique",
      eyebrow: language === "fr" ? "Boutique" : "Shop",
      title: language === "fr" ? "Magasiner" : "Shop",
      text: language === "fr" ? "Produits, categories et recherche rapide." : "Products, categories, and quick search.",
    },
    {
      href: "/cart",
      eyebrow: language === "fr" ? "Panier" : "Cart",
      title: language === "fr" ? "Reprendre mon panier" : "Resume my cart",
      text: language === "fr" ? "Verifier les items avant le checkout." : "Review items before checkout.",
    },
    {
      href: user ? "/account/orders" : "/login",
      eyebrow: language === "fr" ? "Compte" : "Account",
      title: language === "fr" ? "Mes commandes" : "My orders",
      text: language === "fr" ? "Suivi, factures et statut de livraison." : "Tracking, invoices, and delivery status.",
    },
    {
      href: user ? "/account/dogs" : "/login",
      eyebrow: "QR",
      title: language === "fr" ? "Mes chiens" : "My dogs",
      text: language === "fr" ? "Profils QR, infos utiles et contact." : "QR profiles, useful info, and contact.",
    },
    {
      href: user ? "/account/profile" : "/login",
      eyebrow: language === "fr" ? "Profil" : "Profile",
      title: language === "fr" ? "Adresses et securite" : "Addresses and security",
      text: language === "fr" ? "Infos client, adresses et sessions." : "Customer info, addresses, and sessions.",
    },
    {
      href: "/faq",
      eyebrow: language === "fr" ? "Aide" : "Help",
      title: language === "fr" ? "Centre d'aide" : "Help center",
      text: language === "fr" ? "Livraison, retours, paiement et support." : "Delivery, returns, payment, and support.",
    },
  ];

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
      text: language === "fr" ? "Suivre les tournees chauffeur." : "Track driver runs.",
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
      <header className="topbar">
        <Navigation language={language} t={t} user={user} />
      </header>

      <main className="pwa-hub" aria-labelledby="pwa-hub-title">
        <section className="pwa-hero">
          <div>
            <p className="pwa-kicker">{language === "fr" ? "Application" : "App"}</p>
            <h1 id="pwa-hub-title">Chez Olive</h1>
            <p>
              {language === "fr"
                ? "Le raccourci mobile pour magasiner, suivre ton compte, gerer les profils QR et ouvrir les outils terrain."
                : "The mobile shortcut to shop, follow your account, manage QR profiles, and open field tools."}
            </p>
          </div>
          <div className="pwa-hero-actions">
            <Link className="btn" href="/boutique">
              {language === "fr" ? "Ouvrir la boutique" : "Open shop"}
            </Link>
            {user ? (
              <Link className="btn btn-secondary" href="/account">
                {language === "fr" ? "Mon compte" : "My account"}
              </Link>
            ) : (
              <Link className="btn btn-secondary" href="/login">
                {language === "fr" ? "Se connecter" : "Sign in"}
              </Link>
            )}
          </div>
        </section>

        <PwaInstallPanel language={language} />

        {user ? (
          <section className="pwa-hub-section pwa-account-snapshot" aria-label={language === "fr" ? "Resume du compte" : "Account summary"}>
            <div className="pwa-section-head">
              <div>
                <p className="pwa-kicker">{language === "fr" ? "Connecte" : "Signed in"}</p>
                <h2>
                  {language === "fr"
                    ? `Bonjour, ${user.firstName || "ami"}`
                    : `Hi, ${user.firstName || "friend"}`}
                </h2>
              </div>
              <div className="pwa-shortcut-row" aria-label={language === "fr" ? "Raccourcis recents" : "Recent shortcuts"}>
                <Link className="btn btn-secondary" href="/account/orders">
                  {language === "fr" ? "Commandes" : "Orders"}
                </Link>
                <Link className="btn btn-secondary" href="/account/dogs">
                  {language === "fr" ? "Chiens QR" : "QR dogs"}
                </Link>
                <Link className="btn btn-secondary" href="/account/support">
                  Support
                </Link>
              </div>
            </div>
            <div className="pwa-stat-grid">
              <StatCard
                href="/account/orders"
                label={language === "fr" ? "Commandes" : "Orders"}
                value={String(customerSnapshot?.orderCount ?? 0)}
                help={
                  customerSnapshot?.latestOrder
                    ? language === "fr"
                      ? `Derniere #${customerSnapshot.latestOrder.orderNumber} - ${orderStatusLabel(customerSnapshot.latestOrder.status, language)} - ${formatCurrency(customerSnapshot.latestOrder.totalCents, language)}`
                      : `Latest #${customerSnapshot.latestOrder.orderNumber} - ${orderStatusLabel(customerSnapshot.latestOrder.status, language)} - ${formatCurrency(customerSnapshot.latestOrder.totalCents, language)}`
                    : language === "fr"
                      ? "Aucune commande recente."
                      : "No recent order."
                }
              />
              <StatCard
                href="/account/dogs"
                label={language === "fr" ? "Profils chiens" : "Dog profiles"}
                value={String(customerSnapshot?.dogCount ?? 0)}
                help={language === "fr" ? "Colliers QR actifs dans ton compte." : "Active QR collars in your account."}
              />
              <StatCard
                href="/account/support"
                label="Support"
                value={String(customerSnapshot?.activeSupportCount ?? 0)}
                help={language === "fr" ? "Conversation ouverte ou en attente." : "Open or waiting conversation."}
              />
            </div>
          </section>
        ) : null}

        <section className="pwa-hub-section">
          <div className="pwa-section-head">
            <p className="pwa-kicker">{language === "fr" ? "Client" : "Customer"}</p>
            <h2>{language === "fr" ? "Tout pour ton compte" : "Everything for your account"}</h2>
            <PwaSupportButton language={language} />
          </div>
          <div className="pwa-hub-grid">
            {customerLinks.map((item) => <HubCard key={item.href + item.title} item={item} />)}
          </div>
        </section>

        <PwaDriverAccessCard language={language} />

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
                      ? "Aucune tournee active."
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
    </div>
  );
}
