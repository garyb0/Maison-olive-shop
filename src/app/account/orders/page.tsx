import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/format";
import { getCurrentLanguage } from "@/lib/language";
import { prisma } from "@/lib/prisma";

const DELIVERY_STATUS_FR: Record<string, string> = {
  UNSCHEDULED: "À planifier",
  SCHEDULED: "Livraison planifiée",
  OUT_FOR_DELIVERY: "En livraison",
  DELIVERED: "Livraison terminée",
  FAILED: "Problème de livraison",
  RESCHEDULED: "Livraison replanifiée",
};

const DELIVERY_STATUS_EN: Record<string, string> = {
  UNSCHEDULED: "To be scheduled",
  SCHEDULED: "Delivery scheduled",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivery complete",
  FAILED: "Delivery issue",
  RESCHEDULED: "Delivery rescheduled",
};

const ORDER_STATUS_FR: Record<string, string> = {
  PENDING: "Commande reçue",
  PAID: "Payée",
  PROCESSING: "En préparation",
  SHIPPED: "Expédiée",
  DELIVERED: "Terminée",
  CANCELLED: "Annulée",
};

const ORDER_STATUS_EN: Record<string, string> = {
  PENDING: "Order received",
  PAID: "Paid",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Complete",
  CANCELLED: "Cancelled",
};

const PAYMENT_STATUS_FR: Record<string, string> = {
  PENDING: "Paiement en attente",
  PAID: "Paiement reçu",
  FAILED: "Paiement échoué",
  REFUNDED: "Remboursé",
};

const PAYMENT_STATUS_EN: Record<string, string> = {
  PENDING: "Payment pending",
  PAID: "Payment received",
  FAILED: "Payment failed",
  REFUNDED: "Refunded",
};

const PAYMENT_METHOD_FR: Record<string, string> = {
  MANUAL: "Paiement local",
  STRIPE: "Carte",
};

const PAYMENT_METHOD_EN: Record<string, string> = {
  MANUAL: "Local payment",
  STRIPE: "Card",
};

function getStatusTone(status: string) {
  if (["PAID", "DELIVERED"].includes(status)) return "ok";
  if (["FAILED", "CANCELLED"].includes(status)) return "err";
  if (["OUT_FOR_DELIVERY", "SHIPPED", "RESCHEDULED"].includes(status)) return "info";
  return "warn";
}

