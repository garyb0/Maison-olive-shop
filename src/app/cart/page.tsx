import { getCurrentUser } from "@/lib/auth";
import { getCurrentLanguage } from "@/lib/language";
import { getDictionary } from "@/lib/i18n";
import { getActiveProducts } from "@/lib/catalog";
import { CartClient } from "@/app/cart/cart-client";
import { env } from "@/lib/env";
import { getVariantDisplayName, sumActiveVariantStock } from "@/lib/product-variants";

export default async function CartPage() {
  const [language, user, products] = await Promise.all([
    getCurrentLanguage(),
    getCurrentUser(),
    getActiveProducts(),
  ]);

  const t = getDictionary(language);

  const productEntries = products.flatMap((p) => {
      const currency = p.currency ?? "CAD";
      const locale = language === "fr" ? "fr-CA" : "en-CA";
      const name = language === "fr" ? p.nameFr : p.nameEn;
      const formatPrice = (priceCents: number) =>
        new Intl.NumberFormat(locale, {
          style: "currency",
          currency,
        }).format(priceCents / 100);
      const baseEntry = [
        p.id,
        {
          id: p.id,
          productId: p.id,
          name,
          priceCents: p.priceCents,
          currency,
          priceLabel: formatPrice(p.priceCents),
          stock: p.variants.length > 0 ? sumActiveVariantStock(p.variants) : p.stock,
          requiresVariantSelection: p.variants.length > 0,
        },
      ] as const;
      const variantEntries = p.variants.map((variant) => {
        const priceCents = variant.priceCents ?? p.priceCents;
        return [
          `${p.id}:${variant.id}`,
          {
            id: `${p.id}:${variant.id}`,
            productId: p.id,
            variantId: variant.id,
            name: getVariantDisplayName(name, variant, language),
            priceCents,
            currency,
            priceLabel: formatPrice(priceCents),
            stock: variant.stock,
          },
        ] as const;
      });

      return [baseEntry, ...variantEntries];
    });
  const productIndex = Object.fromEntries(productEntries);

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
