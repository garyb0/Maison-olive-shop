import net from "node:net";
import { execSync } from "node:child_process";
import Stripe from "stripe";
import { resolvePublicSiteUrl } from "../src/lib/site-url";
import { STRIPE_API_VERSION } from "../src/lib/stripe-server";
import { loadEnvFilesInOrder } from "./db-utils";

loadEnvFilesInOrder([".env.production.local", ".env.production", ".env"]);

type CheckLevel = "pass" | "warn" | "fail";

type CheckResult = {
  name: string;
  level: CheckLevel;
  details: string;
};

function pushResult(results: CheckResult[], result: CheckResult) {
  results.push(result);
}

function hasFail(results: CheckResult[]) {
  return results.some((result) => result.level === "fail");
}

function hasWarn(results: CheckResult[]) {
  return results.some((result) => result.level === "warn");
}

function logResult(result: CheckResult) {
  const prefix = result.level === "pass" ? "PASS" : result.level === "warn" ? "WARN" : "FAIL";
  console.log(`${prefix} ${result.name}: ${result.details}`);
}

async function checkEnv(): Promise<CheckResult> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { validateEnv } = require("../src/lib/env");
  const report = validateEnv("production");

  if (report.errors.length > 0) {
    return {
      name: "environment",
      level: "fail",
      details: report.errors.join(" | "),
    };
  }

  if (report.warnings.length > 0) {
    return {
      name: "environment",
      level: "warn",
      details: report.warnings.join(" | "),
    };
  }

  return {
    name: "environment",
    level: "pass",
    details: "production required values are present",
  };
}

async function checkDbConnectivity() {
  let prismaClient: { $disconnect: () => Promise<void> } | null = null;

  try {
    const { loadEnvFilesInOrder: localLoad } = await import("./db-utils");
    localLoad([".env.production.local", ".env.production", ".env"]);

    const { prisma } = await import("../src/lib/prisma");
    prismaClient = prisma;

    const startedAt = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - startedAt;

    return {
      name: "database-connectivity",
      level: "pass",
      details: `SELECT 1 succeeded in ${latencyMs}ms`,
    } satisfies CheckResult;
  } catch (error) {
    return {
      name: "database-connectivity",
      level: "fail",
      details: error instanceof Error ? error.message : "DB query failed",
    } satisfies CheckResult;
  } finally {
    if (prismaClient) {
      await prismaClient.$disconnect().catch(() => undefined);
    }
  }
}

function checkMigrationsStatus() {
  try {
    const raw = execSync("npx prisma migrate status --schema prisma/schema.prisma", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL,
      },
    });

    const output = String(raw);
    if (/not yet applied|pending/i.test(output)) {
      return {
        name: "migrations",
        level: "fail",
        details: "pending migrations detected",
      } as CheckResult;
    }

    if (/up to date|All migration files are applied|No unapplied migration|No migrations found/i.test(output)) {
      return {
        name: "migrations",
        level: "pass",
        details: "schema migrations are up to date",
      } as CheckResult;
    }

    return {
      name: "migrations",
      level: "warn",
      details: "unexpected migrate status output; review manually",
    } as CheckResult;
  } catch (error) {
    const message = error instanceof Error ? error.message : "prisma migrate status failed";
    return {
      name: "migrations",
      level: "fail",
      details: message,
    } as CheckResult;
  }
}

async function checkStripeConnectivity() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ?? "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";

  if (!stripeSecretKey) {
    return {
      name: "stripe",
      level: "warn",
      details: "STRIPE_SECRET_KEY missing; checkout checks skipped",
    } satisfies CheckResult;
  }

  if (!webhookSecret) {
    return {
      name: "stripe",
      level: "fail",
      details: "STRIPE_WEBHOOK_SECRET missing while Stripe is configured",
    } satisfies CheckResult;
  }

  if (!publishableKey) {
    return {
      name: "stripe",
      level: "fail",
      details: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY missing while Stripe is configured",
    } satisfies CheckResult;
  }

  try {
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: STRIPE_API_VERSION,
    });

    const startedAt = Date.now();
    await stripe.balance.retrieve();

    return {
      name: "stripe",
      level: "pass",
      details: `stripe API reachable (${Date.now() - startedAt}ms)`,
    } satisfies CheckResult;
  } catch (error) {
    return {
      name: "stripe",
      level: "fail",
      details: error instanceof Error ? error.message : "stripe API reachability check failed",
    } satisfies CheckResult;
  }
}