function formatDeliveryWindow(
  startAt: Date | string | null,
  endAt: Date | string | null,
  locale: string,
  language: "fr" | "en",
) {
  if (!startAt || !endAt) {
    return language === "fr" ? "À confirmer" : "To be confirmed";
  }

  const start = new Date(startAt);
  const end = new Date(endAt);
  const sameDay = start.toDateString() === end.toDateString();

  if (!sameDay) {
    return `${formatDate(start, locale)} -> ${formatDate(end, locale)}`;
  }

  const dateLabel = new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(start);
  const timeFormatter = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" });
  const separator = language === "fr" ? " à " : " to ";

  return `${dateLabel} · ${timeFormatter.format(start)}${separator}${timeFormatter.format(end)}`;
}

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
        orderBy: { createdAt: "asc" },
      },
    },
  });
  const totalSpentCents = orders.reduce((sum, order) => sum + order.totalCents, 0);
  const latestOrder = orders[0] ?? null;

  return (
    <>
      <section className="section account-orders-hero">
        <div className="account-orders-hero__copy">
          <p className="account-home-hero__eyebrow">
            {language === "fr" ? "Commandes" : "Orders"}
          </p>
          <h1>{language === "fr" ? "Mes commandes" : "My orders"}</h1>
          <p className="small account-section-copy">
            {language === "fr"
              ? "Suis tes achats, tes paiements et les livraisons locales au même endroit."
              : "Track your purchases, payments, and local deliveries in one place."}
          </p>
        </div>

        <div className="account-orders-hero__stats" aria-label={language === "fr" ? "Résumé des commandes" : "Order summary"}>
          <div>
            <span>{language === "fr" ? "Commandes" : "Orders"}</span>
            <strong>{orders.length}</strong>
          </div>
          <div>
            <span>{language === "fr" ? "Montant" : "Amount"}</span>
            <strong>{formatCurrency(totalSpentCents, "CAD", locale)}</strong>
          </div>
          <div>
            <span>{language === "fr" ? "Dernière" : "Latest"}</span>
            <strong>{latestOrder ? formatDate(latestOrder.createdAt, locale) : "—"}</strong>
          </div>
        </div>
      </section>

      {orders.length === 0 ? (
        <section className="section account-orders-empty">
          <div className="account-orders-empty__icon" aria-hidden="true">📦</div>
          <h2>{language === "fr" ? "Aucune commande pour le moment" : "No orders yet"}</h2>
          <p className="small">
            {language === "fr"
              ? "Quand tu passeras une commande, son suivi et sa facture apparaîtront ici."
              : "Once you place an order, tracking and invoice details will appear here."}
          </p>
          <Link className="btn" href="/boutique">
            {language === "fr" ? "Découvrir la boutique" : "Browse the shop"}
          </Link>
        </section>
      ) : (
        <section className="account-orders-grid account-orders-grid--compact">
          {orders.map((order) => {
            const orderStatusLabel = (language === "fr" ? ORDER_STATUS_FR : ORDER_STATUS_EN)[order.status] ?? order.status;
            const paymentStatusLabel =
              (language === "fr" ? PAYMENT_STATUS_FR : PAYMENT_STATUS_EN)[order.paymentStatus] ?? order.paymentStatus;
            const paymentMethodLabel =
              (language === "fr" ? PAYMENT_METHOD_FR : PAYMENT_METHOD_EN)[order.paymentMethod] ?? order.paymentMethod;
            const deliveryStatusLabel =
              (language === "fr" ? DELIVERY_STATUS_FR : DELIVERY_STATUS_EN)[order.deliveryStatus] ?? order.deliveryStatus;
            const deliveryWindowLabel = formatDeliveryWindow(
              order.deliveryWindowStartAt,
              order.deliveryWindowEndAt,
              locale,
              language,
            );
            const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);

            return (
              <article key={order.id} className="account-order-card">
                <div className="account-order-card__head">
                  <div className="account-order-card__identity">
                    <p className="account-home-hero__eyebrow">
                      {language === "fr" ? "Commande" : "Order"}
                    </p>
                    <h2 className="account-order-card__number">#{order.orderNumber}</h2>
                    <p className="small">
                      {language === "fr" ? "Passée le " : "Placed on "}
                      {formatDate(order.createdAt, locale)}
                    </p>
                  </div>
                  <div className="account-order-card__total-block">
                    <span>{language === "fr" ? "Total commande" : "Order total"}</span>
                    <strong>{formatCurrency(order.totalCents, order.currency, locale)}</strong>
                  </div>
                </div>

                <div className="account-order-card__status-row">
                  <div className="account-order-card__status-item">
                    <span>{language === "fr" ? "Commande" : "Order"}</span>
                    <strong className={`account-status-pill account-status-pill--${getStatusTone(order.status)}`}>
                      {orderStatusLabel}
                    </strong>
                  </div>
                  <div className="account-order-card__status-item">
                    <span>{language === "fr" ? "Paiement" : "Payment"}</span>
                    <strong className={`account-status-pill account-status-pill--${getStatusTone(order.paymentStatus)}`}>
                      {paymentStatusLabel}
                    </strong>
                  </div>
                  <div className="account-order-card__status-item">
                    <span>{language === "fr" ? "Livraison" : "Delivery"}</span>
                    <strong className={`account-status-pill account-status-pill--${getStatusTone(order.deliveryStatus)}`}>
                      {deliveryStatusLabel}
                    </strong>
                  </div>
                </div>

                <div className="account-order-card__details">
                  <div className="account-order-card__detail-block">
                    <span className="account-order-card__meta-label">{language === "fr" ? "Livraison" : "Delivery"}</span>
                    <strong>{deliveryWindowLabel}</strong>
                  </div>
                  <div className="account-order-card__detail-block">
                    <span className="account-order-card__meta-label">{language === "fr" ? "Paiement" : "Payment"}</span>
                    <strong>{paymentMethodLabel}</strong>
                  </div>
                </div>

                <div className="account-order-card__items">
                  <div className="account-order-card__items-head">
                    <span className="account-order-card__meta-label">{language === "fr" ? "Articles" : "Items"}</span>
                    <strong>
                      {totalItems} {language === "fr" ? `article${totalItems !== 1 ? "s" : ""}` : `item${totalItems !== 1 ? "s" : ""}`}
                    </strong>
                  </div>
                  <ul>
                    {order.items.map((item) => (
                      <li key={item.id}>
                        <span>{language === "fr" ? item.productNameSnapshotFr : item.productNameSnapshotEn}</span>
                        <strong>× {item.quantity}</strong>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="account-order-card__actions">
                  <Link className="btn account-order-card__detail-link" href={`/account/orders/${order.id}`}>
                    {language === "fr" ? "Voir la facture" : "View invoice"}
                  </Link>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </>
  );
}
