"use client";

import { useState } from "react";

type Subscription = {
  id: string;
  status: string;
  product: {
    nameFr: string;
    nameEn: string;
    imageUrl: string | null;
  };
  quantity: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  nextPaymentDate?: string;
  lastPaymentDate?: string;
};

type Props = {
  subscriptions: Subscription[];
  language: "fr" | "en";
};

const statusLabels: Record<string, { fr: string; en: string; color: string }> = {
  ACTIVE: { fr: "Actif", en: "Active", color: "var(--success)" },
  PAST_DUE: { fr: "Paiement en retard", en: "Payment overdue", color: "var(--warning)" },
  CANCELED: { fr: "Annulé", en: "Canceled", color: "var(--muted)" },
  PAUSED: { fr: "En pause", en: "Paused", color: "var(--muted)" },
  EXPIRED: { fr: "Expiré", en: "Expired", color: "var(--muted)" },
};

export default function UserSubscriptionsClient({ subscriptions, language }: Props) {
  const [loading, setLoading] = useState<string | null>(null);

  const formatDate = (iso: string) => {
    const locale = language === "fr" ? "fr-CA" : "en-CA";
    return new Date(iso).toLocaleDateString(locale, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const cancelSubscription = async (id: string) => {
    const message = language === "fr"
      ? "Es-tu sûr de vouloir annuler cet abonnement ? Il restera actif jusqu'à la fin de la période."
      : "Are you sure you want to cancel this subscription? It will remain active until the end of the period.";

    if (!confirm(message)) {
      return;
    }

    setLoading(id);
    try {
      await fetch("/api/account/subscriptions/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId: id }),
      });
      window.location.reload();
    } finally {
      setLoading(null);
    }
  };

  if (subscriptions.length === 0) {
    return (
      <div className="support-lite-card account-empty-card">
        <p className="support-lite-card__eyebrow">{language === "fr" ? "Abonnements" : "Subscriptions"}</p>
        <h3>{language === "fr" ? "Aucun abonnement actif" : "No active subscriptions"}</h3>
        <p className="small">
          {language === "fr"
            ? "Tu n'as pas encore d'abonnement actif. Les formules récurrentes apparaîtront ici."
            : "You do not have active subscriptions yet. Recurring plans will appear here."}
        </p>
      </div>
    );
  }

  return (
    <div className="account-orders-grid">
      {subscriptions.map((sub) => {
        const productName = language === "fr" ? sub.product.nameFr : sub.product.nameEn;
        const status = statusLabels[sub.status] || statusLabels.ACTIVE;

        return (
          <article key={sub.id} className="account-order-card">
            <div className="account-order-card__head">
              <div>
                <p className="account-home-hero__eyebrow" style={{ marginBottom: 6 }}>
                  {language === "fr" ? "Abonnement" : "Subscription"}
                </p>
                <h3 style={{ margin: "0 0 4px", color: "#44321d" }}>{productName}</h3>
                <span className="badge" style={{ background: status.color, color: "white" }}>
                  {status[language]}
                </span>
              </div>

              {sub.status === "ACTIVE" && !sub.cancelAtPeriodEnd ? (
                <button
                  className="btn btn-danger"
                  disabled={loading === sub.id}
                  onClick={() => void cancelSubscription(sub.id)}
                  style={{ fontSize: "0.9rem" }}
                  type="button"
                >
                  {loading === sub.id ? "..." : language === "fr" ? "Annuler" : "Cancel"}
                </button>
              ) : sub.cancelAtPeriodEnd ? (
                <span className="badge" style={{ background: "var(--warning)" }}>
                  {language === "fr" ? "Annulé à la fin de période" : "Canceled at period end"}
                </span>
              ) : null}
            </div>

            <div className="account-order-card__meta small" style={{ marginTop: 4 }}>
              <div className="account-order-card__meta-block">
                <span className="account-order-card__meta-label">{language === "fr" ? "Début période" : "Period start"}</span>
                <strong>{formatDate(sub.currentPeriodStart)}</strong>
              </div>
              <div className="account-order-card__meta-block">
                <span className="account-order-card__meta-label">{language === "fr" ? "Fin période" : "Period end"}</span>
                <strong>{formatDate(sub.currentPeriodEnd)}</strong>
              </div>
              {sub.nextPaymentDate ? (
                <div className="account-order-card__meta-block">
                  <span className="account-order-card__meta-label">{language === "fr" ? "Prochain paiement" : "Next payment"}</span>
                  <strong>{formatDate(sub.nextPaymentDate)}</strong>
                </div>
              ) : null}
              {sub.lastPaymentDate ? (
                <div className="account-order-card__meta-block">
                  <span className="account-order-card__meta-label">{language === "fr" ? "Dernier paiement" : "Last payment"}</span>
                  <strong>{formatDate(sub.lastPaymentDate)}</strong>
                </div>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
