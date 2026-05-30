export {};

const validateTwilioRequestMock = vi.fn();
const recordSmsStatusCallbackMock = vi.fn();
const recordInboundSmsMock = vi.fn();

vi.mock("@/lib/sms", () => ({
  formDataToTwilioParams: (formData: FormData) => Object.fromEntries(formData.entries()),
  validateTwilioRequest: (...args: unknown[]) => validateTwilioRequestMock(...args),
  recordSmsStatusCallback: (...args: unknown[]) => recordSmsStatusCallbackMock(...args),
  recordInboundSms: (...args: unknown[]) => recordInboundSmsMock(...args),
}));

vi.mock("@/lib/observability", () => ({
  logApiEvent: vi.fn(),
}));

describe("Twilio SMS routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("refuse un status callback sans signature valide", async () => {
    validateTwilioRequestMock.mockReturnValue(false);
    const { POST } = await import("@/app/api/twilio/message-status/route");

    const res = await POST(
      new Request("https://chezolive.ca/api/twilio/message-status", {
        method: "POST",
        body: new URLSearchParams({ MessageSid: "SM123", MessageStatus: "delivered" }),
      }),
    );

    expect(res.status).toBe(403);
    expect(recordSmsStatusCallbackMock).not.toHaveBeenCalled();
  });

  it("accepte un status callback valide", async () => {
    validateTwilioRequestMock.mockReturnValue(true);
    recordSmsStatusCallbackMock.mockResolvedValue(undefined);
    const { POST } = await import("@/app/api/twilio/message-status/route");

    const res = await POST(
      new Request("https://chezolive.ca/api/twilio/message-status", {
        method: "POST",
        body: new URLSearchParams({ MessageSid: "SM123", MessageStatus: "delivered" }),
      }),
    );

    expect(res.status).toBe(204);
    expect(recordSmsStatusCallbackMock).toHaveBeenCalledWith(
      expect.objectContaining({ MessageSid: "SM123", MessageStatus: "delivered" }),
    );
  });

  it("capture un SMS entrant valide et repond en TwiML vide", async () => {
    validateTwilioRequestMock.mockReturnValue(true);
    recordInboundSmsMock.mockResolvedValue({ optOutType: "STOP" });
    const { POST } = await import("@/app/api/twilio/inbound/route");

    const res = await POST(
      new Request("https://chezolive.ca/api/twilio/inbound", {
        method: "POST",
        body: new URLSearchParams({ MessageSid: "SMIN123", From: "+14185551234", Body: "STOP" }),
      }),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/xml");
    expect(await res.text()).toBe("<Response></Response>");
    expect(recordInboundSmsMock).toHaveBeenCalledWith(
      expect.objectContaining({ MessageSid: "SMIN123", From: "+14185551234", Body: "STOP" }),
    );
  });
});
