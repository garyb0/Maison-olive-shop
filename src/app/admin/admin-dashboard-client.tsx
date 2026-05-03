"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import type { Dictionary, Language } from "@/lib/i18n";

type AdminActionItem = {
  id: string;
  href: string;
  title: string;
  meta: string;
  detail: string;
  badge?: string;
};

type Props = {
  language: Language;
  t: Dictionary;
  oliveMode: "princess" | "gremlin";
  initialMaintenanceEnabled: boolean;
  initialMaintenanceOpenAt: string | null;
  stats: {
    totalProducts: number;
    activeProducts: number;
    totalOrders: number;
    pendingOrders: number;
    totalCustomers: number;
    taxTotal: string;
  };
  todayCockpit: {
    dateKey: string;
    todayOrderCount: number;
    ordersToPrepareCount: number;
    deliveryOrderCount: number;
    openSupportCount: number;
    activeRunCount: number;
    todaySalesLabel: string;
    lowStockCount: number;
    lowStockProducts: Array<{
      id: string;
      name: string;
      slug: string;
      stock: number;
    }>;
    actionQueues: {
      ordersToPrepare: AdminActionItem[];
      deliveryOrders: AdminActionItem[];
      supportQueue: AdminActionItem[];
      activeRuns: AdminActionItem[];
    };
    backup: {
      status: "ok" | "warn" | "unknown";
      label: string;
      latestName: string | null;
      ageHours: number | null;
    };
    conversion: {
      today: AdminConversionPeriod;
      sevenDays: AdminConversionPeriod;
      topAddedProducts: AdminConversionProduct[];
      topAbandonedProducts: AdminConversionProduct[];
    };
    siteStatus: string;
  };
  profitabilitySummary: {
    stockValueAtCostLabel: string;
    stockValueAtRetailLabel: string;
    grossRevenueLabel: string;
    estimatedGrossProfitLabel: string;
  };
  profitabilityRows: Array<{
    id: string;
    name: string;
    slug: string;
    stock: number;
    quantityAdded: number;
    quantitySold: number;
    quantityAdjusted: number;
    estimatedGrossProfitLabel: string;
  }>;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    customerName: string;
    status: string;
    totalLabel: string;
  }>;
};

type AdminConversionPeriod = {
  shopVisitors: number;
  productViews: number;
  cartAdds: number;
  cartViews: number;
  checkoutStarts: number;
  ordersCreated: number;
  checkoutErrors: number;
  cartToCheckoutRateLabel: string;
  checkoutToOrderRateLabel: string;
};

type AdminConversionProduct = {
  key: string;
  name: string;
  quantity: number;
  addCount: number;
};

const ORDER_STATUS_LABELS_FR: Record<string, string> = {
  PENDING: "À vérifier",
  PAID: "Payée",
  PROCESSING: "En préparation",
  SHIPPED: "Expédiée",
  DELIVERED: "Livrée",
  CANCELLED: "Annulée",
};

const formatOrderStatus = (status: string, language: Language) =>
  language === "fr" ? ORDER_STATUS_LABELS_FR[status] ?? status : status;

function AdminActionCard({
  title,
  eyebrow,
  value,
  summary,
  href,
  actionLabel,
  items,
  emptyLabel,
  tone = "default",
}: {
  title: string;
  eyebrow: string;
  value: ReactNode;
  summary: string;
  href: string;
  actionLabel: string;
  items: AdminActionItem[];
  emptyLabel: string;
  tone?: "default" | "primary" | "warn";
}) {
  return (
    <article className={`admin-action-card admin-action-card--${tone}`}>
      <div className="admin-action-card__head">
        <div>
          <span>{eyebrow}</span>
          <h3>{title}</h3>
          <p>{summary}</p>
        </div>
        <strong>{value}</strong>
      </div>

      {items.length > 0 ? (
        <div className="admin-action-list">
          {items.map((item) => (
            <Link className="admin-action-item" href={item.href} key={item.id}>
              <span className="admin-action-item__title">{item.title}</span>
              <span className="admin-action-item__meta">{item.meta}</span>
              <span className="admin-action-item__detail">{item.detail}</span>
              {item.badge ? <span className="admin-action-item__badge">{item.badge}</span> : null}
            </Link>
          ))}
        </div>
      ) : (
        <p className="admin-action-empty">{emptyLabel}</p>
      )}

      <Link className="admin-action-card__link" href={href}>
        {actionLabel}
      </Link>
    </article>
  );
}

