import {
  registerWebPushSubscriptionForDriverToken,
  unregisterWebPushSubscriptionForDriverToken,
} from "@/lib/app-notifications";
import { getDriverRunSnapshot, mapDeliveryRunError } from "@/lib/delivery-runs";
import { jsonError, jsonOk } from "@/lib/http";
import { applyRateLimit } from "@/lib/rate-limit";
import { webPushSubscriptionSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const rate = await applyRateLimit(request, { namespace: "driver:push:subscribe", windowMs: 60_000, max: 20 });
  if (!rate.ok) return jsonError("Too many requests", 429);

  try {
    const { token } = await context.params;
    const body = await request.json();
    const parsed = webPushSubscriptionSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid push subscription", 400);

    const run = await getDriverRunSnapshot(token);
    const subscription = await registerWebPushSubscriptionForDriverToken({
      token,
      runId: run.id,
      subscription: parsed.data,
      userAgent: request.headers.get("user-agent"),
    });

    return jsonOk({ ok: true, subscription });
  } catch (error) {
    const mapped = mapDeliveryRunError(error);
    return jsonError(mapped.message, mapped.status);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const rate = await applyRateLimit(request, { namespace: "driver:push:unsubscribe", windowMs: 60_000, max: 20 });
  if (!rate.ok) return jsonError("Too many requests", 429);

  try {
    const { token } = await context.params;
    let endpoint: string | null = null;
    try {
      const body = await request.json();
      endpoint = typeof body?.endpoint === "string" ? body.endpoint : null;
    } catch {
      endpoint = null;
    }

    await getDriverRunSnapshot(token);
    const result = await unregisterWebPushSubscriptionForDriverToken(token, endpoint);
    return jsonOk(result);
  } catch (error) {
    const mapped = mapDeliveryRunError(error);
    return jsonError(mapped.message, mapped.status);
  }
}
