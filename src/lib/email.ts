import { env } from "@/lib/env";
import { logApiEvent } from "@/lib/observability";
import net from "node:net";
import tls from "node:tls";

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

function logEmailDebug(event: string, details?: Record<string, unknown>) {
  if (env.nodeEnv === "production") return;

  logApiEvent({
    level: "INFO",
    route: "lib/email",
    event,
    details,
  });
}

// ── SMS Notification via Email-to-SMS ─────────────────────────────────────────

/**
 * Sends an SMS notification via Email-to-SMS gateway using SMTP.
 * This is a free method that converts email to SMS through carrier gateways.
 */
export async function sendSmsNotification(message: string): Promise<void> {
  logEmailDebug("SMS_NOTIFICATION_ATTEMPT", {
    hasAdminSmsEmail: Boolean(env.adminSmsEmail),
    hasSmtpHost: Boolean(env.smtpHost),
  });

  if (!env.adminSmsEmail) {
    logEmailDebug("SMS_NOTIFICATION_SKIPPED_NO_DESTINATION");
    return;
  }

  // For SMS, we need a simple text-only approach (max 160 chars for SMS)
  const smsContent = message.slice(0, 160);
  logEmailDebug("SMS_NOTIFICATION_PREPARED", { preview: smsContent });

  try {
    // Use SMTP if configured
    if (env.smtpHost && env.smtpUser && env.smtpPass) {
      logEmailDebug("SMS_NOTIFICATION_SENDING_SMTP", { to: env.adminSmsEmail });
      await sendSmtpEmail({
        to: env.adminSmsEmail,
        subject: "", // Empty subject for SMS
        text: smsContent,
      });
      logApiEvent({
        level: "INFO",
        route: "lib/email",
        event: "SMS_NOTIFICATION_SENT_SMTP",
        details: { to: env.adminSmsEmail },
      });
    } else if (env.resendApiKey) {
      // Fallback to Resend API
      logEmailDebug("SMS_NOTIFICATION_SENDING_RESEND", { to: env.adminSmsEmail });
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.resendApiKey}`,
        },
        body: JSON.stringify({
          from: env.resendFromEmail,
          to: [env.adminSmsEmail],
          subject: "",
          text: smsContent,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "(no body)");
        logApiEvent({
          level: "WARN",
          route: "lib/email",
          event: "SMS_NOTIFICATION_RESEND_FAILED",
          status: res.status,
          details: { to: env.adminSmsEmail, body },
        });
      } else {
        logApiEvent({
          level: "INFO",
          route: "lib/email",
          event: "SMS_NOTIFICATION_SENT_RESEND",
          status: res.status,
          details: { to: env.adminSmsEmail },
        });
      }
    } else {
      logApiEvent({
        level: "WARN",
        route: "lib/email",
        event: "SMS_NOTIFICATION_SKIPPED_NO_PROVIDER",
        details: { to: env.adminSmsEmail },
      });
    }
  } catch (error) {
    logApiEvent({
      level: "WARN",
      route: "lib/email",
      event: "SMS_NOTIFICATION_FAILED",
      details: { to: env.adminSmsEmail, error },
    });
  }
}

/**
 * Sends an email via SMTP using raw socket connection.
 * Simple implementation without external dependencies.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function assertSafeSmtpHeader(name: string, value: string) {
  if (/[\r\n]/.test(value)) {
    throw new Error(`SMTP_HEADER_INJECTION:${name}`);
  }
}

function encodeSmtpHeader(name: string, value: string) {
  assertSafeSmtpHeader(name, value);
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

export function normalizeSmtpDataBody(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => (line.startsWith(".") ? `.${line}` : line))
    .join("\r\n");
}

function smtpEhloHost() {
  try {
    return new URL(env.siteUrl).hostname || "chezolive.local";
  } catch {
    return "chezolive.local";
  }
}

export function buildSmtpMessage(input: { to: string; subject: string; text: string }) {
  const from = env.smtpFromEmail || env.businessSupportEmail;
  assertSafeSmtpHeader("from", from);
  assertSafeSmtpHeader("to", input.to);

  return [
    `From: ${encodeSmtpHeader("from", from)}`,
    `To: ${encodeSmtpHeader("to", input.to)}`,
    `Subject: ${encodeSmtpHeader("subject", input.subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    normalizeSmtpDataBody(input.text),
  ].join("\r\n");
}

type SmtpResponse = {
  code: number;
  text: string;
};

async function sendSmtpEmail(input: { to: string; subject: string; text: string }): Promise<void> {
  const host = env.smtpHost;
  const port = env.smtpPort || (env.smtpSecure ? 465 : 587);
  const rejectUnauthorized = env.nodeEnv === "production";
  const from = env.smtpFromEmail || env.businessSupportEmail;
  assertSafeSmtpHeader("from", from);
  assertSafeSmtpHeader("to", input.to);
  assertSafeSmtpHeader("subject", input.subject);

  logEmailDebug("SMTP_CONNECTING", { host, port, secure: env.smtpSecure, to: input.to });

  let socket: net.Socket | tls.TLSSocket | null = null;
  let buffer = "";
  let currentLines: string[] = [];
  const queuedResponses: SmtpResponse[] = [];
  let pending:
    | {
        resolve: (response: SmtpResponse) => void;
        reject: (error: Error) => void;
      }
    | null = null;

  const parseResponse = (data: Buffer) => {
    buffer += data.toString("utf8");
    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).replace(/\r$/, "");
      buffer = buffer.slice(newlineIndex + 1);
      currentLines.push(line);

      const finalLine = /^\d{3} /.test(line);
      if (finalLine) {
        const responseText = currentLines.join("\n");
        const code = Number.parseInt(line.slice(0, 3), 10);
        const response = { code, text: responseText };
        currentLines = [];
        logEmailDebug("SMTP_RESPONSE_RECEIVED", { code, text: responseText });

        if (pending) {
          pending.resolve(response);
          pending = null;
        } else {
          queuedResponses.push(response);
        }
      }
      newlineIndex = buffer.indexOf("\n");
    }
  };

  const onSocketError = (error: Error) => {
    if (pending) {
      pending.reject(error);
      pending = null;
    }
  };

  const attachSocket = (nextSocket: net.Socket | tls.TLSSocket) => {
    socket = nextSocket;
    nextSocket.setTimeout(30_000, () => nextSocket.destroy(new Error("SMTP_TIMEOUT")));
    nextSocket.on("data", parseResponse);
    nextSocket.on("error", onSocketError);
  };

  const readResponse = () =>
    new Promise<SmtpResponse>((resolve, reject) => {
      const queued = queuedResponses.shift();
      if (queued) {
        resolve(queued);
        return;
      }
      pending = { resolve, reject };
    });

  const expectCode = (response: SmtpResponse, expected: number | number[], command: string) => {
    const expectedCodes = Array.isArray(expected) ? expected : [expected];
    if (!expectedCodes.includes(response.code)) {
      throw new Error(`SMTP_COMMAND_FAILED:${command}:${response.code}`);
    }
    return response;
  };

  const writeLine = (line: string) => {
    if (!socket) throw new Error("SMTP_SOCKET_NOT_CONNECTED");
    socket.write(`${line}\r\n`);
  };

  const command = async (line: string, expected: number | number[]) => {
    writeLine(line);
    return expectCode(await readResponse(), expected, line.split(" ")[0] ?? line);
  };

  const connectPlain = () =>
    new Promise<net.Socket>((resolve, reject) => {
      const plain = net.createConnection({ host, port });
      plain.once("connect", () => resolve(plain));
      plain.once("error", reject);
      attachSocket(plain);
    });

  const connectTls = (baseSocket?: net.Socket) =>
    new Promise<tls.TLSSocket>((resolve, reject) => {
      const secureSocket = tls.connect({
        host: baseSocket ? undefined : host,
        port: baseSocket ? undefined : port,
        socket: baseSocket,
        servername: host,
        rejectUnauthorized,
      });
      secureSocket.once("secureConnect", () => resolve(secureSocket));
      secureSocket.once("error", reject);
      attachSocket(secureSocket);
    });

  try {
    await (env.smtpSecure ? connectTls() : connectPlain());
    expectCode(await readResponse(), 220, "CONNECT");

    let ehlo = await command(`EHLO ${smtpEhloHost()}`, 250);

    if (!env.smtpSecure) {
      const supportsStartTls = /^250[ -]STARTTLS\b/im.test(ehlo.text);
      if (!supportsStartTls) {
        throw new Error("SMTP_STARTTLS_REQUIRED");
      }

      await command("STARTTLS", 220);
      if (!socket) throw new Error("SMTP_SOCKET_NOT_CONNECTED");
      const oldSocket = socket as net.Socket;
      oldSocket.removeListener("data", parseResponse);
      oldSocket.removeListener("error", onSocketError);
      buffer = "";
      currentLines = [];
      queuedResponses.length = 0;
      await connectTls(oldSocket);
      ehlo = await command(`EHLO ${smtpEhloHost()}`, 250);
    }

    if (!/^250[ -]AUTH\b/im.test(ehlo.text)) {
      throw new Error("SMTP_AUTH_UNAVAILABLE");
    }

    await command("AUTH LOGIN", 334);
    await command(Buffer.from(env.smtpUser || "", "utf8").toString("base64"), 334);
    await command(Buffer.from(env.smtpPass || "", "utf8").toString("base64"), 235);
    await command(`MAIL FROM:<${from}>`, 250);
    await command(`RCPT TO:<${input.to}>`, [250, 251]);
    await command("DATA", 354);

    if (!socket) throw new Error("SMTP_SOCKET_NOT_CONNECTED");
    (socket as net.Socket | tls.TLSSocket).write(`${buildSmtpMessage(input)}\r\n.\r\n`);
    expectCode(await readResponse(), 250, "DATA_BODY");

    logApiEvent({
      level: "INFO",
      route: "lib/email",
      event: "SMTP_EMAIL_SENT",
      details: { to: input.to },
    });

    writeLine("QUIT");
    await readResponse().catch(() => undefined);
  } catch (error) {
    logApiEvent({
      level: "WARN",
      route: "lib/email",
      event: "SMTP_ERROR",
      details: { to: input.to, error },
    });
    throw error;
  } finally {
    (socket as net.Socket | tls.TLSSocket | null)?.end();
  }
}

