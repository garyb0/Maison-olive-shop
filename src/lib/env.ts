const parseNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeSiteUrl = (value: string | undefined) => {
  const raw = value?.trim();
  if (!raw) return "http://localhost:3000";
  return raw.replace(/\/+$/, "");
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl: process.env.DATABASE_URL ?? "file:./dev.db",
  sessionSecret: process.env.SESSION_SECRET ?? "dev-insecure-change-me",
  sessionCookieName: process.env.SESSION_COOKIE_NAME ?? "maisonolive_session",
  sessionDurationDays: parseNumber(process.env.SESSION_DURATION_DAYS, 30),
  taxRate: parseNumber(process.env.TAX_RATE, 0.14975),
  shippingFlatCents: parseNumber(process.env.SHIPPING_FLAT_CENTS, 899),
  shippingFreeThresholdCents: parseNumber(process.env.SHIPPING_FREE_THRESHOLD_CENTS, 7500),
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  siteUrl: normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL),
  businessSupportEmail: process.env.BUSINESS_SUPPORT_EMAIL ?? "support@maisonolive.local",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  resendFromEmail: process.env.RESEND_FROM_EMAIL ?? "Maison Olive <onboarding@resend.dev>",
};
