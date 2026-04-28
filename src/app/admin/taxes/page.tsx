import { getCurrentLanguage } from "@/lib/language";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/auth";
import { getTaxReport } from "@/lib/admin";
import { formatCurrency } from "@/lib/format";
import { AdminTaxesClient } from "./admin-taxes-client";
import Link from "next/link";

export default async function AdminTaxesPage() {
  const [language, user] = await Promise.all([getCurrentLanguage(), getCurrentUser()]);
  const t = getDictionary(language);

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

  const taxReport = await getTaxReport();

  return (
    <AdminTaxesClient
      language={language}
      t={t}
      taxSummary={{
        subtotalLabel: formatCurrency(taxReport.summary.subtotalCents, "CAD", language === "fr" ? "fr-CA" : "en-CA"),
        gstLabel: formatCurrency(taxReport.summary.gstCents, "CAD", language === "fr" ? "fr-CA" : "en-CA"),
        qstLabel: formatCurrency(taxReport.summary.qstCents, "CAD", language === "fr" ? "fr-CA" : "en-CA"),
        taxesLabel: formatCurrency(taxReport.summary.taxCents, "CAD", language === "fr" ? "fr-CA" : "en-CA"),
        shippingLabel: formatCurrency(taxReport.summary.shippingCents, "CAD", language === "fr" ? "fr-CA" : "en-CA"),
        totalLabel: formatCurrency(taxReport.summary.totalCents, "CAD", language === "fr" ? "fr-CA" : "en-CA"),
      }}
    />
  );
}
