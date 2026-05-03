import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentLanguage } from "@/lib/language";
import { getDictionary } from "@/lib/i18n";
import { getBusinessInfo } from "@/lib/business";
import { getHelpCenterQuestions, getHelpQuickActions, getHelpTopics } from "@/lib/help-center";
import { Navigation } from "@/components/Navigation";
import { HelpSupportActions } from "@/components/HelpSupportActions";

export default async function FaqPage() {
  const language = await getCurrentLanguage();
  const t = getDictionary(language);
  const business = getBusinessInfo(language);
  const user = await getCurrentUser();
  const quickActions = getHelpQuickActions(language, business);
  const topics = getHelpTopics(language, business);
  const questions = getHelpCenterQuestions(language, business);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">{t.brandName}</div>
        <Navigation language={language} t={t} user={user} />
      </header>

      <section className="section help-hero help-hero--hub">
        <div className="help-hero__content">
          <p className="help-hero__eyebrow">{language === "fr" ? "Centre d’aide" : "Help center"}</p>
          <h1>{language === "fr" ? "Comment peut-on t’aider ?" : "How can we help?"}</h1>
          <p className="help-hero__text">
            {language === "fr"
              ? "Commande, livraison, retour ou question produit: tout part d’ici, avec l’équipe Chez Olive pas loin."
              : "Order, delivery, return, or product question: start here, with the Chez Olive team close by."}
          </p>
          <HelpSupportActions language={language} supportEmail={business.supportEmail} />
        </div>
        <nav className="help-anchor-nav" aria-label={language === "fr" ? "Sections du centre d’aide" : "Help center sections"}>
          {topics.map((topic) => (
            <a key={topic.id} href={`#${topic.id}`}>
              {topic.eyebrow}
            </a>
          ))}
        </nav>
      </section>

      <section className="section help-quick-section" aria-labelledby="help-quick-actions">
        <div className="help-section-head">
          <div>
            <p className="section-kicker">{language === "fr" ? "Actions rapides" : "Quick actions"}</p>
            <h2 id="help-quick-actions">{language === "fr" ? "On va au plus court" : "Straight to what you need"}</h2>
          </div>
        </div>
        <div className="help-quick-grid">
          {quickActions.map((action) =>
            action.eventName ? (
              <article
                key={action.title}
                className={`help-quick-card ${action.primary ? "help-quick-card--primary" : ""}`}
              >
                <h3>{action.title}</h3>
                <p className="small">{action.description}</p>
                <HelpSupportActions
                  compact
                  language={language}
                  primaryLabel={language === "fr" ? "Ouvrir la bulle Aide" : "Open Help"}
                  supportEmail={business.supportEmail}
                />
              </article>
            ) : (
              <Link
                key={action.title}
                className={`help-quick-card ${action.primary ? "help-quick-card--primary" : ""}`}
                href={action.href ?? "/faq"}
              >
                <h3>{action.title}</h3>
                <p className="small">{action.description}</p>
                <span className="help-card-link">{language === "fr" ? "Voir" : "View"}</span>
              </Link>
            ),
          )}
        </div>
      </section>

      <section className="section help-topic-section" aria-labelledby="help-topic-title">
        <div className="help-section-head">
          <div>
            <p className="section-kicker">{language === "fr" ? "Guide client" : "Customer guide"}</p>
            <h2 id="help-topic-title">{language === "fr" ? "Les essentiels au même endroit" : "The essentials in one place"}</h2>
          </div>
        </div>
        <div className="help-topic-grid">
          {topics.map((topic) => (
            <article id={topic.id} key={topic.id} className="help-topic-card">
              <p className="help-topic-card__eyebrow">{topic.eyebrow}</p>
              <h3>{topic.title}</h3>
              <p className="small">{topic.body}</p>
              <ul className="help-topic-card__points">
                {topic.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              {topic.ctaHref && topic.ctaLabel ? (
                topic.ctaHref.startsWith("mailto:") ? (
                  <a className="pill-link pill-link--sm" href={topic.ctaHref}>
                    {topic.ctaLabel}
                  </a>
                ) : (
                  <Link className="pill-link pill-link--sm" href={topic.ctaHref}>
                    {topic.ctaLabel}
                  </Link>
                )
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section id="faq" className="section faq-list help-faq-section" aria-labelledby="help-faq-title">
        <div className="help-section-head">
          <div>
            <p className="section-kicker">FAQ</p>
            <h2 id="help-faq-title">{language === "fr" ? "Questions fréquentes" : "Frequently asked questions"}</h2>
          </div>
        </div>
        <div className="help-faq-grid">
          {questions.map((item) => (
            <details key={item.q} className="faq-item help-faq-item">
              <summary>{item.q}</summary>
              <p className="small">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="section help-support-cta help-support-cta--hub">
        <div className="help-support-cta__content">
          <p className="section-kicker">{language === "fr" ? "Support humain" : "Human support"}</p>
          <h2>{language === "fr" ? "Pas besoin de chercher seul." : "You do not have to figure it out alone."}</h2>
          <p className="small">
            {language === "fr"
              ? "Ouvre la bulle Aide et on te répondra ici dès que possible. Le courriel reste disponible si tu préfères."
              : "Open the Help bubble and we will reply here as soon as possible. Email is still available if you prefer."}
          </p>
        </div>
        <HelpSupportActions language={language} supportEmail={business.supportEmail} compact />
      </section>
    </div>
  );
}
