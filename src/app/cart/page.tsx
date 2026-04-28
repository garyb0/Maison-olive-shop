import { getCurrentUser } from "@/lib/auth";
import { getCurrentLanguage } from "@/lib/language";
import { getDictionary } from "@/lib/i18n";
import { getActiveProducts } from "@/lib/catalog";
import { CartClient } from "@/app/cart/cart-client";
import { env } from "@/lib/env";

export default async function CartPage() {
  const [language, user, products] = await Promise.all([
    getCurrentLanguage(),
    getCurrentUser(),
    getActiveProducts(),
  ]);

  const t = getDictionary(language);

  const productIndex = Object.fromEntries(
    products.map((p) => {
      const priceCents = p.priceCents;
      const currency = p.currency ?? "CAD";
      const locale = language === "fr" ? "fr-CA" : "en-CA";
      const priceLabel = new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
      }).format(priceCents / 100);

      const name = language === "fr" ? p.nameFr : p.nameEn;

      return [
        p.id,
        {
          id: p.id,
          name,
          priceCents,
          currency,
          priceLabel,
        },
      ];
    }),
  );

  return (
    <CartClient
      language={language}
      t={t}
      user={user}
      productIndex={productIndex}
      shippingFlatCents={env.shippingFlatCents}
      shippingFreeThresholdCents={env.shippingFreeThresholdCents}
    />
  );
}
