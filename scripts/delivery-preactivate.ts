import { getEnvFilesForTarget, loadEnvFilesInOrder, resolveEnvTargetFromArgs } from "./db-utils";
import { readDeliveryCheckpointManifest } from "./delivery-checkpoint-lib";

type CheckLevel = "pass" | "warn" | "fail";

type CheckResult = {
  name: string;
  level: CheckLevel;
  details: string;
};

type RoutePlanningSnippet = {
  targetEnvFile: string;
  lines: string[];
};

function parseFlagValue(flagName: string) {
  const prefix = `${flagName}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function logResult(result: CheckResult) {
  const prefix = result.level === "pass" ? "PASS" : result.level === "warn" ? "WARN" : "FAIL";
  console.log(`${prefix} ${result.name}: ${result.details}`);
}

function hasFail(results: CheckResult[]) {
  return results.some((result) => result.level === "fail");
}

function hasWarn(results: CheckResult[]) {
  return results.some((result) => result.level === "warn");
}

function getTargetEnvFile(envTarget: "development" | "production") {
  return envTarget === "production" ? ".env.production.local" : ".env.local";
}

function quoteEnvValue(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function buildRoutePlanningSnippet(
  envTarget: "development" | "production",
  options: {
    googleMapsConfigured: boolean;
    depotAddressConfigured: boolean;
  },
) {
  const targetEnvFile = getTargetEnvFile(envTarget);
  const lines = [
    `GOOGLE_MAPS_API_KEY=${quoteEnvValue(options.googleMapsConfigured ? process.env.GOOGLE_MAPS_API_KEY ?? "" : "<set-me>")}`,
    `DELIVERY_DEPOT_LABEL=${quoteEnvValue(process.env.DELIVERY_DEPOT_LABEL?.trim() || "Chez Olive")}`,
    `DELIVERY_DEPOT_LINE1=${quoteEnvValue(process.env.DELIVERY_DEPOT_LINE1?.trim() || "<set-me>")}`,
    `DELIVERY_DEPOT_CITY=${quoteEnvValue(process.env.DELIVERY_DEPOT_CITY?.trim() || "Rimouski")}`,
    `DELIVERY_DEPOT_REGION=${quoteEnvValue(process.env.DELIVERY_DEPOT_REGION?.trim() || "QC")}`,
    `DELIVERY_DEPOT_POSTAL=${quoteEnvValue(process.env.DELIVERY_DEPOT_POSTAL?.trim() || "<set-me>")}`,
    `DELIVERY_DEPOT_COUNTRY=${quoteEnvValue(process.env.DELIVERY_DEPOT_COUNTRY?.trim() || "CA")}`,
  ];

  if (!options.googleMapsConfigured || !options.depotAddressConfigured) {
    return {
      targetEnvFile,
      lines,
    } satisfies RoutePlanningSnippet;
  }

  return null;
}

async function main() {
  const envTarget = resolveEnvTargetFromArgs(process.argv, "development");
  loadEnvFilesInOrder(getEnvFilesForTarget(envTarget));

  const currentFlagEnabled = process.env.DELIVERY_EXPERIMENTAL_ROUTING_ENABLED === "true";
  const samplePostal = parseFlagValue("--postal") ?? process.env.DELIVERY_PREACTIVATE_POSTAL ?? "G5L 1A1";
  const sampleCountry = parseFlagValue("--country") ?? process.env.DELIVERY_PREACTIVATE_COUNTRY ?? "CA";
  const checkpointArg = process.argv.slice(2).find((value) => !value.startsWith("--"));

  if (!currentFlagEnabled) {
    process.env.DELIVERY_EXPERIMENTAL_ROUTING_ENABLED = "true";
  }

  const [{ validateEnv, env }, { resolvePublicSiteUrl }] = await Promise.all([
    import("../src/lib/env"),
    import("../src/lib/site-url"),
  ]);

  const {
    getCheckoutDeliverySlots,
  } = await import("../src/lib/delivery");
  const {
    isDeliveryGpsTrackingEnabled,
    isDeliveryRunsSchemaAvailable,
    isGoogleRoutePlanningReady,
  } = await import("../src/lib/delivery-runs");
  const { getDeliveryDepotAddress, hasGoogleMapsApiKey } = await import("../src/lib/google-maps");
  const { prisma } = await import("../src/lib/prisma");

  const baseUrl = resolvePublicSiteUrl({
    configuredUrl: process.env.NEXT_PUBLIC_SITE_URL,
    nodeEnv: envTarget,
  });

  const results: CheckResult[] = [];

  results.push({
    name: "target",
    level: "pass",
    details: `baseUrl=${baseUrl} env=${envTarget}`,
  });

  results.push({
    name: "flag-current-state",
    level: currentFlagEnabled ? "warn" : "pass",
    details: currentFlagEnabled
      ? "DELIVERY_EXPERIMENTAL_ROUTING_ENABLED is already true in the current environment."
      : "DELIVERY_EXPERIMENTAL_ROUTING_ENABLED is currently false; checks are being evaluated as if it were enabled.",
  });

  try {
    const manifest = readDeliveryCheckpointManifest(process.cwd(), checkpointArg);
    const snapshotKind = manifest.git.snapshotKind ?? "head";
    const level: CheckLevel =
      manifest.database.kind === "missing"
        ? "fail"
        : manifest.database.kind === "managed"
          ? "warn"
          : "pass";

    results.push({
      name: "checkpoint",
      level,
      details: `tag=${manifest.git.tag} createdAt=${manifest.createdAt} snapshot=${snapshotKind} db=${manifest.database.kind}`,
    });

    if (manifest.git.dirty && snapshotKind !== "worktree") {
      results.push({
        name: "checkpoint-snapshot-fidelity",
        level: "fail",
        details: "Dirty checkpoint detected without a worktree snapshot. Create a fresh checkpoint with --allow-dirty before rollout.",
      });
    } else {
      results.push({
        name: "checkpoint-snapshot-fidelity",
        level: "pass",
        details: manifest.git.dirty
          ? "Dirty worktree checkpoint includes a dedicated worktree snapshot commit."
          : "Checkpoint was taken from a clean Git state.",
      });
    }
  } catch (error) {
    results.push({
      name: "checkpoint",
      level: "fail",
      details: error instanceof Error ? error.message : "Unable to read delivery checkpoint manifest.",
    });
  }

  const envReport = validateEnv(envTarget);
  if (envReport.errors.length > 0) {
    results.push({
      name: "environment",
      level: "fail",
      details: envReport.errors.join(" | "),
    });
  } else if (envReport.warnings.length > 0) {
    results.push({
      name: "environment",
      level: "warn",
      details: envReport.warnings.join(" | "),
    });
  } else {
    results.push({
      name: "environment",
      level: "pass",
      details: `Environment validated for ${envTarget}.`,
    });
  }

  try {
    const startedAt = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    results.push({
      name: "database-connectivity",
      level: "pass",
      details: `SELECT 1 succeeded in ${Date.now() - startedAt}ms`,
    });
  } catch (error) {
    results.push({
      name: "database-connectivity",
      level: "fail",
      details: error instanceof Error ? error.message : "Unable to query the database.",
    });
  }

  try {
    const schemaAvailable = await isDeliveryRunsSchemaAvailable();
    results.push({
      name: "delivery-schema",
      level: schemaAvailable ? "pass" : "fail",
      details: schemaAvailable
        ? "Delivery run tables are available."
        : "Delivery run tables are missing. Run Prisma migrations before enabling the flag.",
    });
  } catch (error) {
    results.push({
      name: "delivery-schema",
      level: "fail",
      details: error instanceof Error ? error.message : "Unable to inspect delivery schema availability.",
    });
  }

  try {
    const response = await fetch(`${baseUrl}/api/health`);
    if (!response.ok) {
      results.push({
        name: "runtime-health",
        level: "fail",
        details: `HTTP ${response.status}`,
      });
    } else {
      const payload = (await response.json()) as {
        ok?: boolean;
        release?: string;
      };
      results.push({
        name: "runtime-health",
        level: payload.ok ? "pass" : "fail",
        details: `release=${payload.release ?? "n/a"}`,
      });
    }
  } catch (error) {
    results.push({
      name: "runtime-health",
      level: "fail",
      details: error instanceof Error ? error.message : "Health check failed.",
    });
  }

  try {
    const slots = await getCheckoutDeliverySlots({
      postalCode: samplePostal,
      country: sampleCountry,
      mode: "dynamic",
    });

    if (slots.mode !== "dynamic") {
      results.push({
        name: "dynamic-checkout-slots",
        level: "fail",
        details: `Expected dynamic mode but received ${slots.mode}.`,
      });
    } else if (slots.slots.length === 0) {
      results.push({
        name: "dynamic-checkout-slots",
        level: "warn",
        details: `Dynamic mode is active but no available windows were returned for ${samplePostal}, ${sampleCountry}.`,
      });
    } else {
      const first = slots.slots[0];
      results.push({
        name: "dynamic-checkout-slots",
        level: "pass",
        details: `${slots.slots.length} windows available for ${samplePostal}, ${sampleCountry}; first=${first.startAt} -> ${first.endAt}`,
      });
    }
  } catch (error) {
    results.push({
      name: "dynamic-checkout-slots",
      level: "fail",
      details: error instanceof Error ? error.message : "Unable to evaluate dynamic checkout windows.",
    });
  }

  const googleMapsConfigured = hasGoogleMapsApiKey();
  const depotAddress = getDeliveryDepotAddress();
  const routePlanningReady = isGoogleRoutePlanningReady();
  const routePlanningSnippet = buildRoutePlanningSnippet(envTarget, {
    googleMapsConfigured,
    depotAddressConfigured: Boolean(depotAddress),
  });

  if (routePlanningReady) {
    results.push({
      name: "route-planning",
      level: "pass",
      details: "Google Maps API key and depot address are configured.",
    });
  } else {
    const missingBits = [
      googleMapsConfigured ? null : "GOOGLE_MAPS_API_KEY",
      depotAddress ? null : "DELIVERY_DEPOT_*",
    ].filter(Boolean);

    results.push({
      name: "route-planning",
      level: "warn",
      details: `Route planning will fall back to manual ordering until ${missingBits.join(" + ")} is configured.`,
    });
  }

  results.push({
    name: "gps-tracking",
    level: isDeliveryGpsTrackingEnabled() ? "pass" : "warn",
    details: isDeliveryGpsTrackingEnabled()
      ? "GPS tracking will be active when drivers start a run."
      : "GPS tracking is disabled; driver runs will work, but live GPS samples will remain off.",
  });

  console.log("Delivery pre-activation check");
  for (const result of results) {
    logResult(result);
  }

  if (routePlanningSnippet) {
    console.log(`\nSuggested route-planning snippet for ${routePlanningSnippet.targetEnvFile}:`);
    for (const line of routePlanningSnippet.lines) {
      console.log(line);
    }
  }

  if (hasFail(results)) {
    console.log("\nVerdict: not ready to enable experimental delivery mode");
    process.exitCode = 1;
    return;
  }

  if (hasWarn(results)) {
    console.log("\nVerdict: conditionally ready, but warnings should be reviewed before enabling the flag");
    process.exitCode = 1;
    return;
  }

  console.log("\nVerdict: ready to enable experimental delivery mode");
}

void main();
