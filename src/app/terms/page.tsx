import type { Metadata } from "next";
import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import { getCurrentUser } from "@/lib/auth";
import { getBusinessInfo } from "@/lib/business";
import { getDictionary } from "@/lib/i18n";
import { getCurrentLanguage } from "@/lib/language";

export const metadata: Metadata = {
  title: "Conditions",
  description: "Conditions d'utilisation et de vente de Chez Olive pour le site web et l'app client Android.",
};

export default async function TermsPage() {
  const language = await getCurrentLanguage();
  const t = getDictionary(language);
  const business = getBusinessInfo(language);
  const user = await getCurrentUser();

  const sections = language === "fr"
    ? [
        {
          title: "Utilisation du service",
          body: "Chez Olive fournit une boutique animalière locale avec livraison à domicile à Rimouski, un espace client, un suivi de commandes, du support et des services associés. Vous devez fournir des informations exactes et protéger l'accès à votre compte.",
        },
        {
          title: "Commandes et disponibilité",
          body: "Les prix, stocks et disponibilités peuvent changer. Une commande peut être refusée ou ajustée si un produit devient indisponible, si une adresse est hors zone ou si une vérification est requise.",
        },
        {
          title: "Livraison à domicile",
          body: "Les frais, fenêtres et zones de livraison à domicile sont confirmés au panier et au passage à la caisse. Les délais peuvent varier selon la météo, le volume et les contraintes opérationnelles.",
        },
        {
          title: "Retours et support",
          body: "Pour un problème de produit, livraison ou commande, contactez le support rapidement. Les solutions peuvent inclure correction, remplacement, crédit ou remboursement selon le contexte.",
        },
        {
          title: "App Android",
          body: "L'app Chez Olive utilise les mêmes comptes et services que le site. Les notifications natives sont optionnelles et peuvent être désactivées dans l'app ou les réglages Android.",
        },
      ]
    : [
        {
          title: "Using the service",
          body: "Chez Olive provides a local pet boutique with home delivery in Rimouski, a customer area, order tracking, support, and related services. You must provide accurate information and protect access to your account.",
        },
        {
          title: "Orders and availability",
          body: "Prices, stock, and availability may change. An order may be refused or adjusted if a product becomes unavailable, an address is outside the delivery area, or verification is required.",
        },
        {
          title: "Home delivery",
          body: "Home delivery fees, windows, and delivery areas are confirmed in cart and checkout. Timing may vary with weather, volume, and operational constraints.",
        },
        {
          title: "Returns and support",
          body: "For a product, delivery, or order issue, contact support promptly. Solutions may include correction, replacement, credit, or refund depending on the context.",
        },
        {
          title: "Android app",
          body: "The Chez Olive app uses the same accounts and services as the website. Native notifications are optional and can be disabled in the app or Android settings.",
        },
      ];

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">{t.brandName}</div>
        <Navigation language={language} t={t} user={user} />
      </header>

      <main className="section legal-page">
        <div className="legal-page__hero">
          <p className="section-kicker">{language === "fr" ? "Conditions" : "Terms"}</p>
          <h1>{language === "fr" ? "Conditions d'utilisation et de vente" : "Terms of use and sale"}</h1>
          <p className="small">
            {language === "fr"
              ? "Ces conditions encadrent l'utilisation de Chez Olive, du site, de l'app client Android, des commandes, du support et des services connexes."
              : "These terms govern the use of Chez Olive, the website, Android customer app, orders, support, and related services."}
          </p>
          <p className="small">
            {language === "fr" ? "Dernière mise à jour: 4 mai 2026." : "Last updated: May 4, 2026."}
          </p>
        </div>

        <div className="legal-page__grid">
          {sections.map((section) => (
            <article className="legal-page__card" key={section.title}>
              <h2>{section.title}</h2>
              <p className="small">{section.body}</p>
            </article>
          ))}
        </div>

        <section className="legal-page__contact">
          <h2>{language === "fr" ? "Questions" : "Questions"}</h2>
          <p className="small">
            {language === "fr"
              ? "Pour une question sur une commande ou ces conditions, écris-nous à "
              : "For a question about an order or these terms, contact us at "}
            <a href={`mailto:${business.supportEmail}`}>{business.supportEmail}</a>.
          </p>
          <Link className="pill-link pill-link--sm" href="/privacy">
            {language === "fr" ? "Voir la confidentialité" : "View privacy"}
          </Link>
        </section>
      </main>
    </div>
  );
}
