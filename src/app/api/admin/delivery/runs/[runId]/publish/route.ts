import { jsonError, jsonOk } from "@/lib/http";
import { requireAdmin } from "@/lib/permissions";
import { mapDeliveryRunError, publishDeliveryRun } from "@/lib/delivery-runs";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin();
    const { runId } = await context.params;
    const result = await publishDeliveryRun({
      runId,
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
