import { jsonError, jsonOk } from "@/lib/http";
import { requireAdmin } from "@/lib/permissions";
import {
  getSupportAdminUiSettings,
  getSupportNotificationPreferences,
  getSupportSystemHealth,
  hasSupportEmailProviderConfigured,
  parseSupportAdminUiSettingsInput,
  parseSupportNotificationPreferencesInput,
  updateSupportAdminUiSettings,
  updateSupportNotificationPreferences,
} from "@/lib/support-notification-preferences";

function mapAdminSettingsError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message === "UNAUTHORIZED") return jsonError("Unauthorized", 401);
  if (error instanceof Error && error.message === "FORBIDDEN") return jsonError("Forbidden", 403);
  return jsonError(fallback, 500);
}

export async function GET() {
  try {
    const admin = await requireAdmin();
    const [preferences, uiSettings, supportHealth] = await Promise.all([
      getSupportNotificationPreferences(admin.id),
      getSupportAdminUiSettings(admin),
      getSupportSystemHealth(),
    ]);
    return jsonOk({
      preferences,
      uiSettings,
      supportHealth,
      emailProviderConfigured: supportHealth.ok && hasSupportEmailProviderConfigured(),
    });
  } catch (error) {
    return mapAdminSettingsError(error, "Failed to load support notification settings");
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = await request.json().catch(() => null);
    const supportHealth = await getSupportSystemHealth();
    if (!supportHealth.ok) {
      return jsonError(`Support settings table missing: ${supportHealth.missingTables.join(", ")}`, 409);
    }

    const parsedPreferences = parseSupportNotificationPreferencesInput(body);
    const parsedUiSettings = parseSupportAdminUiSettingsInput(body);
    if (!parsedPreferences && !parsedUiSettings) {
      return jsonError("Invalid support notification settings payload", 400);
    }

    const [preferences, uiSettings] = await Promise.all([
      parsedPreferences
        ? updateSupportNotificationPreferences(admin.id, parsedPreferences)
        : getSupportNotificationPreferences(admin.id),
      parsedUiSettings
        ? updateSupportAdminUiSettings(admin, parsedUiSettings)
        : getSupportAdminUiSettings(admin),
    ]);
    return jsonOk({
      preferences,
      uiSettings,
      supportHealth,
      emailProviderConfigured: supportHealth.ok && hasSupportEmailProviderConfigured(),
    });
  } catch (error) {
    return mapAdminSettingsError(error, "Failed to save support notification settings");
  }
}
