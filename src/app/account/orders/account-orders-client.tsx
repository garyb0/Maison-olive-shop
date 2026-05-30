"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatCurrency, formatDate } from "@/lib/format";

export type AccountOrderListItem = {
  id: string;
  orderNumber: string;
  createdAt: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  deliveryStatus: string;
  deliveryWindowStartAt: string | null;
  deliveryWindowEndAt: string | null;
  totalCents: number;
  currency: string;
  items: Array<{
    id: string;
    productId: string;
    slug: string;
    imageUrl: string | null;
    currentStock: number;
    isActive: boolean;
    productNameFr: string;
    productNameEn: string;
    quantity: number;
  }>;
};

export type AccountFavoriteProduct = {
  id: string;
  slug: string;
  nameFr: string;
  nameEn: string;
  imageUrl: string | null;
  priceLabel: string | null;
  stock: number;
  isActive: boolean;
};

type AccountOrdersClientProps = {
  language: "fr" | "en";
  orders: AccountOrderListItem[];
  favoriteProducts: AccountFavoriteProduct[];
};

type OrderFilter = "all" | "active" | "delivered" | "attention";
type OrderSort = "newest" | "oldest" | "amount";
type SupportTopic = "DELIVERY" | "PRODUCT" | "PAYMENT" | "CHANGE_CANCEL";

type CartLine = {
  productId: string;
  variantId?: string | null;
  name?: string;
  quantity: number;
};

type ReorderCartResponse = {
  orderNumber: string;
  lines: Array<{
    productId: string;
    variantId?: string | null;
    name: string;
    quantity: number;
    currentStock: number;
  }>;
  unavailableItems: Array<{
    productId: string;
    name: string;
    requestedQuantity: number;
    reason: string;
  }>;
  adjustedItems: Array<{
    productId: string;
    name: string;
    requestedQuantity: number;
    availableQuantity: number;
  }>;
};

const CART_STORAGE_KEY = "chezolive_cart_v1";

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

const SUPPORT_TOPIC_LABELS_FR: Record<SupportTopic, string> = {
  DELIVERY: "Livraison",
  PRODUCT: "Produit",
  PAYMENT: "Paiement/facture",
  CHANGE_CANCEL: "Modification/annulation",
};

const SUPPORT_TOPIC_LABELS_EN: Record<SupportTopic, string> = {
  DELIVERY: "Delivery",
  PRODUCT: "Product",
  PAYMENT: "Payment/invoice",
  CHANGE_CANCEL: "Change/cancel",
};

function readCart() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartLine[]) : [];
  } catch {
    return [];
  }
}

function writeCart(lines: CartLine[]) {
  const nextValue = JSON.stringify(lines);
  localStorage.setItem(CART_STORAGE_KEY, nextValue);
  window.dispatchEvent(new StorageEvent("storage", { key: CART_STORAGE_KEY, newValue: nextValue }));
}

const getCartLineKey = (line: { productId: string; variantId?: string | null }) =>
  line.variantId ? `${line.productId}:${line.variantId}` : line.productId;

function getStatusTone(status: string) {
  if (["PAID", "DELIVERED"].includes(status)) return "ok";
  if (["FAILED", "CANCELLED"].includes(status)) return "err";
  if (["OUT_FOR_DELIVERY", "SHIPPED", "RESCHEDULED"].includes(status)) return "info";
  return "warn";
}

function isActiveOrder(order: AccountOrderListItem) {
  return !["DELIVERED", "CANCELLED"].includes(order.status) && order.deliveryStatus !== "DELIVERED";
}

function needsAttention(order: AccountOrderListItem) {
  return (
    ["FAILED", "CANCELLED"].includes(order.status) ||
    ["FAILED", "PENDING"].includes(order.paymentStatus) ||
    ["FAILED", "RESCHEDULED", "UNSCHEDULED"].includes(order.deliveryStatus)
  );
}

