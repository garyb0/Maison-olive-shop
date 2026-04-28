import { prisma } from "@/lib/prisma";
import { getCurrentLanguage } from "@/lib/language";
import { env } from "@/lib/env";
import { getDisabledPromoCodes } from "@/lib/launch-guards";
import { AdminPromoClient } from "./admin-promo-client-entry";
import { AdminPromoCodesClient } from "./admin-promo-codes-client";

export default async function AdminPromoPage() {
  const language = await getCurrentLanguage();
  const disabledPromoCodes = new Set<string>(getDisabledPromoCodes());

  const rawBanners = await prisma.promoBanner.findMany({
    orderBy: { sortOrder: "asc" },
  });
  const rawPromoCodes = await prisma.promoCode.findMany({
    orderBy: [{ isActive: "desc" }, { code: "asc" }],
  });

  const banners = rawBanners.map((b) => ({
    ...b,
    createdAt: b.createdAt.toISOString(),
  }));
  const promoCodes = rawPromoCodes.map((promoCode) => ({
    ...promoCode,
    createdAt: promoCode.createdAt.toISOString(),
    isLaunchBlocked: disabledPromoCodes.has(promoCode.code),
  }));

  return (
    <>
      <section className="section">
        <h1>{language === "fr" ? "Promotions" : "Promotions"}</h1>
        <p className="small">
          {language === "fr"
            ? "Gère les promotions du site, incluant les bannières storefront et les codes promo du checkout."
            : "Manage site promotions, including storefront banners and checkout promo codes."}
        </p>
      </section>
      <AdminPromoClient
        language={language}
        banners={banners}
        freeShippingThresholdLabel={new Intl.NumberFormat(language === "fr" ? "fr-CA" : "en-CA", {
          style: "currency",
          currency: "CAD",
        }).format(env.shippingFreeThresholdCents / 100)}
      />
      <AdminPromoCodesClient language={language} promoCodes={promoCodes} />
    </>
  );
}

