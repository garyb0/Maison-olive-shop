import { jsonError, jsonOk } from "@/lib/http";
import { requireAdmin } from "@/lib/permissions";
import {
  createDeliveryDriver,
  listDeliveryDrivers,
  mapDeliveryRunError,
} from "@/lib/delivery-runs";
import { adminDriverCreateSchema } from "@/lib/validators";

export async function GET() {
  try {
    await requireAdmin();
    const drivers = await listDeliveryDrivers();
    return jsonOk({ drivers });
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

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = await request.json().catch(() => null);
    const parsed = adminDriverCreateSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("Invalid driver payload", 400);
    }

    const driver = await createDeliveryDriver({
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
