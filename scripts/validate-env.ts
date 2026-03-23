import { loadEnvFilesInOrder } from "./db-utils";

const arg = (process.argv[2] ?? "development").toLowerCase();
const target = arg === "production" ? "production" : "development";

if (target === "production") {
  loadEnvFilesInOrder([".env.production.local", ".env.production"]);
}

loadEnvFilesInOrder([".env.local", ".env"]);

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { validateEnv } = require("../src/lib/env");
const report = validateEnv(target);

if (report.warnings.length > 0) {
  console.warn(`\n[env][${target}] warnings:`);
  for (const warning of report.warnings) {
    console.warn(`- ${warning}`);
  }
}

if (report.errors.length > 0) {
  console.error(`\n[env][${target}] errors:`);
  for (const error of report.errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`[env][${target}] validation passed.`);
