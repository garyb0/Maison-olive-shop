import { env } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { logApiEvent } from "@/lib/observability";
import crypto from "crypto";

// Generate a secure token for email reply validation
export function generateEmailReplyToken(conversationId: string, adminId: string): string {
  const data = `${conversationId}:${adminId}:${Date.now()}`;
  return crypto.createHmac('sha256', env.sessionSecret).update(data).digest('hex');
}

// Verify email reply token
export function verifyEmailReplyToken(token: string): { conversationId: string; adminId: string } | null {
  try {
    // Token format: conversationId:adminId:timestamp:hmac
    const parts = Buffer.from(token, 'base64').toString('utf-8').split(':');
    if (parts.length !== 4) return null;
    
    const [conversationId, adminId, timestamp, hmac] = parts;
    const expectedData = `${conversationId}:${adminId}:${timestamp}`;
    const expectedHmac = crypto.createHmac('sha256', env.sessionSecret).update(expectedData).digest('hex');
    
    if (hmac !== expectedHmac) return null;
    
    // Token valid for 7 days
    const tokenTime = parseInt(timestamp);
    if (Date.now() - tokenTime > 7 * 24 * 60 * 60 * 1000) return null;
    
    return { conversationId, adminId };
  } catch {
    return null;
  }
}

// Create a token that can be decoded
function createReplyToken(conversationId: string, adminId: string): string {
  const timestamp = Date.now().toString();
  const data = `${conversationId}:${adminId}:${timestamp}`;
  const hmac = crypto.createHmac('sha256', env.sessionSecret).update(data).digest('hex');
  const tokenData = `${conversationId}:${adminId}:${timestamp}:${hmac}`;
  return Buffer.from(tokenData).toString('base64');
}

interface EmailNotificationData {
  conversationId: string;
  customerName: string;
  customerEmail: string;
  messageContent: string;
  adminName?: string;
  adminEmail?: string;
  isReply?: boolean;
}