/**
 * Sends a transactional email via the Resend REST API.
 * Falls back gracefully (logs only) when no API key is configured,
 * so local dev works without an email provider.
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  if (env.resendApiKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.resendApiKey}`,
      },
      body: JSON.stringify({
        from: env.resendFromEmail,
        to: [input.to],
        subject: input.subject,
        html: input.html,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "(no body)");
      logApiEvent({
        level: "ERROR",
        route: "lib/email",
        event: "EMAIL_SEND_FAILED",
        status: res.status,
        details: { to: input.to, subject: input.subject, body },
      });
      throw new Error(`EMAIL_SEND_FAILED:${res.status}`);
    }

    logApiEvent({
      level: "INFO",
      route: "lib/email",
      event: "EMAIL_SENT",
      details: { to: input.to, subject: input.subject, provider: "resend" },
    });
    return;
  }

  if (env.smtpHost && env.smtpUser && env.smtpPass) {
    await sendSmtpEmail({
      to: input.to,
      subject: input.subject,
      text: input.text ?? stripHtml(input.html),
    });

    logApiEvent({
      level: "INFO",
      route: "lib/email",
      event: "EMAIL_SENT",
      details: { to: input.to, subject: input.subject, provider: "smtp" },
    });
    return;
  }

  logApiEvent({
    level: "WARN",
    route: "lib/email",
    event: "EMAIL_SKIPPED_NO_PROVIDER",
    details: { to: input.to, subject: input.subject },
  });
}

// ── Branded email templates ──────────────────────────────────────────────────

const emailWrapper = (content: string) => `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Chez Olive</title>
  <style>
    body { margin: 0; padding: 0; background: #FAF8F4; font-family: 'Helvetica Neue', Arial, sans-serif; color: #2C1E0F; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #E8DDD0; }
    .header { background: linear-gradient(135deg, #3D4A2A 0%, #5C6B40 100%); padding: 28px 32px; text-align: center; }
    .header-title { font-size: 22px; font-weight: 700; color: #ffffff; margin: 0; letter-spacing: -0.02em; }
    .header-sub { font-size: 13px; color: rgba(255,255,255,0.75); margin: 4px 0 0; }
    .body { padding: 32px; }
    .body p { font-size: 15px; line-height: 1.65; margin: 0 0 16px; }
    .body p:last-child { margin-bottom: 0; }
    .btn-wrap { text-align: center; margin: 28px 0; }
    .btn { display: inline-block; background: #3D4A2A; color: #ffffff !important; text-decoration: none; padding: 14px 36px; border-radius: 10px; font-weight: 700; font-size: 15px; letter-spacing: 0.01em; }
    .note { font-size: 13px; color: #8C7B65; margin-top: 20px; padding-top: 20px; border-top: 1px solid #E8DDD0; }
    .footer { background: #F5F0E8; padding: 18px 32px; text-align: center; font-size: 12px; color: #8C7B65; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <p class="header-title">🐾 Chez Olive</p>
      <p class="header-sub">Boutique animalière bilingue</p>
    </div>
    <div class="body">
      ${content}
    </div>
    <div class="footer">© Chez Olive — Rimouski, QC</div>
  </div>
</body>
</html>`;

export function buildPasswordResetEmailFr(resetUrl: string): { subject: string; html: string } {
  return {
    subject: "Réinitialisation de ton mot de passe — Chez Olive",
    html: emailWrapper(`
      <p>Bonjour,</p>
      <p>Nous avons reçu une demande de réinitialisation du mot de passe associé à ton compte Chez Olive.</p>
      <div class="btn-wrap">
        <a class="btn" href="${resetUrl}">Réinitialiser mon mot de passe</a>
      </div>
      <p>Ce lien est valide pendant <strong>1 heure</strong>. Si tu n'as pas demandé de réinitialisation, tu peux ignorer ce courriel — ton mot de passe ne sera pas modifié.</p>
      <p class="note">Si le bouton ne fonctionne pas, copie-colle ce lien dans ton navigateur :<br /><span style="word-break:break-all;">${resetUrl}</span></p>
    `),
  };
}

export function buildPasswordResetEmailEn(resetUrl: string): { subject: string; html: string } {
  return {
    subject: "Reset your password — Chez Olive",
    html: emailWrapper(`
      <p>Hello,</p>
      <p>We received a request to reset the password for your Chez Olive account.</p>
      <div class="btn-wrap">
        <a class="btn" href="${resetUrl}">Reset my password</a>
      </div>
      <p>This link is valid for <strong>1 hour</strong>. If you did not request a password reset, you can safely ignore this email — your password will not change.</p>
      <p class="note">If the button doesn't work, copy and paste this link into your browser:<br /><span style="word-break:break-all;">${resetUrl}</span></p>
    `),
  };
}

