import { getCurrentUser } from "@/lib/auth";
import { logApiEvent } from "@/lib/observability";
import { jsonOk } from "@/lib/http";

export async function GET() {
  const startedAt = Date.now();
  const user = await getCurrentUser();
  const durationMs = Date.now() - startedAt;

  logApiEvent({
    level: user ? "INFO" : "WARN",
    route: "/api/auth/me",
    event: user ? "AUTH_ME_SUCCESS" : "AUTH_ME_ANONYMOUS",
    status: user ? 200 : 401,
    details: { durationMs, userId: user?.id ?? null },
  });

  return jsonOk({ user });
}