function getItemName(orderItem: AccountOrderListItem["items"][number] | AccountFavoriteProduct, language: "fr" | "en") {
  if ("productNameFr" in orderItem) {
    return language === "fr" ? orderItem.productNameFr : orderItem.productNameEn;
  }

  return language === "fr" ? orderItem.nameFr : orderItem.nameEn;
}

function formatDeliveryWindow(
  startAt: string | null,
  endAt: string | null,
  locale: string,
  language: "fr" | "en",
) {
  if (!startAt || !endAt) return language === "fr" ? "À confirmer" : "To be confirmed";

  const start = new Date(startAt);
  const end = new Date(endAt);
  const sameDay = start.toDateString() === end.toDateString();
  if (!sameDay) return `${formatDate(start, locale)} -> ${formatDate(end, locale)}`;

  const dateLabel = new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(start);
  const timeFormatter = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" });
  return `${dateLabel} · ${timeFormatter.format(start)}${language === "fr" ? " à " : " to "}${timeFormatter.format(end)}`;
}

function getItemAvailabilityLabel(item: AccountOrderListItem["items"][number], language: "fr" | "en") {
  if (!item.isActive) return language === "fr" ? "Produit désactivé" : "Product disabled";
  if (item.currentStock <= 0) return language === "fr" ? "Rupture" : "Out of stock";
  if (item.currentStock < item.quantity) {
    return language === "fr" ? `${item.currentStock} disponible${item.currentStock > 1 ? "s" : ""}` : `${item.currentStock} available`;
  }
  return language === "fr" ? "Disponible" : "Available";
}

