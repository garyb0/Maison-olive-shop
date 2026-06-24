import Link from "next/link";
import { getCurrentLanguage } from "@/lib/language";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/auth";
import { Navigation } from "@/components/Navigation";
import { MobileAppChrome } from "@/components/MobileAppChrome";
import { AccountSidebar } from "./account-sidebar";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [language, user] = await Promise.all([getCurrentLanguage(), getCurrentUser()]);
  const t = getDictionary(language);

  if (!user) {
    return (
      <div className="app-shell account-app-shell">
        <MobileAppChrome language={language} userRole={null} className="account-mobile-chrome" />
        <header className="topbar account-desktop-topbar">
          <Navigation language={language} t={t} user={user} />
        </header>
        <section className="section account-access-card">
          <p className="account-home-hero__eyebrow">{language === "fr" ? "Espace client" : "Customer area"}</p>
          <h1>{language === "fr" ? "Connecte-toi à ton compte" : "Sign in to your account"}</h1>
          <p className="small">
            {language === "fr"
              ? "Tu dois être connecté pour accéder à tes commandes et tes préférences."
              : "You must be signed in to access your orders and preferences."}
          </p>
          <div className="account-access-actions">
            <Link className="btn" href="/login">
              {language === "fr" ? "Se connecter" : "Sign in"}
            </Link>
            <Link className="btn btn-secondary" href="/">
              {language === "fr" ? "Retour à l'accueil" : "Back to home"}
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="app-shell account-app-shell">
      <MobileAppChrome language={language} userRole={user.role} className="account-mobile-chrome" />
      <header className="topbar account-desktop-topbar">
        <Navigation language={language} t={t} user={user} />
      </header>
      <div className="admin-layout account-layout-shell">
        <AccountSidebar language={language} />
        <main className="admin-main account-main">
          {children}
        </main>
      </div>
    </div>
  );
}
