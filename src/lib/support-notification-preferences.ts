import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export type EmailDigestPreference = "none" | "hourly" | "daily";

export type SupportNotificationPreferences = {
  emailNewConversation: boolean;
  emailNewMessage: boolean;
  emailConversationAssigned: boolean;
  emailDigest: EmailDigestPreference;
};

export type SupportAdminUiSettings = {
  displayName: string;
  quickReplies: string[];
};

export type SupportSystemHealth = {
  ok: boolean;
  missingTables: string[];
};

export const DEFAULT_SUPPORT_NOTIFICATION_PREFERENCES: SupportNotificationPreferences = {
  emailNewConversation: true,
  emailNewMessage: true,
  emailConversationAssigned: true,
  emailDigest: "none",
};

const SUPPORT_REQUIRED_TABLES = [
  "SupportConversation",
  "SupportMessage",
  "SupportNotificationPreference",
  "SupportInternalNote",
  "SupportQuickReply",
] as const;

const MAX_QUICK_REPLIES = 30;
const MAX_QUICK_REPLY_LENGTH = 600;
const MAX_DISPLAY_NAME_LENGTH = 80;

type SupportNotificationPreferencesCandidate = {
  emailNewConversation?: unknown;
  emailNewMessage?: unknown;
  emailConversationAssigned?: unknown;
  emailDigest?: unknown;
};

const supportNotificationPreferenceSelect = {
  emailNewConversation: true,
  emailNewMessage: true,
  emailConversationAssigned: true,
  emailDigest: true,
  displayName: true,
  quickRepliesJson: true,
};

function isEmailDigestPreference(value: unknown): value is EmailDigestPreference {
  return value === "none" || value === "hourly" || value === "daily";
}

export function normalizeSupportNotificationPreferences(
  preferences: SupportNotificationPreferencesCandidate | null | undefined,
): SupportNotificationPreferences {
  return {
    emailNewConversation:
      typeof preferences?.emailNewConversation === "boolean"
        ? preferences.emailNewConversation
        : DEFAULT_SUPPORT_NOTIFICATION_PREFERENCES.emailNewConversation,
    emailNewMessage:
      typeof preferences?.emailNewMessage === "boolean"
        ? preferences.emailNewMessage
        : DEFAULT_SUPPORT_NOTIFICATION_PREFERENCES.emailNewMessage,
    emailConversationAssigned:
      typeof preferences?.emailConversationAssigned === "boolean"
        ? preferences.emailConversationAssigned
        : DEFAULT_SUPPORT_NOTIFICATION_PREFERENCES.emailConversationAssigned,
    emailDigest: isEmailDigestPreference(preferences?.emailDigest)
      ? preferences.emailDigest
      : DEFAULT_SUPPORT_NOTIFICATION_PREFERENCES.emailDigest,
  };
}

function isMissingSupportSettingsTableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("SupportNotificationPreference") &&
    (message.includes("no such table") || message.includes("does not exist"))
  );
}

function normalizeQuickReplies(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const replies = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, MAX_QUICK_REPLIES)
    .map((item) => item.slice(0, MAX_QUICK_REPLY_LENGTH));
  return replies;
}

function parseQuickRepliesJson(value: string | null | undefined): string[] | null {
  if (!value) return null;
  try {
    return normalizeQuickReplies(JSON.parse(value));
  } catch {
    return null;
  }
}

export function getDefaultSupportQuickReplies(language: "fr" | "en", displayName: string) {
  const name = displayName.trim() || (language === "fr" ? "votre conseiller" : "your advisor");
  return language === "fr"
    ? [
        `Bonjour ! Je suis ${name} de l'équipe Chez Olive. Comment puis-je vous aider aujourd'hui ?`,
        `Merci pour votre message. Je vérifie ça pour vous et je reviens avec une réponse claire.`,
        "Votre commande est bien visible de notre côté. Je regarde le statut et je vous confirme la suite.",
        "Je comprends la situation. Je vais vérifier les détails et vous proposer la meilleure solution.",
        "Merci pour votre patience. Est-ce que je peux faire autre chose pour vous aujourd'hui ?",
        "Cette conversation est maintenant terminée. N'hésitez pas à nous réécrire si vous avez une autre question.",
      ]
    : [
        `Hello! I'm ${name} from the Chez Olive team. How can I help today?`,
        "Thank you for your message. I will check this and come back with a clear answer.",
        "I can see your order on our side. I will review the status and confirm the next step.",
        "I understand the situation. I will check the details and suggest the best solution.",
        "Thank you for your patience. Is there anything else I can help with today?",
        "This conversation is now closed. Please message us again if you have another question.",
      ];
}

