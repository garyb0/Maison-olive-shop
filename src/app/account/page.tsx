import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentLanguage } from "@/lib/language";
import { syncOrderPaymentFromStripeSessionForUser } from "@/lib/orders";
import { prisma } from "@/lib/prisma";

type AccountDashboardPageProps = {
  searchParams?: Promise<{
    paid?: string | string[];
    cancelled?: string | string[];
    session_id?: string | string[];
  }>;
};

const getSearchParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export default async function AccountDashboardPage({ searchParams }: AccountDashboardPageProps) {
  const user = await getCurrentUser();
  const language = await getCurrentLanguage();

  if (!user) {
    return null;
  }

  const query = searchParams ? await searchParams : {};
  const paid = getSearchParam(query.paid) === "1";
  const cancelled = getSearchParam(query.cancelled) === "1";
  const stripeSessionId = getSearchParam(query.session_id);

  let paymentNotice: "paid" | "cancelled" | "syncing" | "sync_failed" | null = null;

  if (paid && stripeSessionId && user) {
    try {
      const result = await syncOrderPaymentFromStripeSessionForUser(stripeSessionId, user.id);
      paymentNotice = result?.transitionedToPaid || result?.reason === "ALREADY_FINALIZED" ? "paid" : "syncing";
    } catch {
      paymentNotice = "sync_failed";
    }
  } else if (cancelled) {
    paymentNotice = "cancelled";
  }

  const ordersCount = await prisma.order.count({
    where: { userId: user.id },
  });

  const activeSubscriptionsCount = await prisma.subscription.count({
    where: { userId: user.id, status: "ACTIVE" },
  });

  return (
    <>
      <section className="section account-home-hero">
        <p className="account-home-hero__eyebrow">
          {language === "fr" ? "Tableau de bord" : "Dashboard"}
        </p>
        <h1>
          {language === "fr" ? "Bonjour" : "Hello"}, {user?.firstName}
        </h1>
        <p className="small" style={{ marginBottom: 0, maxWidth: 620 }}>
          {language === "fr"
            ? "Retrouve ici l’essentiel pour suivre tes commandes, tes abonnements et les informations utiles de ton compte."
            : "Find the essentials here to track your orders, subscriptions, and useful account information."}
        </p>
      </section>

      {paymentNotice ? (
        <div className="card" style={{ padding: 18, marginBottom: 24 }}>
          {paymentNotice === "paid" ? (
            <p style={{ margin: 0, color: "var(--success)" }}>
              {language === "fr"
                ? "Paiement par carte reçu. Ta commande est maintenant confirmée."
                : "Card payment received. Your order is now confirmed."}
            </p>
          ) : null}
          {paymentNotice === "syncing" ? (
            <p style={{ margin: 0 }}>
              {language === "fr"
                ? "Paiement reçu. La confirmation finale peut prendre quelques secondes."
                : "Payment received. Final confirmation may take a few seconds."}
            </p>
          ) : null}
          {paymentNotice === "sync_failed" ? (
            <p style={{ margin: 0 }}>
              {language === "fr"
                ? "Paiement reçu. Si ta commande n'apparaît pas encore payée, elle sera synchronisée automatiquement."
                : "Payment received. If your order is not marked paid yet, it will sync automatically."}
            </p>
          ) : null}
          {paymentNotice === "cancelled" ? (
            <p style={{ margin: 0 }}>
              {language === "fr"
                ? "Paiement annulé. Ta commande n'est pas payée; tu peux refaire le checkout quand tu es prêt."
                : "Payment cancelled. Your order is not paid; you can restart checkout when ready."}
            </p>
          ) : null}
        </div>
      ) : null}

      <section className="account-home-stats" style={{ marginBottom: 32 }}>
        <div className="account-home-stat-card">
          <div className="account-home-stat-label">{language === "fr" ? "Commandes passées" : "Orders placed"}</div>
          <div className="stat-value">{ordersCount}</div>
        </div>
        <div className="account-home-stat-card">
          <div className="account-home-stat-label">{language === "fr" ? "Abonnements actifs" : "Active subscriptions"}</div>
          <div className="stat-value">{activeSubscriptionsCount}</div>
        </div>
      </section>

      <section className="section">
        <h2>{language === "fr" ? "Raccourcis utiles" : "Useful shortcuts"}</h2>
        <p className="small" style={{ marginBottom: 0 }}>
          {language === "fr"
            ? "Les actions les plus fréquentes de ton compte sont regroupées ici."
            : "Your most common account actions are grouped here."}
        </p>
        <div className="account-home-shortcuts">
          <Link className="account-home-shortcut" href="/account/orders">
            <span className="account-home-shortcut__title">{language === "fr" ? "Voir mes commandes" : "View my orders"}</span>
            <p className="small account-home-shortcut__copy">
              {language === "fr" ? "Suivi, détails et facture de tes achats." : "Track, review, and access your order invoices."}
            </p>
          </Link>
          <Link className="account-home-shortcut" href="/account/dogs">
            <span className="account-home-shortcut__title">{language === "fr" ? "Gérer mes chiens" : "Manage my dogs"}</span>
            <p className="small account-home-shortcut__copy">
              {language === "fr" ? "Mettre à jour leurs profils et infos utiles." : "Update their profiles and useful information."}
            </p>
          </Link>
          <Link className="account-home-shortcut" href="/account/subscriptions">
            <span className="account-home-shortcut__title">{language === "fr" ? "Gérer mes abonnements" : "Manage my subscriptions"}</span>
            <p className="small account-home-shortcut__copy">
              {language === "fr" ? "Voir tes envois récurrents et leur statut." : "Review recurring shipments and their status."}
            </p>
          </Link>
          <Link className="account-home-shortcut" href="/account/profile">
            <span className="account-home-shortcut__title">{language === "fr" ? "Modifier mon profil" : "Edit my profile"}</span>
            <p className="small account-home-shortcut__copy">
              {language === "fr" ? "Adresses, sécurité et informations personnelles." : "Addresses, security, and personal details."}
            </p>
          </Link>
        </div>
      </section>
    </>
  );
}

