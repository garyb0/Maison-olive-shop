import { beginTwoFactorSetupForCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { logApiEvent } from "@/lib/observability";
import { applyRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const rate = await applyRateLimit(request, { namespace: "account:two-factor:setup", windowMs: 10 * 60_000, max: 6 });
  if (!rate.ok) {
    return jsonError("Too many requests", 429);
  }

  try {
    const result = await beginTwoFactorSetupForCurrentUser();

    logApiEvent({
      level: "INFO",
      route: "/api/account/two-factor/setup",
      event: "TWO_FACTOR_SETUP_STARTED",
      status: 200,
    });

    return jsonOk(result);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return jsonError("Forbidden", 403);
    }

    if (error instanceof Error && error.message === "TWO_FACTOR_ALREADY_ENABLED") {
      return jsonError("Two-factor authentication is already enabled", 400);
    }

    logApiEvent({
      level: "ERROR",
      route: "/api/account/two-factor/setup",
      event: "TWO_FACTOR_SETUP_START_FAILED",
      status: 500,
      details: { error },
    });

    return jsonError("Unable to start two-factor setup", 500);
  }
}
