import { logoutUser } from "@/lib/auth";
import { logApiEvent } from "@/lib/observability";
import { jsonOk } from "@/lib/http";

export async function POST() {
  const startedAt = Date.now();
  await logoutUser();
  logApiEvent({
    level: "INFO",
    route: "/api/auth/logout",
    event: "LOGOUT_SUCCESS",
    status: 200,
    details: { durationMs: Date.now() - startedAt },
  });
  return jsonOk({ ok: true });
}
