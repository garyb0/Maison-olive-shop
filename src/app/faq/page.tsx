import Link from "next/link";
import { getCurrentLanguage } from "@/lib/language";
import { getDictionary } from "@/lib/i18n";
import { getBusinessInfo } from "@/lib/business";

export default async function FaqPage() {
  const language = await getCurrentLanguage();
  const t = getDictionary(language);
  const business = getBusinessInfo(language);

  const questions =
    language === "fr"
      ? [
          {
            q: "Quels sont vos délais de livraison?",
            a: business.shippingPolicy,
          },
          {
            q: "Quels modes de paiement acceptez-vous?",
            a: "Nous acceptons Stripe (carte) et le mode paiement manuel.",
          },
          {
            q: "Comment suivre ma commande?",
            a: "Depuis Mon compte > Historique des commandes, tu vois tous les statuts.",
          },
          {
            q: "Comment contacter le support?",
            a: `Email: ${business.supportEmail} — ${business.supportHours}`,
          },
        ]
      : [
          {
            q: "What are your shipping times?",
            a: business.shippingPolicy,
          },
          {
            q: "Which payment methods do you support?",
            a: "We support Stripe (card) and manual payment mode.",
          },
          {
            q: "How do I track my order?",
            a: "From My account > Order history, you can view all statuses.",
          },
          {
            q: "How do I contact support?",
            a: `Email: ${business.supportEmail} — ${business.supportHours}`,
          },
        ];

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">{t.brandName}</div>
        <nav className="nav-links">
          <Link className="pill-link" href="/">
            {t.navHome}
          </Link>
          <Link className="pill-link" href="/checkout">
            {t.navCheckout}
          </Link>
          <Link className="pill-link" href="/account">
            {t.navAccount}
          </Link>
        </nav>
      </header>

      <section className="section">
        <h1>{t.navFaq}</h1>
        <p className="small">
          {language === "fr"
            ? "Questions fréquentes pour aider tes clients avant achat."
            : "Frequently asked questions to help customers before purchase."}
        </p>
      </section>

      <section className="section faq-list">
        {questions.map((item) => (
          <article key={item.q} className="faq-item">
            <h3>{item.q}</h3>
            <p className="small">{item.a}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
