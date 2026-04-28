import { jsonError, jsonOk } from "@/lib/http";
import { requireAdmin } from "@/lib/permissions";
import {
  createDeliveryRun,
  listDeliveryRunsByDate,
  mapDeliveryRunError,
} from "@/lib/delivery-runs";
import { adminDeliveryRunsQuerySchema, createDeliveryRunSchema } from "@/lib/validators";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const parsed = adminDeliveryRunsQuerySchema.safeParse({
      date: searchParams.get("date") ?? undefined,
    });

    if (!parsed.success) {
      return jsonError("Invalid query", 400);
    }

    const runs = await listDeliveryRunsByDate(parsed.data.date);
    return jsonOk({ runs });
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
    const parsed = createDeliveryRunSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("Invalid run payload", 400);
    }

    const result = await createDeliveryRun({
      ...parsed.data,
      actorUserId: admin.id,
    });

    return jsonOk(result);
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
