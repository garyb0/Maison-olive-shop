import Link from "next/link";
import { getCurrentLanguage } from "@/lib/language";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/auth";
import { getAdminOrders, getAdminCustomers, getAdminProductInventoryMetrics, getAdminProducts, getTaxReport } from "@/lib/admin";
import { formatCurrency } from "@/lib/format";
import { getMaintenanceState } from "@/lib/maintenance";
import { AdminDashboardClient } from "./admin-dashboard-client";

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

  const [orders, customers, taxReport, products, inventoryMetrics] = await Promise.all([
    getAdminOrders({}),
    getAdminCustomers(),
    getTaxReport(),
    getAdminProducts(),
    getAdminProductInventoryMetrics(),
  ]);

  const activeProducts = products.filter((product) => product.isActive).length;
  const pendingOrders = orders.filter((order) => order.status === "PENDING").length;
  const locale = language === "fr" ? "fr-CA" : "en-CA";

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
