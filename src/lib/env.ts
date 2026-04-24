import { isLocalhostSiteUrl, isSecureSiteUrl, normalizeSiteUrl } from "@/lib/site-url";

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

const parseInteger = (
  value: string | undefined,
  fallback: number,
  options?: { min?: number; max?: number },
) => {
  const parsed = Number.parseInt(value ?? String(fallback), 10);
  if (!Number.isFinite(parsed)) return fallback;
  if (options?.min !== undefined && parsed < options.min) return fallback;
  if (options?.max !== undefined && parsed > options.max) return fallback;
  return parsed;
};

const nodeEnv = process.env.NODE_ENV ?? "development";
const smtpPortRaw = process.env.SMTP_PORT;
const smtpPortIsConfigured = typeof smtpPortRaw === "string" && smtpPortRaw.trim().length > 0;
const parsedSmtpPort = parseInteger(smtpPortRaw, 587, { min: 1, max: 65535 });

export const env = {
  nodeEnv,
  databaseUrl: process.env.DATABASE_URL ?? "file:./dev.db",
  sessionSecret: process.env.SESSION_SECRET ?? DEV_SESSION_SECRET,
  sessionCookieName: process.env.SESSION_COOKIE_NAME ?? "chezolive_session",
  sessionDurationDays: parseNumber(process.env.SESSION_DURATION_DAYS, 30, { min: 1 }),
  taxRate: parseNumber(process.env.TAX_RATE, 0.14975, { min: 0 }),
  shippingFlatCents: parseNumber(process.env.SHIPPING_FLAT_CENTS, 899, { min: 0 }),
  shippingFreeThresholdCents: parseNumber(process.env.SHIPPING_FREE_THRESHOLD_CENTS, 7500, {
    min: 0,
  }),
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  allowStripeTestKeysInProduction: process.env.ALLOW_STRIPE_TEST_KEYS_IN_PRODUCTION === "true",
  siteUrl: normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL),
  businessSupportEmail: process.env.BUSINESS_SUPPORT_EMAIL ?? "support@chezolive.ca",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  resendFromEmail: process.env.RESEND_FROM_EMAIL ?? "Chez Olive <onboarding@resend.dev>",
  adminSmsEmail: process.env.ADMIN_SMS_EMAIL ?? "",
  // SMTP configuration for sending emails
  smtpHost: process.env.SMTP_HOST ?? "",
  smtpPort: parsedSmtpPort,
  smtpSecure: process.env.SMTP_SECURE === "true",
  smtpUser: process.env.SMTP_USER ?? "",
  smtpPass: process.env.SMTP_PASS ?? "",
  smtpFromEmail: process.env.SMTP_FROM_EMAIL ?? "",
  maintenanceMode: process.env.MAINTENANCE_MODE === "true",
  deliveryExperimentalRoutingEnabled:
    process.env.DELIVERY_EXPERIMENTAL_ROUTING_ENABLED === "true",
  deliveryGpsTrackingEnabled:
    process.env.DELIVERY_GPS_TRACKING_ENABLED === "true",
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY ?? "",
  deliveryDepotLabel: process.env.DELIVERY_DEPOT_LABEL ?? "",
  deliveryDepotLine1: process.env.DELIVERY_DEPOT_LINE1 ?? "",
  deliveryDepotCity: process.env.DELIVERY_DEPOT_CITY ?? "",
  deliveryDepotRegion: process.env.DELIVERY_DEPOT_REGION ?? "",
  deliveryDepotPostal: process.env.DELIVERY_DEPOT_POSTAL ?? "",
  deliveryDepotCountry: process.env.DELIVERY_DEPOT_COUNTRY ?? "",
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

    if (isLocalhostSiteUrl(env.siteUrl)) {
      errors.push("NEXT_PUBLIC_SITE_URL cannot point to localhost in production.");
    } else if (!isSecureSiteUrl(env.siteUrl)) {
      errors.push("NEXT_PUBLIC_SITE_URL must use https in production.");
    }

    if (env.databaseUrl.includes("dev.db")) {
      errors.push("DATABASE_URL still points to dev.db; use a production database before go-live.");
    }

    const hasStripeSecretKey = env.stripeSecretKey.length > 0;
    const hasStripePublishableKey = env.stripePublishableKey.length > 0;
    const hasStripeWebhookSecret = env.stripeWebhookSecret.length > 0;

    if (!hasStripeSecretKey && !hasStripeWebhookSecret && !hasStripePublishableKey) {
      warnings.push(
        "Stripe is not configured in production. Online checkout and webhooks will stay disabled until STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY are set."
      );
    } else {
      if (!hasStripeSecretKey) {
        errors.push("STRIPE_SECRET_KEY is required when Stripe webhook handling is configured.");
      }

      if (!hasStripeWebhookSecret) {
        errors.push("STRIPE_WEBHOOK_SECRET is required when Stripe checkout is configured.");
      }

      if (!hasStripePublishableKey) {
        warnings.push(
          "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is missing. Embedded Stripe checkout will stay disabled until the publishable key is added and the app is rebuilt."
        );
      }
    }

    if (hasStripeSecretKey && hasStripeWebhookSecret && !env.stripeWebhookSecret.startsWith("whsec_")) {
      warnings.push("STRIPE_WEBHOOK_SECRET does not look like a Stripe webhook secret (expected prefix whsec_).");
    }

    const isStripeTestKey = env.stripeSecretKey.startsWith("sk_test_");
    const isStripeLiveKey = env.stripeSecretKey.startsWith("sk_live_");
    const isStripeTestPublishableKey = env.stripePublishableKey.startsWith("pk_test_");
    const isStripeLivePublishableKey = env.stripePublishableKey.startsWith("pk_live_");

    if (hasStripeSecretKey && !isStripeTestKey && !isStripeLiveKey) {
      warnings.push("STRIPE_SECRET_KEY format looks unusual (expected sk_test_* or sk_live_*).");
    }

    if (hasStripePublishableKey && !isStripeTestPublishableKey && !isStripeLivePublishableKey) {
      warnings.push("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY format looks unusual (expected pk_test_* or pk_live_*).");
    }

    if (isStripeTestKey && !env.allowStripeTestKeysInProduction) {
      errors.push(
        "STRIPE_SECRET_KEY is a test key. Set ALLOW_STRIPE_TEST_KEYS_IN_PRODUCTION=true only for pre-production."
      );
    }

    if (isStripeLiveKey && hasStripePublishableKey && isStripeTestPublishableKey) {
      errors.push("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is test key while STRIPE_SECRET_KEY is live.");
    }

    if (isStripeTestKey && hasStripePublishableKey && isStripeLivePublishableKey) {
      warnings.push("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is live while STRIPE_SECRET_KEY is test; verify your Stripe environment pairing.");
    }

    if (isStripeTestKey && env.allowStripeTestKeysInProduction) {
      warnings.push("STRIPE_SECRET_KEY is test key and ALLOW_STRIPE_TEST_KEYS_IN_PRODUCTION=true is enabled.");
    }

    if (isStripeLiveKey && env.allowStripeTestKeysInProduction) {
      warnings.push(
        "ALLOW_STRIPE_TEST_KEYS_IN_PRODUCTION=true is set but STRIPE_SECRET_KEY is live; you can remove this override."
      );
    }

    if (!env.resendApiKey && !env.smtpHost) {
      errors.push("Email provider required in production (RESEND_API_KEY or SMTP_HOST).");
    }

    if (env.resendApiKey && !env.resendFromEmail) {
      errors.push("RESEND_FROM_EMAIL is required when RESEND_API_KEY is configured.");
    }

    if (!env.resendApiKey && env.smtpHost && !env.smtpFromEmail) {
      errors.push("SMTP_FROM_EMAIL is required when SMTP_HOST is configured.");
    }

    if (env.smtpHost && !smtpPortIsConfigured) {
      warnings.push("SMTP_PORT not set, defaulting to 587 for SMTP_HOST.");
    }

    if (env.smtpHost && smtpPortIsConfigured && (Number.isNaN(Number.parseInt(smtpPortRaw, 10)) || parsedSmtpPort < 1 || parsedSmtpPort > 65535)) {
      errors.push("SMTP_PORT must be a valid positive integer.");
    }

    if (env.smtpHost && !env.smtpUser && !env.smtpPass) {
      warnings.push("SMTP_HOST is configured without SMTP_USER/SMTP_PASS. This may be accepted only if your host allows anonymous relay.");
    }

    if (env.resendApiKey && env.resendFromEmail.includes("onboarding@resend.dev")) {
      errors.push("RESEND_FROM_EMAIL still uses the Resend onboarding sandbox address in production.");
    }

    if (env.deliveryExperimentalRoutingEnabled) {
      warnings.push(
        "DELIVERY_EXPERIMENTAL_ROUTING_ENABLED=true is enabled. Ensure rollback steps and delivery-specific checks are ready before rollout."
      );

      if (!env.googleMapsApiKey) {
        warnings.push(
          "GOOGLE_MAPS_API_KEY is missing. Delivery run optimization will fall back to manual ordering."
        );
      }

      if (
        !env.deliveryDepotLine1 ||
        !env.deliveryDepotCity ||
        !env.deliveryDepotRegion ||
        !env.deliveryDepotPostal ||
        !env.deliveryDepotCountry
      ) {
        warnings.push(
          "Delivery depot address is incomplete. Planned KM cannot be computed reliably until DELIVERY_DEPOT_* values are configured."
        );
      }
    }

    if (env.deliveryGpsTrackingEnabled && !env.deliveryExperimentalRoutingEnabled) {
      warnings.push(
        "DELIVERY_GPS_TRACKING_ENABLED=true is set while DELIVERY_EXPERIMENTAL_ROUTING_ENABLED=false. GPS capture will stay dormant until the experimental delivery module is enabled."
      );
    }
  }

  return { target, errors, warnings };
}


