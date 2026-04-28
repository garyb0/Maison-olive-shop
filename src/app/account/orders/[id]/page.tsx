import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentLanguage } from "@/lib/language";
import { getCurrentUser } from "@/lib/auth";
import { getOrderByIdForUser } from "@/lib/orders";
import { formatCurrency, formatDate } from "@/lib/format";
import { computeStoredOrderTaxBreakdown } from "@/lib/taxes";

type AccountOrderDetailsPageProps = {
  params: Promise<{ id: string }>;
};

const DELIVERY_STATUS_FR: Record<string, string> = {
  UNSCHEDULED: "Appel de confirmation requis",
  SCHEDULED: "Planifiée",
  OUT_FOR_DELIVERY: "En livraison",
  DELIVERED: "Livrée",
  FAILED: "Problème de livraison",
  RESCHEDULED: "Replanifiée",
};

const DELIVERY_STATUS_EN: Record<string, string> = {
  UNSCHEDULED: "Follow-up call required",
  SCHEDULED: "Scheduled",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  FAILED: "Delivery issue",
  RESCHEDULED: "Rescheduled",
};

const ORDER_STATUS_FR: Record<string, string> = {
  PENDING: "En attente",
  PAID: "Payée",
  PROCESSING: "En préparation",
  SHIPPED: "Expédiée",
  DELIVERED: "Livrée",
  CANCELLED: "Annulée",
};

