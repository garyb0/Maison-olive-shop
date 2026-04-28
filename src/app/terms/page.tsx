import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentLanguage } from "@/lib/language";
import { getDictionary } from "@/lib/i18n";
import { getBusinessInfo } from "@/lib/business";
import { getTermsSections } from "@/lib/help-center";
import { Navigation } from "@/components/Navigation";
import { PromoBanner } from "@/components/PromoBanner";

export default async function TermsPage() {
  const language = await getCurrentLanguage();
  const t = getDictionary(language);
  const business = getBusinessInfo(language);
  const user = await getCurrentUser();
  const sections = getTermsSections(language, business);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">{t.brandName}</div>
        <Navigation language={language} t={t} user={user} />
      </header>

      <PromoBanner language={language} />

      <section className="section help-hero">
        <h1>{language === "fr" ? "Conditions de vente" : "Terms of sale"}</h1>
        <p className="small">
          {language === "fr"
            ? "Cette page r\u00e9sume simplement les conditions g\u00e9n\u00e9rales qui encadrent une commande chez Olive."
            : "This page simply summarizes the general terms that apply to an order at Chez Olive."}
        </p>
      </section>

      <section className="section legal-content">
        <div className="help-section-head">
          <h2>{language === "fr" ? "Conditions" : "Terms"}</h2>
          <Link className="pill-link pill-link--sm" href="/faq">
            {language === "fr" ? "Centre d\u2019aide" : "Help center"}
          </Link>
        </div>
        {sections.map((item) => (
          <article key={item.title} className="help-info-card">
            <h3>{item.title}</h3>
            <p className="small">{item.body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
