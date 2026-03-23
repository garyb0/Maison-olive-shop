import fs from "node:fs";
import path from "node:path";

function loadEnvFileIfExists(fileName: string) {
  const fullPath = path.resolve(process.cwd(), fileName);
  if (!fs.existsSync(fullPath)) return;

  const content = fs.readFileSync(fullPath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const equalIndex = line.indexOf("=");
    if (equalIndex <= 0) continue;

    const key = line.slice(0, equalIndex).trim();
    let value = line.slice(equalIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

const arg = (process.argv[2] ?? "development").toLowerCase();
const target = arg === "production" ? "production" : "development";

if (target === "production") {
  loadEnvFileIfExists(".env.production.local");
  loadEnvFileIfExists(".env.production");
}

loadEnvFileIfExists(".env.local");
loadEnvFileIfExists(".env");

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
