export const DEV_SESSION_SECRET = "dev-insecure-change-me";

const parseNumber = (
  value: string | undefined,
  fallback: number,
  options?: { min?: number }
) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (options?.min !== undefined && parsed < options.min) return fallback;
  return parsed;
};

const normalizeSiteUrl = (value: string | undefined) => {
  const raw = value?.trim();
  if (!raw) return "http://localhost:3000";
  return raw.replace(/\/+$/, "");
};

const nodeEnv = process.env.NODE_ENV ?? "development";

export const env = {
  nodeEnv,
  databaseUrl: process.env.DATABASE_URL ?? "file:./dev.db",
  sessionSecret: process.env.SESSION_SECRET ?? DEV_SESSION_SECRET,
  sessionCookieName: process.env.SESSION_COOKIE_NAME ?? "maisonolive_session",
  sessionDurationDays: parseNumber(process.env.SESSION_DURATION_DAYS, 30, { min: 1 }),
  taxRate: parseNumber(process.env.TAX_RATE, 0.14975, { min: 0 }),
  shippingFlatCents: parseNumber(process.env.SHIPPING_FLAT_CENTS, 899, { min: 0 }),
  shippingFreeThresholdCents: parseNumber(process.env.SHIPPING_FREE_THRESHOLD_CENTS, 7500, {
    min: 0,
  }),
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  siteUrl: normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL),
  businessSupportEmail: process.env.BUSINESS_SUPPORT_EMAIL ?? "gary_b0@hotmail.fr",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  resendFromEmail: process.env.RESEND_FROM_EMAIL ?? "Maison Olive <onboarding@resend.dev>",
  adminSmsEmail: process.env.ADMIN_SMS_EMAIL ?? "",
  // SMTP configuration for sending emails
  smtpHost: process.env.SMTP_HOST ?? "",
  smtpPort: parseInt(process.env.SMTP_PORT ?? "587"),
  smtpSecure: process.env.SMTP_SECURE === "true",
  smtpUser: process.env.SMTP_USER ?? "",
  smtpPass: process.env.SMTP_PASS ?? "",
  smtpFromEmail: process.env.SMTP_FROM_EMAIL ?? "",
} as const;

export type EnvValidationReport = {
  target: "development" | "production";
  errors: string[];
  warnings: string[];
};

export function validateEnv(target: "development" | "production" = "development"): EnvValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!env.databaseUrl) {
    errors.push("DATABASE_URL is required.");
  }

  if (target === "production") {
    if (!env.sessionSecret || env.sessionSecret === DEV_SESSION_SECRET) {
      errors.push("SESSION_SECRET must be set to a strong non-default value in production.");
    } else if (env.sessionSecret.length < 32) {
      warnings.push("SESSION_SECRET should be at least 32 characters.");
    }

    if (!process.env.NEXT_PUBLIC_SITE_URL) {
      errors.push("NEXT_PUBLIC_SITE_URL is required in production.");
    }

    if (env.siteUrl.includes("localhost")) {
      warnings.push("NEXT_PUBLIC_SITE_URL points to localhost; use your real domain in production.");
    }

    if (env.stripeSecretKey && !env.stripeWebhookSecret) {
      errors.push("STRIPE_WEBHOOK_SECRET is required when STRIPE_SECRET_KEY is configured.");
    }

    if (env.resendApiKey && !env.resendFromEmail) {
      errors.push("RESEND_FROM_EMAIL is required when RESEND_API_KEY is configured.");
    }
  }

  return { target, errors, warnings };
}
