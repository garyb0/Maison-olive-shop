import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { logApiEvent } from "@/lib/observability";
import { requireAdmin } from "@/lib/permissions";
import { adminPromoBannerCreateSchema } from "@/lib/validators";
import { sanitizePromoCtaLink } from "@/lib/promo-links";

const INVALID_PROMO_LINK_ERROR =
  "Lien de bouton invalide. Utilise une route publique comme /, /checkout, /faq ou /products/slug.";

// GET /api/admin/promo — Liste toutes les bannières
export async function GET() {
  try {
    await requireAdmin();

    const banners = await prisma.promoBanner.findMany({
      orderBy: { sortOrder: "asc" },
    });

    logApiEvent({
      level: "INFO",
      route: "/api/admin/promo",
      event: "ADMIN_PROMO_LIST_SUCCESS",
      status: 200,
      details: { count: banners.length },
    });

    return jsonOk({ banners });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }
    return jsonError("Forbidden", 403);
  }
}

// POST /api/admin/promo — Créer une nouvelle bannière
export async function POST(request: Request) {
  try {
    await requireAdmin();

    const body = await request.json();
    const parsed = adminPromoBannerCreateSchema.safeParse(body);
    if (!parsed.success) {
      if (parsed.error.issues.some((issue) => issue.path[0] === "ctaLink")) {
        return jsonError(INVALID_PROMO_LINK_ERROR, 400);
      }

      if (parsed.error.issues.some((issue) => issue.path[0] === "titleFr")) {
        return jsonError("Le titre français est requis", 400);
      }

      return jsonError("Payload de banniere invalide", 400);
    }

    const {
      isActive = true,
      sortOrder = 0,
      badgeFr = "🔥 Offre limitée",
      badgeEn,
      titleFr,
      titleEn,
      price1Fr = "1 pour 64,99 $",
      price1En,
      price2Fr = "🔥 2 pour seulement 100 $",
      price2En,
      point1Fr = "Ultra doux",
      point1En,
      point2Fr = "Lavable",
      point2En,
      point3Fr = "Approuvé par Olive",
      point3En,
      ctaTextFr = "Magasiner →",
      ctaTextEn,
      ctaLink = "/",
    } = parsed.data;

    const banner = await prisma.promoBanner.create({
      data: {
        isActive,
        sortOrder,
        badgeFr,
        badgeEn: badgeEn ?? "",
        titleFr,
        titleEn: titleEn ?? "",
        price1Fr,
        price1En: price1En ?? "",
        price2Fr,
        price2En: price2En ?? "",
        point1Fr,
        point1En: point1En ?? "",
        point2Fr,
        point2En: point2En ?? "",
        point3Fr,
        point3En: point3En ?? "",
        ctaTextFr,
        ctaTextEn: ctaTextEn ?? "",
        ctaLink: sanitizePromoCtaLink(ctaLink),
      },
    });

    logApiEvent({
      level: "INFO",
      route: "/api/admin/promo",
      event: "ADMIN_PROMO_CREATE_SUCCESS",
      status: 201,
      details: { bannerId: banner.id },
    });

    return jsonOk({ banner }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }
    return jsonError("Forbidden", 403);
  }
}
