import {
  createAppNotification,
  getAppNotificationPreferences,
  isWebPushConfigured,
} from "@/lib/app-notifications";
import { jsonError, jsonOk } from "@/lib/http";
import { requireUser } from "@/lib/permissions";
import { applyRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const rate = await applyRateLimit(request, { namespace: "notifications:test", windowMs: 60_000, max: 6 });
  if (!rate.ok) return jsonError("Too many requests", 429);

  try {
    const user = await requireUser();
    const preferences = await getAppNotificationPreferences(user.id);
    const pushConfigured = isWebPushConfigured();
    const pushAttempted = Boolean(pushConfigured && preferences.pushEnabled);
    const notification = await createAppNotification({
      userId: user.id,
      audience: user.role === "ADMIN" ? "ADMIN" : "CUSTOMER",
      type: "SYSTEM",
      title: user.language === "fr" ? "Notification test" : "Test notification",
      body: user.language === "fr"
        ? "Ton centre d'actions Chez Olive fonctionne."
        : "Your Chez Olive action center is working.",
      href: "/app",
      metadata: { test: true },
    });

    return jsonOk({ notification, pushConfigured, pushAttempted });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return jsonError("Unauthorized", 401);
    return jsonError("Unable to create test notification", 500);
  }
}