const ORDER_STATUS_EN: Record<string, string> = {
  PENDING: "Pending",
  PAID: "Paid",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

const PAYMENT_STATUS_FR: Record<string, string> = {
  PENDING: "En attente",
  PAID: "Payé",
  FAILED: "Échoué",
  REFUNDED: "Remboursé",
};

const PAYMENT_STATUS_EN: Record<string, string> = {
  PENDING: "Pending",
  PAID: "Paid",
  FAILED: "Failed",
  REFUNDED: "Refunded",
};

const PAYMENT_METHOD_FR: Record<string, string> = {
  MANUAL: "Paiement à la livraison",
  STRIPE: "Paiement par carte",
};

const PAYMENT_METHOD_EN: Record<string, string> = {
  MANUAL: "Pay on delivery",
  STRIPE: "Card payment",
};

function formatAddress(parts: Array<string | null | undefined>) {
  return parts.map((part) => part?.trim()).filter(Boolean).join(", ");
}

export default async function AccountOrderDetailsPage({ params }: AccountOrderDetailsPageProps) {
  const { id } = await params;
  const [user, language] = await Promise.all([getCurrentUser(), getCurrentLanguage()]);

  if (!user) {
    notFound();
  }

  const order = await getOrderByIdForUser(id, user.id);
  if (!order) {
    notFound();
  }

  const taxSummary = computeStoredOrderTaxBreakdown(
    order.subtotalCents,
    order.discountCents,
    order.shippingCents,
  );
  const locale = language === "fr" ? "fr-CA" : "en-CA";
  const beforeTaxCents = taxSummary.discountedSubtotal + order.shippingCents;
  const deliveryStatusLabel =
    (language === "fr" ? DELIVERY_STATUS_FR : DELIVERY_STATUS_EN)[order.deliveryStatus] ?? order.deliveryStatus;
  const orderStatusLabel = (language === "fr" ? ORDER_STATUS_FR : ORDER_STATUS_EN)[order.status] ?? order.status;
  const paymentStatusLabel =
    (language === "fr" ? PAYMENT_STATUS_FR : PAYMENT_STATUS_EN)[order.paymentStatus] ?? order.paymentStatus;
  const paymentMethodLabel =
    (language === "fr" ? PAYMENT_METHOD_FR : PAYMENT_METHOD_EN)[order.paymentMethod] ?? order.paymentMethod;
  const deliveryWindowLabel =
    order.deliveryWindowStartAt && order.deliveryWindowEndAt
      ? `${formatDate(order.deliveryWindowStartAt, locale)} -> ${formatDate(order.deliveryWindowEndAt, locale)}`
      : language === "fr"
        ? "À confirmer avec notre équipe"
        : "To be confirmed with our team";
  const shippingAddress = formatAddress([
    order.shippingLine1,
    order.shippingCity,
    order.shippingRegion,
    order.shippingPostal,
    order.shippingCountry,
  ]);
  const statusItems = [
    {
      label: language === "fr" ? "Statut de commande" : "Order status",
      value: orderStatusLabel,
      kind: "badge" as const,
    },
    {
      label: language === "fr" ? "Paiement" : "Payment",
      value: paymentStatusLabel,
      kind: "badge" as const,
    },
    {
      label: language === "fr" ? "Livraison" : "Delivery",
      value: deliveryStatusLabel,
      kind: "badge" as const,
    },
    {
      label: language === "fr" ? "Mode de paiement" : "Payment method",
      value: paymentMethodLabel,
      kind: "text" as const,
    },
    {
      label: language === "fr" ? "Total" : "Total",
      value: formatCurrency(order.totalCents, order.currency, locale),
      kind: "total" as const,
    },
  ];
  const amountRows = [
    {
      label: language === "fr" ? "Sous-total" : "Subtotal",
      value: formatCurrency(order.subtotalCents, order.currency, locale),
      accent: false,
    },
    ...(order.discountCents > 0
      ? [{
          label: language === "fr" ? "Rabais promo" : "Promo discount",
          value: `-${formatCurrency(order.discountCents, order.currency, locale)}`,
          accent: true,
        }]
      : []),
    {
      label: language === "fr" ? "Livraison" : "Shipping",
      value: formatCurrency(order.shippingCents, order.currency, locale),
      accent: false,
    },
    {
      label: language === "fr" ? "Total avant taxes" : "Total before taxes",
      value: formatCurrency(beforeTaxCents, order.currency, locale),
      accent: false,
      dividerBefore: true,
    },
    {
      label: language === "fr" ? "TPS (5%)" : "GST (5%)",
      value: formatCurrency(taxSummary.gstCents, order.currency, locale),
      accent: false,
    },
    {
      label: language === "fr" ? "TVQ (9,975%)" : "QST (9.975%)",
      value: formatCurrency(taxSummary.qstCents, order.currency, locale),
      accent: false,
    },
    {
      label: language === "fr" ? "Taxes totales" : "Total taxes",
      value: formatCurrency(order.taxCents, order.currency, locale),
      accent: false,
    },
    {
      label: language === "fr" ? "Total" : "Total",
      value: formatCurrency(order.totalCents, order.currency, locale),
      accent: false,
      dividerBefore: true,
      strong: true,
    },
  ];

  return (
    <>
      <section className="section">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <p className="small" style={{ margin: 0, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>
              {language === "fr" ? "Facture client" : "Customer invoice"}
            </p>
            <h1>{language === "fr" ? `Commande #${order.orderNumber}` : `Order #${order.orderNumber}`}</h1>
            <p className="small">
              {language === "fr"
                ? `Passée le ${formatDate(order.createdAt, locale)}`
                : `Placed on ${formatDate(order.createdAt, locale)}`}
            </p>
          </div>
          <Link className="btn btn-secondary" href="/account/orders">
            {language === "fr" ? "Retour à mes commandes" : "Back to my orders"}
          </Link>
        </div>
      </section>

      <section className="section">
        <div className="invoice-overview-grid">
          {statusItems.map((item) => (
            <div key={item.label} className={`invoice-overview-item${item.kind === "total" ? " invoice-overview-item--total" : ""}`}>
              <p className="small">{item.label}</p>
              {item.kind === "badge" ? <span className="badge">{item.value}</span> : null}
              {item.kind === "text" ? <strong>{item.value}</strong> : null}
              {item.kind === "total" ? <strong className="invoice-overview-total">{item.value}</strong> : null}
            </div>
          ))}
        </div>
      </section>

      {order.deliveryStatus === "UNSCHEDULED" ? (
        <section className="section">
          <div
            style={{
              padding: "14px 16px",
              borderRadius: 16,
              border: "1px solid rgba(180, 83, 9, 0.18)",
              background: "rgba(255, 247, 237, 0.95)",
            }}
          >
            <p className="small" style={{ margin: 0, fontWeight: 700, color: "#9a3412" }}>
              {language === "fr" ? "Planification manuelle en cours" : "Manual scheduling in progress"}
            </p>
            <p className="small" style={{ margin: "6px 0 0" }}>
              {language === "fr"
                ? "Aucun créneau n'était libre au moment de la commande. Notre équipe te contactera pour confirmer une plage de livraison."
                : "No slot was available at the time of order. Our team will contact you to confirm a delivery window."}
            </p>
          </div>
        </section>
      ) : null}

      <section className="section">
        <h2>{language === "fr" ? "Client et livraison" : "Customer and delivery"}</h2>
        <div className="invoice-two-column">
          <div className="invoice-panel">
            <p className="invoice-panel-label">{language === "fr" ? "Client" : "Customer"}</p>
            <strong className="invoice-panel-value">{order.customerName}</strong>
            <p className="small" style={{ marginTop: 6 }}>{order.customerEmail}</p>
          </div>
          <div className="invoice-panel">
            <p className="invoice-panel-label">{language === "fr" ? "Livraison" : "Delivery"}</p>
            <strong className="invoice-panel-value">{shippingAddress || "-"}</strong>
            <div className="invoice-meta-list">
              <p className="small">
                {language === "fr" ? "Plage de livraison" : "Delivery window"}: {deliveryWindowLabel}
              </p>
              <p className="small">{language === "fr" ? "Téléphone" : "Phone"}: {order.deliveryPhone ?? "-"}</p>
              <p className="small">
                {language === "fr" ? "Instructions" : "Instructions"}: {order.deliveryInstructions ?? "-"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <h2>{language === "fr" ? "Articles" : "Items"}</h2>
        <div className="invoice-line-items">
          {order.items.map((item) => (
            <div key={item.id} className="invoice-line-item">
              <div>
                <strong className="invoice-panel-value">
                  {language === "fr" ? item.productNameSnapshotFr : item.productNameSnapshotEn}
                </strong>
                <p className="small" style={{ marginTop: 6 }}>
                  {language === "fr" ? "Quantité" : "Qty"}: {item.quantity} · {language === "fr" ? "Prix unit." : "Unit price"}:{" "}
                  {formatCurrency(item.unitPriceCents, order.currency, locale)}
                </p>
              </div>
              <strong className="invoice-line-price">
                {formatCurrency(item.lineTotalCents, order.currency, locale)}
              </strong>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>{language === "fr" ? "Montants" : "Amounts"}</h2>
        <div className="invoice-amount-card">
          {amountRows.map((row) => (
            <div key={row.label}>
              {row.dividerBefore ? <div className="checkout-summary-divider" /> : null}
              <div className={`checkout-summary-row${row.strong ? " invoice-amount-row--strong" : ""}`}>
                <span className={row.accent ? "checkout-summary-free" : undefined}>{row.label}</span>
                <span className={row.strong ? "invoice-overview-total" : undefined}>{row.value}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

