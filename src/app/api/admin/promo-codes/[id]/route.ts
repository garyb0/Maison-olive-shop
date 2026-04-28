import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { logApiEvent } from "@/lib/observability";
import { requireAdmin } from "@/lib/permissions";
import { normalizePromoCode } from "@/lib/promo";
import { adminPromoCodeUpdateSchema } from "@/lib/validators";

type RouteParams = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    await requireAdmin();
    const { id } = await params;

    const body = await request.json();
    const parsed = adminPromoCodeUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Payload de code promo invalide", 400);
    }

    const existing = await prisma.promoCode.findUnique({ where: { id } });
    if (!existing) {
      return jsonError("Code promo introuvable", 404);
    }

    const promoCode = await prisma.promoCode.update({
      where: { id },
      data: {
        ...(parsed.data.code !== undefined && { code: normalizePromoCode(parsed.data.code) }),
        ...(parsed.data.description !== undefined && { description: parsed.data.description }),
        ...(parsed.data.discountPercent !== undefined && { discountPercent: parsed.data.discountPercent }),
        ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
      },
    });

    logApiEvent({
      level: "INFO",
      route: `/api/admin/promo-codes/${id}`,
      event: "ADMIN_PROMO_CODE_UPDATE_SUCCESS",
      status: 200,
      details: { promoCodeId: id, code: promoCode.code },
    });

    return jsonOk({ promoCode });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }

    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return jsonError("Ce code promo existe deja", 409);
    }

    return jsonError("Forbidden", 403);
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    await requireAdmin();
    const { id } = await params;

    const existing = await prisma.promoCode.findUnique({ where: { id } });
    if (!existing) {
      return jsonError("Code promo introuvable", 404);
    }

    await prisma.promoCode.delete({ where: { id } });

    logApiEvent({
      level: "INFO",
      route: `/api/admin/promo-codes/${id}`,
      event: "ADMIN_PROMO_CODE_DELETE_SUCCESS",
      status: 200,
      details: { promoCodeId: id, code: existing.code },
    });

    return jsonOk({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }

    return jsonError("Forbidden", 403);
  }
}
