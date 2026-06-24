import {
  CLIENT_HIDDEN_NOTIFICATION_TYPES,
  listAppNotificationsForUser,
  markAppNotificationsRead,
} from "@/lib/app-notifications";
import { jsonError, jsonOk } from "@/lib/http";
import { requireUser } from "@/lib/permissions";
import { applyRateLimit } from "@/lib/rate-limit";
import { notificationsPatchSchema } from "@/lib/validators";

export async function GET(request: Request) {
  const rate = await applyRateLimit(request, { namespace: "notifications:list", windowMs: 60_000, max: 80 });
  if (!rate.ok) return jsonError("Too many requests", 429);

  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const take = Math.min(50, Math.max(1, Number.parseInt(url.searchParams.get("take") ?? "20", 10) || 20));
    const result = await listAppNotificationsForUser(user, take, {
      excludeTypes: CLIENT_HIDDEN_NOTIFICATION_TYPES,
    });
    return jsonOk(result);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return jsonError("Unauthorized", 401);
    return jsonError("Unable to load notifications", 500);
  }
}

export async function PATCH(request: Request) {
  const rate = await applyRateLimit(request, { namespace: "notifications:patch", windowMs: 60_000, max: 40 });
  if (!rate.ok) return jsonError("Too many requests", 429);

  try {
    const user = await requireUser();
    const body = await request.json();
    const parsed = notificationsPatchSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid notification update", 400);

    const result = await markAppNotificationsRead(user, parsed.data);
    return jsonOk(result);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return jsonError("Unauthorized", 401);
    return jsonError("Unable to update notifications", 500);
  }
}
