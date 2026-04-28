import Link from "next/link";
import { getCurrentLanguage } from "@/lib/language";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/auth";
import { Navigation } from "@/components/Navigation";
import { AdminSidebar } from "./admin-sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [language, user] = await Promise.all([getCurrentLanguage(), getCurrentUser()]);
  const t = getDictionary(language);

  if (!user || user.role !== "ADMIN") {
    return (
      <div className="app-shell">
        <header className="topbar">
          <Navigation language={language} t={t} user={user} />
        </header>
        <section className="section">
          <h1>{t.adminTitle}</h1>
          <p className="small">
            {language === "fr" ? "Accès réservé aux administrateurs." : "Admin access only."}
          </p>
          <Link className="btn" href="/">
            {t.navHome}
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <Navigation language={language} t={t} user={user} />
      </header>
      <div className="admin-layout">
        <AdminSidebar language={language} />
        <main className="admin-main">
          {children}
        </main>
      </div>
    </div>
  );
}
