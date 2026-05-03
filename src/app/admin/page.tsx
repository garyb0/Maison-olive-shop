import Link from "next/link";
import { getCurrentLanguage } from "@/lib/language";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/auth";
import { getAdminOrders, getAdminCustomers, getAdminProductInventoryMetrics, getAdminProducts, getTaxReport } from "@/lib/admin";
import { formatCurrency } from "@/lib/format";
import { getMaintenanceState } from "@/lib/maintenance";
import { getOwnerTodaySnapshot } from "@/lib/owner-dashboard";
import { AdminDashboardClient } from "./admin-dashboard-client";

const orderStatusLabel = (status: string, language: "fr" | "en") => {
  const labels: Record<string, Record<"fr" | "en", string>> = {
    PENDING: { fr: "A verifier", en: "To review" },
    PAID: { fr: "Payee", en: "Paid" },
    PROCESSING: { fr: "En preparation", en: "Processing" },
    SHIPPED: { fr: "Expediee", en: "Shipped" },
    DELIVERED: { fr: "Livree", en: "Delivered" },
    CANCELLED: { fr: "Annulee", en: "Cancelled" },
  };

  return labels[status]?.[language] ?? status;
};

const paymentStatusLabel = (status: string, language: "fr" | "en") => {
  const labels: Record<string, Record<"fr" | "en", string>> = {
    PENDING: { fr: "Paiement a verifier", en: "Payment to review" },
    PAID: { fr: "Paiement recu", en: "Payment received" },
    FAILED: { fr: "Paiement echoue", en: "Payment failed" },
    REFUNDED: { fr: "Remboursee", en: "Refunded" },
  };

  return labels[status]?.[language] ?? status;
};

const deliveryStatusLabel = (status: string, language: "fr" | "en") => {
  const labels: Record<string, Record<"fr" | "en", string>> = {
    SCHEDULED: { fr: "Planifiee", en: "Scheduled" },
    OUT_FOR_DELIVERY: { fr: "Sur la route", en: "Out for delivery" },
    DELIVERED: { fr: "Livree", en: "Delivered" },
    FAILED: { fr: "Echec", en: "Failed" },
    RESCHEDULED: { fr: "A replanifier", en: "Rescheduled" },
    UNSCHEDULED: { fr: "Non planifiee", en: "Unscheduled" },
  };

  return labels[status]?.[language] ?? status;
};

const supportStatusLabel = (status: string, language: "fr" | "en") => {
  const labels: Record<string, Record<"fr" | "en", string>> = {
    WAITING: { fr: "Attend une reponse", en: "Waiting" },
    OPEN: { fr: "Ouverte", en: "Open" },
    ASSIGNED: { fr: "Assignee", en: "Assigned" },
    CLOSED: { fr: "Fermee", en: "Closed" },
  };

  return labels[status]?.[language] ?? status;
};

const runStatusLabel = (status: string, language: "fr" | "en") => {
  const labels: Record<string, Record<"fr" | "en", string>> = {
    PUBLISHED: { fr: "Publiee", en: "Published" },
    IN_PROGRESS: { fr: "En cours", en: "In progress" },
    DRAFT: { fr: "Brouillon", en: "Draft" },
    COMPLETED: { fr: "Terminee", en: "Completed" },
    CANCELLED: { fr: "Annulee", en: "Cancelled" },
  };

  return labels[status]?.[language] ?? status;
};

