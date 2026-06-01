import { jsonError, jsonOk } from "@/lib/http";
import {
  getDeliveryRunTokenRateLimitIdentity,
  mapDeliveryRunError,
  recordDriverRunLocation,
} from "@/lib/delivery-runs";
import { applyRateLimit } from "@/lib/rate-limit";
import { driverLocationSampleSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { token } = await context.params;
  const rate = await applyRateLimit(request, {
    namespace: "driver:location",
    windowMs: 60_000,
    max: 120,
    identity: getDeliveryRunTokenRateLimitIdentity(token),
  });
  if (!rate.ok) return jsonError("Too many requests", 429);

  try {
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
