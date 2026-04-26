import { confirmTwoFactorSetupForCurrentUser, disableTwoFactorForCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { logApiEvent } from "@/lib/observability";
import { applyRateLimit } from "@/lib/rate-limit";
import { twoFactorDisableSchema, twoFactorSetupConfirmSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const rate = await applyRateLimit(request, { namespace: "account:two-factor:enable", windowMs: 10 * 60_000, max: 6 });
  if (!rate.ok) {
    return jsonError("Too many requests", 429);
  }

  try {
    const body = await request.json().catch(() => null);
    const parsed = twoFactorSetupConfirmSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid two-factor payload", 400);
    }

    const result = await confirmTwoFactorSetupForCurrentUser(parsed.data.currentPassword, parsed.data.code);

    logApiEvent({
      level: "INFO",
      route: "/api/account/two-factor",
      event: "TWO_FACTOR_ENABLED",
      status: 200,
    });

    return jsonOk({ ok: true, ...result });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return jsonError("Forbidden", 403);
    }

    if (error instanceof Error && error.message === "INVALID_CURRENT_PASSWORD") {
      return jsonError("Invalid current password", 401);
    }

    if (error instanceof Error && error.message === "TWO_FACTOR_SETUP_REQUIRED") {
      return jsonError("Two-factor setup must be started first", 400);
    }

    if (error instanceof Error && error.message === "TWO_FACTOR_ALREADY_ENABLED") {
      return jsonError("Two-factor authentication is already enabled", 400);
    }

    if (error instanceof Error && error.message === "INVALID_TWO_FACTOR_CODE") {
      return jsonError("Invalid two-factor code", 401);
    }

    logApiEvent({
      level: "ERROR",
      route: "/api/account/two-factor",
      event: "TWO_FACTOR_ENABLE_FAILED",
      status: 500,
      details: { error },
    });

    return jsonError("Unable to enable two-factor authentication", 500);
  }
}

export async function DELETE(request: Request) {
  const rate = await applyRateLimit(request, { namespace: "account:two-factor:disable", windowMs: 10 * 60_000, max: 6 });
  if (!rate.ok) {
    return jsonError("Too many requests", 429);
  }

  try {
    const body = await request.json().catch(() => null);
    const parsed = twoFactorDisableSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid two-factor payload", 400);
    }

    await disableTwoFactorForCurrentUser(parsed.data.currentPassword, parsed.data.code);

    logApiEvent({
      level: "INFO",
      route: "/api/account/two-factor",
      event: "TWO_FACTOR_DISABLED",
      status: 200,
    });

    return jsonOk({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return jsonError("Forbidden", 403);
    }

    if (error instanceof Error && error.message === "INVALID_CURRENT_PASSWORD") {
      return jsonError("Invalid current password", 401);
    }

    if (error instanceof Error && error.message === "TWO_FACTOR_NOT_ENABLED") {
      return jsonError("Two-factor authentication is not enabled", 400);
    }

    if (error instanceof Error && error.message === "INVALID_TWO_FACTOR_CODE") {
      return jsonError("Invalid two-factor code", 401);
    }

    logApiEvent({
      level: "ERROR",
      route: "/api/account/two-factor",
      event: "TWO_FACTOR_DISABLE_FAILED",
      status: 500,
      details: { error },
    });

    return jsonError("Unable to disable two-factor authentication", 500);
  }
}
