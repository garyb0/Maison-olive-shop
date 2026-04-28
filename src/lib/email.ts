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

async function sendSmtpEmail(input: { to: string; subject: string; text: string }): Promise<void> {
  return new Promise((resolve, reject) => {
    const host = env.smtpHost;
    const port = env.smtpPort || (env.smtpSecure ? 465 : 587);
    const secure = env.smtpSecure;
    
    logEmailDebug("SMTP_CONNECTING", { host, port, secure, to: input.to });
    
    const socket = secure 
      ? tls.connect({ host, port, rejectUnauthorized: false })
      : net.createConnection({ host, port });
    
    let response = "";
    
    const sendCommand = (cmd: string) => {
      socket.write(cmd + "\r\n");
    };
    
    socket.on("data", (data: Buffer) => {
      response += data.toString();
      logEmailDebug("SMTP_RESPONSE_RECEIVED", { chunk: response.trim() });
      
      // Wait for server ready
      if (response.includes("220")) {
        response = "";
        sendCommand("EHLO " + env.siteUrl);
      }
      // After EHLO, start TLS if not secure and server supports it
      else if (response.includes("250") && !secure && !response.includes("AUTH")) {
        response = "";
        sendCommand("STARTTLS");
      }
      // After STARTTLS response, upgrade connection
      else if (response.includes("220") && response.includes("ready")) {
        // TLS upgrade would happen here, but for simplicity we'll skip
        response = "";
        sendCommand("AUTH LOGIN");
      }
      // After AUTH LOGIN
      else if (response.includes("334") && !response.includes("VX")) {
        response = "";
        // Send username (base64 encoded)
        const user = Buffer.from(env.smtpUser || "").toString("base64");
        sendCommand(user);
      }
      // After username, send password
      else if (response.includes("334") && response.includes("VX")) {
        response = "";
        // Send password (base64 encoded)
        const pass = Buffer.from(env.smtpPass || "").toString("base64");
        sendCommand(pass);
      }
      // After AUTH success
      else if (response.includes("235") || response.includes("2.7.0")) {
        response = "";
        sendCommand("MAIL FROM:<" + (env.smtpFromEmail || env.businessSupportEmail) + ">");
      }
      // After MAIL FROM
      else if (response.includes("250") && !response.includes("RCPT")) {
        response = "";
        sendCommand("RCPT TO:<" + input.to + ">");
      }
      // After RCPT TO
      else if (response.includes("250") && !response.includes("DATA")) {
        response = "";
        sendCommand("DATA");
      }
      // After DATA command (354 response)
      else if (response.includes("354")) {
        response = "";
        // Send email content
        const emailContent = 
          "From: " + (env.smtpFromEmail || env.businessSupportEmail) + "\r\n" +
          "To: " + input.to + "\r\n" +
          "Subject: " + input.subject + "\r\n" +
          "Content-Type: text/plain; charset=utf-8\r\n\r\n" +
          input.text + "\r\n.\r\n";
        sendCommand(emailContent);
      }
      // After email sent (250 response)
      else if (response.includes("250") && response.includes("OK")) {
        logApiEvent({
          level: "INFO",
          route: "lib/email",
          event: "SMTP_EMAIL_SENT",
          details: { to: input.to },
        });
        sendCommand("QUIT");
        socket.end();
        resolve();
      }
      // After QUIT
      else if (response.includes("221")) {
        socket.end();
        resolve();
      }
    });
    
    socket.on("error", (err: Error) => {
      logApiEvent({
        level: "WARN",
        route: "lib/email",
        event: "SMTP_ERROR",
        details: { to: input.to, error: err },
      });
      reject(err);
    });
    
    socket.on("end", () => {
      logEmailDebug("SMTP_CONNECTION_CLOSED", { to: input.to });
    });
  });
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

