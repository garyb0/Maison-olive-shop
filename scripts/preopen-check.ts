import { loadEnvFilesInOrder } from "./db-utils";

loadEnvFilesInOrder([".env.production.local", ".env.production", ".env"]);

type CheckLevel = "pass" | "warn" | "fail";

type CheckResult = {
  name: string;
  level: CheckLevel;
  details: string;
};

function logCheck(result: CheckResult) {
  const prefix =
    result.level === "pass" ? "PASS" : result.level === "warn" ? "WARN" : "FAIL";
  console.log(`${prefix} ${result.name} -> ${result.details}`);
}

async function checkHealth(baseUrl: string): Promise<CheckResult> {
  try {
    const response = await fetch(`${baseUrl}/api/health`);
    if (!response.ok) {
      return { name: "health", level: "fail", details: `HTTP ${response.status}` };
    }

    const payload = (await response.json()) as {
      ok?: boolean;
      release?: string;
      checks?: { db?: { ok?: boolean; latencyMs?: number } };
    };

    if (!payload.ok) {
      return { name: "health", level: "fail", details: JSON.stringify(payload) };
    }

    return {
      name: "health",
      level: "pass",
      details: `release=${payload.release ?? "n/a"} db=${payload.checks?.db?.latencyMs ?? "?"}ms`,
    };
  } catch (error) {
    return {
      name: "health",
      level: "fail",
      details: error instanceof Error ? error.message : "unknown error",
    };
  }
}

async function checkPublicHomepage(baseUrl: string): Promise<CheckResult> {
  try {
    const response = await fetch(baseUrl, { redirect: "manual" });
    const rewrite = response.headers.get("x-middleware-rewrite");
    if (rewrite === "/maintenance") {
      return {
        name: "public-homepage",
        level: "fail",
        details: "maintenance page is still active",
      };
    }

    if (!response.ok) {
      return {
        name: "public-homepage",
        level: "fail",
        details: `HTTP ${response.status}`,
      };
    }

    return {
      name: "public-homepage",
      level: "pass",
      details: `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      name: "public-homepage",
      level: "fail",
      details: error instanceof Error ? error.message : "unknown error",
    };
  }
}

async function checkMaintenanceState(): Promise<CheckResult> {
  const { getMaintenanceState } = await import("../src/lib/maintenance");
  const state = getMaintenanceState();
  if (state.enabled) {
    return {
      name: "maintenance-state",
      level: "fail",
      details: `enabled=true openAt=${state.openAt?.toISOString() ?? "none"}`,
    };
  }

  return {
    name: "maintenance-state",
    level: "pass",
    details: "enabled=false",
  };
}

function checkCommercialReadiness(): CheckResult[] {
  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  const webhook = process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";
  const resend = process.env.RESEND_API_KEY?.trim() ?? "";
  const resendFrom = process.env.RESEND_FROM_EMAIL?.trim() ?? "";

  const results: CheckResult[] = [];

  if (!stripeKey) {
    results.push({
      name: "stripe-live",
      level: "warn",
      details: "STRIPE_SECRET_KEY is missing; paid checkout is not commercially ready",
    });
  } else if (stripeKey.startsWith("sk_test_")) {
    results.push({
      name: "stripe-live",
      level: "warn",
      details: "test Stripe key configured",
    });
  } else if (!webhook) {
    results.push({
      name: "stripe-live",
      level: "fail",
      details: "webhook secret missing while Stripe is configured",
    });
  } else {
    results.push({
      name: "stripe-live",
      level: "pass",
      details: "live Stripe configuration present",
    });
  }

  if (!resend) {
    results.push({
      name: "email-transactional",
      level: "warn",
      details: "RESEND_API_KEY is missing",
    });
  } else if (!resendFrom || resendFrom.includes("onboarding@resend.dev")) {
    results.push({
      name: "email-transactional",
      level: "fail",
      details: "RESEND_FROM_EMAIL is not production-ready",
    });
  } else {
    results.push({
      name: "email-transactional",
      level: "pass",
      details: "transactional email configuration present",
    });
  }

  return results;
}

async function main() {
  const [{ validateEnv }, { resolvePublicSiteUrl }] = await Promise.all([
    import("../src/lib/env"),
    import("../src/lib/site-url"),
  ]);

  const envReport = validateEnv("production");
  const baseUrl = resolvePublicSiteUrl({
    configuredUrl: process.env.NEXT_PUBLIC_SITE_URL,
    nodeEnv: "production",
  });

  const checks: CheckResult[] = [];

  checks.push({
    name: "target-site",
    level: "pass",
    details: baseUrl,
  });

  if (envReport.errors.length > 0) {
    checks.push({
      name: "env-validation",
      level: "fail",
      details: envReport.errors.join(" | "),
    });
  } else if (envReport.warnings.length > 0) {
    checks.push({
      name: "env-validation",
      level: "warn",
      details: envReport.warnings.join(" | "),
    });
  } else {
    checks.push({
      name: "env-validation",
      level: "pass",
      details: "production environment validated",
    });
  }

  checks.push(await checkMaintenanceState());
  checks.push(await checkHealth(baseUrl));
  checks.push(await checkPublicHomepage(baseUrl));
  checks.push(...checkCommercialReadiness());

  console.log("Pre-opening check");
  for (const check of checks) {
    logCheck(check);
  }

  const hasFail = checks.some((check) => check.level === "fail");
  const hasWarn = checks.some((check) => check.level === "warn");

  if (!hasFail && !hasWarn) {
    console.log("Verdict -> ready to open");
    return;
  }

  if (!hasFail && hasWarn) {
    console.log("Verdict -> technically openable, but commercial warnings remain");
    process.exitCode = 1;
    return;
  }

  console.log("Verdict -> do not open yet");
  process.exitCode = 1;
}

void main();
