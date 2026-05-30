import type { Language } from "@/lib/i18n";

export type PublicProductVariant = {
  id: string;
  slug: string;
  sku?: string | null;
  barcode?: string | null;
  colorNameFr?: string | null;
  colorNameEn?: string | null;
  colorHex?: string | null;
  sizeNameFr?: string | null;
  sizeNameEn?: string | null;
  sizeCode?: string | null;
  sizeSortOrder?: number | null;
  imageUrl?: string | null;
  stock: number;
  priceCents?: number | null;
  costCents?: number | null;
  isActive?: boolean;
  sortOrder?: number;
};

export type VariantSizeOption = {
  key: string;
  label: string;
  code: string | null;
  sortOrder: number | null;
};

export function getVariantColorLabel(variant: PublicProductVariant, language: Language) {
  return language === "fr"
    ? variant.colorNameFr ?? variant.colorNameEn ?? variant.slug
    : variant.colorNameEn ?? variant.colorNameFr ?? variant.slug;
}

export function getVariantSizeLabel(variant: PublicProductVariant, language: Language) {
  return language === "fr"
    ? variant.sizeNameFr ?? variant.sizeNameEn ?? variant.sizeCode ?? null
    : variant.sizeNameEn ?? variant.sizeNameFr ?? variant.sizeCode ?? null;
}

export function getVariantOptionLabel(variant: PublicProductVariant, language: Language) {
  const color = getVariantColorLabel(variant, language);
  const size = getVariantSizeLabel(variant, language);
  return size ? `${color} / ${size}` : color;
}

export function getVariantDisplayName(productName: string, variant: PublicProductVariant, language: Language) {
  return `${productName} - ${getVariantOptionLabel(variant, language)}`;
}

export function sumActiveVariantStock(variants: PublicProductVariant[] | undefined | null) {
  return (variants ?? [])
    .filter((variant) => variant.isActive !== false)
    .reduce((sum, variant) => sum + Math.max(0, variant.stock), 0);
}

export function getSellableVariantCount(variants: PublicProductVariant[] | undefined | null) {
  return (variants ?? []).filter((variant) => variant.isActive !== false).length;
}

export function getVariantSizeKey(variant: PublicProductVariant) {
  return variant.sizeCode ?? variant.sizeNameFr ?? variant.sizeNameEn ?? null;
}

export function getVariantColorKey(variant: PublicProductVariant) {
  return variant.colorNameFr ?? variant.colorNameEn ?? variant.slug;
}

export function getVariantSizeOptions(variants: PublicProductVariant[] | undefined | null, language: Language) {
  const seen = new Map<string, VariantSizeOption>();

  for (const variant of variants ?? []) {
    if (variant.isActive === false) continue;
    const key = getVariantSizeKey(variant);
    if (!key || seen.has(key)) continue;

    seen.set(key, {
      key,
      label: getVariantSizeLabel(variant, language) ?? key,
      code: variant.sizeCode ?? null,
      sortOrder: variant.sizeSortOrder ?? null,
    });
  }

  return Array.from(seen.values()).sort((left, right) => {
    const leftOrder = left.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.sortOrder ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return left.label.localeCompare(right.label);
  });
}

export function getVariantsForSize(variants: PublicProductVariant[] | undefined | null, sizeKey: string | null) {
  const activeVariants = (variants ?? []).filter((variant) => variant.isActive !== false);
  if (!sizeKey) return activeVariants;
  return activeVariants.filter((variant) => getVariantSizeKey(variant) === sizeKey);
}

export function findVariantForOptions(
  variants: PublicProductVariant[] | undefined | null,
  options: { sizeKey?: string | null; colorKey?: string | null },
) {
  const scopedVariants = getVariantsForSize(variants, options.sizeKey ?? null);
  if (!options.colorKey) {
    return scopedVariants.find((variant) => variant.stock > 0) ?? scopedVariants[0] ?? null;
  }

  return scopedVariants.find((variant) => getVariantColorKey(variant) === options.colorKey) ?? null;
}
