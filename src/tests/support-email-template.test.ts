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
    sendEmailMock.mockResolvedValue(undefined);
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

  it("echappe les champs client inseres dans le HTML", async () => {
    const { sendNewConversationEmail } = await import("@/lib/support-email");

    await sendNewConversationEmail({
      conversationId: "conv_1",
      customerEmail: `client"><img src=x onerror=alert(1)>@example.com`,
      customerName: `<script>alert("olive")</script>`,
      messageContent: `<b onclick="alert(1)">Besoin d'aide</b>`,
      adminEmails: ["admin@example.com"],
    });

    const payload = sendEmailMock.mock.calls[0]?.[0] as { html: string };
    expect(payload.html).toContain("&lt;script&gt;alert(&quot;olive&quot;)&lt;/script&gt;");
    expect(payload.html).toContain("&lt;b onclick=&quot;alert(1)&quot;&gt;Besoin d&#39;aide&lt;/b&gt;");
    expect(payload.html).not.toContain("<script>");
    expect(payload.html).not.toContain("<b onclick=");
    expect(payload.html).not.toContain("<img");
  });
});
