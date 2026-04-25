import Link from "next/link";
import { getCurrentLanguage } from "@/lib/language";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/auth";
import { Navigation } from "@/components/Navigation";
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
      <div className="app-shell">
        <header className="topbar">
          <div className="brand">{t.brandName}</div>
          <Navigation language={language} t={t} user={user} />
        </header>
        <section className="section">
          <h1>{language === "fr" ? "Mon compte" : "My account"}</h1>
          <p className="small">
            {language === "fr" ? "Tu dois être connecté pour accéder à cette section." : "You must be logged in to access this section."}
          </p>
          <Link className="btn" href="/">
            {language === "fr" ? "Retour à l'accueil" : "Back to home"}
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">{t.brandName}</div>
        <Navigation language={language} t={t} user={user} />
      </header>
      <div className="admin-layout">
        <AccountSidebar language={language} />
        <main className="admin-main">
          {children}
        </main>
      </div>
    </div>
  );
}