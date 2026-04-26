import { prisma } from "@/lib/prisma";
import { jsonError, jsonOk } from "@/lib/http";
import { logApiEvent } from "@/lib/observability";
import { requireAdmin } from "@/lib/permissions";
import { normalizePromoCode } from "@/lib/promo";
import { adminPromoCodeCreateSchema } from "@/lib/validators";

export async function GET() {
  try {
    await requireAdmin();

    const promoCodes = await prisma.promoCode.findMany({
      orderBy: [{ isActive: "desc" }, { code: "asc" }],
    });

    logApiEvent({
      level: "INFO",
      route: "/api/admin/promo-codes",
      event: "ADMIN_PROMO_CODES_LIST_SUCCESS",
      status: 200,
      details: { count: promoCodes.length },
    });

    return jsonOk({ promoCodes });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }

    return jsonError("Forbidden", 403);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();

    const body = await request.json();
    const parsed = adminPromoCodeCreateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Payload de code promo invalide", 400);
    }

    const promoCode = await prisma.promoCode.create({
      data: {
        code: normalizePromoCode(parsed.data.code),
        description: parsed.data.description,
        discountPercent: parsed.data.discountPercent,
        isActive: parsed.data.isActive ?? true,
      },
    });

    logApiEvent({
      level: "INFO",
      route: "/api/admin/promo-codes",
      event: "ADMIN_PROMO_CODE_CREATE_SUCCESS",
      status: 201,
      details: { promoCodeId: promoCode.id, code: promoCode.code },
    });

    return jsonOk({ promoCode }, { status: 201 });
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
