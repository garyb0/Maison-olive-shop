import { jsonError, jsonOk } from "@/lib/http";
import { requireAdmin } from "@/lib/permissions";
import { getSupportSystemHealth, sendSupportSettingsTestEmail } from "@/lib/support-notification-preferences";

export async function POST() {
  try {
    const admin = await requireAdmin();
    const supportHealth = await getSupportSystemHealth();
    if (!supportHealth.ok) {
      return jsonError(`Support settings table missing: ${supportHealth.missingTables.join(", ")}`, 409);
    }

    const result = await sendSupportSettingsTestEmail(admin);

    if (!result.sent) {
      return jsonError("Email provider is not configured", 409);
    }

    return jsonOk({ sent: true, to: result.to });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return jsonError("Unauthorized", 401);
    if (error instanceof Error && error.message === "FORBIDDEN") return jsonError("Forbidden", 403);
    return jsonError("Failed to send support test email", 500);
  }
}
