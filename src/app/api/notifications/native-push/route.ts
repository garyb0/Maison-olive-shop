import {
  registerNativePushTokenForUser,
  unregisterNativePushTokenForUser,
} from "@/lib/app-notifications";
import { jsonError, jsonOk } from "@/lib/http";
import { requireUser } from "@/lib/permissions";
import { applyRateLimit } from "@/lib/rate-limit";
import { nativePushTokenSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const rate = await applyRateLimit(request, { namespace: "notifications:native-push:post", windowMs: 60_000, max: 20 });
  if (!rate.ok) return jsonError("Too many requests", 429);

  try {
    const user = await requireUser();
    const body = await request.json();
    const parsed = nativePushTokenSchema.safeParse(body);
    if (!parsed.success) return jsonError("Invalid native push token", 400);

    const token = await registerNativePushTokenForUser(user, parsed.data);
    return jsonOk({ ok: true, token });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return jsonError("Unauthorized", 401);
    return jsonError("Unable to register native push token", 500);
  }
}

export async function DELETE(request: Request) {
  const rate = await applyRateLimit(request, { namespace: "notifications:native-push:delete", windowMs: 60_000, max: 20 });
  if (!rate.ok) return jsonError("Too many requests", 429);

  try {
    const user = await requireUser();
    let token: string | null = null;
    try {
      const body = await request.json();
      const parsed = nativePushTokenSchema.pick({ token: true }).safeParse(body);
      token = parsed.success ? parsed.data.token : null;
    } catch {
      token = null;
    }

    const result = await unregisterNativePushTokenForUser(user.id, token);
    return jsonOk(result);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return jsonError("Unauthorized", 401);
    return jsonError("Unable to unregister native push token", 500);
  }
}
