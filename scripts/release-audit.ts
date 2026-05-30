import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export type ReleaseAuditLevel = "pass" | "warn" | "fail";

export type ReleaseAuditItem = {
  level: ReleaseAuditLevel;
  name: string;
  details: string;
};

export type ReleaseAuditReport = {
  items: ReleaseAuditItem[];
  statusLines: string[];
};

const pathFromStatusLine = (line: string) => line.slice(3).trim().replace(/^"|"$/g, "");

function hasPath(statusLines: string[], predicate: (path: string, line: string) => boolean) {
  return statusLines.some((line) => predicate(pathFromStatusLine(line), line));
}

function countPaths(statusLines: string[], predicate: (path: string, line: string) => boolean) {
  return statusLines.filter((line) => predicate(pathFromStatusLine(line), line)).length;
}

function isDeletion(line: string) {
  return line.startsWith(" D ") || line.startsWith("D  ") || line.startsWith("DD ");
}

function fileExists(projectRoot: string, filePath: string) {
  return fs.existsSync(path.join(projectRoot, filePath));
}

function fileTextIncludes(projectRoot: string, filePath: string, text: string) {
  try {
    return fs.readFileSync(path.join(projectRoot, filePath), "utf8").includes(text);
  } catch {
    return false;
  }
}

export function analyzeReleaseStatus(statusText: string, projectRoot = process.cwd()): ReleaseAuditReport {
  const statusLines = statusText.split(/\r?\n/).map((line) => line.trimEnd()).filter(Boolean);
  const items: ReleaseAuditItem[] = [];

  items.push({
    level: statusLines.length === 0 ? "pass" : "warn",
    name: "worktree",
    details: statusLines.length === 0 ? "clean" : `${statusLines.length} changed or untracked paths`,
  });

  const envCount = countPaths(statusLines, (filePath) => /^\.env(\.|$)/.test(filePath));
  items.push({
    level: envCount > 0 ? "warn" : "pass",
    name: "env-files",
    details: envCount > 0 ? `${envCount} env file path(s) changed; review secrets before commit` : "no env file changes",
  });

  const backupCount = countPaths(statusLines, (filePath, line) => {
    if (isDeletion(line)) {
      return false;
    }

    return filePath.startsWith("backups/") || filePath.startsWith("storage/");
  });
  items.push({
    level: backupCount > 0 ? "fail" : "pass",
    name: "runtime-artifacts",
    details: backupCount > 0
      ? `${backupCount} backup/storage path(s) added or modified in git status`
      : "no backup/storage additions visible",
  });

  const sandboxCount = countPaths(statusLines, (filePath) => (
    filePath.includes("delivery-sandbox") ||
    filePath.includes("sandbox-orders") ||
    filePath.includes("smoke") ||
    filePath.includes("fixtures/")
  ));
  items.push({
    level: sandboxCount > 0 ? "warn" : "pass",
    name: "demo-smoke-assets",
    details: sandboxCount > 0 ? `${sandboxCount} sandbox/smoke/demo path(s) need intentional review` : "no sandbox/smoke paths visible",
  });

  const pwaChanged =
    hasPath(statusLines, (filePath) => filePath === "src/app/manifest.ts") &&
    hasPath(statusLines, (filePath) => filePath.startsWith("src/app/app/")) &&
    hasPath(statusLines, (filePath) => filePath === "src/e2e/pwa-app.spec.ts");
  const pwaPresent =
    fileExists(projectRoot, "src/app/manifest.ts") &&
    fileExists(projectRoot, "src/app/app/page.tsx") &&
    fileExists(projectRoot, "src/e2e/pwa-app.spec.ts");
  const pwaReady = pwaChanged || pwaPresent;
  items.push({
    level: pwaReady ? "pass" : "warn",
    name: "pwa-v1",
    details: pwaReady
      ? "manifest, /app hub, and Playwright PWA spec are present"
      : "PWA release paths are missing",
  });

  const legacyHelpPages = ["src/app/shipping/page.tsx", "src/app/returns/page.tsx"];
  const removedLegacyHelpInStatus = legacyHelpPages
    .every((filePath) => statusLines.some((line) => line.startsWith(" D ") && pathFromStatusLine(line) === filePath));
  const legacyHelpRemovedFromTree = legacyHelpPages.every((filePath) => !fileExists(projectRoot, filePath));
  const redirectsPresent =
    fileTextIncludes(projectRoot, "next.config.ts", 'source: "/shipping"') &&
    fileTextIncludes(projectRoot, "next.config.ts", 'destination: "/faq#livraison"') &&
    fileTextIncludes(projectRoot, "next.config.ts", 'source: "/returns"') &&
    fileTextIncludes(projectRoot, "next.config.ts", 'destination: "/faq#retours"') &&
    fileExists(projectRoot, "src/app/terms/page.tsx");
  const removedLegacyHelp = (removedLegacyHelpInStatus || legacyHelpRemovedFromTree) && redirectsPresent;
  items.push({
    level: removedLegacyHelp ? "pass" : "warn",
    name: "help-redirect-cleanup",
    details: removedLegacyHelp
      ? "legacy shipping/returns pages removed, redirects are present, and /terms exists as a legal page"
      : "legacy help cleanup, redirects, or /terms legal page are missing",
  });

  return { items, statusLines };
}

export function formatReleaseAudit(report: ReleaseAuditReport) {
  const prefix = (level: ReleaseAuditLevel) => level === "pass" ? "PASS" : level === "warn" ? "WARN" : "FAIL";
  return [
    "Release audit",
    ...report.items.map((item) => `${prefix(item.level)} ${item.name}: ${item.details}`),
  ].join("\n");
}

function hasFail(report: ReleaseAuditReport) {
  return report.items.some((item) => item.level === "fail");
}

function main() {
  const statusText = execSync("git status --short", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const report = analyzeReleaseStatus(statusText);

  console.log(formatReleaseAudit(report));

  if (hasFail(report)) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}
