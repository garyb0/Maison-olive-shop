export {};

const sendEmailMock = vi.fn();
const logApiEventMock = vi.fn();

vi.mock("@/lib/email", () => ({
  sendEmail: (...args: unknown[]) => sendEmailMock(...args),
}));

vi.mock("@/lib/observability", () => ({
  logApiEvent: (...args: unknown[]) => logApiEventMock(...args),
}));

describe("support email templates", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("SMTP_HOST", "smtp.example.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("utilise l'annee courante dans le pied de courriel", async () => {
    const { sendConversationClosedEmail } = await import("@/lib/support-email");
    const currentYear = new Date().getFullYear();

    await sendConversationClosedEmail({
      conversationId: "conv_1",
      customerEmail: "client@example.com",
      customerName: "Client Invite",
    });

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const payload = sendEmailMock.mock.calls[0]?.[0] as { html: string };
    expect(payload.html).toContain(`© ${currentYear} Chez Olive`);
    expect(payload.html).not.toContain("© 2024 Chez Olive");
  });
});
