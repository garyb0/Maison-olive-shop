import { jsonError, jsonOk } from "@/lib/http";
import { logApiEvent } from "@/lib/observability";
import { requireAdmin } from "@/lib/permissions";
import {
  createAdminDeliverySlot,
  deleteAdminDeliveryException,
  deleteAdminDeliverySlot,
  getAdminDeliverySlots,
  upsertAdminDeliveryException,
  updateAdminDeliverySlot,
} from "@/lib/delivery";
import {
  adminDeliveryExceptionDeleteSchema,
  adminDeliveryExceptionUpsertSchema,
  adminDeliverySlotCreateSchema,
  adminDeliverySlotDeleteSchema,
  adminDeliverySlotUpdateSchema,
  deliverySlotsQuerySchema,
} from "@/lib/validators";

export async function GET(request: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const parsed = deliverySlotsQuerySchema.safeParse({
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
    });

    if (!parsed.success) {
      return jsonError("Invalid query", 400);
    }

    const slots = await getAdminDeliverySlots({
      from: parsed.data.from ? new Date(parsed.data.from) : undefined,
      to: parsed.data.to ? new Date(parsed.data.to) : undefined,
    });

    return jsonOk({ slots });
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
    const body = await request.json().catch(() => null);

    if (body && typeof body === "object" && "dateKey" in body) {
      const parsedException = adminDeliveryExceptionUpsertSchema.safeParse(body);
      if (!parsedException.success) {
        return jsonError("Invalid exception payload", 400);
      }

      const exception = await upsertAdminDeliveryException(parsedException.data);
      return jsonOk({ exception });
    }

    const parsedSlot = adminDeliverySlotCreateSchema.safeParse(body);
    if (!parsedSlot.success) {
      return jsonError("Invalid slot payload", 400);
    }

    const slot = await createAdminDeliverySlot(parsedSlot.data);
    const [mappedSlot] = await getAdminDeliverySlots({ from: slot.startAt, to: slot.endAt });
    return jsonOk({ slot: mappedSlot ?? slot });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return jsonError("Forbidden", 403);
    }
    if (error instanceof Error && error.message === "DELIVERY_SCHEMA_UNAVAILABLE") {
      return jsonError("Schema livraison non initialise. Execute la migration Prisma.", 503);
    }
    if (error instanceof Error && error.message === "SLOT_OVERLAP") {
      return jsonError("Ce créneau chevauche un autre créneau existant", 409);
    }
    if (error instanceof Error && error.message === "INVALID_SLOT_RANGE") {
      return jsonError("Plage horaire invalide", 400);
    }

    logApiEvent({
      level: "ERROR",
      route: "/api/admin/delivery",
      event: "ADMIN_DELIVERY_POST_FAILED",
      status: 500,
      details: { error },
    });
    return jsonError("Failed to create delivery data", 500);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => null);

    if (body && typeof body === "object" && "dateKey" in body && !("id" in body)) {
      const parsedException = adminDeliveryExceptionUpsertSchema.safeParse(body);
      if (!parsedException.success) {
        return jsonError("Invalid exception payload", 400);
      }

      const exception = await upsertAdminDeliveryException(parsedException.data);
      return jsonOk({ exception });
    }

    const parsedSlot = adminDeliverySlotUpdateSchema.safeParse(body);
    if (!parsedSlot.success) {
      return jsonError("Invalid slot payload", 400);
    }

    const slot = await updateAdminDeliverySlot(parsedSlot.data);
    const [mappedSlot] = await getAdminDeliverySlots({ from: slot.startAt, to: slot.endAt });
    return jsonOk({ slot: mappedSlot ?? slot });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return jsonError("Forbidden", 403);
    }
    if (error instanceof Error && error.message === "DELIVERY_SCHEMA_UNAVAILABLE") {
      return jsonError("Schema livraison non initialise. Execute la migration Prisma.", 503);
    }
    if (error instanceof Error && error.message === "DELIVERY_SLOT_NOT_FOUND") {
      return jsonError("Créneau introuvable", 404);
    }
    if (error instanceof Error && error.message === "INVALID_SLOT_RANGE") {
      return jsonError("Plage horaire invalide", 400);
    }
    if (error instanceof Error && error.message === "SLOT_OVERLAP") {
      return jsonError("Ce créneau chevauche un autre créneau existant", 409);
    }

    logApiEvent({
      level: "ERROR",
      route: "/api/admin/delivery",
      event: "ADMIN_DELIVERY_PATCH_FAILED",
      status: 500,
      details: { error },
    });
    return jsonError("Failed to update delivery data", 500);
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => null);

    if (body && typeof body === "object" && "dateKey" in body && !("id" in body)) {
      const parsedException = adminDeliveryExceptionDeleteSchema.safeParse(body);
      if (!parsedException.success) {
        return jsonError("Invalid exception payload", 400);
      }

      const result = await deleteAdminDeliveryException(parsedException.data);
      return jsonOk({ deleted: true, ...result });
    }

    const parsedSlot = adminDeliverySlotDeleteSchema.safeParse(body);
    if (!parsedSlot.success) {
      return jsonError("Invalid slot payload", 400);
    }

    const result = await deleteAdminDeliverySlot(parsedSlot.data);
    return jsonOk({ deleted: true, ...result });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return jsonError("Forbidden", 403);
    }
    if (error instanceof Error && error.message === "DELIVERY_SCHEMA_UNAVAILABLE") {
      return jsonError("Schema livraison non initialise. Execute la migration Prisma.", 503);
    }
    if (error instanceof Error && error.message === "DELIVERY_SLOT_NOT_FOUND") {
      return jsonError("Créneau introuvable", 404);
    }
    if (error instanceof Error && error.message === "DELIVERY_EXCEPTION_NOT_FOUND") {
      return jsonError("Exception introuvable", 404);
    }
    if (error instanceof Error && error.message === "DELIVERY_SLOT_HAS_ORDERS") {
      return jsonError("Impossible de supprimer un créneau lie a des commandes", 409);
    }

    logApiEvent({
      level: "ERROR",
      route: "/api/admin/delivery",
      event: "ADMIN_DELIVERY_DELETE_FAILED",
      status: 500,
      details: { error },
    });
    return jsonError("Failed to delete delivery data", 500);
  }
}
