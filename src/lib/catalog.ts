import { prisma } from "@/lib/prisma";

export async function getActiveProducts() {
  return prisma.product.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getProductById(productId: string) {
  return prisma.product.findUnique({ where: { id: productId } });
}
