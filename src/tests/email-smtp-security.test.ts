import net from "node:net";

export {};

describe("SMTP security helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SMTP_HOST", "127.0.0.1");
    vi.stubEnv("SMTP_USER", "smtp-user");
    vi.stubEnv("SMTP_PASS", "smtp-pass");
    vi.stubEnv("SMTP_FROM_EMAIL", "support@chezolive.ca");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejette les CRLF dans les headers SMTP", async () => {
    const { sendEmail } = await import("@/lib/email");

    await expect(sendEmail({
      to: "client@example.com",
      subject: "Bonjour\r\nBcc: attacker@example.com",
      html: "<p>Bonjour</p>",
    })).rejects.toThrow("SMTP_HEADER_INJECTION:subject");
  });

  it("encode les headers non ASCII et dot-stuffe le DATA", async () => {
    const { buildSmtpMessage, normalizeSmtpDataBody } = await import("@/lib/email");

    expect(normalizeSmtpDataBody("ligne 1\n.debut point")).toBe("ligne 1\r\n..debut point");

    const message = buildSmtpMessage({
      to: "client@example.com",
      subject: "Conversation assignée",
      text: "Bonjour\n.debut point",
    });

    expect(message).toContain("Subject: =?UTF-8?B?");
    expect(message).toContain("\r\n..debut point");
  });

  it("exige STARTTLS avant AUTH sur une connexion SMTP non TLS", async () => {
    const commands: string[] = [];
    const server = net.createServer((socket) => {
      socket.write("220 local.test ESMTP\r\n");
      let buffer = "";
      socket.on("data", (chunk) => {
        buffer += chunk.toString("utf8");
        let index = buffer.indexOf("\n");
        while (index >= 0) {
          const line = buffer.slice(0, index).replace(/\r$/, "");
          buffer = buffer.slice(index + 1);
          commands.push(line);
          if (line.startsWith("EHLO")) {
            socket.write("250-local.test\r\n250 AUTH LOGIN\r\n");
          }
          index = buffer.indexOf("\n");
        }
      });
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("SERVER_LISTEN_FAILED");
    vi.stubEnv("SMTP_PORT", String(address.port));

    const { sendEmail } = await import("@/lib/email");

    await expect(sendEmail({
      to: "client@example.com",
      subject: "Bonjour",
      html: "<p>Bonjour</p>",
    })).rejects.toThrow("SMTP_STARTTLS_REQUIRED");

    expect(commands.some((command) => command.startsWith("EHLO"))).toBe(true);
    expect(commands.some((command) => command.startsWith("AUTH"))).toBe(false);

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});
