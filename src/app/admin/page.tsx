import Link from "next/link";
import { getCurrentLanguage } from "@/lib/language";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/auth";
import { getAdminCustomers, getAdminOrders, getAdminProducts, getRecentInventoryMovements, getTaxReport } from "@/lib/admin";
import { formatCurrency, formatDate } from "@/lib/format";
import { AdminClient } from "@/app/admin/admin-client";

import { Navigation } from "@/components/Navigation";
type AdminOrders = Awaited<ReturnType<typeof getAdminOrders>>;
type AdminOrder = AdminOrders[number];
type AdminCustomers = Awaited<ReturnType<typeof getAdminCustomers>>;
type AdminCustomer = AdminCustomers[number];
type AdminProducts = Awaited<ReturnType<typeof getAdminProducts>>;
type AdminProduct = AdminProducts[number];
type AdminInventoryMovements = Awaited<ReturnType<typeof getRecentInventoryMovements>>;
type AdminInventoryMovement = AdminInventoryMovements[number];

export default async function AdminPage() {
  const [language, user] = await Promise.all([getCurrentLanguage(), getCurrentUser()]);
  const t = getDictionary(language);
  const oliveMode = (process.env.OLIVE_MODE as "princess" | "gremlin") || "princess";

  if (!user || user.role !== "ADMIN") {
    return (
      <div className="app-shell">
        <header className="topbar">
          <div className="brand">{t.brandName}</div>
          <Navigation language={language} t={t} user={user} />
        </header>
        <section className="section">
          <h1>{t.adminTitle}</h1>
          <p className="small">{language === "fr" ? "Accès réservé aux administrateurs." : "Admin access only."}</p>
          <Link className="btn" href="/">
            {t.navHome}
          </Link>
        </section>
      </div>
    );
  }

  const [orders, customers, taxReport, products, inventoryMovements] = await Promise.all([
    getAdminOrders({}),
    getAdminCustomers(),
    getTaxReport(),
    getAdminProducts(),
    getRecentInventoryMovements(),
  ]);

  return (
    <AdminClient
      language={language}
      t={t}
      oliveMode={oliveMode}
      products={products.map((product: AdminProduct) => ({
        id: product.id,
        slug: product.slug,
        category: product.category?.name ?? "Uncategorized",
        nameFr: product.nameFr,
        nameEn: product.nameEn,
        descriptionFr: product.descriptionFr,
        descriptionEn: product.descriptionEn,
        imageUrl: product.imageUrl,
        priceCents: product.priceCents,
        currency: product.currency,
        stock: product.stock,
        isActive: product.isActive,
        createdAt: product.createdAt.toISOString(),
      }))}
      inventoryMovements={inventoryMovements.map((movement: AdminInventoryMovement) => ({
        id: movement.id,
        productId: movement.productId,
        productName: language === "fr" ? movement.product.nameFr : movement.product.nameEn,
        quantityChange: movement.quantityChange,
        reason: movement.reason,
        orderNumber: movement.order?.orderNumber ?? null,
        createdAt: movement.createdAt.toISOString(),
      }))}
      orders={orders.map((order: AdminOrder) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        customerEmail: order.customerEmail,
        customerName: order.customerName,
        status: order.status,
        paymentStatus: order.paymentStatus,
        totalLabel: formatCurrency(order.totalCents, order.currency, language === "fr" ? "fr-CA" : "en-CA"),
        createdAtLabel: formatDate(order.createdAt, language === "fr" ? "fr-CA" : "en-CA"),
      }))}
      customers={customers.map((customer: AdminCustomer) => ({
        id: customer.id,
        email: customer.email,
        fullName: `${customer.firstName} ${customer.lastName}`,
        role: customer.role,
        ordersCount: customer.orders.length,
        createdAtLabel: formatDate(customer.createdAt, language === "fr" ? "fr-CA" : "en-CA"),
      }))}
      taxSummary={{
        subtotalLabel: formatCurrency(taxReport.summary.subtotalCents, "CAD", language === "fr" ? "fr-CA" : "en-CA"),
        taxesLabel: formatCurrency(taxReport.summary.taxCents, "CAD", language === "fr" ? "fr-CA" : "en-CA"),
        shippingLabel: formatCurrency(taxReport.summary.shippingCents, "CAD", language === "fr" ? "fr-CA" : "en-CA"),
        totalLabel: formatCurrency(taxReport.summary.totalCents, "CAD", language === "fr" ? "fr-CA" : "en-CA"),
      }}
    />
  );
}
