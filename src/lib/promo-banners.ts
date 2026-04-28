import type { Language } from "@/lib/i18n";
import { sanitizePromoCtaLink } from "@/lib/promo-links";

export type PromoBannerBilingualFields = {
  badgeFr: string;
  badgeEn: string;
  titleFr: string;
  titleEn: string;
  price1Fr: string;
  price1En: string;
  price2Fr: string;
  price2En: string;
  point1Fr: string;
  point1En: string;
  point2Fr: string;
  point2En: string;
  point3Fr: string;
  point3En: string;
  ctaTextFr: string;
  ctaTextEn: string;
};

export type PromoBannerCore = {
  id: string;
  isActive: boolean;
  sortOrder: number;
  ctaLink: string;
};

export type PromoBannerRecord = PromoBannerCore & PromoBannerBilingualFields;

export type PromoBannerLocalized = PromoBannerCore & {
  badge: string;
  title: string;
  price1: string;
  price2: string;
  point1: string;
  point2: string;
  point3: string;
  ctaText: string;
};

const localizedValue = (fr: string, en: string, language: Language) => {
  if (language === "en" && en.trim()) {
    return en;
  }

  return fr;
};

export const localizePromoBanner = (
  banner: PromoBannerRecord,
  language: Language,
): PromoBannerLocalized => ({
  id: banner.id,
  isActive: banner.isActive,
  sortOrder: banner.sortOrder,
  badge: localizedValue(banner.badgeFr, banner.badgeEn, language),
  title: localizedValue(banner.titleFr, banner.titleEn, language),
  price1: localizedValue(banner.price1Fr, banner.price1En, language),
  price2: localizedValue(banner.price2Fr, banner.price2En, language),
  point1: localizedValue(banner.point1Fr, banner.point1En, language),
  point2: localizedValue(banner.point2Fr, banner.point2En, language),
  point3: localizedValue(banner.point3Fr, banner.point3En, language),
  ctaText: localizedValue(banner.ctaTextFr, banner.ctaTextEn, language),
  ctaLink: sanitizePromoCtaLink(banner.ctaLink),
});

export const hasMissingEnglishPromoCopy = (banner: PromoBannerBilingualFields) =>
  [
    banner.badgeEn,
    banner.titleEn,
    banner.price1En,
    banner.price2En,
    banner.point1En,
    banner.point2En,
    banner.point3En,
    banner.ctaTextEn,
  ].some((value) => !value.trim());
