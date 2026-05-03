import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { getCurrentLanguage } from "@/lib/language";
import { Navigation } from "@/components/Navigation";

export const metadata: Metadata = {
  title: "Hors ligne",
  description: "Etat hors ligne de l'application Chez Olive.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function OfflinePage() {
  const [language, user] = await Promise.all([getCurrentLanguage(), getCurrentUser()]);
  const t = getDictionary(language);

  return (
    <div className="app-shell pwa-app-shell">
      <header className="topbar">
        <Navigation language={language} t={t} user={user} />
      </header>

      <main className="pwa-hub pwa-offline-page" aria-labelledby="offline-title">
        <section className="pwa-hero pwa-offline-hero">
          <div>
            <p className="pwa-kicker">{language === "fr" ? "Connexion" : "Connection"}</p>
            <h1 id="offline-title">{language === "fr" ? "Mode hors ligne" : "Offline mode"}</h1>
            <p>
              {language === "fr"
                ? "Chez Olive reste installable comme une app, mais les pages sensibles ne sont pas mises en cache. Reviens ici quand le reseau revient."
                : "Chez Olive stays installable as an app, but sensitive pages are not aggressively cached. Come back here when your network returns."}
            </p>
          </div>
          <div className="pwa-hero-actions">
            <Link className="btn" href="/app">
              {language === "fr" ? "Retour a l'app" : "Back to app"}
            </Link>
            <Link className="btn btn-secondary" href="/faq">
              {language === "fr" ? "Centre d'aide" : "Help center"}
            </Link>
          </div>
        </section>

        <section className="pwa-hub-section">
          <div className="pwa-section-head">
            <div>
              <p className="pwa-kicker">{language === "fr" ? "Securite" : "Safety"}</p>
              <h2>{language === "fr" ? "Ce qui reste volontairement en ligne" : "What intentionally stays online"}</h2>
            </div>
          </div>
          <div className="pwa-hub-grid">
            <div className="pwa-hub-card">
              <span>{language === "fr" ? "Paiement" : "Payment"}</span>
              <strong>{language === "fr" ? "Checkout protege" : "Protected checkout"}</strong>
              <p>
                {language === "fr"
                  ? "Le panier et le checkout attendent le reseau pour eviter une commande incomplete."
                  : "Cart and checkout wait for network so an order cannot be submitted half-way."}
              </p>
            </div>
            <div className="pwa-hub-card">
              <span>{language === "fr" ? "Compte" : "Account"}</span>
              <strong>{language === "fr" ? "Donnees fraiches" : "Fresh data"}</strong>
              <p>
                {language === "fr"
                  ? "Les commandes, profils QR, support et admin se rechargent quand la connexion revient."
                  : "Orders, QR profiles, support, and admin refresh when the connection comes back."}
              </p>
            </div>
            <div className="pwa-hub-card">
              <span>{language === "fr" ? "Terrain" : "Field"}</span>
              <strong>{language === "fr" ? "Livreur prudent" : "Careful driver mode"}</strong>
              <p>
                {language === "fr"
                  ? "Les actions chauffeur utilisent leur propre file hors ligne quand la tournee est deja ouverte."
                  : "Driver actions use their own offline queue when the run is already open."}
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
