import { verifyTwoFactorLogin } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { logApiEvent } from "@/lib/observability";
import { applyRateLimit } from "@/lib/rate-limit";
import { twoFactorCodeSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const startedAt = Date.now()
  const rate = await applyRateLimit(request, { namespace: "auth:login:2fa", windowMs: 5 * 60_000, max: 20 });
  if (!rate.ok) {
    logApiEvent({
      level: "WARN",
      route: "/api/auth/login/verify-two-factor",
      event: "LOGIN_TWO_FACTOR_RATE_LIMITED",
      status: 429,
      details: { durationMs: Date.now() - startedAt },
    });
    return jsonError("Too many requests", 429);
  }

  try {
    const body = await request.json().catch(() => null);
    const parsed = twoFactorCodeSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid two-factor payload", 400);
    }

    const user = await verifyTwoFactorLogin(parsed.data.code);
    const durationMs = Date.now() - startedAt;

    logApiEvent({
      level: "INFO",
      route: "/api/auth/login/verify-two-factor",
      event: "LOGIN_TWO_FACTOR_SUCCESS",
      status: 200,
      details: { userId: user.id, role: user.role, durationMs },
    });

    return jsonOk(user);
  } catch (error) {
    const durationMs = Date.now() - startedAt;

    if (error instanceof Error && error.message === "TWO_FACTOR_CHALLENGE_REQUIRED") {
      return jsonError("Two-factor verification is required", 401);
    }

    if (error instanceof Error && error.message === "INVALID_TWO_FACTOR_CODE") {
      return jsonError("Invalid two-factor code", 401);
    }

    logApiEvent({
      level: "WARN",
      route: "/api/auth/login/verify-two-factor",
      event: "LOGIN_TWO_FACTOR_FAILED",
      status: 401,
      details: { error, durationMs },
    });

    return jsonError("Invalid two-factor code", 401);
  }
}