function ConversionMetricCard({
  language,
  title,
  period,
}: {
  language: Language;
  title: string;
  period: AdminConversionPeriod;
}) {
  return (
    <article className="admin-conversion-card">
      <div className="admin-conversion-card__head">
        <span>{title}</span>
        <strong>{period.ordersCreated}</strong>
      </div>
      <div className="admin-conversion-metrics">
        <span>{language === "fr" ? "Visiteurs boutique" : "Shop visitors"} <strong>{period.shopVisitors}</strong></span>
        <span>{language === "fr" ? "Ajouts panier" : "Cart adds"} <strong>{period.cartAdds}</strong></span>
        <span>Checkout <strong>{period.checkoutStarts}</strong></span>
        <span>{language === "fr" ? "Commandes" : "Orders"} <strong>{period.ordersCreated}</strong></span>
        <span>{language === "fr" ? "Panier vers checkout" : "Cart to checkout"} <strong>{period.cartToCheckoutRateLabel}</strong></span>
        <span>{language === "fr" ? "Checkout vers commande" : "Checkout to order"} <strong>{period.checkoutToOrderRateLabel}</strong></span>
        <span>{language === "fr" ? "Erreurs checkout" : "Checkout errors"} <strong>{period.checkoutErrors}</strong></span>
      </div>
    </article>
  );
}

