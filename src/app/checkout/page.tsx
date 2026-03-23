import { getCurrentLanguage } from "@/lib/language";
import { getDictionary } from "@/lib/i18n";
import { getCurrentUser } from "@/lib/auth";
import { getActiveProducts } from "@/lib/catalog";
import { formatCurrency } from "@/lib/format";
import { CheckoutClient } from "@/app/checkout/checkout-client";

type CatalogProduct = Awaited<ReturnType<typeof getActiveProducts>>[number];

export default async function CheckoutPage() {
  const [language, user, products] = await Promise.all([
    getCurrentLanguage(),
    getCurrentUser(),
    getActiveProducts(),
  ]);
  const t = getDictionary(language);

  const productIndex = Object.fromEntries(
    products.map((product: CatalogProduct) => [
      product.id,
      {
        id: product.id,
        name: language === "fr" ? product.nameFr : product.nameEn,
        priceCents: product.priceCents,
        currency: product.currency,
        priceLabel: formatCurrency(product.priceCents, product.currency, language === "fr" ? "fr-CA" : "en-CA"),
      },
    ]),
  );

  return <CheckoutClient language={language} t={t} user={user} productIndex={productIndex} />;
}
