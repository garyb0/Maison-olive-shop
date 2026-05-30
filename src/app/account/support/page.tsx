import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { getCurrentLanguage } from "@/lib/language";

export default async function AccountSupportPage() {
  await getCurrentUser();
  const language = await getCurrentLanguage();
  const supportEmail = env.businessSupportEmail;

  return (
    <div className="account-support-page">
      <section className="section account-support-hero">
        <div className="account-support-hero__copy">
          <p className="account-home-hero__eyebrow">{language === "fr" ? "Support" : "Support"}</p>
          <h1>{language === "fr" ? "Support client" : "Customer support"}</h1>
          <p className="small account-section-copy">
            {language === "fr"
              ? "Besoin d'aide avant ou après une commande ? On t'oriente rapidement vers la bonne ressource."
              : "Need help before or after an order? We will guide you quickly to the right resource."}
          </p>
        </div>

        <div className="account-support-hero__aside" aria-label={language === "fr" ? "Informations support" : "Support information"}>
          <span>{language === "fr" ? "Réponse locale" : "Local response"}</span>
          <strong>{language === "fr" ? "Rimouski et environs" : "Rimouski area"}</strong>
          <span>{language === "fr" ? "Courriel" : "Email"}</span>
          <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
        </div>
      </section>

      <section className="account-support-actions-grid" aria-label={language === "fr" ? "Options de support" : "Support options"}>
        <article className="account-support-card account-support-card--primary">
          <div className="account-support-card__head">
            <p className="support-lite-card__eyebrow">{language === "fr" ? "Contact direct" : "Direct contact"}</p>
            <h2 className="account-support-card__title">{language === "fr" ? "Nous écrire" : "Email us"}</h2>
            <p className="small support-lite-card__text">
              {language === "fr"
                ? "Pour une question précise sur une commande, un produit ou une livraison locale."
                : "For a specific question about an order, product, or local delivery."}
            </p>
          </div>

          <div className="account-support-card__meta-row">
            <span>{language === "fr" ? "Commande" : "Order"}</span>
            <span>{language === "fr" ? "Produit" : "Product"}</span>
            <span>{language === "fr" ? "Livraison" : "Delivery"}</span>
          </div>

          <a className="btn account-support-card__cta" href={`mailto:${supportEmail}`}>
            {language === "fr" ? "Envoyer un courriel" : "Send an email"}
          </a>
        </article>

        <article className="account-support-card">
          <div className="account-support-card__head">
            <p className="support-lite-card__eyebrow">{language === "fr" ? "Aide rapide" : "Quick help"}</p>
            <h2 className="account-support-card__title">{language === "fr" ? "Centre d'aide" : "Help center"}</h2>
            <p className="small support-lite-card__text">
              {language === "fr"
                ? "Retours, livraison, paiement et réponses fréquentes sont regroupés au même endroit."
                : "Returns, shipping, payment, and common answers are all grouped in one place."}
            </p>
          </div>

          <Link className="btn btn-secondary account-support-card__cta" href="/faq">
            {language === "fr" ? "Voir le centre d'aide" : "Open help center"}
          </Link>
        </article>
      </section>

      <section className="account-support-guide" aria-labelledby="account-support-guide-title">
        <div className="account-support-guide__head">
          <p className="account-home-hero__eyebrow">{language === "fr" ? "Repères" : "Guidance"}</p>
          <h2 id="account-support-guide-title">{language === "fr" ? "Quand nous écrire ?" : "When should you contact us?"}</h2>
          <p className="small account-section-copy">
            {language === "fr"
              ? "Choisis le bon point de départ selon le moment où tu es dans ton achat."
              : "Choose the right starting point depending on where you are in your purchase."}
          </p>
        </div>

        <div className="account-support-guide__grid">
          <article className="account-support-guide-card">
            <p className="support-lite-card__eyebrow">{language === "fr" ? "Avant" : "Before"}</p>
            <h3 className="support-lite-card__title">{language === "fr" ? "Avant la commande" : "Before ordering"}</h3>
            <p className="small support-lite-card__text">
              {language === "fr"
                ? "Pour confirmer un produit, une livraison locale ou une information pratique."
                : "To confirm a product, local delivery, or any practical information."}
            </p>
          </article>

          <article className="account-support-guide-card">
            <p className="support-lite-card__eyebrow">{language === "fr" ? "Après" : "After"}</p>
            <h3 className="support-lite-card__title">{language === "fr" ? "Après la commande" : "After ordering"}</h3>
            <p className="small support-lite-card__text">
              {language === "fr"
                ? "Pour un suivi, un changement lié à la livraison ou un problème avec ta commande."
                : "For tracking, delivery changes, or a problem with your order."}
            </p>
          </article>
        </div>
      </section>
    </div>
  );
}
