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
            ? "Mode gremlin d'Olive active."
            : "Mode princesse d'Olive active."
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
      <section className="section">
        <h1>{t.adminTitle}</h1>
        <p className="small">
          {language === "fr" ? "Bienvenue dans le panneau d'administration." : "Welcome to the admin panel."}
        </p>
      </section>

      <section className="section">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <h2 style={{ margin: 0 }}>{language === "fr" ? "Mode Maintenance" : "Maintenance Mode"}</h2>
          <Link className="btn btn-secondary" href="/admin/maintenance-cloudflare">
            {language === "fr" ? "Aide maintenance Cloudflare" : "Cloudflare maintenance help"}
          </Link>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 12,
            marginTop: 14,
          }}
        >
          <div
            style={{
              padding: 14,
              borderRadius: 16,
              border: "1px solid rgba(120, 113, 108, 0.16)",
              background: "rgba(250, 250, 249, 0.95)",
            }}
          >
            <p className="small" style={{ margin: 0, fontWeight: 700, color: "#1c1917" }}>
              {language === "fr" ? "Maintenance normale" : "Normal maintenance"}
            </p>
            <p className="small" style={{ margin: "6px 0 0" }}>
              {language === "fr"
                ? "Utilise ce bouton pour fermer le site proprement, avec réouverture planifiée si besoin."
                : "Use this button to close the site cleanly, with scheduled reopening if needed."}
            </p>
          </div>
          <div
            style={{
              padding: 14,
              borderRadius: 16,
              border: "1px solid rgba(180, 83, 9, 0.18)",
              background: "rgba(255, 247, 237, 0.92)",
            }}
          >
            <p className="small" style={{ margin: 0, fontWeight: 700, color: "#9a3412" }}>
              {language === "fr" ? "Urgence Cloudflare" : "Cloudflare emergency"}
            </p>
            <p className="small" style={{ margin: "6px 0 0" }}>
              {language === "fr"
                ? "À utiliser seulement si le PC local, PM2 ou le tunnel ne répond plus."
                : "Use only if the local PC, PM2, or the tunnel stops responding."}
            </p>
          </div>
        </div>
        <p className="small">
          {language === "fr"
            ? `État actuel : ${maintenanceEnabled ? "Site FERME" : "Site OUVERT"}`
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
        <div style={{ marginTop: 10 }}>
          <label className="small" htmlFor="maintenance-open-at">
            {language === "fr" ? "Réouverture automatique (optionnel)" : "Automatic reopening (optional)"}
          </label>
          <input
            id="maintenance-open-at"
            type="datetime-local"
            value={maintenanceOpenAtInput}
            onChange={(e) => setMaintenanceOpenAtInput(e.target.value)}
            className="input"
            style={{ marginTop: 6, maxWidth: 320 }}
          />
          <div className="row" style={{ marginTop: 8, gap: 8, flexWrap: "wrap" }}>
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
        <div style={{ marginTop: 10 }}>
          <button
            className={maintenanceEnabled ? "btn btn-danger" : "btn"}
            disabled={maintenanceLoading}
            onClick={() => void toggleMaintenance()}
            type="button"
            style={{ minWidth: 280 }}
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
          <p className="small" style={{ marginTop: 12, color: "#dc2626" }}>
            {language === "fr"
              ? "Les administrateurs continuent de voir le site normalement."
              : "Administrators still see the site normally."}
          </p>
        ) : null}
      </section>

      <section className="section">
        <h2>{language === "fr" ? "Statistiques rapides" : "Quick stats"}</h2>
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
        <h2>{language === "fr" ? "Vue interne rentabilite" : "Internal profitability view"}</h2>
        <p className="small">
          {language === "fr"
            ? "Section réservée à l'administration pour lire les chiffres sensibles de rentabilité."
            : "Admin-only section for reading sensitive profitability figures."}
        </p>
        <div className="admin-stats-grid">
          <div className="admin-stat-card">
            <div className="admin-stat-content">
              <div className="admin-stat-value">{profitabilitySummary.stockValueAtCostLabel}</div>
              <div className="admin-stat-label">{language === "fr" ? "Valeur stock au cout" : "Stock value at cost"}</div>
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
              <div className="admin-stat-label">{language === "fr" ? "Revenu brut estime" : "Estimated gross revenue"}</div>
            </div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-content">
              <div className="admin-stat-value">{profitabilitySummary.estimatedGrossProfitLabel}</div>
              <div className="admin-stat-label">
                {language === "fr" ? "Profit brut estime" : "Estimated gross profit"}
              </div>
            </div>
          </div>
        </div>

        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>{language === "fr" ? "Produit" : "Product"}</th>
                <th>{language === "fr" ? "Stock" : "Stock"}</th>
                <th>{language === "fr" ? "Entrees" : "Added"}</th>
                <th>{language === "fr" ? "Vendus" : "Sold"}</th>
                <th>{language === "fr" ? "Ajustes" : "Adjusted"}</th>
                <th>{language === "fr" ? "Profit brut estime" : "Estimated gross profit"}</th>
              </tr>
            </thead>
            <tbody>
              {profitabilityRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.name}</strong>
                    <div className="small">{row.slug}</div>
                  </td>
                  <td>{row.stock}</td>
                  <td>{row.quantityAdded}</td>
                  <td>{row.quantitySold}</td>
                  <td>{row.quantityAdjusted}</td>
                  <td>{row.estimatedGrossProfitLabel}</td>
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
        <div className="row" style={{ marginTop: 10 }}>
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
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h2>{language === "fr" ? "Commandes récentes" : "Recent orders"}</h2>
          <Link className="btn btn-secondary" href="/admin/orders">
            {language === "fr" ? "Voir tout" : "View all"}
          </Link>
        </div>
        {recentOrders.length === 0 ? (
          <p className="small">{language === "fr" ? "Aucune commande récente." : "No recent orders."}</p>
        ) : (
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table>
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
                    <td>{order.orderNumber}</td>
                    <td>{order.customerName}</td>
                    <td>
                      <span className="badge">{order.status}</span>
                    </td>
                    <td>{order.totalLabel}</td>
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