export function AccountOrdersClient({ language, orders, favoriteProducts }: AccountOrdersClientProps) {
  const locale = language === "fr" ? "fr-CA" : "en-CA";
  const [filter, setFilter] = useState<OrderFilter>("all");
  const [sort, setSort] = useState<OrderSort>("newest");
  const [search, setSearch] = useState("");
  const [favoriteIds, setFavoriteIds] = useState(() => new Set(favoriteProducts.map((product) => product.id)));
  const [favorites, setFavorites] = useState(favoriteProducts);
  const [cartCount, setCartCount] = useState(0);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [reorderNotice, setReorderNotice] = useState<Record<string, string>>({});
  const [supportTopics, setSupportTopics] = useState<Record<string, SupportTopic>>({});
  const totalSpentCents = useMemo(() => orders.reduce((sum, order) => sum + order.totalCents, 0), [orders]);
  const latestOrder = orders[0] ?? null;
  const featuredOrder = orders.find(isActiveOrder) ?? latestOrder;
  const trimmedSearch = search.trim().toLowerCase();

  useEffect(() => {
    const refreshCartCount = () => {
      const count = readCart().reduce((sum, line) => sum + line.quantity, 0);
      setCartCount(count);
    };

    refreshCartCount();
    window.addEventListener("storage", refreshCartCount);
    return () => window.removeEventListener("storage", refreshCartCount);
  }, []);

  const filteredOrders = useMemo(() => {
    return orders
      .filter((order) => {
        if (filter === "active") return isActiveOrder(order);
        if (filter === "delivered") return order.status === "DELIVERED" || order.deliveryStatus === "DELIVERED";
        if (filter === "attention") return needsAttention(order);
        return true;
      })
      .filter((order) => {
        if (!trimmedSearch) return true;
        const haystack = [
          order.orderNumber,
          order.status,
          order.paymentStatus,
          order.deliveryStatus,
          ...order.items.flatMap((item) => [item.productNameFr, item.productNameEn]),
        ].join(" ").toLowerCase();
        return haystack.includes(trimmedSearch);
      })
      .sort((a, b) => {
        if (sort === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        if (sort === "amount") return b.totalCents - a.totalCents;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [filter, orders, sort, trimmedSearch]);

  const tabs = [
    { id: "all" as const, label: language === "fr" ? "Toutes" : "All", count: orders.length },
    { id: "active" as const, label: language === "fr" ? "En cours" : "Active", count: orders.filter(isActiveOrder).length },
    {
      id: "delivered" as const,
      label: language === "fr" ? "Livrées" : "Delivered",
      count: orders.filter((order) => order.status === "DELIVERED" || order.deliveryStatus === "DELIVERED").length,
    },
    { id: "attention" as const, label: language === "fr" ? "À surveiller" : "Watch", count: orders.filter(needsAttention).length },
  ];

  const toggleFavorite = async (item: AccountOrderListItem["items"][number]) => {
    const isFavorite = favoriteIds.has(item.productId);
    const response = await fetch(isFavorite ? `/api/account/favorites/${item.productId}` : "/api/account/favorites", {
      method: isFavorite ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: isFavorite ? undefined : JSON.stringify({ productId: item.productId }),
    });
    if (!response.ok) return;

    setFavoriteIds((current) => {
      const next = new Set(current);
      if (isFavorite) next.delete(item.productId);
      else next.add(item.productId);
      return next;
    });

    setFavorites((current) => {
      if (isFavorite) return current.filter((product) => product.id !== item.productId);
      if (current.some((product) => product.id === item.productId)) return current;
      return [
        {
          id: item.productId,
          slug: item.slug,
          nameFr: item.productNameFr,
          nameEn: item.productNameEn,
          imageUrl: item.imageUrl,
          priceLabel: null,
          stock: item.currentStock,
          isActive: item.isActive,
        },
        ...current,
      ];
    });
  };

  const handleReorder = async (order: AccountOrderListItem) => {
    setBusyOrderId(order.id);
    setReorderNotice((current) => ({ ...current, [order.id]: "" }));

    try {
      const response = await fetch("/api/orders/reorder-cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id }),
      });
      const payload = (await response.json().catch(() => ({}))) as Partial<ReorderCartResponse> & { error?: string };
      if (!response.ok || !payload.lines) {
        setReorderNotice((current) => ({
          ...current,
          [order.id]: language === "fr" ? "Impossible de préparer ce panier." : "Unable to prepare this cart.",
        }));
        return;
      }

      const currentCart = readCart();
      const merged = new Map(currentCart.map((line) => [getCartLineKey(line), { ...line }]));
      for (const line of payload.lines) {
        const lineKey = getCartLineKey(line);
        const existing = merged.get(lineKey);
        const quantity = Math.min((existing?.quantity ?? 0) + line.quantity, Math.max(1, line.currentStock));
        merged.set(lineKey, { productId: line.productId, variantId: line.variantId ?? undefined, name: existing?.name ?? line.name, quantity });
      }
      writeCart(Array.from(merged.values()));

      const notes = [
        payload.lines.length > 0
          ? language === "fr"
            ? `${payload.lines.length} article(s) ajouté(s) au panier.`
            : `${payload.lines.length} item(s) added to cart.`
          : language === "fr"
            ? "Aucun article disponible à ajouter."
            : "No available item to add.",
        ...(payload.adjustedItems ?? []).map((item) =>
          language === "fr"
            ? `${item.name}: quantité ajustée à ${item.availableQuantity}.`
            : `${item.name}: quantity adjusted to ${item.availableQuantity}.`,
        ),
        ...(payload.unavailableItems ?? []).map((item) =>
          language === "fr"
            ? `${item.name}: non disponible.`
            : `${item.name}: unavailable.`,
        ),
      ];

      setReorderNotice((current) => ({ ...current, [order.id]: notes.join(" ") }));
      if (payload.lines.length > 0) {
        window.setTimeout(() => {
          window.location.assign("/cart");
        }, 700);
      }
    } finally {
      setBusyOrderId(null);
    }
  };

  const openSupport = (order: AccountOrderListItem) => {
    const topic = supportTopics[order.id] ?? "DELIVERY";
    const topicLabel = (language === "fr" ? SUPPORT_TOPIC_LABELS_FR : SUPPORT_TOPIC_LABELS_EN)[topic];
    const draft =
      language === "fr"
        ? `Bonjour, j'ai besoin d'aide avec la commande #${order.orderNumber}. Sujet: ${topicLabel}.`
        : `Hello, I need help with order #${order.orderNumber}. Topic: ${topicLabel}.`;

    window.dispatchEvent(
      new CustomEvent("chezolive:support-open", {
        detail: {
          orderId: order.id,
          topic,
          draft,
        },
      }),
    );
  };

  const renderCartReminder = () =>
    cartCount > 0 ? (
      <section className="account-cart-reminder" aria-live="polite">
        <div>
          <strong>{language === "fr" ? "Panier en cours" : "Cart in progress"}</strong>
          <p className="small">
            {language === "fr"
              ? `${cartCount} article${cartCount > 1 ? "s" : ""} attend${cartCount > 1 ? "ent" : ""} avant le checkout.`
              : `${cartCount} item${cartCount > 1 ? "s" : ""} waiting before checkout.`}
          </p>
        </div>
        <Link className="btn" href="/cart">
          {language === "fr" ? "Reprendre le panier" : "Resume cart"}
        </Link>
      </section>
    ) : null;

  return (
    <>
      <section className="section account-orders-hero account-orders-hero--premium">
        <div className="account-orders-hero__copy">
          <p className="account-home-hero__eyebrow">{language === "fr" ? "Commandes" : "Orders"}</p>
          <h1>{language === "fr" ? "Centre de commandes" : "Order command center"}</h1>
          <p className="small account-section-copy">
            {language === "fr"
              ? "Suivi, rachat sécurisé, favoris et support au même endroit."
              : "Tracking, safe reorder, favorites, and support in one place."}
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
            <span>{language === "fr" ? "Essentiels" : "Essentials"}</span>
            <strong>{favorites.length}</strong>
          </div>
        </div>
      </section>

      {renderCartReminder()}

      <section className="account-essentials-section">
        <div className="account-orders-section-head">
          <div>
            <p className="account-home-hero__eyebrow">{language === "fr" ? "Favoris" : "Favorites"}</p>
            <h2>{language === "fr" ? "Mes essentiels" : "My essentials"}</h2>
          </div>
          <Link className="btn btn-secondary" href="/boutique">
            {language === "fr" ? "Ajouter des essentiels" : "Add essentials"}
          </Link>
        </div>
        {favorites.length > 0 ? (
          <div className="account-essentials-grid">
            {favorites.slice(0, 6).map((product) => (
              <Link className="account-essential-card" href={`/products/${product.slug}`} key={product.id}>
                {product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.imageUrl} alt={getItemName(product, language)} />
                ) : (
                  <span aria-hidden="true">CO</span>
                )}
                <strong>{getItemName(product, language)}</strong>
                <small>
                  {product.priceLabel ? `${product.priceLabel} · ` : ""}
                  {product.isActive && product.stock > 0
                    ? language === "fr" ? "Disponible" : "Available"
                    : language === "fr" ? "Non disponible" : "Unavailable"}
                </small>
              </Link>
            ))}
          </div>
        ) : (
          <p className="small account-empty-inline">
            {language === "fr"
              ? "Sauvegarde tes produits répétés depuis une commande ou la boutique."
              : "Save repeat products from an order or the shop."}
          </p>
        )}
      </section>

      {featuredOrder ? (
        <section className="account-orders-featured" aria-label={language === "fr" ? "Prochaine action commande" : "Next order action"}>
          <div>
            <p className="account-home-hero__eyebrow">{language === "fr" ? "À suivre" : "Keep an eye on"}</p>
            <h2>#{featuredOrder.orderNumber}</h2>
            <p className="small">
              {formatDeliveryWindow(featuredOrder.deliveryWindowStartAt, featuredOrder.deliveryWindowEndAt, locale, language)}
            </p>
          </div>
          <div className="account-orders-featured__status">
            <span>{(language === "fr" ? DELIVERY_STATUS_FR : DELIVERY_STATUS_EN)[featuredOrder.deliveryStatus] ?? featuredOrder.deliveryStatus}</span>
            <Link className="btn btn-secondary" href={`/account/orders/${featuredOrder.id}`}>
              {language === "fr" ? "Voir le suivi" : "View tracking"}
            </Link>
          </div>
        </section>
      ) : null}

      {orders.length === 0 ? (
        <section className="section account-orders-empty">
          <div className="account-orders-empty__icon" aria-hidden="true">CO</div>
          <h2>{language === "fr" ? "Aucune commande pour le moment" : "No orders yet"}</h2>
          <p className="small">
            {language === "fr"
              ? "La boutique, le panier et tes favoris sont prêts pour ton premier achat."
              : "The shop, cart, and favorites are ready for your first purchase."}
          </p>
          <Link className="btn" href="/boutique">
            {language === "fr" ? "Découvrir la boutique" : "Browse the shop"}
          </Link>
        </section>
      ) : (
        <>
          <section className="account-orders-controls" aria-label={language === "fr" ? "Filtres commandes" : "Order filters"}>
            <div className="account-orders-tabs" role="tablist" aria-label={language === "fr" ? "Filtrer les commandes" : "Filter orders"}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`account-orders-tab${filter === tab.id ? " account-orders-tab--active" : ""}`}
                  onClick={() => setFilter(tab.id)}
                >
                  <span>{tab.label}</span>
                  <strong>{tab.count}</strong>
                </button>
              ))}
            </div>

            <div className="account-orders-search-row">
              <label className="sr-only" htmlFor="account-orders-search">
                {language === "fr" ? "Rechercher une commande" : "Search orders"}
              </label>
              <input
                id="account-orders-search"
                className="account-orders-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={language === "fr" ? "Numéro ou article..." : "Number or item..."}
              />
              <select
                id="account-orders-sort"
                className="account-orders-sort"
                value={sort}
                onChange={(event) => setSort(event.target.value as OrderSort)}
              >
                <option value="newest">{language === "fr" ? "Plus récentes" : "Newest"}</option>
                <option value="oldest">{language === "fr" ? "Plus anciennes" : "Oldest"}</option>
                <option value="amount">{language === "fr" ? "Montant élevé" : "Highest amount"}</option>
              </select>
            </div>
          </section>

          {filteredOrders.length === 0 ? (
            <section className="section account-orders-empty account-orders-empty--filtered">
              <h2>{language === "fr" ? "Aucune commande trouvée" : "No matching orders"}</h2>
              <button className="btn btn-secondary" type="button" onClick={() => { setFilter("all"); setSearch(""); }}>
                {language === "fr" ? "Réinitialiser" : "Reset"}
              </button>
            </section>
          ) : (
            <section className="account-orders-grid account-orders-grid--compact">
              {filteredOrders.map((order) => {
                const orderStatusLabel = (language === "fr" ? ORDER_STATUS_FR : ORDER_STATUS_EN)[order.status] ?? order.status;
                const paymentStatusLabel =
                  (language === "fr" ? PAYMENT_STATUS_FR : PAYMENT_STATUS_EN)[order.paymentStatus] ?? order.paymentStatus;
                const paymentMethodLabel =
                  (language === "fr" ? PAYMENT_METHOD_FR : PAYMENT_METHOD_EN)[order.paymentMethod] ?? order.paymentMethod;
                const deliveryStatusLabel =
                  (language === "fr" ? DELIVERY_STATUS_FR : DELIVERY_STATUS_EN)[order.deliveryStatus] ?? order.deliveryStatus;
                const deliveryWindowLabel = formatDeliveryWindow(order.deliveryWindowStartAt, order.deliveryWindowEndAt, locale, language);
                const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);
                const topic = supportTopics[order.id] ?? "DELIVERY";

                return (
                  <article key={order.id} className="account-order-card account-order-card--premium account-order-card--command">
                    <div className="account-order-card__head">
                      <div className="account-order-card__identity">
                        <p className="account-home-hero__eyebrow">{language === "fr" ? "Commande" : "Order"}</p>
                        <h2 className="account-order-card__number">#{order.orderNumber}</h2>
                        <p className="small">
                          {language === "fr" ? "Passée le " : "Placed on "}
                          {formatDate(order.createdAt, locale)}
                        </p>
                      </div>
                      <div className="account-order-card__total-block">
                        <span>{language === "fr" ? "Total" : "Total"}</span>
                        <strong>{formatCurrency(order.totalCents, order.currency, locale)}</strong>
                      </div>
                    </div>

                    <div className="account-order-card__status-row">
                      {[
                        [language === "fr" ? "Commande" : "Order", order.status, orderStatusLabel],
                        [language === "fr" ? "Paiement" : "Payment", order.paymentStatus, paymentStatusLabel],
                        [language === "fr" ? "Livraison" : "Delivery", order.deliveryStatus, deliveryStatusLabel],
                      ].map(([label, status, value]) => (
                        <div className="account-order-card__status-item" key={`${order.id}-${label}`}>
                          <span>{label}</span>
                          <strong className={`account-status-pill account-status-pill--${getStatusTone(status)}`}>
                            {value}
                          </strong>
                        </div>
                      ))}
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
                      <div className="account-order-card__detail-block">
                        <span className="account-order-card__meta-label">{language === "fr" ? "Articles" : "Items"}</span>
                        <strong>
                          {totalItems} {language === "fr" ? `article${totalItems !== 1 ? "s" : ""}` : `item${totalItems !== 1 ? "s" : ""}`}
                        </strong>
                      </div>
                    </div>

                    <div className="account-order-command-items">
                      {order.items.map((item) => {
                        const isFavorite = favoriteIds.has(item.productId);
                        return (
                          <div className="account-order-command-item" key={item.id}>
                            <Link className="account-order-command-item__media" href={`/products/${item.slug}`}>
                              {item.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={item.imageUrl} alt={getItemName(item, language)} />
                              ) : (
                                <span aria-hidden="true">CO</span>
                              )}
                            </Link>
                            <div className="account-order-command-item__copy">
                              <Link href={`/products/${item.slug}`}>{getItemName(item, language)}</Link>
                              <small>
                                x {item.quantity} · {getItemAvailabilityLabel(item, language)}
                              </small>
                            </div>
                            <button className="btn btn-secondary" type="button" onClick={() => void toggleFavorite(item)}>
                              {isFavorite ? (language === "fr" ? "Favori" : "Saved") : (language === "fr" ? "Sauvegarder" : "Save")}
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {reorderNotice[order.id] ? <p className="small account-reorder-notice">{reorderNotice[order.id]}</p> : null}

                    <div className="account-order-support-row">
                      <select
                        className="account-order-topic-select"
                        value={topic}
                        onChange={(event) => setSupportTopics((current) => ({ ...current, [order.id]: event.target.value as SupportTopic }))}
                        aria-label={language === "fr" ? "Sujet de support" : "Support topic"}
                      >
                        {(Object.keys(SUPPORT_TOPIC_LABELS_FR) as SupportTopic[]).map((option) => (
                          <option value={option} key={option}>
                            {(language === "fr" ? SUPPORT_TOPIC_LABELS_FR : SUPPORT_TOPIC_LABELS_EN)[option]}
                          </option>
                        ))}
                      </select>
                      <button className="btn btn-secondary" type="button" onClick={() => openSupport(order)}>
                        {language === "fr" ? "Demander de l’aide" : "Ask for help"}
                      </button>
                    </div>

                    <div className="account-order-card__actions account-order-card__actions--command">
                      <Link className="btn btn-secondary" href={`/account/orders/${order.id}`}>
                        {language === "fr" ? "Voir le détail" : "View detail"}
                      </Link>
                      <button className="btn" type="button" disabled={busyOrderId === order.id} onClick={() => void handleReorder(order)}>
                        {busyOrderId === order.id
                          ? language === "fr" ? "Préparation..." : "Preparing..."
                          : language === "fr" ? "Acheter à nouveau" : "Buy again"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </section>
          )}
        </>
      )}
    </>
  );
}