async function checkEmail() {
  const resendApiKey = process.env.RESEND_API_KEY?.trim() ?? "";
  const smtpHost = process.env.SMTP_HOST?.trim() ?? "";

  if (!resendApiKey && !smtpHost) {
    return {
      name: "email",
      level: "warn",
      details: "No email provider configured (RESEND_API_KEY or SMTP_HOST)",
    } satisfies CheckResult;
  }

  if (smtpHost) {
    const smtpPort = Number(process.env.SMTP_PORT || "587");
    const start = Date.now();

    return new Promise<CheckResult>((resolve) => {
      const socket = net.connect({ host: smtpHost, port: smtpPort, timeout: 5000 }, () => {
        socket.destroy();
        resolve({
          name: "email",
          level: "pass",
          details: `SMTP ${smtpHost}:${smtpPort} reachable (${Date.now() - start}ms)`,
        } satisfies CheckResult);
      });

      socket.on("error", (error) => {
        resolve({
          name: "email",
          level: resendApiKey ? "warn" : "warn",
          details: `SMTP connection to ${smtpHost}:${smtpPort} failed (${error.message})`,
        } satisfies CheckResult);
      });

      socket.on("timeout", () => {
        socket.destroy();
        resolve({
          name: "email",
          level: "warn",
          details: `SMTP connection to ${smtpHost}:${smtpPort} timed out`,
        } satisfies CheckResult);
      });
    });
  }

  return {
    name: "email",
    level: "pass",
    details: "RESEND configured",
  } satisfies CheckResult;
}

async function checkStripeWebhookVersion(baseUrl: string) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";

  if (!stripeSecretKey || !webhookSecret) {
    return {
      name: "stripe-webhook-version",
      level: "warn",
      details: "Webhook version check skipped because Stripe is not fully configured",
    } satisfies CheckResult;
  }

  try {
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: STRIPE_API_VERSION,
    });
    const targetUrl = `${baseUrl}/api/stripe/webhook`;
    const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
    const endpoint = endpoints.data.find((candidate) => candidate.url === targetUrl);

    if (!endpoint) {
      return {
        name: "stripe-webhook-version",
        level: "warn",
        details: `No Stripe webhook endpoint found for ${targetUrl}`,
      } satisfies CheckResult;
    }

    if (endpoint.api_version && endpoint.api_version !== STRIPE_API_VERSION) {
      return {
        name: "stripe-webhook-version",
        level: "warn",
        details: `Stripe webhook endpoint uses ${endpoint.api_version}; app expects ${STRIPE_API_VERSION}`,
      } satisfies CheckResult;
    }

    return {
      name: "stripe-webhook-version",
      level: "pass",
      details: `Webhook endpoint version is aligned (${endpoint.api_version ?? STRIPE_API_VERSION})`,
    } satisfies CheckResult;
  } catch (error) {
    return {
      name: "stripe-webhook-version",
      level: "warn",
      details: error instanceof Error ? error.message : "Unable to inspect Stripe webhook endpoint version",
    } satisfies CheckResult;
  }
}

async function checkWebhookEndpoint(baseUrl: string) {
  if (!process.env.STRIPE_SECRET_KEY?.trim() || !process.env.STRIPE_WEBHOOK_SECRET?.trim()) {
    return {
      name: "stripe-webhook-endpoint",
      level: "warn",
      details: "Stripe webhook endpoint check skipped (Stripe webhook not fully configured)",
    } satisfies CheckResult;
  }

  const webhookUrl = `${baseUrl}/api/stripe/webhook`;
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": "",
      },
      body: JSON.stringify({ test: true }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const body = await response.text();
    const details = `status=${response.status}, elapsedMs=${Date.now() - startedAt}, body=${body.slice(0, 200)}`;

    if (response.status === 400 && body.includes("Missing stripe-signature")) {
      return {
        name: "stripe-webhook-endpoint",
        level: "pass",
        details,
      } satisfies CheckResult;
    }

    if (response.status === 405 || response.status === 404) {
      return {
        name: "stripe-webhook-endpoint",
        level: "fail",
        details: `stripe webhook endpoint is not accepting POST requests (${details})`,
      } satisfies CheckResult;
    }

    if (response.status >= 500) {
      return {
        name: "stripe-webhook-endpoint",
        level: "fail",
        details: `stripe webhook endpoint returned error (${details})`,
      } satisfies CheckResult;
    }

    return {
      name: "stripe-webhook-endpoint",
      level: "warn",
      details: `unrecognized webhook response (${details})`,
    } satisfies CheckResult;
  } catch (error) {
    clearTimeout(timeout);
    return {
      name: "stripe-webhook-endpoint",
      level: "warn",
      details: `webhook endpoint check failed: ${error instanceof Error ? error.message : "webhook ping failed"}`,
    } satisfies CheckResult;
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const baseUrl = resolvePublicSiteUrl({
    configuredUrl: process.env.NEXT_PUBLIC_SITE_URL,
    nodeEnv: "production",
  });

  const results: CheckResult[] = [];

  pushResult(results, {
    name: "target",
    level: "pass",
    details: `baseUrl=${baseUrl}`,
  });

  pushResult(results, await checkEnv());
  pushResult(results, await checkDbConnectivity());
  pushResult(results, checkMigrationsStatus());
  pushResult(results, await checkStripeConnectivity());
  pushResult(results, await checkStripeWebhookVersion(baseUrl));
  pushResult(results, await checkEmail());
  pushResult(results, await checkWebhookEndpoint(baseUrl));

  console.log("\nPROD verification");
  for (const result of results) {
    logResult(result);
  }

  if (hasFail(results)) {
    console.log("\nVerdict: not ready");
    process.exitCode = 1;
    return;
  }

  if (hasWarn(results)) {
    console.log("\nVerdict: conditionally ready (warnings present)");
    process.exitCode = 1;
    return;
  }

  console.log("\nVerdict: ready for production");
}

void main();
