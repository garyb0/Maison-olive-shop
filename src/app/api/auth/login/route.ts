import { loginUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { logApiEvent } from "@/lib/observability";
import { applyRateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const startedAt = Date.now()
  const rate = await applyRateLimit(request, { namespace: "auth:login", windowMs: 5 * 60_000, max: 20 });
  if (!rate.ok) {
    logApiEvent({
      level: "WARN",
      route: "/api/auth/login",
      event: "LOGIN_RATE_LIMITED",
      status: 429,
      details: { durationMs: Date.now() - startedAt, namespace: "auth:login" },
    });
    return jsonError("Too many requests", 429);
  }

  try {
    const body = await request.json();
    const input = loginSchema.parse(body);
    const result = await loginUser(input.email, input.password);
    const durationMs = Date.now() - startedAt;

    logApiEvent({
      level: "INFO",
      route: "/api/auth/login",
      event: "LOGIN_SUCCESS",
      status: 200,
      details: { userId: result.user.id, role: result.user.role, requiresTwoFactor: result.requiresTwoFactor, durationMs },
    });

    return jsonOk({
      id: result.user.id,
      email: result.user.email,
      firstName: result.user.firstName,
      lastName: result.user.lastName,
      role: result.user.role,
      requiresTwoFactor: result.requiresTwoFactor,
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;

    logApiEvent({
      level: "WARN",
      route: "/api/auth/login",
      event: "LOGIN_FAILED",
      status: 401,
      details: { error, durationMs },
    });

    return jsonError("Invalid credentials", 401);
  }
}
