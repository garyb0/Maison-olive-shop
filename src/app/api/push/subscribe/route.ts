import {
  registerWebPushSubscriptionForUser,
  unregisterWebPushSubscriptionForUser,
} from "@/lib/app-notifications";
import { jsonError, jsonOk } from "@/lib/http";
import { requireUser } from "@/lib/permissions";
import { applyRateLimit } from "@/lib/rate-limit";
import { webPushSubscriptionSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const rate = await applyRateLimit(request, { namespace: "push:subscribe", windowMs: 60_000, max: 20 });
  if (!rate.ok) return jsonError("Too many requests", 429);

  try {
    const user = await requireUser();
    const body = await request.json();
    const parsed = webPushSubscriptionSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid push subscription", 400);

    const subscription = await registerWebPushSubscriptionForUser(
      user,
      parsed.data,
      request.headers.get("user-agent"),
    );

    return jsonOk({ ok: true, subscription });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return jsonError("Unauthorized", 401);
    if (error instanceof Error && error.message === "WEB_PUSH_ENDPOINT_NOT_ALLOWED") {
      return jsonError("Invalid push subscription", 400);
    }
    return jsonError("Unable to subscribe to push", 500);
  }
}

export async function DELETE(request: Request) {
  const rate = await applyRateLimit(request, { namespace: "push:unsubscribe", windowMs: 60_000, max: 20 });
  if (!rate.ok) return jsonError("Too many requests", 429);

  try {
    const user = await requireUser();
    let endpoint: string | null = null;
    try {
      const body = await request.json();
      endpoint = typeof body?.endpoint === "string" ? body.endpoint : null;
    } catch {
      endpoint = null;
    }

    const result = await unregisterWebPushSubscriptionForUser(user.id, endpoint);
    return jsonOk(result);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return jsonError("Unauthorized", 401);
    return jsonError("Unable to unsubscribe from push", 500);
  }
}
