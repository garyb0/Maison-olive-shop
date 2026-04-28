import { jsonError, jsonOk } from "@/lib/http";
import { requireAdmin } from "@/lib/permissions";
import {
  exportDeliveryRunCsv,
  getDeliveryRunDetail,
  mapDeliveryRunError,
} from "@/lib/delivery-runs";

type RouteContext = {
  params: Promise<{ runId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    await requireAdmin();
    const { runId } = await context.params;
    const url = new URL(request.url);

    if (url.searchParams.get("format") === "csv") {
      const csv = await exportDeliveryRunCsv(runId);
      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="delivery-run-${runId}.csv"`,
        },
      });
    }

    const run = await getDeliveryRunDetail(runId);
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
