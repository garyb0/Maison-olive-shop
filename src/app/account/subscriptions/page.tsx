import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDictionary } from "@/lib/i18n";
import { getCurrentLanguage } from "@/lib/language";
import UserSubscriptionsClient from "./user-subscriptions-client";

export default async function UserSubscriptionsPage() {
  const user = await getCurrentUser();
  if (!user) {
    notFound();
  }

  const language = await getCurrentLanguage();
  const t = getDictionary(language);
  const locale = language === "fr" ? "fr-CA" : "en-CA";

  const subscriptions = await prisma.subscription.findMany({
    where: { userId: user.id },
    include: { product: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="app-shell">
      <nav className="topbar">
        <div className="brand">{t.brandName}</div>
        <div className="nav-links">
          <Link className="pill-link" href="/">
            {t.navHome}
          </Link>
          <Link className="pill-link" href="/account">
            {t.navAccount}
          </Link>
        </div>
      </nav>

      <section className="section" style={{ maxWidth: 800, margin: "0 auto" }}>
        <h1>{language === "fr" ? "Mes abonnements" : "My subscriptions"}</h1>
        
        <p className="small" style={{ marginBottom: 24 }}>
          {language === "fr" 
            ? "Gère tes abonnements récurrents. Tu peux annuler ou reprendre à tout moment." 
            : "Manage your recurring subscriptions. You can cancel or resume at any time."}
        </p>

        <UserSubscriptionsClient 
          subscriptions={subscriptions.map(sub => ({
            id: sub.id,
            status: sub.status,
            product: {
              nameFr: sub.product.nameFr,
              nameEn: sub.product.nameEn,
              imageUrl: sub.product.imageUrl,
            },
            quantity: sub.quantity,
            currentPeriodStart: sub.currentPeriodStart.toISOString(),
            currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
            cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
            nextPaymentDate: sub.nextPaymentDate?.toISOString(),
            lastPaymentDate: sub.lastPaymentDate?.toISOString(),
          }))} 
          language={language} 
        />
      </section>
    </div>
  );
}