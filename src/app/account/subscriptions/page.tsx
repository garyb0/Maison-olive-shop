import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDictionary } from "@/lib/i18n";
import { getCurrentLanguage } from "@/lib/language";
import { Navigation } from "@/components/Navigation";
import UserSubscriptionsClient from "./user-subscriptions-client";

export default async function UserSubscriptionsPage() {
  const user = await getCurrentUser();
  if (!user) {
    notFound();
  }

  const language = await getCurrentLanguage();
  const t = getDictionary(language);

  const subscriptions = await prisma.subscription.findMany({
    where: { userId: user.id },
    include: { product: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">{t.brandName}</div>
        <Navigation language={language} t={t} user={user} />
      </header>

      <section className="section account-home-hero" style={{ maxWidth: 920, margin: "0 auto 1.2rem" }}>
        <p className="account-home-hero__eyebrow">
          {language === "fr" ? "Abonnements" : "Subscriptions"}
        </p>
        <h1>{language === "fr" ? "Mes abonnements" : "My subscriptions"}</h1>
        <p className="small" style={{ marginBottom: 0, maxWidth: 620 }}>
          {language === "fr"
            ? "Gère tes abonnements récurrents. Tu peux les ajuster ou les annuler au bon moment."
            : "Manage your recurring subscriptions. You can adjust or cancel them when needed."}
        </p>
      </section>

      <section className="section" style={{ maxWidth: 920, margin: "0 auto" }}>
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

      {false ? (<section className="section" style={{ maxWidth: 800, margin: "0 auto" }}>
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
      </section>) : null}
    </div>
  );
}
