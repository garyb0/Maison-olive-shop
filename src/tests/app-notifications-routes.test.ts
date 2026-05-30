export {};

const applyRateLimitMock = vi.fn();
const requireUserMock = vi.fn();
const getAppNotificationPreferencesMock = vi.fn();
const createAppNotificationMock = vi.fn();
const isWebPushConfiguredMock = vi.fn();
const listAppNotificationsForUserMock = vi.fn();
const markAppNotificationsReadMock = vi.fn();
const registerNativePushTokenForUserMock = vi.fn();
const registerWebPushSubscriptionForUserMock = vi.fn();
const unregisterNativePushTokenForUserMock = vi.fn();
const unregisterWebPushSubscriptionForUserMock = vi.fn();
const updateAppNotificationPreferencesMock = vi.fn();

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: (...args: unknown[]) => applyRateLimitMock(...args),
}));

vi.mock("@/lib/permissions", () => ({
  requireUser: (...args: unknown[]) => requireUserMock(...args),
}));

vi.mock("@/lib/app-notifications", () => ({
  createAppNotification: (...args: unknown[]) => createAppNotificationMock(...args),
  getAppNotificationPreferences: (...args: unknown[]) => getAppNotificationPreferencesMock(...args),
  isWebPushConfigured: (...args: unknown[]) => isWebPushConfiguredMock(...args),
  listAppNotificationsForUser: (...args: unknown[]) => listAppNotificationsForUserMock(...args),
  markAppNotificationsRead: (...args: unknown[]) => markAppNotificationsReadMock(...args),
  registerNativePushTokenForUser: (...args: unknown[]) => registerNativePushTokenForUserMock(...args),
  registerWebPushSubscriptionForUser: (...args: unknown[]) => registerWebPushSubscriptionForUserMock(...args),
  unregisterNativePushTokenForUser: (...args: unknown[]) => unregisterNativePushTokenForUserMock(...args),
  unregisterWebPushSubscriptionForUser: (...args: unknown[]) => unregisterWebPushSubscriptionForUserMock(...args),
  updateAppNotificationPreferences: (...args: unknown[]) => updateAppNotificationPreferencesMock(...args),
}));

const user = {
  id: "user_1",
  email: "client@chezolive.ca",
  firstName: "Client",
  lastName: "Smoke",
  role: "CUSTOMER",
  language: "fr",
};

const validSubscription = {
  endpoint: "https://push.example.test/subscription/123",
  keys: {
    p256dh: "abcdefghijklmnopqrstuvwxyz123456",
    auth: "auth-token-123",
  },
};

