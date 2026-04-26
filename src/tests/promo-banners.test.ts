import { describe, expect, it } from "vitest";
import { hasMissingEnglishPromoCopy, localizePromoBanner } from "@/lib/promo-banners";

const baseBanner = {
  id: "banner_1",
  isActive: true,
  sortOrder: 0,
  badgeFr: "Offre limitée",
  badgeEn: "Limited offer",
  titleFr: "Livraison locale",
  titleEn: "Local delivery",
  price1Fr: "1 pour 64,99 $",
  price1En: "1 for $64.99",
  price2Fr: "2 pour 100 $",
  price2En: "2 for $100",
  point1Fr: "Ultra doux",
  point1En: "Ultra soft",
  point2Fr: "Lavable",
  point2En: "Washable",
  point3Fr: "Approuvé par Olive",
  point3En: "Olive approved",
  ctaTextFr: "Magasiner →",
  ctaTextEn: "Shop now →",
  ctaLink: "/",
};

describe("promo banner localization", () => {
  it("uses English copy when it is available", () => {
    const banner = localizePromoBanner(baseBanner, "en");

    expect(banner.title).toBe("Local delivery");
    expect(banner.ctaText).toBe("Shop now →");
  });

  it("falls back to French when English copy is blank", () => {
    const banner = localizePromoBanner(
      {
        ...baseBanner,
        titleEn: "",
        ctaTextEn: "",
      },
      "en",
    );

    expect(banner.title).toBe("Livraison locale");
    expect(banner.ctaText).toBe("Magasiner →");
  });

  it("detects missing English fields", () => {
    expect(
      hasMissingEnglishPromoCopy({
        ...baseBanner,
        point2En: "",
      }),
    ).toBe(true);
  });
});
