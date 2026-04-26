import { getCurrentLanguage } from "@/lib/language";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/auth";
import { AdminSupportPanel } from "@/components/AdminSupportPanel";
import Link from "next/link";

export default async function AdminSupportPage() {
  const [language, user] = await Promise.all([getCurrentLanguage(), getCurrentUser()]);
  const t = getDictionary(language);

  if (!user || user.role !== "ADMIN") {
    return (
      <section className="section">
        <h1>{t.adminTitle}</h1>
        <p className="small">
          {language === "fr" ? "Accès réservé aux administrateurs." : "Admin access only."}
        </p>
        <Link className="btn" href="/">
          {t.navHome}
        </Link>
      </section>
    );
  }

  return (
    <>
      <section className="section">
        <h1>{language === "fr" ? "Support Client" : "Customer Support"}</h1>
        <p className="small">
          {language === "fr"
            ? "Gérez les conversations de support client en temps réel."
            : "Manage real-time customer support conversations."}
        </p>
      </section>

      <AdminSupportPanel language={language} />
    </>
  );
}
