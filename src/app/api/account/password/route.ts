import { changePasswordForCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { logApiEvent } from "@/lib/observability";
import { applyRateLimit } from "@/lib/rate-limit";
import { accountPasswordChangeSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const rate = await applyRateLimit(request, { namespace: "account:password", windowMs: 10 * 60_000, max: 8 });
  if (!rate.ok) {
    return jsonError("Too many requests", 429);
  }

  try {
    const body = await request.json().catch(() => null);
    const parsed = accountPasswordChangeSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("Invalid password change payload", 400);
    }

    await changePasswordForCurrentUser(parsed.data.currentPassword, parsed.data.newPassword);

    logApiEvent({
      level: "INFO",
      route: "/api/account/password",
      event: "PASSWORD_CHANGED",
      status: 200,
    });

    return jsonOk({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }

    if (error instanceof Error && error.message === "INVALID_CURRENT_PASSWORD") {
      return jsonError("Invalid current password", 401);
    }

    if (error instanceof Error && error.message === "PASSWORD_UNCHANGED") {
      return jsonError("New password must be different", 400);
    }

    logApiEvent({
      level: "ERROR",
      route: "/api/account/password",
      event: "PASSWORD_CHANGE_FAILED",
      status: 500,
      details: { error },
    });

    return jsonError("Unable to change password", 500);
  }
}
