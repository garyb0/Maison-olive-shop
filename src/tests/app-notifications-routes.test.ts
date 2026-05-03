export {};

const applyRateLimitMock = vi.fn();
const requireUserMock = vi.fn();
const getAppNotificationPreferencesMock = vi.fn();
const listAppNotificationsForUserMock = vi.fn();
const markAppNotificationsReadMock = vi.fn();
const registerWebPushSubscriptionForUserMock = vi.fn();
const unregisterWebPushSubscriptionForUserMock = vi.fn();
const updateAppNotificationPreferencesMock = vi.fn();

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: (...args: unknown[]) => applyRateLimitMock(...args),
}));

vi.mock("@/lib/permissions", () => ({
  requireUser: (...args: unknown[]) => requireUserMock(...args),
}));

vi.mock("@/lib/app-notifications", () => ({
  getAppNotificationPreferences: (...args: unknown[]) => getAppNotificationPreferencesMock(...args),
  listAppNotificationsForUser: (...args: unknown[]) => listAppNotificationsForUserMock(...args),
  markAppNotificationsRead: (...args: unknown[]) => markAppNotificationsReadMock(...args),
  registerWebPushSubscriptionForUser: (...args: unknown[]) => registerWebPushSubscriptionForUserMock(...args),
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
    registerWebPushSubscriptionForUserMock.mockResolvedValue({ id: "push_1", enabled: true });
    unregisterWebPushSubscriptionForUserMock.mockResolvedValue({ ok: true });
    getAppNotificationPreferencesMock.mockResolvedValue({ pushEnabled: false, orderUpdates: true });
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
});
