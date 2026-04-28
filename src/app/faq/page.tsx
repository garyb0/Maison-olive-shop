import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentLanguage } from "@/lib/language";
import { getDictionary } from "@/lib/i18n";
import { getBusinessInfo } from "@/lib/business";
import { getHelpCenterCards, getHelpCenterQuestions } from "@/lib/help-center";
import { Navigation } from "@/components/Navigation";
import { PromoBanner } from "@/components/PromoBanner";

export default async function FaqPage() {
  const language = await getCurrentLanguage();
  const t = getDictionary(language);
  const business = getBusinessInfo(language);
  const user = await getCurrentUser();
  const cards = getHelpCenterCards(language, business);
  const questions = getHelpCenterQuestions(language, business);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">{t.brandName}</div>
        <Navigation language={language} t={t} user={user} />
      </header>

      <PromoBanner language={language} />

      <section className="section help-hero">
        <h1>{language === "fr" ? "Centre d\u2019aide" : "Help center"}</h1>
        <p className="small">
          {language === "fr"
            ? "Trouve rapidement l\u2019essentiel pour ta commande, la livraison, les retours, le paiement et le support."
            : "Quickly find the essentials for your order, shipping, returns, payment, and support."}
        </p>
      </section>

      <section className="section">
        <div className="help-card-grid">
          {cards.map((card) => {
            const anchorId =
              card.href === "/terms"
                ? "cgv"
                : card.href === "/returns"
                  ? "retours"
                  : undefined;

            if (card.external) {
              return (
                <a key={card.title} className="help-nav-card" href={card.href} id={anchorId}>
                  <h2>{card.title}</h2>
                  <p className="small">{card.description}</p>
                  <span className="help-nav-card__cta">
                    {language === "fr" ? "Ouvrir" : "Open"} {"\u2192"}
                  </span>
                </a>
              );
            }

            if (card.href.startsWith("#")) {
              return (
                <a key={card.title} className="help-nav-card" href={card.href} id={anchorId}>
                  <h2>{card.title}</h2>
                  <p className="small">{card.description}</p>
                  <span className="help-nav-card__cta">
                    {language === "fr" ? "Voir" : "View"} {"\u2192"}
                  </span>
                </a>
              );
            }

            return (
              <Link key={card.title} className="help-nav-card" href={card.href} id={anchorId}>
                <h2>{card.title}</h2>
                <p className="small">{card.description}</p>
                <span className="help-nav-card__cta">
                  {language === "fr" ? "Voir" : "View"} {"\u2192"}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section id="faq" className="section faq-list">
        <div className="help-section-head">
          <h2>FAQ</h2>
          <Link className="pill-link pill-link--sm" href="/shipping">
            {language === "fr" ? "Livraison" : "Shipping"}
          </Link>
        </div>
        {questions.map((item) => (
          <article key={item.q} className="faq-item">
            <h3>{item.q}</h3>
            <p className="small">{item.a}</p>
          </article>
        ))}
      </section>

      <section className="section help-support-cta">
        <div className="help-support-cta__content">
          <h2>{language === "fr" ? "Besoin d\u2019un coup de main ?" : "Need a hand?"}</h2>
          <p className="small">
            {language === "fr"
              ? "Notre \u00e9quipe peut t\u2019aider avant ou apr\u00e8s la commande."
              : "Our team can help before or after your order."}
          </p>
        </div>
        <a className="btn" href={`mailto:${business.supportEmail}`}>
          {language === "fr" ? "Nous \u00e9crire" : "Email us"}
        </a>
      </section>
    </div>
  );
}
