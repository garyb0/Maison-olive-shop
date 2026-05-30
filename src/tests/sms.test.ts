export {};

const envMock = vi.hoisted(() => ({
  smsNotificationsEnabled: true,
  smsDryRun: true,
  twilioAccountSid: "AC123",
  twilioAuthToken: "token",
  twilioMessagingServiceSid: "MG123",
  siteUrl: "https://chezolive.ca",
}));

const prismaMock = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  order: {
    findUnique: vi.fn(),
  },
  smsRecipientPreference: {
    upsert: vi.fn(),
    updateMany: vi.fn(),
  },
  smsNotificationLog: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  },
  smsInboundMessage: {
    upsert: vi.fn(),
  },
}));

const messagesCreateMock = vi.hoisted(() => vi.fn());
const validateRequestMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/env", () => ({ env: envMock }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/observability", () => ({ logApiEvent: vi.fn() }));
vi.mock("twilio", () => ({
  default: vi.fn(() => ({ messages: { create: (...args: unknown[]) => messagesCreateMock(...args) } })),
  validateRequest: (...args: unknown[]) => validateRequestMock(...args),
}));

describe("SMS Twilio helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    envMock.smsNotificationsEnabled = true;
    envMock.smsDryRun = true;
    envMock.twilioAccountSid = "AC123";
    envMock.twilioAuthToken = "token";
    envMock.twilioMessagingServiceSid = "MG123";
    prismaMock.smsRecipientPreference.upsert.mockResolvedValue({ id: "pref_1" });
    prismaMock.$queryRaw.mockResolvedValue([
      { name: "SmsRecipientPreference" },
      { name: "SmsNotificationLog" },
      { name: "SmsInboundMessage" },
    ]);
  });

  it("normalise les numeros CA/US en E.164", async () => {
    const { normalizeSmsPhoneToE164 } = await import("@/lib/sms");

    expect(normalizeSmsPhoneToE164("418 555-1234")).toBe("+14185551234");
    expect(normalizeSmsPhoneToE164("+1 (418) 555-1234")).toBe("+14185551234");
    expect(normalizeSmsPhoneToE164("011 33 1 23 45 67 89")).toBeNull();
  });

  it("cree une preference seulement avec opt-in explicite", async () => {
    const { createOrderSmsPreference } = await import("@/lib/sms");

    await createOrderSmsPreference({
      orderId: "order_1",
      userId: "user_1",
      phone: "4185551234",
      language: "fr",
      optedIn: false,
      source: "checkout",
    });
    expect(prismaMock.smsRecipientPreference.upsert).not.toHaveBeenCalled();

    await createOrderSmsPreference({
      orderId: "order_1",
      userId: "user_1",
      phone: "4185551234",
      language: "fr",
      optedIn: true,
      source: "checkout",
    });

    expect(prismaMock.smsRecipientPreference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderId_phoneE164: { orderId: "order_1", phoneE164: "+14185551234" } },
        create: expect.objectContaining({ optedIn: true, optedOut: false, optInSource: "checkout" }),
      }),
    );
  });

  it("journalise un dry-run sans appeler Twilio", async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      id: "order_1",
      orderNumber: "MO-1",
      userId: "user_1",
      customerName: "Gary",
      deliveryPhone: "4185551234",
      deliveryWindowStartAt: null,
      deliveryWindowEndAt: null,
      smsRecipientPreferences: [
        { id: "pref_1", phoneE164: "+14185551234", language: "fr", optedOut: false },
      ],
    });
    prismaMock.smsNotificationLog.findUnique.mockResolvedValue(null);
    prismaMock.smsNotificationLog.create.mockResolvedValue({ id: "log_1" });

    const { sendOrderSmsNotification } = await import("@/lib/sms");
    const result = await sendOrderSmsNotification({ orderId: "order_1", type: "ORDER_PAID" });

    expect(result).toEqual({ sent: false, reason: "DRY_RUN", logId: "log_1" });
    expect(messagesCreateMock).not.toHaveBeenCalled();
    expect(prismaMock.smsNotificationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventKey: "order:order_1:ORDER_PAID",
          status: "DRY_RUN",
          dryRun: true,
        }),
      }),
    );
  });

  it("met a jour le statut depuis un callback Twilio", async () => {
    const { recordSmsStatusCallback } = await import("@/lib/sms");

    await recordSmsStatusCallback({
      MessageSid: "SM123",
      MessageStatus: "delivered",
      To: "+14185551234",
      AccountSid: "AC123",
      MessagingServiceSid: "MG123",
    });

    expect(prismaMock.smsNotificationLog.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { twilioMessageSid: "SM123" },
        update: expect.objectContaining({ status: "DELIVERED" }),
      }),
    );
  });

  it("capture STOP entrant et marque le numero opt-out", async () => {
    const { recordInboundSms } = await import("@/lib/sms");

    await recordInboundSms({
      MessageSid: "SMIN123",
      From: "+14185551234",
      To: "+14185550000",
      Body: "STOP",
    });

    expect(prismaMock.smsInboundMessage.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ optOutType: "STOP" }),
      }),
    );
    expect(prismaMock.smsRecipientPreference.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { phoneE164: "+14185551234" },
        data: expect.objectContaining({ optedOut: true }),
      }),
    );
  });
});