export default async function AdminDashboardPage() {
  const [language, user] = await Promise.all([getCurrentLanguage(), getCurrentUser()]);
  const t = getDictionary(language);
  const oliveMode = (process.env.OLIVE_MODE as "princess" | "gremlin") || "princess";
  const maintenanceState = getMaintenanceState();

  if (!user || user.role !== "ADMIN") {
    return (
      <section className="section">
        <h1>{t.adminTitle}</h1>
        <p className="small">
          {language === "fr" ? "Accès réservé aux administrateurs." : "Admin access only."}
        </p>
        <Link className="btn" href="/">
          {t.navHome}
        </Link>
      </section>
    );
  }

  const [orders, customers, taxReport, products, inventoryMetrics, todaySnapshot] = await Promise.all([
    getAdminOrders({}),
    getAdminCustomers(),
    getTaxReport(),
    getAdminProducts(),
    getAdminProductInventoryMetrics(),
    getOwnerTodaySnapshot(),
  ]);

  const activeProducts = products.filter((product) => product.isActive).length;
  const pendingOrders = orders.filter((order) => order.status === "PENDING").length;
  const locale = language === "fr" ? "fr-CA" : "en-CA";
  const formatShortDateTime = (date: Date) =>
    new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  const formatDeliveryWindow = (startAt: Date | null, endAt: Date | null) => {
    if (!startAt || !endAt) {
      return language === "fr" ? "Fenetre a confirmer" : "Window to confirm";
    }

    return `${formatShortDateTime(startAt)} - ${formatShortDateTime(endAt)}`;
  };

  const recentOrders = orders.slice(0, 5).map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    status: order.status,
    totalLabel: formatCurrency(order.totalCents, order.currency, locale),
  }));

  return (
    <AdminDashboardClient
      language={language}
      t={t}
      oliveMode={oliveMode}
      initialMaintenanceEnabled={maintenanceState.enabled}
      initialMaintenanceOpenAt={maintenanceState.openAt ? maintenanceState.openAt.toISOString() : null}
      stats={{
        totalProducts: products.length,
        activeProducts,
        totalOrders: orders.length,
        pendingOrders,
        totalCustomers: customers.length,
        taxTotal: formatCurrency(taxReport.summary.totalCents, "CAD", locale),
      }}
      todayCockpit={{
        dateKey: todaySnapshot.dateKey,
        todayOrderCount: todaySnapshot.todayOrderCount,
        ordersToPrepareCount: todaySnapshot.ordersToPrepareCount,
        deliveryOrderCount: todaySnapshot.deliveryOrderCount,
        openSupportCount: todaySnapshot.openSupportCount,
        activeRunCount: todaySnapshot.activeRunCount,
        todaySalesLabel: formatCurrency(todaySnapshot.todaySalesCents, "CAD", locale),
        lowStockCount: todaySnapshot.lowStockCount,
        lowStockProducts: todaySnapshot.lowStockProducts.map((product) => ({
          id: product.id,
          name: language === "fr" ? product.nameFr : product.nameEn,
          slug: product.slug,
          stock: product.stock,
        })),
        actionQueues: {
          ordersToPrepare: todaySnapshot.ordersToPrepare.map((order) => ({
            id: order.id,
            href: `/admin/orders/${order.id}`,
            title: `#${order.orderNumber}`,
            meta: order.customerName,
            detail:
              language === "fr"
                ? `${order.itemCount} article(s) - ${formatCurrency(order.totalCents, order.currency, locale)} - ${paymentStatusLabel(order.paymentStatus, language)}`
                : `${order.itemCount} item(s) - ${formatCurrency(order.totalCents, order.currency, locale)} - ${paymentStatusLabel(order.paymentStatus, language)}`,
            badge: orderStatusLabel(order.status, language),
          })),
          deliveryOrders: todaySnapshot.deliveryOrders.map((order) => ({
            id: order.id,
            href: `/admin/orders/${order.id}`,
            title: `#${order.orderNumber}`,
            meta: order.shippingCity
              ? `${order.customerName} - ${order.shippingCity}`
              : order.customerName,
            detail: formatDeliveryWindow(order.deliveryWindowStartAt, order.deliveryWindowEndAt),
            badge: deliveryStatusLabel(order.deliveryStatus, language),
          })),
          supportQueue: todaySnapshot.supportQueue.map((conversation) => ({
            id: conversation.id,
            href: "/admin/support",
            title: conversation.customerName || conversation.customerEmail,
            meta: conversation.orderNumber
              ? language === "fr"
                ? `Commande #${conversation.orderNumber}`
                : `Order #${conversation.orderNumber}`
              : conversation.customerEmail,
            detail: conversation.slaDueAt
              ? language === "fr"
                ? `SLA ${formatShortDateTime(conversation.slaDueAt)}`
                : `SLA ${formatShortDateTime(conversation.slaDueAt)}`
              : language === "fr"
                ? `Dernier message ${formatShortDateTime(conversation.lastMessageAt)}`
                : `Last message ${formatShortDateTime(conversation.lastMessageAt)}`,
            badge: `${supportStatusLabel(conversation.status, language)} - ${conversation.priority}`,
          })),
          activeRuns: todaySnapshot.activeRuns.map((run) => ({
            id: run.id,
            href: "/admin/delivery/runs",
            title: run.dateKey,
            meta: formatDeliveryWindow(run.slotStartAt, run.slotEndAt),
            detail:
              language === "fr"
                ? `${run.stopCount} arret(s)${run.startedAt ? ` - depart ${formatShortDateTime(run.startedAt)}` : ""}`
                : `${run.stopCount} stop(s)${run.startedAt ? ` - started ${formatShortDateTime(run.startedAt)}` : ""}`,
            badge: runStatusLabel(run.status, language),
          })),
        },
        backup: todaySnapshot.backup,
        siteStatus: maintenanceState.enabled
          ? language === "fr"
            ? "Maintenance active"
            : "Maintenance active"
          : language === "fr"
            ? "Site ouvert"
            : "Site open",
      }}
      profitabilitySummary={{
        stockValueAtCostLabel: formatCurrency(inventoryMetrics.summary.stockValueAtCostCents, "CAD", locale),
        stockValueAtRetailLabel: formatCurrency(inventoryMetrics.summary.stockValueAtRetailCents, "CAD", locale),
        grossRevenueLabel: formatCurrency(inventoryMetrics.summary.grossRevenueCents, "CAD", locale),
        estimatedGrossProfitLabel: formatCurrency(inventoryMetrics.summary.estimatedGrossProfitCents, "CAD", locale),
      }}
      profitabilityRows={inventoryMetrics.rows.map((metric) => ({
        id: metric.id,
        name: language === "fr" ? metric.nameFr : metric.nameEn,
        slug: metric.slug,
        stock: metric.stock,
        quantityAdded: metric.quantityAdded,
        quantitySold: metric.quantitySold,
        quantityAdjusted: metric.quantityAdjusted,
        estimatedGrossProfitLabel: formatCurrency(metric.estimatedGrossProfitCents, metric.currency, locale),
      }))}
      recentOrders={recentOrders}
    />
  );
}
