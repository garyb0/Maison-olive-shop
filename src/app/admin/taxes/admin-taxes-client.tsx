"use client";

import type { Dictionary, Language } from "@/lib/i18n";

type Props = {
  language: Language;
  t: Dictionary;
  taxSummary: {
    subtotalLabel: string;
    gstLabel: string;
    qstLabel: string;
    taxesLabel: string;
    shippingLabel: string;
    totalLabel: string;
  };
};

export function AdminTaxesClient({ language, t, taxSummary }: Props) {
  return (
    <>
      <section className="section">
        <h1>{t.taxReport}</h1>
        <p className="small">
          {language === "fr" ? "Résumé des ventes et taxes collectées." : "Sales and tax collection summary."}
        </p>
      </section>

      <section className="section">
        <h2>{language === "fr" ? "Résumé fiscal" : "Tax summary"}</h2>
        <div className="admin-stats-grid">
          <div className="admin-stat-card">
            <div className="admin-stat-icon">$</div>
            <div className="admin-stat-content">
              <div className="admin-stat-value">{taxSummary.subtotalLabel}</div>
              <div className="admin-stat-label">{language === "fr" ? "Sous-total" : "Subtotal"}</div>
            </div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-icon">G</div>
            <div className="admin-stat-content">
              <div className="admin-stat-value">{taxSummary.gstLabel}</div>
              <div className="admin-stat-label">{language === "fr" ? "TPS" : "GST"}</div>
            </div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-icon">Q</div>
            <div className="admin-stat-content">
              <div className="admin-stat-value">{taxSummary.qstLabel}</div>
              <div className="admin-stat-label">{language === "fr" ? "TVQ" : "QST"}</div>
            </div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-icon">%</div>
            <div className="admin-stat-content">
              <div className="admin-stat-value">{taxSummary.taxesLabel}</div>
              <div className="admin-stat-label">{language === "fr" ? "Taxes totales" : "Total taxes"}</div>
            </div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-icon">#</div>
            <div className="admin-stat-content">
              <div className="admin-stat-value">{taxSummary.shippingLabel}</div>
              <div className="admin-stat-label">{language === "fr" ? "Livraison" : "Shipping"}</div>
            </div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-icon">=</div>
            <div className="admin-stat-content">
              <div className="admin-stat-value">{taxSummary.totalLabel}</div>
              <div className="admin-stat-label">{language === "fr" ? "Total" : "Total"}</div>
            </div>
          </div>
        </div>

        <div className="row" style={{ marginTop: 20 }}>
          <a className="btn" href="/api/admin/taxes?format=csv">
            {t.taxesExportCsv}
          </a>
        </div>
      </section>
    </>
  );
}
