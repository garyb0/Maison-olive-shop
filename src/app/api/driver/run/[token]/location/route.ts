import { jsonError, jsonOk } from "@/lib/http";
import { mapDeliveryRunError, recordDriverRunLocation } from "@/lib/delivery-runs";
import { driverLocationSampleSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { token } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = driverLocationSampleSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("Invalid location payload", 400);
    }

    const result = await recordDriverRunLocation(token, parsed.data);
    return jsonOk(result);
  } catch (error) {
    const mapped = mapDeliveryRunError(error);
    return jsonError(mapped.message, mapped.status);
  }
}
