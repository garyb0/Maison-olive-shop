import { prisma } from "@/lib/prisma";

export async function getActiveProducts() {
  return prisma.product.findMany({
    where: { isActive: true },
    include: { category: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getProductById(productId: string) {
  return prisma.product.findUnique({
    where: { id: productId },
    include: { category: true },
  });
}

export async function getActiveProductBySlug(slug: string) {
  return prisma.product.findFirst({
    where: {
      slug,
      isActive: true,
    },
    include: { category: true },
  });
}

export async function getRelatedActiveProducts(categoryId: string, excludeProductId: string, limit = 4) {
  return prisma.product.findMany({
    where: {
      isActive: true,
      categoryId,
      id: { not: excludeProductId },
    },
    include: { category: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
