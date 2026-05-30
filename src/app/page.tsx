import { getCurrentUser } from "@/lib/auth";
import { getActiveProducts } from "@/lib/catalog";
import { formatCurrency } from "@/lib/format";
import { getCurrentLanguage } from "@/lib/language";
import { getDictionary } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { localizePromoBanner } from "@/lib/promo-banners";
import { getCatalogPreparationBanner } from "@/lib/promo-banner-fallback";
import { StorefrontClient } from "@/app/storefront-client";
import { redirect } from "next/navigation";
import { hasAvailableSubscription } from "@/lib/subscription-availability";
import { getProductSubcategoryLabel } from "@/lib/product-subcategories";
import { sumActiveVariantStock } from "@/lib/product-variants";
import { isGoogleOAuthConfigured } from "@/lib/google-oauth";
import { getFavoriteProductIdsForUser } from "@/lib/favorites";

type CatalogProduct = Awaited<ReturnType<typeof getActiveProducts>>[number];

type HomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const query = searchParams ? await searchParams : {};
  const initialSearch = (getSearchParam(query.q) ?? getSearchParam(query.search) ?? "").trim();
  const wantsHome = getSearchParam(query.home) === "1";

  if (initialSearch) {
    const params = new URLSearchParams({ q: initialSearch });
    redirect(`/boutique?${params.toString()}`);
  }

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

  if (user && !wantsHome) {
    redirect("/boutique");
  }

  const favoriteProductIds = user ? await getFavoriteProductIdsForUser(user.id) : [];

  const productCards = products.map((p: CatalogProduct) => {
    const variantStock = sumActiveVariantStock(p.variants);
    const firstVariantImage = p.variants.find((variant) => variant.imageUrl)?.imageUrl ?? null;

    return {
      id: p.id,
      slug: p.slug,
      category: p.category?.name ?? "Uncategorized",
      subcategorySlug: p.subcategory?.slug ?? null,
      subcategoryLabel: getProductSubcategoryLabel(p.subcategory, language),
      name: language === "fr" ? p.nameFr : p.nameEn,
      description: language === "fr" ? p.descriptionFr : p.descriptionEn,
      priceCents: p.priceCents,
      priceLabel: formatCurrency(p.priceCents, p.currency, language === "fr" ? "fr-CA" : "en-CA"),
      stock: p.variants.length > 0 ? variantStock : p.stock,
      imageUrl: firstVariantImage ?? p.imageUrl ?? null,
      subscriptionAvailable: hasAvailableSubscription(p),
      variants: p.variants,
    };
  });

  const banners = productCards.length === 0
    ? [getCatalogPreparationBanner(language)]
    : rawBanners.map((b) => ({
        ...localizePromoBanner(b, language),
      }));

  const oliveMode = (process.env.OLIVE_MODE as "princess" | "gremlin") || "princess";
  const initialRegisterEmail = getSearchParam(query.registerEmail)?.trim() ?? "";

  return (
    <StorefrontClient
      language={language}
      t={t}
      user={user}
      products={productCards}
      oliveMode={oliveMode}
      banners={banners}
      initialRegisterEmail={initialRegisterEmail}
      googleOAuthEnabled={isGoogleOAuthConfigured()}
      initialFavoriteProductIds={favoriteProductIds}
    />
  );
}
