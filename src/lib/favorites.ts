import { prisma } from "@/lib/prisma";
import crypto from "crypto";

type FavoriteProductRow = {
  id: string;
  slug: string;
  nameFr: string;
  nameEn: string;
  imageUrl: string | null;
  priceCents: number;
  currency: string;
  stock: number;
  isActive: boolean | number;
};

function isMissingFavoriteTableError(error: unknown) {
  return error instanceof Error && error.message.toLowerCase().includes("productfavorite");
}

export async function getFavoriteProductIdsForUser(userId: string) {
  try {
    const favorites = await prisma.$queryRaw<Array<{ productId: string }>>`
      SELECT "productId"
      FROM "ProductFavorite"
      WHERE "userId" = ${userId}
    `;
    return favorites.map((favorite) => favorite.productId);
  } catch (error) {
    if (isMissingFavoriteTableError(error)) return [];
    throw error;
  }
}

export async function getFavoriteProductsForUser(userId: string) {
  let rows: FavoriteProductRow[] = [];
  try {
    rows = await prisma.$queryRaw<FavoriteProductRow[]>`
      SELECT
        p."id",
        p."slug",
        p."nameFr",
        p."nameEn",
        p."imageUrl",
        p."priceCents",
        p."currency",
        p."stock",
        p."isActive"
      FROM "ProductFavorite" pf
      INNER JOIN "Product" p ON p."id" = pf."productId"
      WHERE pf."userId" = ${userId}
      ORDER BY pf."createdAt" DESC
    `;
  } catch (error) {
    if (isMissingFavoriteTableError(error)) return [];
    throw error;
  }

  return rows.map((product) => ({
    product: {
      ...product,
      isActive: Boolean(product.isActive),
    },
  }));
}

export async function addProductFavoriteForUser(userId: string, productId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, isActive: true },
    select: { id: true },
  });

  if (!product) throw new Error("PRODUCT_NOT_FOUND");

  await prisma.$executeRaw`
    INSERT OR IGNORE INTO "ProductFavorite" ("id", "userId", "productId", "createdAt")
    VALUES (${`fav_${crypto.randomUUID()}`}, ${userId}, ${productId}, CURRENT_TIMESTAMP)
  `;

  return { productId, createdAt: new Date() };
}

export async function removeProductFavoriteForUser(userId: string, productId: string) {
  await prisma.$executeRaw`
    DELETE FROM "ProductFavorite"
    WHERE "userId" = ${userId} AND "productId" = ${productId}
  `;
}
