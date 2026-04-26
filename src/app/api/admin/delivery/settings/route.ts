import { jsonError, jsonOk } from "@/lib/http";
import { logApiEvent } from "@/lib/observability";
import { requireAdmin } from "@/lib/permissions";
import {
  getActiveDeliveryDriverCount,
  getDeliveryScheduleSettings,
  updateDeliveryScheduleSettings,
} from "@/lib/delivery";
import { adminDeliveryScheduleSettingsSchema } from "@/lib/validators";

export async function GET() {
  try {
    await requireAdmin();

    const [settings, activeDriverCount] = await Promise.all([
      getDeliveryScheduleSettings(),
      getActiveDeliveryDriverCount(),
    ]);

    return jsonOk({ settings, activeDriverCount });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return jsonError("Forbidden", 403);
    }
    return jsonError("Forbidden", 403);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => null);
    const parsed = adminDeliveryScheduleSettingsSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("Invalid delivery schedule settings", 400);
    }

    const settings = await updateDeliveryScheduleSettings(parsed.data);
    const activeDriverCount = await getActiveDeliveryDriverCount();

    return jsonOk({ settings, activeDriverCount });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return jsonError("Forbidden", 403);
    }
    if (error instanceof Error && error.message === "DELIVERY_SCHEMA_UNAVAILABLE") {
      return jsonError("Schema livraison non initialise. Execute la migration Prisma.", 503);
    }

    logApiEvent({
      level: "ERROR",
      route: "/api/admin/delivery/settings",
      event: "ADMIN_DELIVERY_SETTINGS_PATCH_FAILED",
      status: 500,
      details: { error },
    });
    return jsonError("Failed to update delivery schedule settings", 500);
  }
}
