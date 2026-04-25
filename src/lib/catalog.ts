import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getHiddenStorefrontProductSlugs, isStorefrontProductHidden } from "@/lib/launch-guards";

export const publicProductSelect = {
  id: true,
  slug: true,
  nameFr: true,
  nameEn: true,
  descriptionFr: true,
  descriptionEn: true,
  imageUrl: true,
  priceCents: true,
  currency: true,
  stock: true,
  isActive: true,
  isSubscription: true,
  priceWeekly: true,
  priceBiweekly: true,
  priceMonthly: true,
  priceQuarterly: true,
  categoryId: true,
  category: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.ProductSelect;

export async function getActiveProducts() {
  return prisma.product.findMany({
    where: {
      isActive: true,
      slug: { notIn: getHiddenStorefrontProductSlugs() },
    },
    select: publicProductSelect,
    orderBy: { createdAt: "desc" },
  });
}

export async function getProductById(productId: string) {
  return prisma.product.findUnique({
    where: { id: productId },
    select: publicProductSelect,
  });
}

export async function getActiveProductBySlug(slug: string) {
  if (isStorefrontProductHidden(slug)) {
    return null;
  }

  return prisma.product.findFirst({
    where: {
      slug,
      isActive: true,
    },
    select: publicProductSelect,
  });
}

export async function getRelatedActiveProducts(categoryId: string, excludeProductId: string, limit = 4) {
  return prisma.product.findMany({
    where: {
      isActive: true,
      slug: { notIn: getHiddenStorefrontProductSlugs() },
      categoryId,
      id: { not: excludeProductId },
    },
    select: publicProductSelect,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
