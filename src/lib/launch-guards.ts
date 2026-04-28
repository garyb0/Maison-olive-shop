const HIDDEN_STOREFRONT_PRODUCT_SLUGS = [
  "test",
  "testttt",
  "ptest",
] as const;
const DISABLED_PROMO_CODES = ["TST90"] as const;

export function getHiddenStorefrontProductSlugs() {
  return [...HIDDEN_STOREFRONT_PRODUCT_SLUGS];
}

export function isStorefrontProductHidden(slug?: string | null) {
  const normalizedSlug = slug?.trim().toLowerCase();
  if (!normalizedSlug) return false;
  return HIDDEN_STOREFRONT_PRODUCT_SLUGS.includes(normalizedSlug as (typeof HIDDEN_STOREFRONT_PRODUCT_SLUGS)[number]);
}

export function getDisabledPromoCodes() {
  return [...DISABLED_PROMO_CODES];
}

export function isPromoCodeBlockedForCheckout(code?: string | null) {
  const normalizedCode = code?.trim().replace(/\s+/g, "").toUpperCase();
  if (!normalizedCode) return false;
  return DISABLED_PROMO_CODES.includes(normalizedCode as (typeof DISABLED_PROMO_CODES)[number]);
}
