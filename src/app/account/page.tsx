import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/format";
import { getCurrentLanguage } from "@/lib/language";
import { getDictionary } from "@/lib/i18n";
import { getOrdersForUser, syncOrderPaymentFromStripeSessionForUser } from "@/lib/orders";
import { AccountClient } from "@/app/account/account-client";
import type { OrderStatus, PaymentStatus } from "@/lib/types";
import { Navigation } from "@/components/Navigation";
import { PromoBanner } from "@/components/PromoBanner";

type PresentationOrder = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  createdAtLabel: string;
  totalLabel: string;
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
  }>;
};

type OrderWithItems = Awaited<ReturnType<typeof getOrdersForUser>>[number];

type SearchParams = Record<string, string | string[] | undefined>;

type AccountPageProps = {
  searchParams?: SearchParams | Promise<SearchParams>;
};

const toSingleParam = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : undefined;

const resolveSearchParams = async (
  searchParams?: SearchParams | Promise<SearchParams>,
): Promise<SearchParams> => {
  if (!searchParams) return {};
  if (typeof (searchParams as Promise<SearchParams>).then === "function") {
    return searchParams as Promise<SearchParams>;
  }
  return searchParams;
};

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const [language, user, params] = await Promise.all([
    getCurrentLanguage(),
    getCurrentUser(),
    resolveSearchParams(searchParams),
  ]);
  const t = getDictionary(language);

  if (!user) {
    return (
      <div className="app-shell">
      <header className="topbar">
          <div className="brand">{t.brandName}</div>
          <Navigation language={language} t={t} user={null} />
        </header>
        <PromoBanner />
        <section className="section">
          <h1>{t.accountTitle}</h1>
          <p className="small">{language === "fr" ? "Connecte-toi pour accéder à ton compte." : "Please login to access your account."}</p>
          <Link className="btn" href="/">
            {t.navHome}
          </Link>
        </section>
      </div>
    );
  }

  const paid = toSingleParam(params.paid) === "1";
  const sessionId = toSingleParam(params.session_id);

  if (paid && sessionId) {
    try {
      await syncOrderPaymentFromStripeSessionForUser(sessionId, user.id);
    } catch {
      // Keep account page available even if Stripe sync fallback fails.
    }
  }

  const orders = await getOrdersForUser(user.id);

  const presentationOrders: PresentationOrder[] = orders.map((order: OrderWithItems) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    createdAtLabel: formatDate(order.createdAt, language === "fr" ? "fr-CA" : "en-CA"),
    totalLabel: formatCurrency(order.totalCents, order.currency, language === "fr" ? "fr-CA" : "en-CA"),
    items: order.items.map((item: OrderWithItems["items"][number]) => ({
      productId: item.productId,
      name: language === "fr" ? item.productNameSnapshotFr : item.productNameSnapshotEn,
      quantity: item.quantity,
    })),
  }));

  return (
    <AccountClient
      language={language}
      t={t}
      user={{ firstName: user.firstName, email: user.email, role: user.role }}
      orders={presentationOrders}
    />
  );
}
