export const CHAT_PROMO_CODE = "OLIVE10";
export const CHAT_PROMO_DISCOUNT_PERCENT = 10;

export function normalizePromoCode(code?: string | null) {
  return code?.trim().toUpperCase() ?? "";
}

export function isSupportedPromoCode(code?: string | null) {
  return normalizePromoCode(code) === CHAT_PROMO_CODE;
}

export function getPromoDiscountCents(subtotalCents: number, promoCode?: string | null) {
  if (!isSupportedPromoCode(promoCode)) return 0;
  return Math.round(subtotalCents * (CHAT_PROMO_DISCOUNT_PERCENT / 100));
}