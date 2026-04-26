import { jsonError, jsonOk } from "@/lib/http";
import { requireAdmin } from "@/lib/permissions";
import {
  completeDeliveryRunFromAdmin,
  mapDeliveryRunError,
} from "@/lib/delivery-runs";
import { adminCompleteDeliveryRunSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin();
    const { runId } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = adminCompleteDeliveryRunSchema.safeParse(body ?? {});

    if (!parsed.success) {
      return jsonError("Invalid completion payload", 400);
    }

    const run = await completeDeliveryRunFromAdmin({
      runId,
      ...parsed.data,
      actorUserId: admin.id,
    });

    return jsonOk({ run });
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
