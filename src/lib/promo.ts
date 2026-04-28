import { prisma } from "@/lib/prisma";
import { getDisabledPromoCodes, isPromoCodeBlockedForCheckout } from "@/lib/launch-guards";

export const CHAT_PROMO_CODE = "OLIVE10";
export const CHAT_PROMO_DISCOUNT_PERCENT = 10;

export function normalizePromoCode(code?: string | null) {
  return code?.trim().replace(/\s+/g, "").toUpperCase() ?? "";
}

export type PromoCodeResolution = {
  normalizedCode: string;
  isValid: boolean;
  discountCents: number;
  appliedCode: string | null;
  discountPercent: number | null;
  description: string | null;
};

function getLegacyPromoDefinition(code?: string | null) {
  const normalizedCode = normalizePromoCode(code);
  if (normalizedCode !== CHAT_PROMO_CODE) return null;

  return {
    code: CHAT_PROMO_CODE,
    description: "Legacy support promo code",
    discountPercent: CHAT_PROMO_DISCOUNT_PERCENT,
  };
}

export function isSupportedPromoCode(code?: string | null) {
  return normalizePromoCode(code) === CHAT_PROMO_CODE;
}

export function getPromoDiscountCents(subtotalCents: number, promoCode?: string | null) {
  if (!isSupportedPromoCode(promoCode)) return 0;
  return Math.round(subtotalCents * (CHAT_PROMO_DISCOUNT_PERCENT / 100));
}

export async function findPromoCodeByCode(code?: string | null) {
  const normalizedCode = normalizePromoCode(code);
  if (!normalizedCode) return null;
  if (isPromoCodeBlockedForCheckout(normalizedCode)) return null;

  const dbPromoCode = await prisma.promoCode.findFirst({
    where: {
      code: normalizedCode,
      isActive: true,
    },
    select: {
      code: true,
      description: true,
      discountPercent: true,
    },
  });

  return dbPromoCode ?? getLegacyPromoDefinition(normalizedCode);
}

export async function getDefaultShareablePromoCode() {
  const promoCode = await prisma.promoCode.findFirst({
    where: {
      isActive: true,
      code: { notIn: getDisabledPromoCodes() },
    },
    orderBy: [{ createdAt: "asc" }],
    select: {
      code: true,
      description: true,
      discountPercent: true,
    },
  });

  return (
    promoCode ?? {
      code: CHAT_PROMO_CODE,
      description: "Legacy support promo code",
      discountPercent: CHAT_PROMO_DISCOUNT_PERCENT,
    }
  );
}

export async function resolvePromoCodeDiscount(subtotalCents: number, promoCode?: string | null): Promise<PromoCodeResolution> {
  const normalizedCode = normalizePromoCode(promoCode);
  if (!normalizedCode) {
    return {
      normalizedCode: "",
      isValid: false,
      discountCents: 0,
      appliedCode: null,
      discountPercent: null,
      description: null,
    };
  }

  const definition = await findPromoCodeByCode(normalizedCode);
  if (!definition) {
    return {
      normalizedCode,
      isValid: false,
      discountCents: 0,
      appliedCode: null,
      discountPercent: null,
      description: null,
    };
  }

  return {
    normalizedCode,
    isValid: true,
    discountCents: Math.round(subtotalCents * (definition.discountPercent / 100)),
    appliedCode: definition.code,
    discountPercent: definition.discountPercent,
    description: definition.description ?? null,
  };
}
