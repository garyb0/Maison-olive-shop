import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { localizePromoBanner } from "@/lib/promo-banners";
import { getCatalogPreparationBanner } from "@/lib/promo-banner-fallback";
import { getHiddenStorefrontProductSlugs } from "@/lib/launch-guards";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const language = searchParams.get("lang") === "en" ? "en" : "fr";
    const activeCatalogCount = await prisma.product.count({
      where: {
        isActive: true,
        slug: { notIn: getHiddenStorefrontProductSlugs() },
      },
    });

    if (activeCatalogCount === 0) {
      return jsonOk({ banners: [getCatalogPreparationBanner(language)] });
    }

    const rawBanners = await prisma.promoBanner.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        isActive: true,
        sortOrder: true,
        badgeFr: true,
        badgeEn: true,
        titleFr: true,
        titleEn: true,
        price1Fr: true,
        price1En: true,
        price2Fr: true,
        price2En: true,
        point1Fr: true,
        point1En: true,
        point2Fr: true,
        point2En: true,
        point3Fr: true,
        point3En: true,
        ctaTextFr: true,
        ctaTextEn: true,
        ctaLink: true,
      },
    });

    const banners = rawBanners.map((banner) => localizePromoBanner(banner, language));

    return jsonOk({ banners });
  } catch {
    return jsonError("Failed to load promo banners", 500);
  }
}
