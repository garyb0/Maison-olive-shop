"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Dictionary, Language } from "@/lib/i18n";

type Props = {
  language: Language;
  t: Dictionary;
  orders: Array<{
    id: string;
    customerType: "account" | "guest";
    orderNumber: string;
    customerEmail: string;
    customerName: string;
    promoCode: string | null;
    status: string;
    paymentStatus: string;
    totalLabel: string;
    createdAtLabel: string;
    deliveryWindowLabel: string;
    deliveryStatus: string;
    deliveryPhone: string | null;
    deliveryInstructions: string | null;
  }>;
};

const DELIVERY_STATUS_OPTIONS = [
  "UNSCHEDULED",
  "SCHEDULED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "FAILED",
  "RESCHEDULED",
] as const;

const ORDER_STATUS_OPTIONS = [
  "PENDING",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const;

const PAYMENT_STATUS_OPTIONS = ["PENDING", "PAID", "FAILED", "REFUNDED"] as const;

const DELIVERY_STATUS_LABELS_FR: Record<string, string> = {
  UNSCHEDULED: "Appel client requis",
  SCHEDULED: "Planifiée",
  OUT_FOR_DELIVERY: "En livraison",
  DELIVERED: "Livrée",
  FAILED: "Échouée",
  RESCHEDULED: "Replanifiée",
};

const DELIVERY_STATUS_BADGES: Record<string, string> = {
  UNSCHEDULED: "Call client",
  SCHEDULED: "Planned",
  OUT_FOR_DELIVERY: "Route",
  DELIVERED: "Done",
  FAILED: "Issue",
  RESCHEDULED: "Redo",
};

export function AdminOrdersClient({ language, t, orders: initialOrders }: Props) {
  const [orders, setOrders] = useState(initialOrders);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [paymentFilter, setPaymentFilter] = useState<string>("");
  const [deliveryFilter, setDeliveryFilter] = useState<string>("");
  const [customerFilter, setCustomerFilter] = useState<string>("");
  const [orderPage, setOrderPage] = useState(1);
  const [orderPageSize, setOrderPageSize] = useState(10);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState("");

  const updateOrder = async (
    orderId: string,
    patch: Partial<Pick<Props["orders"][number], "status" | "paymentStatus" | "deliveryStatus">>,
  ) => {
    setUpdatingId(orderId);
    setUpdateError("");

    try {
      const res = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, ...patch }),
      });

      if (!res.ok) {
        let apiError: string | null = null;
        try {
          const payload = (await res.json()) as { error?: string };
          apiError = typeof payload.error === "string" ? payload.error : null;
        } catch {
          // no-op
        }

        setUpdateError(
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

      const payload = (await res.json()) as {
        order?: Partial<Pick<Props["orders"][number], "id" | "status" | "paymentStatus" | "deliveryStatus">>;
      };

      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId
            ? {
                ...order,
                ...patch,
                ...payload.order,
              }
            : order,
        ),
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const statusOk = !statusFilter || order.status === statusFilter;
      const paymentOk = !paymentFilter || order.paymentStatus === paymentFilter;
      const deliveryOk = !deliveryFilter || order.deliveryStatus === deliveryFilter;
      const customerOk =
        !customerFilter ||
        order.customerEmail.toLowerCase().includes(customerFilter.toLowerCase()) ||
        order.customerName.toLowerCase().includes(customerFilter.toLowerCase());

      return statusOk && paymentOk && deliveryOk && customerOk;
    });
  }, [orders, statusFilter, paymentFilter, deliveryFilter, customerFilter]);

  const orderTotalPages = Math.max(1, Math.ceil(filteredOrders.length / orderPageSize));
  const safeOrderPage = Math.min(orderPage, orderTotalPages);
  const pagedOrders = filteredOrders.slice((safeOrderPage - 1) * orderPageSize, safeOrderPage * orderPageSize);

  const clearOrderFilters = () => {
    setStatusFilter("");
    setPaymentFilter("");
    setDeliveryFilter("");
    setCustomerFilter("");
    setOrderPage(1);
  };

  return (
    <>
      <section className="section">
        <h1>{t.orders}</h1>
        <p className="small">
          {language === "fr"
            ? "Gérez toutes les commandes de la boutique."
            : "Manage all shop orders."}
        </p>
        <p className="small">
          {language === "fr"
            ? "Chaque ligne permet de modifier le statut de commande, le paiement et la livraison."
            : "Each row lets you update order, payment, and delivery statuses."}
        </p>
      </section>

      <section className="section">
        <div className="row" style={{ marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
          <input
            className="input"
            placeholder={language === "fr" ? "Filtre client ou email" : "Filter customer or email"}
            value={customerFilter}
            onChange={(e) => {
              setCustomerFilter(e.target.value);
              setOrderPage(1);
            }}
            style={{ maxWidth: 240 }}
          />
          <select
            className="select"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setOrderPage(1);
            }}
            style={{ maxWidth: 180 }}
          >
            <option value="">{language === "fr" ? "Tous les statuts" : "All statuses"}</option>
            {Array.from(new Set(orders.map((o) => o.status))).map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <select
            className="select"
            value={paymentFilter}
            onChange={(e) => {
              setPaymentFilter(e.target.value);
              setOrderPage(1);
            }}
            style={{ maxWidth: 180 }}
          >
            <option value="">{language === "fr" ? "Tous paiements" : "All payments"}</option>
            {Array.from(new Set(orders.map((o) => o.paymentStatus))).map((ps) => (
              <option key={ps} value={ps}>
                {ps}
              </option>
            ))}
          </select>

          <select
            className="select"
            value={deliveryFilter}
            onChange={(e) => {
              setDeliveryFilter(e.target.value);
              setOrderPage(1);
            }}
            style={{ maxWidth: 200 }}
          >
            <option value="">{language === "fr" ? "Toutes livraisons" : "All deliveries"}</option>
            {DELIVERY_STATUS_OPTIONS.map((ds) => (
              <option key={ds} value={ds}>
                {language === "fr" ? DELIVERY_STATUS_LABELS_FR[ds] : ds}
              </option>
            ))}
          </select>

          <select
            className="select"
            value={String(orderPageSize)}
            onChange={(e) => {
              setOrderPageSize(Number(e.target.value));
              setOrderPage(1);
            }}
            style={{ maxWidth: 120 }}
          >
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </select>

          <button className="btn" onClick={clearOrderFilters}>
            {language === "fr" ? "Réinitialiser filtres" : "Reset filters"}
          </button>
        </div>

        <div className="row" style={{ marginBottom: 10, gap: 8 }}>
          <button className="btn" onClick={() => setOrderPage((p) => Math.max(1, p - 1))} disabled={safeOrderPage <= 1}>
            {language === "fr" ? "Précédent" : "Previous"}
          </button>
          <span className="small">
            {language === "fr" ? "Page" : "Page"} {safeOrderPage}/{orderTotalPages} · {filteredOrders.length}{" "}
            {language === "fr" ? "résultats" : "results"}
          </span>
          <button
            className="btn"
            onClick={() => setOrderPage((p) => Math.min(orderTotalPages, p + 1))}
            disabled={safeOrderPage >= orderTotalPages}
          >
            {language === "fr" ? "Suivant" : "Next"}
          </button>
        </div>

        {updateError ? <p className="err small">{updateError}</p> : null}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{language === "fr" ? "Commande" : "Order"}</th>
                <th>{language === "fr" ? "Client" : "Customer"}</th>
                <th>Email</th>
                <th>{language === "fr" ? "Date" : "Date"}</th>
                <th>{language === "fr" ? "Actions" : "Actions"}</th>
                <th>{language === "fr" ? "Total" : "Total"}</th>
              </tr>
            </thead>
            <tbody>
              {pagedOrders.map((order) => (
                <tr key={order.id}>
                  <td>{order.orderNumber}</td>
                  <td>
                    <div style={{ display: "grid", gap: 6 }}>
                      <span>{order.customerName}</span>
                      <span className="small" style={{
                        width: "fit-content",
                        padding: "0.2rem 0.5rem",
                        borderRadius: 999,
                        border: "1px solid rgba(197, 170, 109, 0.24)",
                        background: order.customerType === "guest" ? "rgba(197, 149, 90, 0.12)" : "rgba(92, 107, 64, 0.1)",
                        color: order.customerType === "guest" ? "#9a5d1b" : "#55663b",
                        fontWeight: 700,
                      }}>
                        {order.customerType === "guest"
                          ? (language === "fr" ? "Invité" : "Guest")
                          : (language === "fr" ? "Client enregistré" : "Registered")}
                      </span>
                    </div>
                  </td>
                  <td>{order.customerEmail}</td>
                  <td>{order.createdAtLabel}</td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 220 }}>
                      <div>
                        <Link className="btn btn-secondary" href={`/admin/orders/${order.id}`}>
                        {language === "fr" ? "Voir détails" : "View details"}
                        </Link>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span className="small">{language === "fr" ? "Statut commande" : "Order status"}</span>
                        <select
                          className="select"
                          value={order.status}
                          disabled={updatingId === order.id}
                          onChange={(e) => void updateOrder(order.id, { status: e.target.value })}
                          style={{
                            fontSize: "0.8rem",
                            padding: "2px 4px",
                            maxWidth: 180,
                            opacity: updatingId === order.id ? 0.5 : 1,
                          }}
                        >
                          {ORDER_STATUS_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span className="small">{language === "fr" ? "Paiement" : "Payment"}</span>
                        <select
                          className="select"
                          value={order.paymentStatus}
                          disabled={updatingId === order.id}
                          onChange={(e) => void updateOrder(order.id, { paymentStatus: e.target.value })}
                          style={{
                            fontSize: "0.8rem",
                            padding: "2px 4px",
                            maxWidth: 180,
                            opacity: updatingId === order.id ? 0.5 : 1,
                          }}
                        >
                          {PAYMENT_STATUS_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span className="small">{language === "fr" ? "Livraison" : "Delivery"}</span>
                        <span className="small">{order.deliveryWindowLabel}</span>
                        <select
                          className="select"
                          value={order.deliveryStatus}
                          disabled={updatingId === order.id}
                          onChange={(e) => void updateOrder(order.id, { deliveryStatus: e.target.value })}
                          style={{
                            fontSize: "0.8rem",
                            padding: "2px 4px",
                            maxWidth: 180,
                            opacity: updatingId === order.id ? 0.5 : 1,
                          }}
                        >
                          {DELIVERY_STATUS_OPTIONS.map((ds) => (
                            <option key={ds} value={ds}>
                              {language === "fr" ? DELIVERY_STATUS_LABELS_FR[ds] : ds}
                            </option>
                          ))}
                        </select>
                        <span
                          className="small"
                          style={order.deliveryStatus === "UNSCHEDULED" ? { color: "#b45309", fontWeight: 700 } : undefined}
                        >
                          {DELIVERY_STATUS_BADGES[order.deliveryStatus] ?? order.deliveryStatus}
                        </span>
                      </div>
                      {order.deliveryPhone ? <span className="small">Tel: {order.deliveryPhone}</span> : null}
                      {order.promoCode ? (
                        <span className="small">
                          {language === "fr" ? "Code promo" : "Promo code"}: <strong>{order.promoCode}</strong>
                        </span>
                      ) : null}
                      {order.deliveryInstructions ? (
                        <span className="small" title={order.deliveryInstructions}>
                          Note: {order.deliveryInstructions.slice(0, 30)}
                          {order.deliveryInstructions.length > 30 ? "..." : ""}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td>{order.totalLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