function normalizeSupportAdminUiSettings(
  settings:
    | {
        displayName?: string | null;
        quickRepliesJson?: string | null;
      }
    | null
    | undefined,
  fallback: { language?: "fr" | "en"; displayName?: string },
): SupportAdminUiSettings {
  const displayName =
    typeof settings?.displayName === "string" && settings.displayName.trim()
      ? settings.displayName.trim()
      : (fallback.displayName ?? "").trim() || (fallback.language === "en" ? "your advisor" : "votre conseiller");
  const quickReplies =
    parseQuickRepliesJson(settings?.quickRepliesJson) ??
    getDefaultSupportQuickReplies(fallback.language ?? "fr", displayName);

  return { displayName, quickReplies };
}

export function parseSupportNotificationPreferencesInput(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const candidate = payload as Record<string, unknown>;

  if (
    typeof candidate.emailNewConversation !== "boolean" ||
    typeof candidate.emailNewMessage !== "boolean" ||
    typeof candidate.emailConversationAssigned !== "boolean" ||
    !isEmailDigestPreference(candidate.emailDigest)
  ) {
    return null;
  }

  return {
    emailNewConversation: candidate.emailNewConversation,
    emailNewMessage: candidate.emailNewMessage,
    emailConversationAssigned: candidate.emailConversationAssigned,
    emailDigest: candidate.emailDigest,
  };
}

export function parseSupportAdminUiSettingsInput(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const candidate = payload as Record<string, unknown>;
  const result: Partial<SupportAdminUiSettings> = {};

  if ("displayName" in candidate) {
    if (typeof candidate.displayName !== "string") return null;
    result.displayName = candidate.displayName.trim().slice(0, MAX_DISPLAY_NAME_LENGTH);
  }

  if ("quickReplies" in candidate) {
    const quickReplies = normalizeQuickReplies(candidate.quickReplies);
    if (!quickReplies) return null;
    result.quickReplies = quickReplies;
  }

  return "displayName" in result || "quickReplies" in result ? result : null;
}

export function shouldSendNewConversationEmail(
  preferences: Pick<SupportNotificationPreferences, "emailNewConversation"> | null | undefined,
) {
  return preferences?.emailNewConversation ?? DEFAULT_SUPPORT_NOTIFICATION_PREFERENCES.emailNewConversation;
}

export function shouldSendNewMessageEmail(
  preferences: Pick<SupportNotificationPreferences, "emailNewMessage"> | null | undefined,
) {
  return preferences?.emailNewMessage ?? DEFAULT_SUPPORT_NOTIFICATION_PREFERENCES.emailNewMessage;
}

export function shouldSendConversationAssignedEmail(
  preferences: Pick<SupportNotificationPreferences, "emailConversationAssigned"> | null | undefined,
) {
  return preferences?.emailConversationAssigned ?? DEFAULT_SUPPORT_NOTIFICATION_PREFERENCES.emailConversationAssigned;
}

export function hasSupportEmailProviderConfigured() {
  return Boolean(env.resendApiKey || (env.smtpHost && env.smtpUser && env.smtpPass));
}