describe("notification and push routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    applyRateLimitMock.mockResolvedValue({ ok: true, remaining: 10, retryAfterSeconds: 0 });
    requireUserMock.mockResolvedValue(user);
    registerNativePushTokenForUserMock.mockResolvedValue({
      id: "native_1",
      platform: "ANDROID",
      enabled: true,
      nativePushAvailable: true,
    });
    registerWebPushSubscriptionForUserMock.mockResolvedValue({ id: "push_1", enabled: true });
    unregisterNativePushTokenForUserMock.mockResolvedValue({ ok: true });
    unregisterWebPushSubscriptionForUserMock.mockResolvedValue({ ok: true });
    getAppNotificationPreferencesMock.mockResolvedValue({ pushEnabled: false, orderUpdates: true });
    createAppNotificationMock.mockResolvedValue({
      id: "notif_test",
      type: "SYSTEM",
      audience: "CUSTOMER",
      title: "Notification test",
      body: "Ton centre d'actions Chez Olive fonctionne.",
      href: "/app",
      readAt: null,
      createdAt: "2026-05-03T16:00:00.000Z",
    });
    isWebPushConfiguredMock.mockReturnValue(true);
    updateAppNotificationPreferencesMock.mockResolvedValue({ pushEnabled: true, orderUpdates: true });
    listAppNotificationsForUserMock.mockResolvedValue({
      notifications: [{ id: "notif_1", title: "Commande", readAt: null }],
      unreadCount: 1,
    });
    markAppNotificationsReadMock.mockResolvedValue({ notifications: [], unreadCount: 0 });
  });

  it("refuse l'abonnement push sans session", async () => {
    requireUserMock.mockRejectedValueOnce(new Error("UNAUTHORIZED"));
    const { POST } = await import("@/app/api/push/subscribe/route");

    const response = await POST(
      new Request("http://localhost:3101/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(validSubscription),
      }),
    );

    expect(response.status).toBe(401);
    expect(registerWebPushSubscriptionForUserMock).not.toHaveBeenCalled();
  });

  it("accepte un abonnement push valide et active la preference", async () => {
    const { POST } = await import("@/app/api/push/subscribe/route");

    const response = await POST(
      new Request("http://localhost:3101/api/push/subscribe", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "Playwright Mobile",
        },
        body: JSON.stringify(validSubscription),
      }),
    );
    const payload = (await response.json()) as { ok?: boolean };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(registerWebPushSubscriptionForUserMock).toHaveBeenCalledWith(
      user,
      validSubscription,
      "Playwright Mobile",
    );
  });

  it("rejette un payload push invalide", async () => {
    const { POST } = await import("@/app/api/push/subscribe/route");

    const response = await POST(
      new Request("http://localhost:3101/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: "not-a-url", keys: { p256dh: "short", auth: "x" } }),
      }),
    );

    expect(response.status).toBe(400);
    expect(registerWebPushSubscriptionForUserMock).not.toHaveBeenCalled();
  });

  it("met a jour les preferences de notifications", async () => {
    const { PATCH } = await import("@/app/api/notifications/preferences/route");

    const response = await PATCH(
      new Request("http://localhost:3101/api/notifications/preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ supportUpdates: false, dogQrUpdates: true }),
      }),
    );
    const payload = (await response.json()) as { preferences?: { pushEnabled?: boolean } };

    expect(response.status).toBe(200);
    expect(payload.preferences?.pushEnabled).toBe(true);
    expect(updateAppNotificationPreferencesMock).toHaveBeenCalledWith("user_1", {
      supportUpdates: false,
      dogQrUpdates: true,
    });
  });

  it("marque les notifications lues pour l'utilisateur courant", async () => {
    const { PATCH } = await import("@/app/api/notifications/route");

    const response = await PATCH(
      new Request("http://localhost:3101/api/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ all: true, read: true }),
      }),
    );
    const payload = (await response.json()) as { unreadCount?: number };

    expect(response.status).toBe(200);
    expect(payload.unreadCount).toBe(0);
    expect(markAppNotificationsReadMock).toHaveBeenCalledWith(user, { all: true, read: true });
  });

  it("cree une notification test protegee pour l'utilisateur courant", async () => {
    getAppNotificationPreferencesMock.mockResolvedValueOnce({ pushEnabled: true });
    const { POST } = await import("@/app/api/notifications/test/route");

    const response = await POST(
      new Request("http://localhost:3101/api/notifications/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
      }),
    );
    const payload = (await response.json()) as {
      notification?: { id?: string };
      pushConfigured?: boolean;
      pushAttempted?: boolean;
    };

    expect(response.status).toBe(200);
    expect(payload.notification?.id).toBe("notif_test");
    expect(payload.pushConfigured).toBe(true);
    expect(payload.pushAttempted).toBe(true);
    expect(createAppNotificationMock).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user_1",
      audience: "CUSTOMER",
      type: "SYSTEM",
      href: "/app",
      metadata: { test: true },
    }));
  });

  it("enregistre un token FCM Android pour l'app native", async () => {
    const { POST } = await import("@/app/api/notifications/native-push/route");
    const tokenValue = "fcm-token-android-1234567890";

    const response = await POST(
      new Request("http://localhost:3101/api/notifications/native-push", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: tokenValue, platform: "ANDROID" }),
      }),
    );
    const payload = (await response.json()) as { ok?: boolean; token?: { id?: string } };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.token?.id).toBe("native_1");
    expect(registerNativePushTokenForUserMock).toHaveBeenCalledWith(user, {
      token: tokenValue,
      platform: "ANDROID",
    });
  });

  it("refuse un token FCM Android invalide", async () => {
    const { POST } = await import("@/app/api/notifications/native-push/route");

    const response = await POST(
      new Request("http://localhost:3101/api/notifications/native-push", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: "short", platform: "ANDROID" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(registerNativePushTokenForUserMock).not.toHaveBeenCalled();
  });

  it("desactive un token FCM Android pour l'utilisateur courant", async () => {
    const { DELETE } = await import("@/app/api/notifications/native-push/route");
    const tokenValue = "fcm-token-android-1234567890";

    const response = await DELETE(
      new Request("http://localhost:3101/api/notifications/native-push", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: tokenValue }),
      }),
    );

    expect(response.status).toBe(200);
    expect(unregisterNativePushTokenForUserMock).toHaveBeenCalledWith("user_1", tokenValue);
  });
});
