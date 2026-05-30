import type { Metadata } from "next";
import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import { getCurrentUser } from "@/lib/auth";
import { getBusinessInfo } from "@/lib/business";
import { getDictionary } from "@/lib/i18n";
import { getCurrentLanguage } from "@/lib/language";

export const metadata: Metadata = {
  title: "Suppression des données",
  description: "Instructions pour demander la suppression des données associées à Chez Olive.",
};

export default async function DataDeletionPage() {
  const language = await getCurrentLanguage();
  const t = getDictionary(language);
  const business = getBusinessInfo(language);
  const user = await getCurrentUser();

  const sections =
    language === "fr"
      ? [
          {
            title: "Demander la suppression",
            body: `Pour demander la suppression de vos données Chez Olive, envoyez un courriel à ${business.supportEmail} avec le sujet "Suppression des données". Nous pourrons vérifier votre identité avant de traiter la demande.`,
          },
          {
            title: "Données couvertes",
            body: "La demande peut couvrir votre compte, vos préférences de notifications, vos messages de support et les profils chiens QR. Certaines données de commande peuvent devoir être conservées temporairement pour les obligations légales, fiscales, antifraude ou de service.",
          },
          {
            title: "Délai de traitement",
            body: "Nous confirmons la réception de la demande et traitons les suppressions admissibles dans un délai raisonnable, selon les exigences applicables et l'état du compte.",
          },
        ]
      : [
          {
            title: "Request deletion",
            body: `To request deletion of your Chez Olive data, email ${business.supportEmail} with the subject "Data deletion". We may verify your identity before processing the request.`,
          },
          {
            title: "Covered data",
            body: "The request may cover your account, notification preferences, support messages, and dog QR profiles. Some order data may need to be retained temporarily for legal, tax, fraud-prevention, or service obligations.",
          },
          {
            title: "Processing time",
            body: "We confirm receipt of the request and process eligible deletion requests within a reasonable timeframe, depending on applicable requirements and account status.",
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
          <p className="section-kicker">{language === "fr" ? "Données utilisateur" : "User data"}</p>
          <h1>{language === "fr" ? "Instructions de suppression des données" : "Data deletion instructions"}</h1>
          <p className="small">
            {language === "fr"
              ? "Cette page explique comment demander la suppression des données associées au site Chez Olive, à l'app Android, aux commandes, au support et aux services associés."
              : "This page explains how to request deletion of data associated with the Chez Olive website, Android app, orders, support, and related services."}
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
          <h2>{language === "fr" ? "Contact" : "Contact"}</h2>
          <p className="small">
            {language === "fr" ? "Écris-nous à " : "Contact us at "}
            <a href={`mailto:${business.supportEmail}`}>{business.supportEmail}</a>.
          </p>
          <Link className="pill-link pill-link--sm" href="/privacy">
            {language === "fr" ? "Voir la politique de confidentialité" : "View privacy policy"}
          </Link>
        </section>
      </main>
    </div>
  );
}
