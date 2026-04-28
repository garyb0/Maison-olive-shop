import type { Metadata } from "next";
import { Navigation } from "@/components/Navigation";
import { PromoBanner } from "@/components/PromoBanner";
import { getCurrentUser } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { getCurrentLanguage } from "@/lib/language";
import { getCheckoutConfirmation } from "@/lib/checkout-confirmation";
import { CheckoutSuccessView } from "@/components/CheckoutSuccessView";

type CheckoutSuccessPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export const metadata: Metadata = {
  title: "Confirmation de commande | Chez Olive",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function CheckoutSuccessPage({ searchParams }: CheckoutSuccessPageProps) {
  const query = searchParams ? await searchParams : {};
  const [language, user] = await Promise.all([getCurrentLanguage(), getCurrentUser()]);
  const t = getDictionary(language);

  const orderNumber = getSearchParam(query.order)?.trim() ?? "";
  const registerEmail = getSearchParam(query.email)?.trim() ?? "";
  const paymentMode = getSearchParam(query.mode)?.trim() === "manual" ? "manual" : "stripe";
  const confirmation = await getCheckoutConfirmation(orderNumber, registerEmail);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">{t.brandName}</div>
        <Navigation language={language} t={t} user={user} />
      </header>

      <PromoBanner language={language} />

      <CheckoutSuccessView
        language={language}
        user={user}
        confirmation={confirmation}
        fallbackOrderNumber={orderNumber}
        fallbackRegisterEmail={registerEmail}
        fallbackPaymentMode={paymentMode}
      />
    </div>
  );
}
