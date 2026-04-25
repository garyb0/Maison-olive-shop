import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/format";
import { getCurrentLanguage } from "@/lib/language";
import { prisma } from "@/lib/prisma";

const DELIVERY_STATUS_FR: Record<string, string> = {
  UNSCHEDULED: "En attente",
  SCHEDULED: "Planifiée",
  OUT_FOR_DELIVERY: "En livraison",
  DELIVERED: "Livrée",
  FAILED: "Échouée",
  RESCHEDULED: "Replanifiée",
};

const DELIVERY_STATUS_EN: Record<string, string> = {
  UNSCHEDULED: "Pending",
  SCHEDULED: "Scheduled",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  FAILED: "Failed",
  RESCHEDULED: "Rescheduled",
};

export default async function AccountOrdersPage() {
  const user = await getCurrentUser();
  const language = await getCurrentLanguage();

  if (!user) {
    return null;
  }

  const locale = language === "fr" ? "fr-CA" : "en-CA";

  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
  });

  return (
    <>
      <section className="section account-home-hero">
        <p className="account-home-hero__eyebrow">
          {language === "fr" ? "Commandes" : "Orders"}
        </p>
        <h1>{language === "fr" ? "Mes commandes" : "My orders"}</h1>
        <p className="small" style={{ marginBottom: 0, maxWidth: 620 }}>
          {language === "fr"
            ? "Retrouve ici l’historique de tes commandes, leur statut et l’accès au détail de facture."
            : "Find your order history here, along with status updates and access to invoice details."}
        </p>
      </section>

      {orders.length === 0 ? (
        <section className="section" style={{ textAlign: "center", padding: "4rem 1rem" }}>
          <h3>{language === "fr" ? "Aucune commande" : "No orders yet"}</h3>
          <p className="small">
            {language === "fr" ? "Tu n'as pas encore passé de commande." : "You haven't placed any orders yet."}
          </p>
          <Link className="btn" href="/" style={{ marginTop: 16 }}>
            {language === "fr" ? "Aller faire des achats" : "Go shopping"}
          </Link>
        </section>
      ) : (
        <section className="account-orders-grid">
          {orders.map((order) => (
            <article key={order.id} className="account-order-card">
              <div className="account-order-card__head">
                <div>
                  <p className="account-home-hero__eyebrow" style={{ marginBottom: 6 }}>
                    {language === "fr" ? "Commande" : "Order"}
                  </p>
                  <h2 className="account-order-card__number">#{order.orderNumber}</h2>
                </div>
                <span className="account-order-card__total">
                  {formatCurrency(order.totalCents, order.currency, locale)}
                </span>
              </div>

              <div className="account-order-card__meta">
                <div className="account-order-card__meta-block">
                  <span className="account-order-card__meta-label">{language === "fr" ? "Date" : "Date"}</span>
                  <strong>{formatDate(order.createdAt, locale)}</strong>
                </div>
                <div className="account-order-card__meta-block">
                  <span className="account-order-card__meta-label">{language === "fr" ? "Statut" : "Status"}</span>
                  <span className="badge">{order.status}</span>
                </div>
                <div className="account-order-card__meta-block">
                  <span className="account-order-card__meta-label">{language === "fr" ? "Livraison" : "Delivery"}</span>
                  <strong>{(language === "fr" ? DELIVERY_STATUS_FR : DELIVERY_STATUS_EN)[order.deliveryStatus] ?? order.deliveryStatus}</strong>
                  <span className="small" style={{ marginTop: 4 }}>
                    {order.deliveryWindowStartAt && order.deliveryWindowEndAt
                      ? `${formatDate(order.deliveryWindowStartAt, locale)} -> ${formatDate(order.deliveryWindowEndAt, locale)}`
                      : language === "fr"
                        ? "À confirmer"
                        : "To be scheduled"}
                  </span>
                </div>
              </div>

              <div className="account-order-card__items">
                <span className="account-order-card__meta-label">{language === "fr" ? "Articles" : "Items"}</span>
                <p className="small" style={{ margin: "6px 0 0", color: "#6f624d" }}>
                  {order.items
                    .map((item) => `${language === "fr" ? item.product.nameFr : item.product.nameEn} × ${item.quantity}`)
                    .join(", ")}
                </p>
              </div>

              <div className="account-order-card__actions">
                <Link className="btn btn-secondary" href={`/account/orders/${order.id}`}>
                  {language === "fr" ? "Voir le détail" : "View details"}
                </Link>
              </div>
            </article>
          ))}
        </section>
      )}
    </>
  );
}

