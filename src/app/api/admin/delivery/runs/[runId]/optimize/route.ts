import { jsonError, jsonOk } from "@/lib/http";
import { requireAdmin } from "@/lib/permissions";
import { mapDeliveryRunError, optimizeDeliveryRun } from "@/lib/delivery-runs";
import { createAppNotification } from "@/lib/app-notifications";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin();
    const { runId } = await context.params;
    const result = await optimizeDeliveryRun({
      runId,
      actorUserId: admin.id,
    });
    if (result.run.status === "PUBLISHED" || result.run.status === "IN_PROGRESS") {
      createAppNotification({
        driverRunId: result.run.id,
        audience: "DRIVER",
        type: "DRIVER_RUN",
        title: "Tournee mise a jour",
        body: `Tournee ${result.run.dateKey}: ordre optimise par l'admin.`,
        href: "/app",
        metadata: { runId: result.run.id, action: "optimized" },
      }).catch(() => undefined);
    }
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
