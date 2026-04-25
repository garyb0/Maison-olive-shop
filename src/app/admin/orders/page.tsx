import Link from "next/link";
import { getCurrentLanguage } from "@/lib/language";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/auth";
import { getAdminOrders } from "@/lib/admin";
import { formatCurrency, formatDate } from "@/lib/format";
import { AdminOrdersClient } from "./admin-orders-client";

type AdminOrders = Awaited<ReturnType<typeof getAdminOrders>>;
type AdminOrder = AdminOrders[number];

export default async function AdminOrdersPage() {
  const [language, user] = await Promise.all([getCurrentLanguage(), getCurrentUser()]);
  const t = getDictionary(language);

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

  const orders = await getAdminOrders({});

  return (
    <AdminOrdersClient
      language={language}
      t={t}
      orders={orders.map((order: AdminOrder) => ({
        id: order.id,
        customerType: order.userId ? "account" : "guest",
        orderNumber: order.orderNumber,
        customerEmail: order.customerEmail,
        customerName: order.customerName,
        promoCode: order.promoCode,
        status: order.status,
        paymentStatus: order.paymentStatus,
        totalLabel: formatCurrency(order.totalCents, order.currency, language === "fr" ? "fr-CA" : "en-CA"),
        createdAtLabel: formatDate(order.createdAt, language === "fr" ? "fr-CA" : "en-CA"),
        deliveryWindowLabel:
          order.deliveryWindowStartAt && order.deliveryWindowEndAt
            ? `${formatDate(order.deliveryWindowStartAt, language === "fr" ? "fr-CA" : "en-CA")} -> ${formatDate(order.deliveryWindowEndAt, language === "fr" ? "fr-CA" : "en-CA")}`
            : language === "fr"
              ? "Appel client requis"
              : "Call customer",
        deliveryStatus: order.deliveryStatus,
        deliveryPhone: order.deliveryPhone,
        deliveryInstructions: order.deliveryInstructions,
      }))}
    />
  );
}
