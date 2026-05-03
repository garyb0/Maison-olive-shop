import {
  getAppNotificationPreferences,
  updateAppNotificationPreferences,
} from "@/lib/app-notifications";
import { jsonError, jsonOk } from "@/lib/http";
import { requireUser } from "@/lib/permissions";
import { applyRateLimit } from "@/lib/rate-limit";
import { notificationPreferencePatchSchema } from "@/lib/validators";

export async function GET(request: Request) {
  const rate = await applyRateLimit(request, { namespace: "notifications:preferences:get", windowMs: 60_000, max: 60 });
  if (!rate.ok) return jsonError("Too many requests", 429);

  try {
    const user = await requireUser();
    const preferences = await getAppNotificationPreferences(user.id);
    return jsonOk({ preferences });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return jsonError("Unauthorized", 401);
    return jsonError("Unable to load notification preferences", 500);
  }
}

export async function PATCH(request: Request) {
  const rate = await applyRateLimit(request, { namespace: "notifications:preferences:update", windowMs: 60_000, max: 30 });
  if (!rate.ok) return jsonError("Too many requests", 429);

  try {
    const user = await requireUser();
    const body = await request.json();
    const parsed = notificationPreferencePatchSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid notification preferences", 400);

    const preferences = await updateAppNotificationPreferences(user.id, parsed.data);
    return jsonOk({ preferences });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return jsonError("Unauthorized", 401);
    return jsonError("Unable to update notification preferences", 500);
  }
}
