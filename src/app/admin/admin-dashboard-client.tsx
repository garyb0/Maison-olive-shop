"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Dictionary, Language } from "@/lib/i18n";

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

export function AdminDashboardClient({
  language,
  t,
  oliveMode,
  initialMaintenanceEnabled,
  initialMaintenanceOpenAt,
  stats,
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

