import fs from "node:fs";
import path from "node:path";

type FindingLevel = "fail" | "warn";

type Finding = {
  level: FindingLevel;
  path: string;
  reason: string;
};

const projectRoot = process.cwd();

const skippedDirectories = new Set([
  ".git",
  ".next",
  "node_modules",
  "coverage",
  "playwright-report",
  "test-results",
  "audit-output",
  "output",
  "storage",
  "logs",
]);

const exactFailPaths = new Map<string, string>([
  ["android/key.properties", "Android signing properties must not live under the project root."],
  ["reset-password-script.js", "Reset helpers with credential material must not live under the project root."],
  ["scripts/windows/cloudflare-ddns.env", "Cloudflare DDNS tokens must not live under the project root."],
  ["cloudflared-config.yml", "Cloudflare tunnel config must be stored outside the public project root."],
]);

function toRelative(filePath: string) {
  return path.relative(projectRoot, filePath).replace(/\\/g, "/");
}

function isEnvWarning(relativePath: string) {
  const name = path.posix.basename(relativePath);
  return name.startsWith(".env") && name !== ".env.example" && name !== ".env.production.example";
}

function isDatabaseArtifact(relativePath: string) {
  const name = path.posix.basename(relativePath).toLowerCase();
  return (
    name.endsWith(".db") ||
    name.includes(".db-") ||
    name.includes(".db.") ||
    name.endsWith(".sqlite") ||
    name.endsWith(".sqlite3") ||
    name.endsWith(".db-journal")
  );
}

function isSigningArtifact(relativePath: string) {
  const lower = relativePath.toLowerCase();
  return lower.startsWith("android/app/") && (lower.endsWith(".keystore") || lower.endsWith(".jks"));
}

function isCloudflareArtifact(relativePath: string) {
  const lower = relativePath.toLowerCase();
  return lower.endsWith(".cloudflared.json") || lower === "tools/cloudflared.exe";
}

function inspectFile(relativePath: string): Finding[] {
  const findings: Finding[] = [];
  const exactReason = exactFailPaths.get(relativePath);

  if (exactReason) {
    findings.push({ level: "fail", path: relativePath, reason: exactReason });
  }

  if (isSigningArtifact(relativePath)) {
    findings.push({ level: "fail", path: relativePath, reason: "Android release signing files must stay outside the project root." });
  }

  if (isDatabaseArtifact(relativePath)) {
    findings.push({ level: "fail", path: relativePath, reason: "Local or production-like database files must stay outside the project root." });
  }

  if (isCloudflareArtifact(relativePath)) {
    findings.push({ level: "fail", path: relativePath, reason: "Cloudflare runtime artifacts must stay outside the project root." });
  }

  if (isEnvWarning(relativePath)) {
    findings.push({ level: "warn", path: relativePath, reason: "Review env files for secrets before release or commit." });
  }

  return findings;
}

function walk(currentDirectory: string): Finding[] {
  const findings: Finding[] = [];

  for (const entry of fs.readdirSync(currentDirectory, { withFileTypes: true })) {
    const fullPath = path.join(currentDirectory, entry.name);
    const relativePath = toRelative(fullPath);

    if (entry.isDirectory()) {
      if (skippedDirectories.has(entry.name) || skippedDirectories.has(relativePath)) {
        continue;
      }
      findings.push(...walk(fullPath));
      continue;
    }

    if (!entry.isFile() && !entry.isSymbolicLink()) {
      continue;
    }

    findings.push(...inspectFile(relativePath));
  }

  return findings;
}

function main() {
  const findings = walk(projectRoot);
  const failures = findings.filter((finding) => finding.level === "fail");
  const warnings = findings.filter((finding) => finding.level === "warn");

  console.log("Security audit");
  if (findings.length === 0) {
    console.log("PASS no sensitive local artifacts found under project root");
    return;
  }

  for (const finding of findings) {
    const prefix = finding.level === "fail" ? "FAIL" : "WARN";
    console.log(`${prefix} ${finding.path}: ${finding.reason}`);
  }

  if (warnings.length > 0 && failures.length === 0) {
    console.log(`WARN ${warnings.length} warning(s); review before release.`);
  }

  if (failures.length > 0) {
    console.error(`Security audit failed with ${failures.length} blocking finding(s).`);
    process.exitCode = 1;
  }
}

main();