function buildEmailHtml(data: EmailNotificationData, isReply: boolean = false): string {
  const replyToken = data.adminEmail ? createReplyToken(data.conversationId, data.adminEmail) : '';
  const replyToUrl = data.adminEmail 
    ? `${env.siteUrl}/api/support/email-reply?token=${encodeURIComponent(replyToken)}`
    : '';

  const subject = isReply
    ? `💬 Nouveau message de ${data.customerName} - Maison Olive`
    : `🔔 Nouvelle conversation de ${data.customerName} - Maison Olive`;

  const previewText = data.messageContent.length > 100 
    ? data.messageContent.substring(0, 100) + '...' 
    : data.messageContent;

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #f5f0e8;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #2c1e0f;
      line-height: 1.6;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
    }
    .header {
      background: linear-gradient(135deg, #3d4a2a 0%, #5c6b40 100%);
      padding: 24px 32px;
      text-align: center;
    }
    .header-title {
      font-size: 20px;
      font-weight: 700;
      color: #ffffff;
      margin: 0;
    }
    .header-subtitle {
      font-size: 13px;
      color: rgba(255, 255, 255, 0.8);
      margin: 4px 0 0;
    }
    .body {
      padding: 32px;
    }
    .notification-badge {
      display: inline-block;
      background: #fef3c7;
      color: #92400e;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 16px;
    }
    .customer-info {
      background: #f9fafb;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .customer-info p {
      margin: 4px 0;
      font-size: 14px;
    }
    .customer-info strong {
      color: #374151;
    }
    .message-preview {
      background: #f3f4f6;
      padding: 16px;
      border-radius: 8px;
      border-left: 4px solid #3d4a2a;
      margin: 20px 0;
    }
    .message-preview p {
      margin: 0;
      font-size: 15px;
      color: #4b5563;
      font-style: italic;
    }
    .button-container {
      text-align: center;
      margin: 28px 0;
    }
    .button {
      display: inline-block;
      background: #3d4a2a;
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 10px;
      font-weight: 600;
      font-size: 15px;
      margin: 8px;
      transition: background 0.2s;
    }
    .button:hover {
      background: #2c381e;
    }
    .button-secondary {
      background: #6b7280;
    }
    .button-secondary:hover {
      background: #4b5563;
    }
    .reply-hint {
      background: #eff6ff;
      padding: 16px;
      border-radius: 8px;
      margin: 20px 0;
      border: 1px solid #bfdbfe;
    }
    .reply-hint p {
      margin: 0;
      font-size: 13px;
      color: #1e40af;
    }
    .footer {
      background: #f9fafb;
      padding: 20px 32px;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
      border-top: 1px solid #e5e7eb;
    }
    .footer p {
      margin: 4px 0;
    }
    @media only screen and (max-width: 600px) {
      .container {
        margin: 0;
        border-radius: 0;
      }
      .body {
        padding: 20px;
      }
      .button {
        display: block;
        margin: 8px auto;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <p class="header-title">🐾 Maison Olive</p>
      <p class="header-subtitle">Support Client</p>
    </div>
    
    <div class="body">
      <span class="notification-badge">
        ${isReply ? '💬 Nouveau message' : '🔔 Nouvelle conversation'}
      </span>
      
      <h2 style="margin: 0 0 16px; font-size: 22px; color: #1f2937;">
        ${isReply ? 'Un client vous a répondu' : 'Nouvelle conversation de support'}
      </h2>
      
      <div class="customer-info">
        <p><strong>👤 Client :</strong> ${data.customerName}</p>
        <p><strong>📧 Email :</strong> ${data.customerEmail}</p>
        ${data.adminName ? `<p><strong>📋 Assigné à :</strong> ${data.adminName}</p>` : ''}
      </div>
      
      <p style="margin: 16px 0; font-size: 15px;">
        ${isReply 
          ? 'Un client a répondu à une conversation que vous suivez.' 
          : 'Un client vient de démarrer une nouvelle conversation de support.'}
      </p>
      
      <div class="message-preview">
        <p>"${previewText}"</p>
      </div>
      
      <div class="button-container">
        <a href="${env.siteUrl}/admin/support" class="button">
          ${isReply ? 'Voir la conversation' : 'Prendre en charge'}
        </a>
      </div>
      
      ${replyToUrl ? `
        <div class="reply-hint">
          <p>
            💡 <strong>Astuce :</strong> Vous pouvez répondre directement à cet email pour envoyer un message au client. 
            Votre réponse sera automatiquement ajoutée à la conversation.
          </p>
        </div>
      ` : ''}
    </div>
    
    <div class="footer">
      <p>© 2024 Maison Olive — Rimouski, QC</p>
      <p>Cet email a été envoyé à ${data.adminEmail || 'votre adresse'}</p>
      <p style="margin-top: 8px;">
        <a href="${env.siteUrl}/admin/support/settings" style="color: #6b7280;">Gérer les notifications</a>
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

// Send email notification for new conversation
export async function sendNewConversationEmail(data: {
  conversationId: string;
  customerName: string;
  customerEmail: string;
  messageContent: string;
  adminEmails: string[];
}): Promise<void> {
  if (!env.resendApiKey && !env.smtpHost) {
    logApiEvent({
      level: 'WARN',
      route: 'lib/support-email',
      event: 'EMAIL_SKIPPED_NO_CONFIG',
      details: { reason: 'No email provider configured' },
    });
    return;
  }

  const html = buildEmailHtml({
    conversationId: data.conversationId,
    customerName: data.customerName,
    customerEmail: data.customerEmail,
    messageContent: data.messageContent,
  }, false);

  const subject = `🔔 Nouvelle conversation de ${data.customerName} - Maison Olive`;

  // Send to all admin emails
  const sendPromises = data.adminEmails.map(adminEmail => 
    sendEmail({
      to: adminEmail,
      subject,
      html,
    }).catch(err => {
      logApiEvent({
        level: 'ERROR',
        route: 'lib/support-email',
        event: 'EMAIL_SEND_FAILED',
        details: { adminEmail, error: err.message },
      });
    })
  );

  await Promise.all(sendPromises);
}

// Send email notification for new message in assigned conversation
export async function sendNewMessageEmail(data: {
  conversationId: string;
  customerName: string;
  customerEmail: string;
  messageContent: string;
  adminEmail: string;
  adminName?: string;
}): Promise<void> {
  if (!env.resendApiKey && !env.smtpHost) {
    return;
  }

  const html = buildEmailHtml({
    conversationId: data.conversationId,
    customerName: data.customerName,
    customerEmail: data.customerEmail,
    messageContent: data.messageContent,
    adminEmail: data.adminEmail,
    adminName: data.adminName,
    isReply: true,
  }, true);

  const subject = `💬 Nouveau message de ${data.customerName} - Maison Olive`;

  await sendEmail({
    to: data.adminEmail,
    subject,
    html,
  });
}

// Send conversation closed notification to customer
export async function sendConversationClosedEmail(data: {
  customerEmail: string;
  customerName: string;
  conversationId: string;
}): Promise<void> {
  if (!env.resendApiKey && !env.smtpHost) {
    return;
  }

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Conversation terminée - Maison Olive</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #f5f0e8;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #2c1e0f;
      line-height: 1.6;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);
    }
    .header {
      background: linear-gradient(135deg, #3d4a2a 0%, #5c6b40 100%);
      padding: 24px 32px;
      text-align: center;
    }
    .header-title {
      font-size: 20px;
      font-weight: 700;
      color: #ffffff;
      margin: 0;
    }
    .body {
      padding: 32px;
    }
    .button {
      display: inline-block;
      background: #3d4a2a;
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 10px;
      font-weight: 600;
      font-size: 15px;
      margin: 16px 0;
    }
    .footer {
      background: #f9fafb;
      padding: 20px 32px;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
      border-top: 1px solid #e5e7eb;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <p class="header-title">🐾 Maison Olive</p>
    </div>
    <div class="body">
      <h2 style="margin: 0 0 16px; font-size: 22px;">Conversation terminée</h2>
      <p>Bonjour ${data.customerName},</p>
      <p>Votre conversation de support a été clôturée par notre équipe.</p>
      <p>Si vous avez d'autres questions, n'hésitez pas à nous recontacter en ouvrant une nouvelle conversation.</p>
      <div style="text-align: center;">
        <a href="${env.siteUrl}" class="button">Retourner au chat</a>
      </div>
    </div>
    <div class="footer">
      <p>© 2024 Maison Olive — Rimouski, QC</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  await sendEmail({
    to: data.customerEmail,
    subject: 'Votre conversation a été clôturée - Maison Olive',
    html,
  });
}