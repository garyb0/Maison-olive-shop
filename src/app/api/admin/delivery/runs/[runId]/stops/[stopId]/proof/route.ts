import { getAdminStopProofFile, mapDeliveryRunError } from "@/lib/delivery-runs";
import { jsonError } from "@/lib/http";
import { requireAdmin } from "@/lib/permissions";

type RouteContext = {
  params: Promise<{ runId: string; stopId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireAdmin();
    const { runId, stopId } = await context.params;
    const proof = await getAdminStopProofFile(runId, stopId);

    return new Response(new Uint8Array(proof.buffer), {
      status: 200,
      headers: {
        "Content-Type": proof.mimeType,
        "Cache-Control": "private, max-age=300",
      },
    });
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
