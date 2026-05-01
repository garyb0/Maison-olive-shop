import { jsonError, jsonOk } from "@/lib/http";
import { arriveDriverStop, mapDeliveryRunError } from "@/lib/delivery-runs";
import { driverStopArriveSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ token: string; stopId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { token, stopId } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = driverStopArriveSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("Invalid stop arrival payload", 400);
    }

    const run = await arriveDriverStop(token, {
      stopId,
      ...parsed.data,
    });

    return jsonOk({ run });
  } catch (error) {
    const mapped = mapDeliveryRunError(error);
    return jsonError(mapped.message, mapped.status);
  }
}
