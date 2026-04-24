import { revokeOtherSessionsForCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { logApiEvent } from "@/lib/observability";
import { applyRateLimit } from "@/lib/rate-limit";

export async function DELETE(request: Request) {
  const rate = await applyRateLimit(request, { namespace: "account:sessions", windowMs: 10 * 60_000, max: 6 });
  if (!rate.ok) {
    return jsonError("Too many requests", 429);
  }

  try {
    const result = await revokeOtherSessionsForCurrentUser();

    logApiEvent({
      level: "INFO",
      route: "/api/account/sessions",
      event: "OTHER_SESSIONS_REVOKED",
      status: 200,
      details: result,
    });

    return jsonOk({ ok: true, ...result });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }

    logApiEvent({
      level: "ERROR",
      route: "/api/account/sessions",
      event: "OTHER_SESSIONS_REVOKE_FAILED",
      status: 500,
      details: { error },
    });

    return jsonError("Unable to revoke sessions", 500);
  }
}
