export {};

describe("Web Push endpoint validation", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepte les hosts push publics connus", async () => {
    const { validateWebPushEndpoint } = await import("@/lib/app-notifications");

    expect(validateWebPushEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(validateWebPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/abc")).toBe(true);
    expect(validateWebPushEndpoint("https://web.push.apple.com/Q/example")).toBe(true);
  });

  it("refuse les endpoints privés ou non HTTPS", async () => {
    const { validateWebPushEndpoint } = await import("@/lib/app-notifications");

    expect(validateWebPushEndpoint("http://fcm.googleapis.com/fcm/send/abc")).toBe(false);
    expect(validateWebPushEndpoint("https://localhost/push")).toBe(false);
    expect(validateWebPushEndpoint("https://127.0.0.1/push")).toBe(false);
    expect(validateWebPushEndpoint("https://10.0.0.5/push")).toBe(false);
    expect(validateWebPushEndpoint("https://169.254.169.254/latest/meta-data")).toBe(false);
    expect(validateWebPushEndpoint("https://[::1]/push")).toBe(false);
  });

  it("autorise un host custom seulement via WEB_PUSH_ALLOWED_HOSTS", async () => {
    vi.stubEnv("WEB_PUSH_ALLOWED_HOSTS", "push.example.test");
    const { validateWebPushEndpoint } = await import("@/lib/app-notifications");

    expect(validateWebPushEndpoint("https://push.example.test/subscription/abc")).toBe(true);
    expect(validateWebPushEndpoint("https://not-allowed.example.test/subscription/abc")).toBe(false);
  });
});
