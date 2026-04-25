import { jsonError, jsonOk } from "@/lib/http";
import { requireAdmin } from "@/lib/permissions";
import {
  deleteDeliveryDriver,
  mapDeliveryRunError,
  updateDeliveryDriver,
} from "@/lib/delivery-runs";
import { adminDriverDeleteSchema, adminDriverUpdateSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ driverId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin();
    const { driverId } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = adminDriverUpdateSchema.safeParse({
      ...(body && typeof body === "object" ? body : {}),
      driverId,
    });

    if (!parsed.success) {
      return jsonError("Invalid driver payload", 400);
    }

    const driver = await updateDeliveryDriver({
      ...parsed.data,
      actorUserId: admin.id,
    });

    return jsonOk({ driver });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return jsonError("Forbidden", 403);
    }
    const mapped = mapDeliveryRunError(error);
    return jsonError(mapped.message, mapped.status);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin();
    const { driverId } = await context.params;
    const parsed = adminDriverDeleteSchema.safeParse({ driverId });

    if (!parsed.success) {
      return jsonError("Invalid driver id", 400);
    }

    await deleteDeliveryDriver({
      driverId: parsed.data.driverId,
      actorUserId: admin.id,
    });

    return jsonOk({ deleted: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return jsonError("Forbidden", 403);
    }
    const mapped = mapDeliveryRunError(error);
    return jsonError(mapped.message, mapped.status);
  }
}
