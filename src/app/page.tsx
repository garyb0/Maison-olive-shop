import { getCurrentUser } from "@/lib/auth";
import { getActiveProducts } from "@/lib/catalog";
import { formatCurrency } from "@/lib/format";
import { getCurrentLanguage } from "@/lib/language";
import { getDictionary } from "@/lib/i18n";
import { StorefrontClient } from "@/app/storefront-client";

type CatalogProduct = Awaited<ReturnType<typeof getActiveProducts>>[number];

export default async function HomePage() {
  const [language, user, products] = await Promise.all([
    getCurrentLanguage(),
    getCurrentUser(),
    getActiveProducts(),
  ]);

  const t = getDictionary(language);

  const productCards = products.map((p: CatalogProduct) => ({
    id: p.id,
    slug: p.slug,
    category: p.category?.name ?? "Uncategorized",
    name: language === "fr" ? p.nameFr : p.nameEn,
    description: language === "fr" ? p.descriptionFr : p.descriptionEn,
    priceCents: p.priceCents,
    priceLabel: formatCurrency(p.priceCents, p.currency, language === "fr" ? "fr-CA" : "en-CA"),
    stock: p.stock,
    imageUrl: p.imageUrl ?? null,
  }));

  const oliveMode = (process.env.OLIVE_MODE as "princess" | "gremlin") || "princess";

  return <StorefrontClient language={language} t={t} user={user} products={productCards} oliveMode={oliveMode} />;
}
