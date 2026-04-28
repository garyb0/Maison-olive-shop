import { jsonError, jsonOk } from "@/lib/http";
import { completeDriverStop, mapDeliveryRunError } from "@/lib/delivery-runs";
import { driverStopCompleteSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ token: string; stopId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { token, stopId } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = driverStopCompleteSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("Invalid stop completion payload", 400);
    }

    const run = await completeDriverStop(token, {
      stopId,
      ...parsed.data,
    });

    return jsonOk({ run });
  } catch (error) {
    const mapped = mapDeliveryRunError(error);
    return jsonError(mapped.message, mapped.status);
  }
}
