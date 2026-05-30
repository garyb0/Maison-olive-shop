"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Dictionary, Language } from "@/lib/i18n";

type AdminOrder = {
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
  supportConversations: Array<{
    id: string;
    status: string;
    priority: string | null;
    lastMessageAtLabel: string | null;
  }>;
};

type Props = {
  language: Language;
  t: Dictionary;
  orders: AdminOrder[];
};

type QueueFilter = "all" | "review" | "prepare" | "delivery" | "problem" | "support";

const DELIVERY_STATUS_OPTIONS = ["UNSCHEDULED", "SCHEDULED", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED", "RESCHEDULED"] as const;
const ORDER_STATUS_OPTIONS = ["PENDING", "PAID", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"] as const;
const PAYMENT_STATUS_OPTIONS = ["PENDING", "PAID", "FAILED", "REFUNDED"] as const;

const ORDER_STATUS_LABELS_FR: Record<string, string> = {
  PENDING: "À vérifier",
  PAID: "Payée",
  PROCESSING: "En préparation",
  SHIPPED: "Expédiée",
  DELIVERED: "Livrée",
  CANCELLED: "Annulée",
};

const PAYMENT_STATUS_LABELS_FR: Record<string, string> = {
  PENDING: "À confirmer",
  PAID: "Payé",
  FAILED: "Échec",
  REFUNDED: "Remboursé",
};

const DELIVERY_STATUS_LABELS_FR: Record<string, string> = {
  UNSCHEDULED: "Appel client requis",
  SCHEDULED: "Planifiée",
  OUT_FOR_DELIVERY: "En livraison",
  DELIVERED: "Livrée",
  FAILED: "Échouée",
  RESCHEDULED: "Replanifiée",
};

const DELIVERY_STATUS_LABELS_EN: Record<string, string> = {
  UNSCHEDULED: "Call customer",
  SCHEDULED: "Scheduled",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  FAILED: "Failed",
  RESCHEDULED: "Rescheduled",
};

function hasActiveSupport(order: AdminOrder) {
  return order.supportConversations.some((conversation) => conversation.status !== "CLOSED");
}

function orderMatchesQueue(order: AdminOrder, queue: QueueFilter) {
  if (queue === "all") return true;
  if (queue === "review") return order.status === "PENDING" || order.paymentStatus === "PENDING";
  if (queue === "prepare") return ["PAID", "PROCESSING"].includes(order.status) && order.paymentStatus === "PAID";
  if (queue === "delivery") return ["UNSCHEDULED", "RESCHEDULED"].includes(order.deliveryStatus);
  if (queue === "problem") return order.paymentStatus === "FAILED" || order.deliveryStatus === "FAILED" || order.status === "CANCELLED";
  if (queue === "support") return hasActiveSupport(order);
  return true;
}

export function AdminOrdersClient({ language, t, orders: initialOrders }: Props) {
  const [orders, setOrders] = useState(initialOrders);
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("all");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [deliveryFilter, setDeliveryFilter] = useState("");
  const [search, setSearch] = useState("");
  const [orderPage, setOrderPage] = useState(1);
  const [orderPageSize, setOrderPageSize] = useState(10);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState("");

  const formatOrderStatus = (status: string) => language === "fr" ? ORDER_STATUS_LABELS_FR[status] ?? status : status;
  const formatPaymentStatus = (status: string) => language === "fr" ? PAYMENT_STATUS_LABELS_FR[status] ?? status : status;
  const formatDeliveryStatus = (status: string) => (language === "fr" ? DELIVERY_STATUS_LABELS_FR : DELIVERY_STATUS_LABELS_EN)[status] ?? status;

  const updateOrder = async (
    orderId: string,
    patch: Partial<Pick<AdminOrder, "status" | "paymentStatus" | "deliveryStatus">>,
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
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        setUpdateError(
          language === "fr"
            ? `Impossible de mettre à jour la commande${payload.error ? `: ${payload.error}` : "."}`
            : `Unable to update order${payload.error ? `: ${payload.error}` : "."}`,
        );
        return;
      }

      const payload = (await res.json().catch(() => ({}))) as { order?: Partial<AdminOrder> };
      setOrders((prev) => prev.map((order) => order.id === orderId ? { ...order, ...patch, ...payload.order } : order));
    } finally {
      setUpdatingId(null);
    }
  };

  const queues = [
    { id: "all" as const, label: language === "fr" ? "Toutes" : "All", help: language === "fr" ? "Boîte complète" : "Full inbox" },
    { id: "review" as const, label: language === "fr" ? "À vérifier" : "Review", help: language === "fr" ? "Statut ou paiement à confirmer" : "Status or payment to confirm" },
    { id: "prepare" as const, label: language === "fr" ? "À préparer" : "Prepare", help: language === "fr" ? "Payées et prêtes" : "Paid and ready" },
    { id: "delivery" as const, label: language === "fr" ? "Livraison à planifier" : "Delivery planning", help: language === "fr" ? "Appel ou replanification" : "Call or reschedule" },
    { id: "problem" as const, label: language === "fr" ? "Problèmes" : "Problems", help: language === "fr" ? "Paiement ou livraison" : "Payment or delivery" },
    { id: "support" as const, label: "Support", help: language === "fr" ? "Conversation liée" : "Linked conversation" },
  ].map((queue) => ({
    ...queue,
    count: orders.filter((order) => orderMatchesQueue(order, queue.id)).length,
  }));

  const filteredOrders = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return orders.filter((order) => {
      const queueOk = orderMatchesQueue(order, queueFilter);
      const statusOk = !statusFilter || order.status === statusFilter;
      const paymentOk = !paymentFilter || order.paymentStatus === paymentFilter;
      const deliveryOk = !deliveryFilter || order.deliveryStatus === deliveryFilter;
      const searchOk =
        !needle ||
        order.orderNumber.toLowerCase().includes(needle) ||
        order.customerEmail.toLowerCase().includes(needle) ||
        order.customerName.toLowerCase().includes(needle);

      return queueOk && statusOk && paymentOk && deliveryOk && searchOk;
    });
  }, [orders, queueFilter, statusFilter, paymentFilter, deliveryFilter, search]);

  const orderTotalPages = Math.max(1, Math.ceil(filteredOrders.length / orderPageSize));
  const safeOrderPage = Math.min(orderPage, orderTotalPages);
  const pagedOrders = filteredOrders.slice((safeOrderPage - 1) * orderPageSize, safeOrderPage * orderPageSize);

  const clearOrderFilters = () => {
    setQueueFilter("all");
    setStatusFilter("");
    setPaymentFilter("");
    setDeliveryFilter("");
    setSearch("");
    setOrderPage(1);
  };

  return (
    <>
      <section className="section admin-page-header">
        <div className="admin-page-header__copy">
          <span className="admin-page-header__eyebrow">{language === "fr" ? "Inbox opérationnelle" : "Operational inbox"}</span>
          <h1>{t.orders}</h1>
          <p className="small">
            {language === "fr"
              ? "Les commandes sont regroupées par priorité pour préparer, planifier et répondre plus vite."
              : "Orders are grouped by priority so the team can prepare, plan, and reply faster."}
          </p>
        </div>
      </section>

      <section className="section admin-orders-inbox">
        <div className="admin-order-queue-grid" role="tablist" aria-label={language === "fr" ? "Files rapides" : "Quick queues"}>
          {queues.map((queue) => (
            <button
              className={`admin-order-queue-card${queueFilter === queue.id ? " admin-order-queue-card--active" : ""}`}
              key={queue.id}
              onClick={() => { setQueueFilter(queue.id); setOrderPage(1); }}
              type="button"
            >
              <span>{queue.label}</span>
              <strong>{queue.count}</strong>
              <small>{queue.help}</small>
            </button>
          ))}
        </div>

        <div className="admin-toolbar">
          <input
            className="input admin-filter-control"
            placeholder={language === "fr" ? "Client, email ou numéro commande" : "Customer, email, or order number"}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOrderPage(1); }}
          />
          <select className="select admin-filter-control" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setOrderPage(1); }}>
            <option value="">{language === "fr" ? "Tous les statuts" : "All statuses"}</option>
            {ORDER_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{formatOrderStatus(status)}</option>)}
          </select>
          <select className="select admin-filter-control" value={paymentFilter} onChange={(e) => { setPaymentFilter(e.target.value); setOrderPage(1); }}>
            <option value="">{language === "fr" ? "Tous paiements" : "All payments"}</option>
            {PAYMENT_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{formatPaymentStatus(status)}</option>)}
          </select>
          <select className="select admin-filter-control" value={deliveryFilter} onChange={(e) => { setDeliveryFilter(e.target.value); setOrderPage(1); }}>
            <option value="">{language === "fr" ? "Toutes livraisons" : "All deliveries"}</option>
            {DELIVERY_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{formatDeliveryStatus(status)}</option>)}
          </select>
          <select className="select admin-filter-control admin-filter-control--short" value={String(orderPageSize)} onChange={(e) => { setOrderPageSize(Number(e.target.value)); setOrderPage(1); }}>
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </select>
          <button className="btn" onClick={clearOrderFilters} type="button">
            {language === "fr" ? "Réinitialiser" : "Reset"}
          </button>
        </div>

        <div className="admin-pagination">
          <button className="btn" onClick={() => setOrderPage((p) => Math.max(1, p - 1))} disabled={safeOrderPage <= 1} type="button">
            {language === "fr" ? "Précédent" : "Previous"}
          </button>
          <span className="small">
            {language === "fr" ? "Page" : "Page"} {safeOrderPage}/{orderTotalPages} · {filteredOrders.length}{" "}
            {language === "fr" ? "résultats" : "results"}
          </span>
          <button className="btn" onClick={() => setOrderPage((p) => Math.min(orderTotalPages, p + 1))} disabled={safeOrderPage >= orderTotalPages} type="button">
            {language === "fr" ? "Suivant" : "Next"}
          </button>
        </div>

        {updateError ? <p className="err small">{updateError}</p> : null}

        <div className="admin-order-inbox-list">
          {pagedOrders.map((order) => {
            const activeSupport = order.supportConversations.find((conversation) => conversation.status !== "CLOSED");
            return (
              <article className="admin-order-inbox-row" key={order.id}>
                <div className="admin-order-inbox-row__main">
                  <div>
                    <p className="admin-order-inbox-row__number">#{order.orderNumber}</p>
                    <p className="small">
                      {order.customerName} · {order.customerEmail}
                    </p>
                    <p className="small">
                      {order.createdAtLabel} · {order.totalLabel}
                    </p>
                  </div>
                  <div className="admin-order-inbox-badges">
                    <span>{formatOrderStatus(order.status)}</span>
                    <span>{formatPaymentStatus(order.paymentStatus)}</span>
                    <span className={order.deliveryStatus === "UNSCHEDULED" || order.deliveryStatus === "FAILED" ? "admin-status-warning" : ""}>
                      {formatDeliveryStatus(order.deliveryStatus)}
                    </span>
                    {activeSupport ? <span className="admin-support-linked-badge">Support {activeSupport.priority ?? "NORMAL"}</span> : null}
                  </div>
                </div>

                <div className="admin-order-inbox-row__details">
                  <span className="small">{order.deliveryWindowLabel}</span>
                  {order.deliveryPhone ? <span className="small">Tel: {order.deliveryPhone}</span> : null}
                  {order.promoCode ? <span className="small">{language === "fr" ? "Promo" : "Promo"}: {order.promoCode}</span> : null}
                  {order.deliveryInstructions ? (
                    <span className="small" title={order.deliveryInstructions}>
                      Note: {order.deliveryInstructions.slice(0, 42)}{order.deliveryInstructions.length > 42 ? "..." : ""}
                    </span>
                  ) : null}
                  {activeSupport ? (
                    <Link className="admin-support-order-link" href={`/admin/support?conversationId=${activeSupport.id}`}>
                      {language === "fr" ? "Conversation support liée" : "Linked support conversation"}
                    </Link>
                  ) : null}
                </div>

                <div className="admin-order-inbox-row__actions">
                  <Link className="btn btn-secondary" href={`/admin/orders/${order.id}`}>
                    {language === "fr" ? "Détails" : "Details"}
                  </Link>
                  <label>
                    <span className="small">{language === "fr" ? "Commande" : "Order"}</span>
                    <select className="select" value={order.status} disabled={updatingId === order.id} onChange={(e) => void updateOrder(order.id, { status: e.target.value })}>
                      {ORDER_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{formatOrderStatus(option)}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="small">{language === "fr" ? "Paiement" : "Payment"}</span>
                    <select className="select" value={order.paymentStatus} disabled={updatingId === order.id} onChange={(e) => void updateOrder(order.id, { paymentStatus: e.target.value })}>
                      {PAYMENT_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{formatPaymentStatus(option)}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="small">{language === "fr" ? "Livraison" : "Delivery"}</span>
                    <select className="select" value={order.deliveryStatus} disabled={updatingId === order.id} onChange={(e) => void updateOrder(order.id, { deliveryStatus: e.target.value })}>
                      {DELIVERY_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{formatDeliveryStatus(option)}</option>)}
                    </select>
                  </label>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
