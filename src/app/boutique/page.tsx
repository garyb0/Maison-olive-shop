import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getActiveProducts } from "@/lib/catalog";
import { formatCurrency } from "@/lib/format";
import { getCurrentLanguage } from "@/lib/language";
import { getDictionary } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { localizePromoBanner } from "@/lib/promo-banners";
import { getCatalogPreparationBanner } from "@/lib/promo-banner-fallback";
import { StorefrontClient } from "@/app/storefront-client";

type CatalogProduct = Awaited<ReturnType<typeof getActiveProducts>>[number];

type BoutiquePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "Boutique",
  description: "Magasiner les produits locaux pour chiens et chats chez Chez Olive.",
  alternates: {
    canonical: "/boutique",
  },
};

function getSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function BoutiquePage({ searchParams }: BoutiquePageProps) {
  const query = searchParams ? await searchParams : {};
  const [language, user, products, rawBanners] = await Promise.all([
    getCurrentLanguage(),
    getCurrentUser(),
    getActiveProducts(),
    prisma.promoBanner.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
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

  const banners = productCards.length === 0
    ? [getCatalogPreparationBanner(language)]
    : rawBanners.map((b) => ({
        ...localizePromoBanner(b, language),
      }));

  return (
    <StorefrontClient
      surface="shop"
      language={language}
      t={t}
      user={user}
      products={productCards}
      banners={banners}
      initialSearch={(getSearchParam(query.q) ?? getSearchParam(query.search) ?? "").trim()}
      initialCategory={(getSearchParam(query.category) ?? "").trim()}
    />
  );
}
