import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { getCurrentLanguage } from "@/lib/language";

export default async function AccountSupportPage() {
  await getCurrentUser();
  const language = await getCurrentLanguage();
  const supportEmail = env.businessSupportEmail;

  return (
    <>
      <section className="section account-home-hero">
        <p className="account-home-hero__eyebrow">
          {language === "fr" ? "Support" : "Support"}
        </p>
        <h1>{language === "fr" ? "Support client" : "Customer support"}</h1>
        <p className="small account-section-copy">
          {language === "fr"
            ? "Besoin d'aide avant ou après une commande ? On t'oriente rapidement vers la bonne ressource."
            : "Need help before or after an order? We will guide you quickly to the right resource."}
        </p>
      </section>

      <section className="support-lite-grid">
        <article className="support-lite-card">
          <p className="support-lite-card__eyebrow">{language === "fr" ? "Contact direct" : "Direct contact"}</p>
          <h2 className="support-lite-card__title">{language === "fr" ? "Nous écrire" : "Email us"}</h2>
          <p className="small support-lite-card__text">
            {language === "fr"
              ? "Pour une question sur une commande, un produit ou une livraison, écris-nous directement."
              : "For questions about an order, product, or delivery, email us directly."}
          </p>
          <div className="support-lite-card__actions">
            <a className="btn" href={`mailto:${supportEmail}`}>
              {language === "fr" ? "Envoyer un courriel" : "Send an email"}
            </a>
          </div>
        </article>

        <article className="support-lite-card">
          <p className="support-lite-card__eyebrow">{language === "fr" ? "Aide rapide" : "Quick help"}</p>
          <h2 className="support-lite-card__title">{language === "fr" ? "Centre d'aide" : "Help center"}</h2>
          <p className="small support-lite-card__text">
            {language === "fr"
              ? "Retours, livraison, paiement et réponses fréquentes sont regroupés au même endroit."
              : "Returns, shipping, payment, and common answers are all grouped in one place."}
          </p>
          <div className="support-lite-card__actions">
            <Link className="btn btn-secondary" href="/faq">
              {language === "fr" ? "Voir le centre d'aide" : "Open help center"}
            </Link>
          </div>
        </article>
      </section>

      <section className="section account-section-card">
        <div className="account-section-head">
          <div>
            <p className="account-home-hero__eyebrow">{language === "fr" ? "Repères" : "Guidance"}</p>
            <h2>{language === "fr" ? "Quand nous écrire ?" : "When should you contact us?"}</h2>
          </div>
        </div>
        <div className="support-lite-grid account-support-grid">
          <article className="support-lite-card">
            <h3 className="support-lite-card__title">{language === "fr" ? "Avant la commande" : "Before ordering"}</h3>
            <p className="small support-lite-card__text">
              {language === "fr"
                ? "Pour confirmer un produit, une livraison locale ou une information pratique."
                : "To confirm a product, local delivery, or any practical information."}
            </p>
          </article>
          <article className="support-lite-card">
            <h3 className="support-lite-card__title">{language === "fr" ? "Après la commande" : "After ordering"}</h3>
            <p className="small support-lite-card__text">
              {language === "fr"
                ? "Pour un suivi, un changement lié à la livraison ou un problème avec ta commande."
                : "For tracking, delivery changes, or a problem with your order."}
            </p>
          </article>
        </div>
      </section>
    </>
  );
}
