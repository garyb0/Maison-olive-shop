import { getCurrentUser } from "@/lib/auth";
import { getCurrentLanguage } from "@/lib/language";
import { getDictionary } from "@/lib/i18n";
import { getBusinessInfo } from "@/lib/business";
import { Navigation } from "@/components/Navigation";
import { PromoBanner } from "@/components/PromoBanner";

export default async function FaqPage() {
  const language = await getCurrentLanguage();
  const t = getDictionary(language);
  const business = getBusinessInfo(language);
  const user = await getCurrentUser();

  const questions =
    language === "fr"
      ? [
          {
            q: "Comment suivre ma commande?",
            a: "Depuis Mon compte > Historique des commandes, tu vois tous les statuts.",
          },
          {
            q: "Comment contacter le support?",
            a: `Email: ${business.supportEmail} — ${business.supportHours}`,
          },
          {
            q: "Où trouver les informations de paiement et livraison?",
            a: (
              <>
                {"Consulte la section "}
                <a href="#cgv">{t.navTerms}</a>
                {" ci-dessous."}
              </>
            ),
          },
          {
            q: "Comment faire un retour ou demander un remboursement?",
            a: (
              <>
                {"Consulte la section "}
                <a href="#retours">{t.navReturns}</a>
                {" ci-dessous."}
              </>
            ),
          },
        ]
      : [
          {
            q: "How do I track my order?",
            a: "From My account > Order history, you can view all statuses.",
          },
          {
            q: "How do I contact support?",
            a: `Email: ${business.supportEmail} — ${business.supportHours}`,
          },
          {
            q: "Where can I find payment and shipping information?",
            a: (
              <>
                {"Please see the "}
                <a href="#cgv">{t.navTerms}</a>
                {" section below."}
              </>
            ),
          },
          {
            q: "How do I request a return or refund?",
            a: (
              <>
                {"Please see the "}
                <a href="#retours">{t.navReturns}</a>
                {" section below."}
              </>
            ),
          },
        ];

  const termsItems =
    language === "fr"
      ? [
          {
            title: "1. Produits et prix",
            text: "Les prix sont en CAD. Les fiches produits sont présentées avec soin mais peuvent être ajustées sans préavis.",
          },
          {
            title: "2. Paiement",
            text: "Paiement via Stripe (carte) ou mode manuel selon disponibilité.",
          },
          {
            title: "3. Livraison",
            text: business.shippingPolicy,
          },
          {
            title: "4. Support",
            text: business.supportEmail,
          },
        ]
      : [
          {
            title: "1. Products and pricing",
            text: "Prices are in CAD. Product details are curated carefully but may be updated without prior notice.",
          },
          {
            title: "2. Payment",
            text: "Payment via Stripe (card) or manual mode depending on availability.",
          },
          {
            title: "3. Shipping",
            text: business.shippingPolicy,
          },
          {
            title: "4. Support",
            text: business.supportEmail,
          },
        ];

  const returnsItems =
    language === "fr"
      ? [
          {
            title: "Délai de retour",
            text: "Tu peux demander un retour dans les 14 jours suivant la réception de la commande.",
          },
          {
            title: "Produits éligibles",
            text: "Les produits doivent être non utilisés et dans leur emballage d’origine.",
          },
          {
            title: "Remboursement",
            text: "Le remboursement est traité sous 5 à 10 jours ouvrables après validation du retour.",
          },
          {
            title: "Contact retours",
            text: business.supportEmail,
          },
        ]
      : [
          {
            title: "Return window",
            text: "You can request a return within 14 days of receiving your order.",
          },
          {
            title: "Eligible products",
            text: "Products must be unused and in their original packaging.",
          },
          {
            title: "Refund",
            text: "Refund is processed within 5 to 10 business days after return approval.",
          },
          {
            title: "Returns contact",
            text: business.supportEmail,
          },
        ];

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">{t.brandName}</div>
        <Navigation language={language} t={t} user={user} />
      </header>

      <PromoBanner />

      <section className="section">
        <h1>{t.navFaq}</h1>
        <p className="small">
          {language === "fr"
            ? "FAQ complète incluant aussi les CGV et la politique de retours."
            : "Complete FAQ including terms and return policy."}
        </p>
        <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
          <a href="#faq" className="pill-link pill-link--sm">{t.navFaq}</a>
          <a href="#cgv" className="pill-link pill-link--sm">{t.navTerms}</a>
          <a href="#retours" className="pill-link pill-link--sm">{t.navReturns}</a>
        </div>
      </section>

      <section id="faq" className="section faq-list">
        <h2>{t.navFaq}</h2>
        {questions.map((item) => (
          <article key={item.q} className="faq-item">
            <h3>{item.q}</h3>
            <p className="small">{item.a}</p>
          </article>
        ))}
      </section>

      <section id="cgv" className="section legal-content">
        <h2>{t.navTerms}</h2>
        {termsItems.map((item) => (
          <article key={item.title} style={{ marginBottom: "1rem" }}>
            <h3>{item.title}</h3>
            <p className="small">{item.text}</p>
          </article>
        ))}
      </section>

      <section id="retours" className="section legal-content">
        <h2>{t.navReturns}</h2>
        {returnsItems.map((item) => (
          <article key={item.title} style={{ marginBottom: "1rem" }}>
            <h3>{item.title}</h3>
            <p className="small">{item.text}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
