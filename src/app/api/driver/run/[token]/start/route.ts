import { jsonError, jsonOk } from "@/lib/http";
import { mapDeliveryRunError, startDriverRun } from "@/lib/delivery-runs";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { token } = await context.params;
    const run = await startDriverRun(token);
    return jsonOk({ run });
  } catch (error) {
    const mapped = mapDeliveryRunError(error);
    return jsonError(mapped.message, mapped.status);
  }
}
