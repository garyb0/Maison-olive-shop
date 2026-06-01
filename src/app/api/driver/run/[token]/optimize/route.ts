import { jsonError, jsonOk } from "@/lib/http";
import {
  getDeliveryRunTokenRateLimitIdentity,
  mapDeliveryRunError,
  optimizeDriverRunFromCurrentPosition,
} from "@/lib/delivery-runs";
import { applyRateLimit } from "@/lib/rate-limit";
import { driverRunOptimizeSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { token } = await context.params;
  const rate = await applyRateLimit(request, {
    namespace: "driver:optimize",
    windowMs: 10 * 60 * 1000,
    max: 6,
    identity: getDeliveryRunTokenRateLimitIdentity(token),
  });
  if (!rate.ok) return jsonError("Too many requests", 429);

  try {
    const body = await request.json().catch(() => null);
    const parsed = driverRunOptimizeSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("Invalid run optimization payload", 400);
    }

    const result = await optimizeDriverRunFromCurrentPosition(token, parsed.data);
    return jsonOk(result);
  } catch (error) {
    const mapped = mapDeliveryRunError(error);
    return jsonError(mapped.message, mapped.status);
  }
}
