export {};

const sendNotificationMock = vi.fn();

const prismaMock = {
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
  appNotification: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  notificationPreference: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  nativePushToken: {
    upsert: vi.fn(),
  },
  webPushSubscription: {
    findMany: vi.fn(),
    count: vi.fn(),
    updateMany: vi.fn(),
  },
};

vi.mock("web-push", () => ({
  sendNotification: (...args: unknown[]) => sendNotificationMock(...args),
}));

vi.mock("@/lib/env", () => ({
  env: {
    webPushPublicKey: "public-key",
    webPushPrivateKey: "private-key",
    webPushSubject: "mailto:support@chezolive.ca",
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

describe("app notifications", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    prismaMock.$queryRaw.mockResolvedValue([
      { name: "WebPushSubscription" },
      { name: "NotificationPreference" },
      { name: "AppNotification" },
      { name: "NativePushToken" },
    ]);
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) =>
      callback(prismaMock),
    );
    prismaMock.appNotification.create.mockResolvedValue({
      id: "notif_1",
      type: "ORDER_UPDATE",
      audience: "CUSTOMER",
      title: "Commande creee",
      body: "Ta commande est bien enregistree.",
      href: null,
      readAt: null,
      createdAt: new Date("2026-05-03T12:00:00.000Z"),
    });
    prismaMock.notificationPreference.findUnique.mockResolvedValue({
      pushEnabled: true,
      orderUpdates: true,
      deliveryUpdates: true,
      supportUpdates: true,
      dogQrUpdates: true,
      adminAlerts: true,
      driverRunUpdates: true,
    });
    prismaMock.notificationPreference.upsert.mockResolvedValue({
      pushEnabled: true,
      orderUpdates: true,
      deliveryUpdates: true,
      supportUpdates: true,
      dogQrUpdates: true,
      adminAlerts: true,
      driverRunUpdates: true,
    });
    prismaMock.nativePushToken.upsert.mockResolvedValue({
      id: "native_1",
      platform: "ANDROID",
      enabled: true,
    });
    prismaMock.webPushSubscription.findMany.mockResolvedValue([
      {
        id: "push_1",
        endpointHash: "hash_1",
        endpoint: "https://push.example.test/sub/1",
        p256dh: "p256dh-key",
        auth: "auth-key",
        userId: "user_1",
      },
    ]);
    prismaMock.webPushSubscription.count.mockResolvedValue(0);
    sendNotificationMock.mockResolvedValue(undefined);
  });

  it("garde les payloads push minimaux et rejette les liens externes", async () => {
    const { createAppNotification } = await import("@/lib/app-notifications");

    await createAppNotification({
      userId: "user_1",
      audience: "CUSTOMER",
      type: "ORDER_UPDATE",
      title: "Commande creee",
      body: "Ta commande est bien enregistree.",
      href: "https://evil.example.test/account/orders/order_1?address=secret",
      metadata: { orderId: "order_1" },
    });

    expect(prismaMock.appNotification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          href: null,
          metadataJson: JSON.stringify({ orderId: "order_1" }),
        }),
      }),
    );
    expect(sendNotificationMock).toHaveBeenCalledTimes(1);

    const payload = JSON.parse(sendNotificationMock.mock.calls[0][1] as string) as Record<string, unknown>;
    expect(payload).toEqual({
      type: "ORDER_UPDATE",
      title: "Commande creee",
      body: "Ta commande est bien enregistree.",
      href: "/app",
    });
    expect(payload).not.toHaveProperty("metadata");
  });

  it("deduplique les notifications QR chien recentes", async () => {
    prismaMock.appNotification.findFirst.mockResolvedValueOnce({ id: "notif_existing" });
    const { createDogQrScanNotification } = await import("@/lib/app-notifications");

    const notification = await createDogQrScanNotification({
      userId: "user_1",
      dogId: "dog_1",
      dogName: "Kratos",
    });

    expect(notification).toBeNull();
    expect(prismaMock.appNotification.create).not.toHaveBeenCalled();
  });

  it("resume les notifications admin recentes et les abonnements push invalides", async () => {
    prismaMock.appNotification.findMany.mockResolvedValueOnce([
      {
        id: "notif_admin_1",
        type: "ADMIN_ORDER",
        audience: "ADMIN",
        title: "Nouvelle commande",
        body: "Commande recue.",
        href: "/admin/orders/order_1",
        readAt: null,
        createdAt: new Date("2026-05-03T13:00:00.000Z"),
      },
    ]);
    prismaMock.appNotification.count.mockResolvedValueOnce(1);
    prismaMock.webPushSubscription.count.mockResolvedValueOnce(2);
    const { getAdminNotificationOpsSnapshot } = await import("@/lib/app-notifications");

    const snapshot = await getAdminNotificationOpsSnapshot();

    expect(snapshot.unreadCount).toBe(1);
    expect(snapshot.disabledPushSubscriptionCount).toBe(2);
    expect(snapshot.recent[0]).toEqual(
      expect.objectContaining({
        id: "notif_admin_1",
        type: "ADMIN_ORDER",
        href: "/admin/orders/order_1",
      }),
    );
  });

  it("enregistre un token natif Android separe du Web Push", async () => {
    const { registerNativePushTokenForUser } = await import("@/lib/app-notifications");

    const result = await registerNativePushTokenForUser(
      {
        id: "user_1",
        email: "client@chezolive.ca",
        firstName: "Client",
        lastName: "Olive",
        role: "CUSTOMER",
        language: "fr",
      },
      { token: "fcm-token-android-1234567890", platform: "ANDROID" },
    );

    expect(result).toEqual({
      id: "native_1",
      platform: "ANDROID",
      enabled: true,
      nativePushAvailable: false,
    });
    expect(prismaMock.nativePushToken.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        userId: "user_1",
        platform: "ANDROID",
        enabled: true,
      }),
      update: expect.objectContaining({
        userId: "user_1",
        platform: "ANDROID",
        enabled: true,
      }),
    }));
  });
});
