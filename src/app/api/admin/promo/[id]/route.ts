import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { logApiEvent } from "@/lib/observability";
import { requireAdmin } from "@/lib/permissions";
import { adminPromoBannerUpdateSchema } from "@/lib/validators";
import { sanitizePromoCtaLink } from "@/lib/promo-links";

type RouteParams = { params: Promise<{ id: string }> };
const INVALID_PROMO_LINK_ERROR =
  "Lien de bouton invalide. Utilise une route publique comme /, /checkout, /faq ou /products/slug.";

// PUT /api/admin/promo/[id] — Modifier une bannière
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    await requireAdmin();
    const { id } = await params;

    const body = await request.json();
    const parsed = adminPromoBannerUpdateSchema.safeParse(body);
    if (!parsed.success) {
      if (parsed.error.issues.some((issue) => issue.path[0] === "ctaLink")) {
        return jsonError(INVALID_PROMO_LINK_ERROR, 400);
      }

      return jsonError("Payload de banniere invalide", 400);
    }

    const {
      isActive,
      sortOrder,
      badgeFr,
      badgeEn,
      titleFr,
      titleEn,
      price1Fr,
      price1En,
      price2Fr,
      price2En,
      point1Fr,
      point1En,
      point2Fr,
      point2En,
      point3Fr,
      point3En,
      ctaTextFr,
      ctaTextEn,
      ctaLink,
    } = parsed.data;

    const existing = await prisma.promoBanner.findUnique({ where: { id } });
    if (!existing) {
      return jsonError("Bannière non trouvée", 404);
    }

    const banner = await prisma.promoBanner.update({
      where: { id },
        data: {
        ...(isActive !== undefined && { isActive }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(badgeFr !== undefined && { badgeFr }),
        ...(badgeEn !== undefined && { badgeEn }),
        ...(titleFr !== undefined && { titleFr }),
        ...(titleEn !== undefined && { titleEn }),
        ...(price1Fr !== undefined && { price1Fr }),
        ...(price1En !== undefined && { price1En }),
        ...(price2Fr !== undefined && { price2Fr }),
        ...(price2En !== undefined && { price2En }),
        ...(point1Fr !== undefined && { point1Fr }),
        ...(point1En !== undefined && { point1En }),
        ...(point2Fr !== undefined && { point2Fr }),
        ...(point2En !== undefined && { point2En }),
        ...(point3Fr !== undefined && { point3Fr }),
        ...(point3En !== undefined && { point3En }),
        ...(ctaTextFr !== undefined && { ctaTextFr }),
        ...(ctaTextEn !== undefined && { ctaTextEn }),
        ...(ctaLink !== undefined && { ctaLink: sanitizePromoCtaLink(ctaLink) }),
      },
    });

    logApiEvent({
      level: "INFO",
      route: `/api/admin/promo/${id}`,
      event: "ADMIN_PROMO_UPDATE_SUCCESS",
      status: 200,
      details: { bannerId: id },
    });

    return jsonOk({ banner });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }
    return jsonError("Forbidden", 403);
  }
}

// DELETE /api/admin/promo/[id] — Supprimer une bannière
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    await requireAdmin();
    const { id } = await params;

    const existing = await prisma.promoBanner.findUnique({ where: { id } });
    if (!existing) {
      return jsonError("Bannière non trouvée", 404);
    }

    await prisma.promoBanner.delete({ where: { id } });

    logApiEvent({
      level: "INFO",
      route: `/api/admin/promo/${id}`,
      event: "ADMIN_PROMO_DELETE_SUCCESS",
      status: 200,
      details: { bannerId: id },
    });

    return jsonOk({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }
    return jsonError("Forbidden", 403);
  }
}
