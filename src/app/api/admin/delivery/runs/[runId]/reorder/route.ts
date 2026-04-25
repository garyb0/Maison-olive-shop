import { jsonError, jsonOk } from "@/lib/http";
import { requireAdmin } from "@/lib/permissions";
import { mapDeliveryRunError, reorderDeliveryRun } from "@/lib/delivery-runs";
import { reorderDeliveryRunSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin();
    const { runId } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = reorderDeliveryRunSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("Invalid reorder payload", 400);
    }

    const result = await reorderDeliveryRun({
      runId,
      stopIds: parsed.data.stopIds,
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