function ConversionProductList({
  language,
  title,
  emptyLabel,
  products,
}: {
  language: Language;
  title: string;
  emptyLabel: string;
  products: AdminConversionProduct[];
}) {
  return (
    <article className="admin-conversion-card admin-conversion-card--list">
      <h3>{title}</h3>
      {products.length > 0 ? (
        <div className="admin-conversion-product-list">
          {products.map((product) => (
            <div className="admin-conversion-product" key={product.key}>
              <strong>{product.name}</strong>
              <span>
                {language === "fr"
                  ? `${product.quantity} unite(s), ${product.addCount} ajout(s)`
                  : `${product.quantity} unit(s), ${product.addCount} add(s)`}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="admin-action-empty">{emptyLabel}</p>
      )}
    </article>
  );
}

export function AdminDashboardClient({
  language,
  t,
  oliveMode,
  initialMaintenanceEnabled,
  initialMaintenanceOpenAt,
  stats,
  todayCockpit,
  profitabilitySummary,
  profitabilityRows,
  recentOrders,
}: Props) {
  const [currentOliveMode, setCurrentOliveMode] = useState<"princess" | "gremlin">(oliveMode);
  const [oliveModeLoading, setOliveModeLoading] = useState(false);
  const [oliveModeMessage, setOliveModeMessage] = useState("");
  const [oliveModeError, setOliveModeError] = useState("");

  const [maintenanceEnabled, setMaintenanceEnabled] = useState(initialMaintenanceEnabled);
  const [maintenanceOpenAt, setMaintenanceOpenAt] = useState<string | null>(initialMaintenanceOpenAt);
  const [maintenanceOpenAtInput, setMaintenanceOpenAtInput] = useState(() => {
    if (!initialMaintenanceOpenAt) return "";
    const date = new Date(initialMaintenanceOpenAt);
    if (Number.isNaN(date.getTime())) return "";
    const tzOffset = date.getTimezoneOffset() * 60_000;
    return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
  });
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [maintenanceError, setMaintenanceError] = useState("");

  const applyQuickReopenDelay = (hoursFromNow: number) => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + hoursFromNow * 60);
    const tzOffset = now.getTimezoneOffset() * 60_000;
    setMaintenanceOpenAtInput(new Date(now.getTime() - tzOffset).toISOString().slice(0, 16));
  };

  const applyTomorrowNineAm = () => {
    const now = new Date();
    const target = new Date(now);
    target.setDate(now.getDate() + 1);
    target.setHours(9, 0, 0, 0);
    const tzOffset = target.getTimezoneOffset() * 60_000;
    setMaintenanceOpenAtInput(new Date(target.getTime() - tzOffset).toISOString().slice(0, 16));
  };

  const formatOpenAtLabel = (isoDate: string) => {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString(language === "fr" ? "fr-CA" : "en-CA", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  useEffect(() => {
    let cancelled = false;

    const fetchMaintenanceState = async () => {
      try {
        const res = await fetch("/api/admin/settings/maintenance", {
          method: "GET",
          cache: "no-store",
        });

        if (!res.ok) {
          return;
        }

        const data = (await res.json()) as { enabled?: boolean; openAt?: string | null };

        if (!cancelled && typeof data.enabled === "boolean") {
          setMaintenanceEnabled(data.enabled);
          setMaintenanceOpenAt(typeof data.openAt === "string" ? data.openAt : null);

          const openAtDate = typeof data.openAt === "string" ? new Date(data.openAt) : null;
          if (openAtDate && !Number.isNaN(openAtDate.getTime())) {
            const tzOffset = openAtDate.getTimezoneOffset() * 60_000;
            setMaintenanceOpenAtInput(new Date(openAtDate.getTime() - tzOffset).toISOString().slice(0, 16));
          } else {
            setMaintenanceOpenAtInput("");
          }
        }
      } catch {
        // keep initial state
      }
    };

    void fetchMaintenanceState();

    return () => {
      cancelled = true;
    };
  }, []);

  const updateOliveMode = async (mode: "princess" | "gremlin") => {
    setOliveModeLoading(true);
    setOliveModeMessage("");
    setOliveModeError("");

    try {
      const res = await fetch("/api/admin/olive-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });

      if (!res.ok) {
        setOliveModeError(
          language === "fr"
            ? "Impossible de changer le mode d'Olive."
            : "Unable to change Olive mode.",
        );
        return;
      }

      setCurrentOliveMode(mode);
      setOliveModeMessage(
        language === "fr"
          ? mode === "gremlin"
            ? "Mode gremlin d'Olive activé."
            : "Mode princesse d'Olive activé."
          : mode === "gremlin"
            ? "Olive gremlin mode activated."
            : "Olive princess mode activated.",
      );
    } finally {
      setOliveModeLoading(false);
    }
  };

  const toggleMaintenance = async () => {
    setMaintenanceLoading(true);
    setMaintenanceMessage("");
    setMaintenanceError("");

    try {
      const newEnabled = !maintenanceEnabled;
      const selectedOpenAt = maintenanceOpenAtInput.trim() ? new Date(maintenanceOpenAtInput) : null;

      if (newEnabled && selectedOpenAt && Number.isNaN(selectedOpenAt.getTime())) {
        setMaintenanceError(
          language === "fr" ? "Date de réouverture invalide." : "Invalid reopening date.",
        );
        return;
      }

      if (newEnabled && selectedOpenAt && selectedOpenAt.getTime() <= Date.now()) {
        setMaintenanceError(
          language === "fr"
            ? "La date de réouverture doit être dans le futur."
            : "Reopening date must be in the future.",
        );
        return;
      }

      const res = await fetch("/api/admin/settings/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: newEnabled,
          openAt: newEnabled && selectedOpenAt ? selectedOpenAt.toISOString() : null,
        }),
      });

      if (!res.ok) {
        let apiError: string | null = null;
        try {
          const payload = (await res.json()) as { error?: string };
          apiError = typeof payload.error === "string" ? payload.error : null;
        } catch {
          // no-op
        }

        setMaintenanceError(
          language === "fr"
            ? apiError
              ? `Impossible de changer le mode maintenance: ${apiError}`
              : "Impossible de changer le mode maintenance."
            : apiError
              ? `Unable to change maintenance mode: ${apiError}`
              : "Unable to change maintenance mode.",
        );
        return;
      }

      const payload = (await res.json()) as { enabled?: boolean; openAt?: string | null };
      const finalEnabled = typeof payload.enabled === "boolean" ? payload.enabled : newEnabled;
      const finalOpenAt = typeof payload.openAt === "string" ? payload.openAt : null;

      setMaintenanceEnabled(finalEnabled);
      setMaintenanceOpenAt(finalOpenAt);

      if (!finalEnabled) {
        setMaintenanceOpenAtInput("");
      }

      const openAtLabel = finalOpenAt ? formatOpenAtLabel(finalOpenAt) : null;
      setMaintenanceMessage(
        language === "fr"
          ? finalEnabled
            ? openAtLabel
              ? `Site fermé au public. Réouverture prévue le ${openAtLabel}.`
              : "Site fermé au public. Mode maintenance activée."
            : "Site ouvert au public. Mode maintenance désactivée."
          : finalEnabled
            ? openAtLabel
              ? `Site closed to public. Reopening planned on ${openAtLabel}.`
              : "Site closed to public. Maintenance mode enabled."
            : "Site open to public. Maintenance mode disabled.",
      );
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const backupAgeLabel = todayCockpit.backup.ageHours === null
    ? language === "fr" ? "Age inconnu" : "Unknown age"
    : todayCockpit.backup.ageHours < 1
      ? language === "fr" ? "Moins d'une heure" : "Less than one hour"
      : language === "fr"
        ? `${todayCockpit.backup.ageHours.toFixed(1)} h`
        : `${todayCockpit.backup.ageHours.toFixed(1)}h`;
  const lowStockActionItems: AdminActionItem[] = todayCockpit.lowStockProducts.map((product) => ({
    id: product.id,
    href: "/admin/products",
    title: product.name,
    meta: product.slug,
    detail:
      language === "fr"
        ? `${product.stock} unite(s) en stock`
        : `${product.stock} unit(s) in stock`,
    badge: product.stock <= 0 ? (language === "fr" ? "Rupture" : "Out") : language === "fr" ? "Bas" : "Low",
  }));
  const healthActionItems: AdminActionItem[] = [
    {
      id: "site",
      href: "/admin/maintenance-cloudflare",
      title: language === "fr" ? "Site public" : "Public site",
      meta: todayCockpit.siteStatus,
      detail: language === "fr" ? "Changer seulement si une intervention est necessaire." : "Change only if maintenance is needed.",
      badge: maintenanceEnabled ? (language === "fr" ? "A surveiller" : "Watch") : "OK",
    },
    {
      id: "backup",
      href: "/admin/maintenance-cloudflare",
      title: "Backup",
      meta: backupAgeLabel,
      detail: todayCockpit.backup.latestName ?? todayCockpit.backup.label,
      badge: todayCockpit.backup.status === "ok" ? "OK" : language === "fr" ? "Verifier" : "Check",
    },
  ];

  return (
    <>
      <section className="section admin-page-header">
        <div className="admin-page-header__copy">
          <span className="admin-page-header__eyebrow">
            {language === "fr" ? "Administration" : "Administration"}
          </span>
          <h1>{t.adminTitle}</h1>
          <p className="small">
            {language === "fr"
              ? "Survole les opérations du jour, les alertes et les chiffres sensibles."
              : "Monitor daily operations, alerts, and sensitive figures."}
          </p>
        </div>
      </section>

      <section className="section admin-today-cockpit" aria-label={language === "fr" ? "Actions du jour" : "Today actions"}>
        <div className="admin-section-head">
          <div>
            <h2>{language === "fr" ? "À faire maintenant" : "To do now"}</h2>
            <p className="small">
              {language === "fr"
                ? `${todayCockpit.todaySalesLabel} aujourd'hui, ${todayCockpit.todayOrderCount} commande(s) creees.`
                : `${todayCockpit.todaySalesLabel} today, ${todayCockpit.todayOrderCount} order(s) created.`}
            </p>
          </div>
          <Link className="btn btn-secondary" href="/app">
            {language === "fr" ? "Vue mobile" : "Mobile view"}
          </Link>
        </div>

        <div className="admin-action-board">
          <AdminActionCard
            title={language === "fr" ? "Commandes à préparer" : "Orders to prepare"}
            eyebrow={language === "fr" ? "Priorite" : "Priority"}
            value={todayCockpit.ordersToPrepareCount}
            summary={language === "fr" ? "Les prochaines commandes à traiter." : "Next orders to handle."}
            href="/admin/orders"
            actionLabel={language === "fr" ? "Voir les commandes" : "View orders"}
            items={todayCockpit.actionQueues.ordersToPrepare}
            emptyLabel={language === "fr" ? "Rien à préparer pour l'instant." : "Nothing to prepare right now."}
            tone={todayCockpit.ordersToPrepareCount > 0 ? "primary" : "default"}
          />
          <AdminActionCard
            title={language === "fr" ? "Livraison client" : "Customer delivery"}
            eyebrow={language === "fr" ? "A surveiller" : "Watch"}
            value={todayCockpit.deliveryOrderCount}
            summary={language === "fr" ? "Commandes planifiees ou deja sur la route." : "Scheduled or already on the road."}
            href="/admin/delivery"
            actionLabel={language === "fr" ? "Ouvrir livraison" : "Open delivery"}
            items={todayCockpit.actionQueues.deliveryOrders}
            emptyLabel={language === "fr" ? "Aucune livraison active." : "No active delivery."}
            tone={todayCockpit.deliveryOrderCount > 0 ? "primary" : "default"}
          />
          <AdminActionCard
            title={language === "fr" ? "Support à répondre" : "Support to answer"}
            eyebrow="Support"
            value={todayCockpit.openSupportCount}
            summary={language === "fr" ? "Clients ouverts, en attente ou assignes." : "Open, waiting, or assigned customers."}
            href="/admin/support"
            actionLabel={language === "fr" ? "Ouvrir support" : "Open support"}
            items={todayCockpit.actionQueues.supportQueue}
            emptyLabel={language === "fr" ? "Aucune conversation urgente." : "No urgent conversation."}
            tone={todayCockpit.openSupportCount > 0 ? "warn" : "default"}
          />
          <AdminActionCard
            title={language === "fr" ? "Tournées chauffeur" : "Driver runs"}
            eyebrow={language === "fr" ? "Terrain" : "Field"}
            value={todayCockpit.activeRunCount}
            summary={language === "fr" ? "Tournées publiees ou en cours." : "Published or in-progress runs."}
            href="/admin/delivery/runs"
            actionLabel={language === "fr" ? "Voir les tournées" : "View runs"}
            items={todayCockpit.actionQueues.activeRuns}
            emptyLabel={language === "fr" ? "Aucune tournée active." : "No active run."}
            tone={todayCockpit.activeRunCount > 0 ? "primary" : "default"}
          />
          <AdminActionCard
            title={language === "fr" ? "Stock critique" : "Critical stock"}
            eyebrow={language === "fr" ? "Inventaire" : "Inventory"}
            value={todayCockpit.lowStockCount}
            summary={language === "fr" ? "Produits actifs à verifier avant de vendre." : "Active products to review before selling."}
            href="/admin/products"
            actionLabel={language === "fr" ? "Ouvrir produits" : "Open products"}
            items={lowStockActionItems}
            emptyLabel={language === "fr" ? "Aucun produit critique." : "No critical product."}
            tone={todayCockpit.lowStockCount > 0 ? "warn" : "default"}
          />
          <AdminActionCard
            title={language === "fr" ? "Santé et backup" : "Health and backup"}
            eyebrow={language === "fr" ? "Ops" : "Ops"}
            value={maintenanceEnabled ? (language === "fr" ? "A voir" : "Watch") : "OK"}
            summary={language === "fr" ? "Etat public et rappel backup local." : "Public state and local backup reminder."}
            href="/admin/maintenance-cloudflare"
            actionLabel={language === "fr" ? "Voir maintenance" : "View maintenance"}
            items={healthActionItems}
            emptyLabel={language === "fr" ? "Aucune alerte ops." : "No ops alert."}
            tone={maintenanceEnabled || todayCockpit.backup.status !== "ok" ? "warn" : "default"}
          />
        </div>
      </section>

      <section className="section admin-conversion-section" aria-label={language === "fr" ? "Conversion boutique" : "Shop conversion"}>
        <div className="admin-section-head">
          <div>
            <h2>{language === "fr" ? "Conversion" : "Conversion"}</h2>
            <p className="small">
              {language === "fr"
                ? "Lecture simple du tunnel boutique: boutique, panier, checkout et commandes."
                : "Simple shop funnel view: shop, cart, checkout, and orders."}
            </p>
          </div>
          <Link className="btn btn-secondary" href="/boutique">
            {language === "fr" ? "Voir boutique" : "View shop"}
          </Link>
        </div>
        <div className="admin-conversion-grid">
          <ConversionMetricCard
            language={language}
            title={language === "fr" ? "Aujourd'hui" : "Today"}
            period={todayCockpit.conversion.today}
          />
          <ConversionMetricCard
            language={language}
            title={language === "fr" ? "7 jours" : "7 days"}
            period={todayCockpit.conversion.sevenDays}
          />
        </div>
        <div className="admin-conversion-grid admin-conversion-grid--products">
          <ConversionProductList
            language={language}
            title={language === "fr" ? "Produits les plus ajoutés" : "Most added products"}
            emptyLabel={language === "fr" ? "Aucun ajout panier mesuré." : "No cart adds measured."}
            products={todayCockpit.conversion.topAddedProducts}
          />
          <ConversionProductList
            language={language}
            title={language === "fr" ? "Produits abandonnés" : "Abandoned products"}
            emptyLabel={language === "fr" ? "Aucun abandon mesuré." : "No abandonment measured."}
            products={todayCockpit.conversion.topAbandonedProducts}
          />
        </div>
      </section>

      <section className="section">
        <div className="admin-section-head">
          <div>
            <h2>{language === "fr" ? "Mode maintenance" : "Maintenance mode"}</h2>
            <p className="small">
              {language === "fr"
                ? "Ferme le site proprement quand une intervention est nécessaire."
                : "Close the site cleanly when maintenance is needed."}
            </p>
          </div>
          <Link className="btn btn-secondary" href="/admin/maintenance-cloudflare">
            {language === "fr" ? "Aide maintenance Cloudflare" : "Cloudflare maintenance help"}
          </Link>
        </div>
        <div className="admin-info-grid">
          <div className="admin-info-tile">
            <p className="admin-info-tile__title">
              {language === "fr" ? "Maintenance normale" : "Normal maintenance"}
            </p>
            <p className="small">
              {language === "fr"
                ? "Utilise ce bouton pour fermer le site proprement, avec réouverture planifiée si besoin."
                : "Use this button to close the site cleanly, with scheduled reopening if needed."}
            </p>
          </div>
          <div className="admin-info-tile admin-info-tile--warn">
            <p className="admin-info-tile__title">
              {language === "fr" ? "Urgence Cloudflare" : "Cloudflare emergency"}
            </p>
            <p className="small">
              {language === "fr"
                ? "À utiliser seulement si le PC local, PM2 ou le tunnel ne répond plus."
                : "Use only if the local PC, PM2, or the tunnel stops responding."}
            </p>
          </div>
        </div>
        <p className="small admin-status-line">
          {language === "fr"
            ? `État actuel : ${maintenanceEnabled ? "site fermé" : "site ouvert"}`
            : `Current status: ${maintenanceEnabled ? "Site CLOSED" : "Site OPEN"}`}
        </p>
        {maintenanceOpenAt ? (
          <p className="small">
            {language === "fr"
            ? `Réouverture planifiée : ${formatOpenAtLabel(maintenanceOpenAt) ?? maintenanceOpenAt}`
              : `Planned reopening: ${formatOpenAtLabel(maintenanceOpenAt) ?? maintenanceOpenAt}`}
          </p>
        ) : null}
        {maintenanceMessage ? <p className={maintenanceEnabled ? "err small" : "ok small"}>{maintenanceMessage}</p> : null}
        {maintenanceError ? <p className="err small">{maintenanceError}</p> : null}
        <div className="admin-field-compact">
          <label className="small" htmlFor="maintenance-open-at">
            {language === "fr" ? "Réouverture automatique (optionnel)" : "Automatic reopening (optional)"}
          </label>
          <input
            id="maintenance-open-at"
            type="datetime-local"
            value={maintenanceOpenAtInput}
            onChange={(e) => setMaintenanceOpenAtInput(e.target.value)}
            className="input"
          />
          <div className="admin-action-row">
            <button className="btn btn-secondary" type="button" onClick={() => applyQuickReopenDelay(1)} disabled={maintenanceLoading}>
              +1h
            </button>
            <button className="btn btn-secondary" type="button" onClick={() => applyQuickReopenDelay(3)} disabled={maintenanceLoading}>
              +3h
            </button>
            <button className="btn btn-secondary" type="button" onClick={() => applyQuickReopenDelay(24)} disabled={maintenanceLoading}>
              +24h
            </button>
            <button className="btn btn-secondary" type="button" onClick={applyTomorrowNineAm} disabled={maintenanceLoading}>
              {language === "fr" ? "Demain 09:00" : "Tomorrow 09:00"}
            </button>
          </div>
        </div>
        <div className="admin-action-row">
          <button
            className={maintenanceEnabled ? "btn btn-danger" : "btn"}
            disabled={maintenanceLoading}
            onClick={() => void toggleMaintenance()}
            type="button"
          >
            {maintenanceLoading
              ? language === "fr"
                ? "Chargement..."
                : "Loading..."
              : maintenanceEnabled
                ? language === "fr"
                  ? "Ouvrir le site"
                  : "Open site"
                : language === "fr"
                  ? "Fermer le site"
                  : "Close site"}
          </button>
        </div>
        {maintenanceEnabled ? (
          <p className="small err">
            {language === "fr"
              ? "Les administrateurs continuent de voir le site normalement."
              : "Administrators still see the site normally."}
          </p>
        ) : null}
      </section>

      <section className="section">
        <div className="admin-section-head">
          <div>
            <h2>{language === "fr" ? "Statistiques rapides" : "Quick stats"}</h2>
            <p className="small">
              {language === "fr" ? "Vue rapide des volumes actifs." : "Quick view of active volumes."}
            </p>
          </div>
        </div>
        <div className="admin-stats-grid">
          <div className="admin-stat-card">
            <div className="admin-stat-icon">🏬</div>
            <div className="admin-stat-content">
              <div className="admin-stat-value">{stats.activeProducts}/{stats.totalProducts}</div>
              <div className="admin-stat-label">{language === "fr" ? "Produits actifs" : "Active products"}</div>
            </div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-icon">📦</div>
            <div className="admin-stat-content">
              <div className="admin-stat-value">{stats.pendingOrders}/{stats.totalOrders}</div>
              <div className="admin-stat-label">{language === "fr" ? "Commandes en attente" : "Pending orders"}</div>
            </div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-icon">👥</div>
            <div className="admin-stat-content">
              <div className="admin-stat-value">{stats.totalCustomers}</div>
              <div className="admin-stat-label">{language === "fr" ? "Clients" : "Customers"}</div>
            </div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-icon">💸</div>
            <div className="admin-stat-content">
              <div className="admin-stat-value">{stats.taxTotal}</div>
              <div className="admin-stat-label">{language === "fr" ? "Total ventes" : "Total sales"}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <h2>{language === "fr" ? "Vue interne rentabilité" : "Internal profitability view"}</h2>
        <p className="small">
          {language === "fr"
            ? "Section réservée à l'administration pour lire les chiffres sensibles de rentabilité."
            : "Admin-only section for reading sensitive profitability figures."}
        </p>
        <div className="admin-stats-grid">
          <div className="admin-stat-card">
            <div className="admin-stat-content">
              <div className="admin-stat-value">{profitabilitySummary.stockValueAtCostLabel}</div>
              <div className="admin-stat-label">{language === "fr" ? "Valeur stock au coût" : "Stock value at cost"}</div>
            </div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-content">
              <div className="admin-stat-value">{profitabilitySummary.stockValueAtRetailLabel}</div>
              <div className="admin-stat-label">
                {language === "fr" ? "Valeur stock au prix de vente" : "Stock value at retail"}
              </div>
            </div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-content">
              <div className="admin-stat-value">{profitabilitySummary.grossRevenueLabel}</div>
              <div className="admin-stat-label">{language === "fr" ? "Revenu brut estimé" : "Estimated gross revenue"}</div>
            </div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-content">
              <div className="admin-stat-value">{profitabilitySummary.estimatedGrossProfitLabel}</div>
              <div className="admin-stat-label">
                {language === "fr" ? "Profit brut estimé" : "Estimated gross profit"}
              </div>
            </div>
          </div>
        </div>

        <div className="table-wrap admin-dashboard-table-wrap admin-table-spaced">
          <table className="admin-dashboard-table">
            <thead>
              <tr>
                <th>{language === "fr" ? "Produit" : "Product"}</th>
                <th>{language === "fr" ? "Stock" : "Stock"}</th>
                <th>{language === "fr" ? "Entrées" : "Added"}</th>
                <th>{language === "fr" ? "Vendus" : "Sold"}</th>
                <th>{language === "fr" ? "Ajustés" : "Adjusted"}</th>
                <th>{language === "fr" ? "Profit brut estimé" : "Estimated gross profit"}</th>
              </tr>
            </thead>
            <tbody>
              {profitabilityRows.map((row) => (
                <tr key={row.id}>
                  <td data-label={language === "fr" ? "Produit" : "Product"}>
                    <strong>{row.name}</strong>
                    <div className="small">{row.slug}</div>
                  </td>
                  <td data-label={language === "fr" ? "Stock" : "Stock"}>{row.stock}</td>
                  <td data-label={language === "fr" ? "Entrées" : "Added"}>{row.quantityAdded}</td>
                  <td data-label={language === "fr" ? "Vendus" : "Sold"}>{row.quantitySold}</td>
                  <td data-label={language === "fr" ? "Ajustés" : "Adjusted"}>{row.quantityAdjusted}</td>
                  <td data-label={language === "fr" ? "Profit brut estimé" : "Estimated gross profit"}>{row.estimatedGrossProfitLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <h2>{language === "fr" ? "Mode Olive" : "Olive mode"}</h2>
        <p className="small">
          {language === "fr"
            ? `Mode actuel : ${currentOliveMode === "gremlin" ? "Gremlin" : "Princesse"}`
            : `Current mode: ${currentOliveMode === "gremlin" ? "Gremlin" : "Princess"}`}
        </p>
        {oliveModeMessage ? <p className="ok small">{oliveModeMessage}</p> : null}
        {oliveModeError ? <p className="err small">{oliveModeError}</p> : null}
        <div className="admin-action-row">
          <button
            className={currentOliveMode === "princess" ? "btn" : "btn btn-secondary"}
            disabled={oliveModeLoading}
            onClick={() => void updateOliveMode("princess")}
            type="button"
          >
            {language === "fr" ? "Activer Princesse" : "Activate Princess"}
          </button>
          <button
            className={currentOliveMode === "gremlin" ? "btn" : "btn btn-secondary"}
            disabled={oliveModeLoading}
            onClick={() => void updateOliveMode("gremlin")}
            type="button"
          >
            {language === "fr" ? "Activer Gremlin" : "Activate Gremlin"}
          </button>
        </div>
      </section>

      <section className="section">
        <div className="admin-section-head">
          <div>
            <h2>{language === "fr" ? "Commandes récentes" : "Recent orders"}</h2>
            <p className="small">
              {language === "fr" ? "Dernières commandes à surveiller." : "Latest orders to monitor."}
            </p>
          </div>
          <Link className="btn btn-secondary" href="/admin/orders">
            {language === "fr" ? "Voir tout" : "View all"}
          </Link>
        </div>
        {recentOrders.length === 0 ? (
          <p className="small">{language === "fr" ? "Aucune commande récente." : "No recent orders."}</p>
        ) : (
          <div className="table-wrap admin-dashboard-table-wrap admin-table-spaced">
            <table className="admin-dashboard-table">
              <thead>
                <tr>
                  <th>{language === "fr" ? "Commande" : "Order"}</th>
                  <th>{language === "fr" ? "Client" : "Customer"}</th>
                  <th>{language === "fr" ? "Statut" : "Status"}</th>
                  <th>{language === "fr" ? "Total" : "Total"}</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td data-label={language === "fr" ? "Commande" : "Order"}>{order.orderNumber}</td>
                    <td data-label={language === "fr" ? "Client" : "Customer"}>{order.customerName}</td>
                    <td data-label={language === "fr" ? "Statut" : "Status"}>
                      <span className="badge">{formatOrderStatus(order.status, language)}</span>
                    </td>
                    <td data-label={language === "fr" ? "Total" : "Total"}>{order.totalLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

