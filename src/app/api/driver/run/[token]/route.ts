import { jsonError, jsonOk } from "@/lib/http";
import { getDriverRunSnapshot, mapDeliveryRunError } from "@/lib/delivery-runs";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { token } = await context.params;
    const run = await getDriverRunSnapshot(token);
    return jsonOk({ run });
  } catch (error) {
    const mapped = mapDeliveryRunError(error);
    return jsonError(mapped.message, mapped.status);
  }
}
