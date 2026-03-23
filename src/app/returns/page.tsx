import Link from "next/link";
import { getCurrentLanguage } from "@/lib/language";
import { getDictionary } from "@/lib/i18n";
import { getBusinessInfo } from "@/lib/business";

export default async function ReturnsPage() {
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
          <Link className="pill-link" href="/terms">
            {t.navTerms}
          </Link>
        </nav>
      </header>

      <section className="section">
        <h1>{t.navReturns}</h1>
        <p className="small">
          {language === "fr"
            ? "Politique de retour et remboursement Maison Olive."
            : "Maison Olive return and refund policy."}
        </p>
      </section>

      <section className="section legal-content">
        <h2>{language === "fr" ? "Délai de retour" : "Return window"}</h2>
        <p className="small">
          {language === "fr"
            ? "Tu peux demander un retour dans les 14 jours suivant la réception de la commande."
            : "You can request a return within 14 days of receiving your order."}
        </p>

        <h2>{language === "fr" ? "Produits éligibles" : "Eligible products"}</h2>
        <p className="small">
          {language === "fr"
            ? "Les produits doivent être non utilisés et dans leur emballage d’origine."
            : "Products must be unused and in their original packaging."}
        </p>

        <h2>{language === "fr" ? "Remboursement" : "Refund"}</h2>
        <p className="small">
          {language === "fr"
            ? "Le remboursement est traité sous 5 à 10 jours ouvrables après validation du retour."
            : "Refund is processed within 5 to 10 business days after return approval."}
        </p>

        <h2>{language === "fr" ? "Contact retours" : "Returns contact"}</h2>
        <p className="small">{business.supportEmail}</p>
      </section>
    </div>
  );
}
