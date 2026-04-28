import { resetPassword } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { logApiEvent } from "@/lib/observability";
import { applyRateLimit } from "@/lib/rate-limit";
import { resetPasswordSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const rate = await applyRateLimit(request, { namespace: "auth:reset-password", windowMs: 10 * 60_000, max: 15 });
  if (!rate.ok) {
    return jsonError("Too many requests", 429);
  }

  try {
    const body = await request.json();
    const input = resetPasswordSchema.parse(body);

    await resetPassword(input.token, input.password);

    logApiEvent({
      level: "INFO",
      route: "/api/auth/reset-password",
      event: "PASSWORD_RESET_SUCCESS",
      status: 200,
    });

    return jsonOk({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (
      message === "INVALID_RESET_TOKEN" ||
      message === "RESET_TOKEN_ALREADY_USED" ||
      message === "RESET_TOKEN_EXPIRED"
    ) {
      logApiEvent({
        level: "WARN",
        route: "/api/auth/reset-password",
        event: "PASSWORD_RESET_INVALID_TOKEN",
        status: 400,
        details: { reason: message },
      });
      return jsonError(message, 400);
    }

    logApiEvent({
      level: "ERROR",
      route: "/api/auth/reset-password",
      event: "PASSWORD_RESET_FAILED",
      status: 500,
      details: { error },
    });

    return jsonError("Internal server error", 500);
  }
}
