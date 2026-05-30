import type { Metadata } from "next";
import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import { getCurrentUser } from "@/lib/auth";
import { getBusinessInfo } from "@/lib/business";
import { getDictionary } from "@/lib/i18n";
import { getCurrentLanguage } from "@/lib/language";

export const metadata: Metadata = {
  title: "Confidentialité",
  description: "Politique de confidentialité de Chez Olive pour le site web, l'app client et les services associés.",
};

export default async function PrivacyPage() {
  const language = await getCurrentLanguage();
  const t = getDictionary(language);
  const business = getBusinessInfo(language);
  const user = await getCurrentUser();

  const sections = language === "fr"
    ? [
        {
          title: "Données que nous collectons",
          body: "Nous collectons les informations nécessaires pour exploiter la boutique: compte, commandes, adresse de livraison, messages de support, profils de chiens QR, préférences de notifications et informations techniques de sécurité.",
        },
        {
          title: "Paiements",
          body: "Les paiements en ligne sont traités par Stripe. Chez Olive ne stocke pas les numéros complets de carte bancaire. Les données de paiement sont traitées selon les contrôles de sécurité de Stripe.",
        },
        {
          title: "Notifications",
          body: "Les notifications web et Android sont optionnelles. Si elles sont activées, nous enregistrons un abonnement ou un token d'appareil afin d'envoyer les suivis de commande, livraison, support et compte.",
        },
        {
          title: "Utilisation et conservation",
          body: "Les données servent à fournir le service, sécuriser les comptes, livrer les commandes, répondre au support et améliorer l'expérience. Nous les conservons seulement aussi longtemps que requis pour les opérations, la loi et la prévention de fraude.",
        },
        {
          title: "Vos choix",
          body: "Vous pouvez mettre à jour votre profil, désactiver les notifications, demander de l'aide ou communiquer avec nous pour une demande d'accès, correction ou suppression lorsque la loi le permet.",
        },
      ]
    : [
        {
          title: "Data we collect",
          body: "We collect the information needed to run the shop: account details, orders, delivery address, support messages, dog QR profiles, notification preferences, and security-related technical information.",
        },
        {
          title: "Payments",
          body: "Online payments are processed by Stripe. Chez Olive does not store full card numbers. Payment data is handled under Stripe security controls.",
        },
        {
          title: "Notifications",
          body: "Web and Android notifications are optional. If enabled, we store a subscription or device token to send order, delivery, support, and account updates.",
        },
        {
          title: "Use and retention",
          body: "Data is used to provide the service, secure accounts, deliver orders, answer support, and improve the experience. We keep it only as long as required for operations, law, and fraud prevention.",
        },
        {
          title: "Your choices",
          body: "You can update your profile, disable notifications, request support, or contact us for access, correction, or deletion where allowed by law.",
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
          <p className="section-kicker">{language === "fr" ? "Vie privée" : "Privacy"}</p>
          <h1>{language === "fr" ? "Politique de confidentialité" : "Privacy policy"}</h1>
          <p className="small">
            {language === "fr"
              ? "Cette page couvre le site Chez Olive, l'app client Android, les commandes, le support, les notifications et les profils chiens QR."
              : "This page covers the Chez Olive website, Android customer app, orders, support, notifications, and dog QR profiles."}
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
          <h2>{language === "fr" ? "Nous joindre" : "Contact"}</h2>
          <p className="small">
            {language === "fr"
              ? "Pour une question de confidentialité, écris-nous à "
              : "For a privacy question, contact us at "}
            <a href={`mailto:${business.supportEmail}`}>{business.supportEmail}</a>.
          </p>
          <Link className="pill-link pill-link--sm" href="/terms">
            {language === "fr" ? "Voir les conditions" : "View terms"}
          </Link>
        </section>
      </main>
    </div>
  );
}
