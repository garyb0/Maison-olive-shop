"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";

type AdminOrderActionsProps = {
  language: "fr" | "en";
  orderId: string;
  initialStatus: string;
  initialPaymentStatus: string;
  initialDeliveryStatus: string;
};

const ORDER_STATUS_OPTIONS = [
  "PENDING",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const;

const PAYMENT_STATUS_OPTIONS = ["PENDING", "PAID", "FAILED", "REFUNDED"] as const;

const DELIVERY_STATUS_OPTIONS = [
  "UNSCHEDULED",
  "SCHEDULED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "FAILED",
  "RESCHEDULED",
] as const;

const DELIVERY_STATUS_LABELS: Record<string, { fr: string; en: string }> = {
  UNSCHEDULED: { fr: "Appel client requis", en: "Call customer" },
  SCHEDULED: { fr: "Planifiée", en: "Scheduled" },
  OUT_FOR_DELIVERY: { fr: "En livraison", en: "Out for delivery" },
  DELIVERED: { fr: "Livrée", en: "Delivered" },
  FAILED: { fr: "Échouée", en: "Failed" },
  RESCHEDULED: { fr: "Replanifiée", en: "Rescheduled" },
};

export function AdminOrderActions({
  language,
  orderId,
  initialStatus,
  initialPaymentStatus,
  initialDeliveryStatus,
}: AdminOrderActionsProps) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [paymentStatus, setPaymentStatus] = useState(initialPaymentStatus);
  const [deliveryStatus, setDeliveryStatus] = useState(initialDeliveryStatus);
  const [loadingField, setLoadingField] = useState<"status" | "paymentStatus" | "deliveryStatus" | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const updateOrder = async (
    field: "status" | "paymentStatus" | "deliveryStatus",
    value: string,
  ) => {
    setLoadingField(field);
    setSuccessMessage("");
    setErrorMessage("");

    const previousValues = { status, paymentStatus, deliveryStatus };

    if (field === "status") setStatus(value);
    if (field === "paymentStatus") setPaymentStatus(value);
    if (field === "deliveryStatus") setDeliveryStatus(value);

    try {
      const res = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, [field]: value }),
      });

      if (!res.ok) {
        let apiError: string | null = null;
        try {
          const payload = (await res.json()) as { error?: string };
          apiError = typeof payload.error === "string" ? payload.error : null;
        } catch {
          // no-op
        }

        setStatus(previousValues.status);
        setPaymentStatus(previousValues.paymentStatus);
        setDeliveryStatus(previousValues.deliveryStatus);
        setErrorMessage(
          language === "fr"
            ? apiError
              ? `Impossible de mettre à jour la commande: ${apiError}`
              : "Impossible de mettre à jour la commande."
            : apiError
              ? `Unable to update order: ${apiError}`
              : "Unable to update order.",
        );
        return;
      }

      setSuccessMessage(
        language === "fr"
          ? "Commande mise à jour. Rafraichissement de la fiche..."
          : "Order updated. Refreshing details...",
      );
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setStatus(previousValues.status);
      setPaymentStatus(previousValues.paymentStatus);
      setDeliveryStatus(previousValues.deliveryStatus);
      setErrorMessage(
        language === "fr"
          ? "Une erreur est survenue pendant la mise à jour."
          : "An error occurred while updating the order.",
      );
    } finally {
      setLoadingField(null);
    }
  };

  const selectStyle = (field: "status" | "paymentStatus" | "deliveryStatus") => ({
    fontSize: "0.9rem",
    padding: "6px 8px",
    maxWidth: 220,
    opacity: loadingField === field ? 0.5 : 1,
  });

  return (
    <section className="section">
      <h2>{language === "fr" ? "Actions rapides" : "Quick actions"}</h2>
      <p className="small">
        {language === "fr"
          ? "Modifie les statuts ici sans revenir à la liste des commandes."
          : "Update statuses here without going back to the orders list."}
      </p>
      {successMessage ? <p className="ok small">{successMessage}</p> : null}
      {errorMessage ? <p className="err small">{errorMessage}</p> : null}
      <div className="row" style={{ gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label className="small" htmlFor="admin-order-status">
            {language === "fr" ? "Statut commande" : "Order status"}
          </label>
          <select
            id="admin-order-status"
            className="select"
            value={status}
            disabled={loadingField !== null}
            onChange={(event) => void updateOrder("status", event.target.value)}
            style={selectStyle("status")}
          >
            {ORDER_STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label className="small" htmlFor="admin-order-payment-status">
            {language === "fr" ? "Paiement" : "Payment"}
          </label>
          <select
            id="admin-order-payment-status"
            className="select"
            value={paymentStatus}
            disabled={loadingField !== null}
            onChange={(event) => void updateOrder("paymentStatus", event.target.value)}
            style={selectStyle("paymentStatus")}
          >
            {PAYMENT_STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label className="small" htmlFor="admin-order-delivery-status">
            {language === "fr" ? "Livraison" : "Delivery"}
          </label>
          <select
            id="admin-order-delivery-status"
            className="select"
            value={deliveryStatus}
            disabled={loadingField !== null}
            onChange={(event) => void updateOrder("deliveryStatus", event.target.value)}
            style={selectStyle("deliveryStatus")}
          >
            {DELIVERY_STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {DELIVERY_STATUS_LABELS[option][language]}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}
