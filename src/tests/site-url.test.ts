import { afterEach, describe, expect, it, vi } from "vitest";
import { isLocalhostSiteUrl, isSecureSiteUrl, resolvePublicSiteUrl } from "@/lib/site-url";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, ORIGINAL_ENV);
  vi.resetModules();
});

describe("site url helpers", () => {
  it("detects localhost-style urls", () => {
    expect(isLocalhostSiteUrl("http://localhost:3101")).toBe(true);
    expect(isLocalhostSiteUrl("http://127.0.0.1:3000")).toBe(true);
    expect(isLocalhostSiteUrl("https://chezolive.ca")).toBe(false);
  });

  it("detects secure public urls", () => {
    expect(isSecureSiteUrl("https://chezolive.ca")).toBe(true);
    expect(isSecureSiteUrl("http://chezolive.ca")).toBe(false);
  });

  it("falls back to request origin only outside production", () => {
    expect(
      resolvePublicSiteUrl({
        nodeEnv: "development",
        request: new Request("https://preview.chezolive.ca/api/health"),
        configuredUrl: "",
      }),
    ).toBe("https://preview.chezolive.ca");

    expect(
      resolvePublicSiteUrl({
        nodeEnv: "production",
        request: new Request("https://preview.chezolive.ca/api/health"),
        configuredUrl: "",
      }),
    ).toBe("http://localhost:3101");
  });
});

describe("validateEnv production hardening", () => {
  it("flags localhost, dev.db and sandbox email in production", async () => {
    Object.assign(process.env, {
      NODE_ENV: "production",
      NEXT_PUBLIC_SITE_URL: "http://localhost:3101",
      DATABASE_URL: "file:./dev.db",
      SESSION_SECRET: "x".repeat(48),
      RESEND_API_KEY: "re_test_key",
      RESEND_FROM_EMAIL: "Chez Olive <onboarding@resend.dev>",
    });

    const { validateEnv } = await import("@/lib/env");
    const report = validateEnv("production");

    expect(report.errors).toEqual(
      expect.arrayContaining([
        "NEXT_PUBLIC_SITE_URL cannot point to localhost in production.",
        "DATABASE_URL still points to dev.db; use a production database before go-live.",
        "RESEND_FROM_EMAIL still uses the Resend onboarding sandbox address in production.",
      ]),
    );
  });

  it("warns when the Stripe publishable key is missing", async () => {
    Object.assign(process.env, {
      NODE_ENV: "production",
      NEXT_PUBLIC_SITE_URL: "https://chezolive.ca",
      DATABASE_URL: "file:./prod.db",
      SESSION_SECRET: "x".repeat(48),
      RESEND_API_KEY: "re_live_key",
      RESEND_FROM_EMAIL: "Chez Olive <support@chezolive.ca>",
      STRIPE_SECRET_KEY: "sk_live_123",
      STRIPE_WEBHOOK_SECRET: "whsec_123",
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "",
    });

    const { validateEnv } = await import("@/lib/env");
    const report = validateEnv("production");

    expect(report.warnings).toContain(
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is missing. Embedded Stripe checkout will stay disabled until the publishable key is added and the app is rebuilt.",
    );
  });

  it("flags mismatched Stripe live and test key pairing", async () => {
    Object.assign(process.env, {
      NODE_ENV: "production",
      NEXT_PUBLIC_SITE_URL: "https://chezolive.ca",
      DATABASE_URL: "file:./prod.db",
      SESSION_SECRET: "x".repeat(48),
      RESEND_API_KEY: "re_live_key",
      RESEND_FROM_EMAIL: "Chez Olive <support@chezolive.ca>",
      STRIPE_SECRET_KEY: "sk_live_123",
      STRIPE_WEBHOOK_SECRET: "whsec_123",
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_123",
    });

    const { validateEnv } = await import("@/lib/env");
    const report = validateEnv("production");

    expect(report.errors).toContain(
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is test key while STRIPE_SECRET_KEY is live.",
    );
  });
});
