import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentLanguage } from "@/lib/language";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/auth";
import { getAdminOrderAuditLogs, getAdminOrderDetail } from "@/lib/admin";
import { formatCurrency, formatDate } from "@/lib/format";
import { computeStoredOrderTaxBreakdown } from "@/lib/taxes";
import { AdminOrderActions } from "./admin-order-actions";

type AdminOrderDetailsPageProps = {
  params: Promise<{ id: string }>;
};

function formatAddress(parts: Array<string | null | undefined>) {
  return parts.map((part) => part?.trim()).filter(Boolean).join(", ");
}

function formatMetadata(metadata: string | null) {
  if (!metadata) return "-";

  try {
    return JSON.stringify(JSON.parse(metadata), null, 2);
  } catch {
    return metadata;
  }
}

function parseMetadata(metadata: string | null) {
  if (!metadata) return null;

  try {
    return JSON.parse(metadata) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getActorLabel(
  actor: { email: string; firstName: string; lastName: string } | null,
) {
  if (!actor) return "-";
  const fullName = `${actor.firstName} ${actor.lastName}`.trim();
  return fullName || actor.email;
}

function getAuditSummary(
  action: string,
  metadata: Record<string, unknown> | null,
  language: "fr" | "en",
) {
  const from = typeof metadata?.from === "string" ? metadata.from : null;
  const to = typeof metadata?.to === "string" ? metadata.to : null;

  if (action === "ORDER_STATUS_UPDATED") {
    return {
      title: language === "fr" ? "Statut de commande modifié" : "Order status updated",
      detail:
        from && to
          ? `${from} -> ${to}`
          : language === "fr"
            ? "Changement manuel du statut de commande."
            : "Manual order status change.",
    };
  }

  if (action === "PAYMENT_STATUS_UPDATED") {
    return {
      title: language === "fr" ? "Statut de paiement modifié" : "Payment status updated",
      detail:
        from && to
          ? `${from} -> ${to}`
          : language === "fr"
            ? "Changement manuel du statut de paiement."
            : "Manual payment status change.",
    };
  }

  if (action === "DELIVERY_STATUS_UPDATED") {
    return {
      title: language === "fr" ? "Statut de livraison modifié" : "Delivery status updated",
      detail:
        from && to
          ? `${from} -> ${to}`
          : language === "fr"
            ? "Changement manuel du statut de livraison."
            : "Manual delivery status change.",
    };
  }

  if (action === "DELIVERY_SLOT_RESCHEDULED") {
    const fromValue =
      metadata?.from && typeof metadata.from === "object" && metadata.from !== null
        ? (metadata.from as Record<string, unknown>)
        : null;
    const toValue =
      metadata?.to && typeof metadata.to === "object" && metadata.to !== null
        ? (metadata.to as Record<string, unknown>)
        : null;
    const fromSlot = typeof fromValue?.deliverySlotId === "string" ? fromValue.deliverySlotId : null;
    const toSlot = typeof toValue?.deliverySlotId === "string" ? toValue.deliverySlotId : null;

    return {
      title: language === "fr" ? "Créneau de livraison replanifié" : "Delivery slot rescheduled",
      detail:
        fromSlot || toSlot
          ? `${fromSlot ?? (language === "fr" ? "aucun" : "none")} -> ${toSlot ?? (language === "fr" ? "aucun" : "none")}`
          : language === "fr"
            ? "Le créneau de livraison a été modifié."
            : "The delivery slot was changed.",
    };
  }

  return {
    title: action,
    detail: language === "fr" ? "Événement enregistré sur cette commande." : "Event recorded for this order.",
  };
}

function getDeliveryStatusLabel(status: string, language: "fr" | "en") {
  const labels: Record<string, { fr: string; en: string }> = {
    UNSCHEDULED: { fr: "Appel client requis", en: "Call customer" },
    SCHEDULED: { fr: "Planifiée", en: "Scheduled" },
    OUT_FOR_DELIVERY: { fr: "En livraison", en: "Out for delivery" },
    DELIVERED: { fr: "Livrée", en: "Delivered" },
    FAILED: { fr: "Échouée", en: "Failed" },
    RESCHEDULED: { fr: "Replanifiée", en: "Rescheduled" },
  };

  return labels[status]?.[language] ?? status;
}

export default async function AdminOrderDetailsPage({ params }: AdminOrderDetailsPageProps) {
  const { id } = await params;
  const [language, user, order, logs] = await Promise.all([
    getCurrentLanguage(),
    getCurrentUser(),
    getAdminOrderDetail(id),
    getAdminOrderAuditLogs(id),
  ]);
  const t = getDictionary(language);
  const locale = language === "fr" ? "fr-CA" : "en-CA";

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

  if (!order) {
    notFound();
  }

  const deliveryWindowLabel =
    order.deliveryWindowStartAt && order.deliveryWindowEndAt
      ? `${formatDate(order.deliveryWindowStartAt, locale)} -> ${formatDate(order.deliveryWindowEndAt, locale)}`
      : language === "fr"
        ? "Appel client requis"
        : "Call customer";

  const shippingAddress = formatAddress([
    order.shippingLine1,
    order.shippingCity,
    order.shippingRegion,
    order.shippingPostal,
    order.shippingCountry,
  ]);
  const taxSummary = computeStoredOrderTaxBreakdown(
    order.subtotalCents,
    order.discountCents,
    order.shippingCents,
  );

  const timelineEntries = logs.map((log) => {
    const parsedMetadata = parseMetadata(log.metadata);
    return {
      ...log,
      actorLabel: getActorLabel(log.actor),
      summary: getAuditSummary(log.action, parsedMetadata, language),
    };
  });

  return (
    <>
      <section className="section">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <h1>{language === "fr" ? `Commande #${order.orderNumber}` : `Order #${order.orderNumber}`}</h1>
            <p className="small">
              {language === "fr"
                ? `Créée le ${formatDate(order.createdAt, locale)}`
                : `Created on ${formatDate(order.createdAt, locale)}`}
            </p>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <Link className="btn btn-secondary" href="/admin/orders">
              {language === "fr" ? "Retour aux commandes" : "Back to orders"}
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <h2>{language === "fr" ? "Résumé" : "Summary"}</h2>
        <div className="row" style={{ gap: 24, flexWrap: "wrap" }}>
          <div>
            <p className="small">{language === "fr" ? "Statut commande" : "Order status"}</p>
            <span className="badge">{order.status}</span>
          </div>
          <div>
            <p className="small">{language === "fr" ? "Paiement" : "Payment"}</p>
            <span className="badge">{order.paymentStatus}</span>
          </div>
          <div>
            <p className="small">{language === "fr" ? "Livraison" : "Delivery"}</p>
            <span className="badge">{getDeliveryStatusLabel(order.deliveryStatus, language)}</span>
          </div>
          <div>
            <p className="small">{language === "fr" ? "Total" : "Total"}</p>
            <strong>{formatCurrency(order.totalCents, order.currency, locale)}</strong>
          </div>
          <div>
            <p className="small">{language === "fr" ? "Code promo" : "Promo code"}</p>
            <span className="badge">{order.promoCode ?? "-"}</span>
          </div>
        </div>
      </section>

      <AdminOrderActions
        language={language}
        orderId={order.id}
        initialStatus={order.status}
        initialPaymentStatus={order.paymentStatus}
        initialDeliveryStatus={order.deliveryStatus}
      />

      <section className="section">
        <h2>{language === "fr" ? "Client et livraison" : "Customer and delivery"}</h2>
        {order.deliveryStatus === "UNSCHEDULED" ? (
          <div
            style={{
              marginBottom: 16,
              padding: "14px 16px",
              borderRadius: 16,
              border: "1px solid rgba(180, 83, 9, 0.18)",
              background: "rgba(255, 247, 237, 0.95)",
            }}
          >
            <p className="small" style={{ margin: 0, fontWeight: 700, color: "#9a3412" }}>
              {language === "fr" ? "Planification manuelle requise" : "Manual scheduling required"}
            </p>
            <p className="small" style={{ margin: "6px 0 0" }}>
              {language === "fr"
                ? "Aucun créneau n'a été confirmé sur cette commande. Appelez le client pour convenir d'une plage de livraison."
                : "No delivery slot was confirmed for this order. Call the customer to agree on a delivery window."}
            </p>
          </div>
        ) : null}
        <div className="row" style={{ gap: 32, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ minWidth: 260 }}>
            <p><strong>{order.customerName}</strong></p>
            <p className="small">{order.customerEmail}</p>
            <p className="small">
              {language === "fr" ? "Compte lié" : "Linked account"}: {" "}
              {order.user
                ? `${order.user.firstName} ${order.user.lastName} (${order.user.role})`
                : language === "fr"
                  ? "Commande invitée"
                  : "Guest checkout"}
            </p>
          </div>
          <div style={{ minWidth: 260 }}>
            <p className="small">{language === "fr" ? "Adresse" : "Address"}</p>
            <p>{shippingAddress || "-"}</p>
            <p className="small">{language === "fr" ? "Créneau" : "Window"}: {deliveryWindowLabel}</p>
            <p className="small">{language === "fr" ? "Téléphone" : "Phone"}: {order.deliveryPhone ?? "-"}</p>
            <p className="small">
              {language === "fr" ? "Instructions" : "Instructions"}: {order.deliveryInstructions ?? "-"}
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <h2>{language === "fr" ? "Montants" : "Amounts"}</h2>
        <div className="table-wrap">
          <table>
            <tbody>
              <tr>
                <td>{language === "fr" ? "Sous-total" : "Subtotal"}</td>
                <td>{formatCurrency(order.subtotalCents, order.currency, locale)}</td>
              </tr>
              <tr>
                <td>{language === "fr" ? "Remise" : "Discount"}</td>
                <td>{formatCurrency(order.discountCents, order.currency, locale)}</td>
              </tr>
              <tr>
                <td>{language === "fr" ? "Code promo" : "Promo code"}</td>
                <td>{order.promoCode ?? "-"}</td>
              </tr>
              <tr>
                <td>{language === "fr" ? "Base taxable" : "Taxable amount"}</td>
                <td>{formatCurrency(taxSummary.taxableCents, order.currency, locale)}</td>
              </tr>
              <tr>
                <td>{language === "fr" ? "TPS (5%)" : "GST (5%)"}</td>
                <td>{formatCurrency(taxSummary.gstCents, order.currency, locale)}</td>
              </tr>
              <tr>
                <td>{language === "fr" ? "TVQ (9,975%)" : "QST (9.975%)"}</td>
                <td>{formatCurrency(taxSummary.qstCents, order.currency, locale)}</td>
              </tr>
              <tr>
                <td>{language === "fr" ? "Taxes totales" : "Total taxes"}</td>
                <td>{formatCurrency(order.taxCents, order.currency, locale)}</td>
              </tr>
              <tr>
                <td>{language === "fr" ? "Livraison" : "Shipping"}</td>
                <td>{formatCurrency(order.shippingCents, order.currency, locale)}</td>
              </tr>
              <tr>
                <td>{language === "fr" ? "Remboursement" : "Refunded"}</td>
                <td>{formatCurrency(order.refundedCents, order.currency, locale)}</td>
              </tr>
              <tr>
                <td><strong>{language === "fr" ? "Total" : "Total"}</strong></td>
                <td><strong>{formatCurrency(order.totalCents, order.currency, locale)}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="small" style={{ marginTop: 12 }}>
          {language === "fr" ? "Méthode de paiement" : "Payment method"}: {order.paymentMethod}
          {order.paymentProvider ? ` · ${order.paymentProvider}` : ""}
        </p>
      </section>

      <section className="section">
        <h2>{language === "fr" ? "Articles" : "Items"}</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{language === "fr" ? "Produit" : "Product"}</th>
                <th>{language === "fr" ? "Quantité" : "Quantity"}</th>
                <th>{language === "fr" ? "Prix unitaire" : "Unit price"}</th>
                <th>{language === "fr" ? "Ligne" : "Line total"}</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <strong>{language === "fr" ? item.productNameSnapshotFr : item.productNameSnapshotEn}</strong>
                      {item.product?.slug ? <span className="small">/{item.product.slug}</span> : null}
                    </div>
                  </td>
                  <td>{item.quantity}</td>
                  <td>{formatCurrency(item.unitPriceCents, order.currency, locale)}</td>
                  <td>{formatCurrency(item.lineTotalCents, order.currency, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <h2>{language === "fr" ? "Historique" : "History"}</h2>
        {timelineEntries.length === 0 ? (
          <p className="small">{language === "fr" ? "Aucune trace d'audit." : "No audit trail yet."}</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {timelineEntries.map((entry) => (
              <article
                className="card"
                key={entry.id}
                style={{ padding: 16, borderLeft: "4px solid #6b8f71" }}
              >
                <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <strong>{entry.summary.title}</strong>
                      <span className="badge">{entry.action}</span>
                    </div>
                    <p className="small" style={{ marginTop: 6 }}>{entry.summary.detail}</p>
                    <p className="small" style={{ marginTop: 6 }}>
                      {language === "fr" ? "Acteur" : "Actor"}: {entry.actorLabel}
                    </p>
                  </div>
                  <span className="small">{formatDate(entry.createdAt, locale)}</span>
                </div>
                {entry.metadata ? (
                  <details style={{ marginTop: 12 }}>
                    <summary className="small" style={{ cursor: "pointer" }}>
                      {language === "fr" ? "Voir les détails techniques" : "View technical details"}
                    </summary>
                    <pre style={{ margin: "10px 0 0 0", whiteSpace: "pre-wrap", fontSize: "0.8rem" }}>
                      {formatMetadata(entry.metadata)}
                    </pre>
                  </details>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
