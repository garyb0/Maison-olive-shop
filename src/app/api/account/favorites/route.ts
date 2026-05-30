import { addProductFavoriteForUser, getFavoriteProductsForUser } from "@/lib/favorites";
import { formatCurrency } from "@/lib/format";
import { getCurrentLanguage } from "@/lib/language";
import { jsonError, jsonOk } from "@/lib/http";
import { requireUser } from "@/lib/permissions";
import { favoriteProductSchema } from "@/lib/validators";

export async function GET() {
  try {
    const [user, language] = await Promise.all([requireUser(), getCurrentLanguage()]);
    const locale = language === "fr" ? "fr-CA" : "en-CA";
    const favorites = await getFavoriteProductsForUser(user.id);

    return jsonOk({
      favorites: favorites.map(({ product }) => ({
        id: product.id,
        slug: product.slug,
        name: language === "fr" ? product.nameFr : product.nameEn,
        imageUrl: product.imageUrl,
        priceLabel: formatCurrency(product.priceCents, product.currency, locale),
        stock: product.stock,
        isActive: product.isActive,
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }

    return jsonError("Unable to load favorites", 500);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const parsed = favoriteProductSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid favorite payload", 400);

    const favorite = await addProductFavoriteForUser(user.id, parsed.data.productId);
    return jsonOk({ favorite });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }

    if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND") {
      return jsonError("Product not found", 404);
    }

    return jsonError("Unable to save favorite", 500);
  }
}