export async function getSupportSystemHealth(): Promise<SupportSystemHealth> {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${SUPPORT_REQUIRED_TABLES.map(
        (table) => `'${table}'`,
      ).join(", ")})`,
    );
    const existing = new Set(rows.map((row) => row.name));
    const missingTables = SUPPORT_REQUIRED_TABLES.filter((table) => !existing.has(table));
    return { ok: missingTables.length === 0, missingTables };
  } catch {
    return { ok: false, missingTables: [...SUPPORT_REQUIRED_TABLES] };
  }
}

export async function getSupportNotificationPreferences(adminUserId: string) {
  try {
    const preferences = await prisma.supportNotificationPreference.findUnique({
      where: { adminUserId },
      select: supportNotificationPreferenceSelect,
    });

    return normalizeSupportNotificationPreferences(preferences);
  } catch (error) {
    if (isMissingSupportSettingsTableError(error)) {
      return DEFAULT_SUPPORT_NOTIFICATION_PREFERENCES;
    }
    throw error;
  }
}

export async function getSupportAdminUiSettings(admin: {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  language?: "fr" | "en";
}) {
  try {
    const preferences = await prisma.supportNotificationPreference.findUnique({
      where: { adminUserId: admin.id },
      select: {
        displayName: true,
        quickRepliesJson: true,
      },
    });
    return normalizeSupportAdminUiSettings(preferences, {
      language: admin.language,
      displayName: formatAdminName(admin),
    });
  } catch (error) {
    if (isMissingSupportSettingsTableError(error)) {
      return normalizeSupportAdminUiSettings(null, {
        language: admin.language,
        displayName: formatAdminName(admin),
      });
    }
    throw error;
  }
}

export async function updateSupportNotificationPreferences(
  adminUserId: string,
  preferences: SupportNotificationPreferences,
) {
  const normalizedPreferences = normalizeSupportNotificationPreferences(preferences);
  const savedPreferences = await prisma.supportNotificationPreference.upsert({
    where: { adminUserId },
    create: {
      adminUserId,
      ...normalizedPreferences,
    },
    update: normalizedPreferences,
    select: supportNotificationPreferenceSelect,
  });

  return normalizeSupportNotificationPreferences(savedPreferences);
}

export async function updateSupportAdminUiSettings(
  admin: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
    language?: "fr" | "en";
  },
  input: Partial<SupportAdminUiSettings>,
) {
  const current = await getSupportAdminUiSettings(admin);
  const nextDisplayName =
    typeof input.displayName === "string" ? input.displayName.trim().slice(0, MAX_DISPLAY_NAME_LENGTH) : current.displayName;
  const nextQuickReplies = input.quickReplies ?? current.quickReplies;

  const savedPreferences = await prisma.supportNotificationPreference.upsert({
    where: { adminUserId: admin.id },
    create: {
      adminUserId: admin.id,
      ...DEFAULT_SUPPORT_NOTIFICATION_PREFERENCES,
      displayName: nextDisplayName,
      quickRepliesJson: JSON.stringify(nextQuickReplies),
    },
    update: {
      displayName: nextDisplayName,
      quickRepliesJson: JSON.stringify(nextQuickReplies),
    },
    select: {
      displayName: true,
      quickRepliesJson: true,
    },
  });

  return normalizeSupportAdminUiSettings(savedPreferences, {
    language: admin.language,
    displayName: formatAdminName(admin),
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatAdminName(admin: { firstName?: string | null; lastName?: string | null; email: string }) {
  return [admin.firstName, admin.lastName].filter(Boolean).join(" ").trim() || admin.email;
}

export async function sendSupportSettingsTestEmail(admin: {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
}) {
  if (!hasSupportEmailProviderConfigured()) {
    return { sent: false as const, reason: "EMAIL_PROVIDER_NOT_CONFIGURED" as const };
  }

  const currentYear = new Date().getFullYear();
  const adminName = escapeHtml(formatAdminName(admin));
  const settingsUrl = `${env.siteUrl}/admin/support/settings`;

  await sendEmail({
    to: admin.email,
    subject: "Test des notifications support - Chez Olive",
    html: `
      <!DOCTYPE html>
      <html lang="fr">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Test des notifications support</title>
        </head>
        <body style="margin:0;padding:24px;background:#f5f0e8;font-family:Arial,sans-serif;color:#2c1e0f;">
          <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e8ddd0;border-radius:12px;overflow:hidden;">
            <div style="background:#3d4a2a;color:#fff;padding:20px 24px;">
              <h1 style="margin:0;font-size:20px;">Chez Olive</h1>
              <p style="margin:4px 0 0;color:rgba(255,255,255,.82);">Test des notifications support</p>
            </div>
            <div style="padding:24px;">
              <p>Bonjour ${adminName},</p>
              <p>Ce courriel confirme que le fournisseur email configuré pour les notifications support peut envoyer un message à ton compte admin.</p>
              <p>
                <a href="${settingsUrl}" style="display:inline-block;background:#3d4a2a;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700;">
                  Ouvrir les paramètres
                </a>
              </p>
              <p style="font-size:13px;color:#6b7280;">Si tu n'as pas lancé ce test, vérifie les accès admin et la configuration email.</p>
            </div>
            <div style="padding:16px 24px;background:#f9fafb;color:#6b7280;font-size:12px;">
              &copy; ${currentYear} Chez Olive - Rimouski, QC
            </div>
          </div>
        </body>
      </html>
    `,
  });

  return { sent: true as const, to: admin.email };
}
