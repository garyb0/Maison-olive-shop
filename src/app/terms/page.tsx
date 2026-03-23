import Link from "next/link";
import { getCurrentLanguage } from "@/lib/language";
import { getDictionary } from "@/lib/i18n";
import { getBusinessInfo } from "@/lib/business";

export default async function TermsPage() {
  const language = await getCurrentLanguage();
  const t = getDictionary(language);
  const business = getBusinessInfo(language);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">{t.brandName}</div>
        <nav className="nav-links">
          <Link className="pill-link" href="/">
            {t.navHome}
          </Link>
          <Link className="pill-link" href="/faq">
            {t.navFaq}
          </Link>
          <Link className="pill-link" href="/returns">
            {t.navReturns}
          </Link>
        </nav>
      </header>

      <section className="section">
        <h1>{t.navTerms}</h1>
        <p className="small">
          {language === "fr"
            ? "Conditions générales de vente de Maison Olive."
            : "Maison Olive general terms and conditions of sale."}
        </p>
      </section>

      <section className="section legal-content">
        <h2>{language === "fr" ? "1. Produits et prix" : "1. Products and pricing"}</h2>
        <p className="small">
          {language === "fr"
            ? "Les prix sont en CAD. Les fiches produits sont présentées avec soin mais peuvent être ajustées sans préavis."
            : "Prices are in CAD. Product details are curated carefully but may be updated without prior notice."}
        </p>

        <h2>{language === "fr" ? "2. Paiement" : "2. Payment"}</h2>
        <p className="small">
          {language === "fr"
            ? "Paiement via Stripe (carte) ou mode manuel selon disponibilité."
            : "Payment via Stripe (card) or manual mode depending on availability."}
        </p>

        <h2>{language === "fr" ? "3. Livraison" : "3. Shipping"}</h2>
        <p className="small">{business.shippingPolicy}</p>

        <h2>{language === "fr" ? "4. Support" : "4. Support"}</h2>
        <p className="small">{business.supportEmail}</p>
      </section>
    </div>
  );
}
