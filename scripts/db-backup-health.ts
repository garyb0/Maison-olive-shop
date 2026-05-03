import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import {
  loadDatabaseEnvForTarget,
  resolveBackupDirFromEnv,
  resolveEnvTargetFromArgs,
  resolveDatabaseFromEnv,
} from "./db-utils";

type CheckLevel = "pass" | "warn" | "fail";

type CheckResult = {
  name: string;
  level: CheckLevel;
  details: string;
};

function getFlagValue(flagName: string) {
  const prefix = `${flagName}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function getFlagNumber(flagName: string, fallback: number) {
  const value = Number(getFlagValue(flagName));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function logResult(result: CheckResult) {
  const prefix = result.level === "pass" ? "PASS" : result.level === "warn" ? "WARN" : "FAIL";
  console.log(`${prefix} ${result.name}: ${result.details}`);
}

function backupDbFiles(backupDir: string) {
  if (!fs.existsSync(backupDir)) return [];

  return fs
    .readdirSync(backupDir)
    .filter((name) => name.toLowerCase().endsWith(".db"))
    .map((name) => {
      const fullPath = path.join(backupDir, name);
      const stats = fs.statSync(fullPath);
      const manifestPath = `${fullPath}.json`;
      let createdAtMs: number | null = null;
      if (fs.existsSync(manifestPath)) {
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as { createdAt?: unknown };
          if (typeof manifest.createdAt === "string") {
            const parsed = Date.parse(manifest.createdAt);
            createdAtMs = Number.isFinite(parsed) ? parsed : null;
          }
        } catch {
          createdAtMs = null;
        }
      }
      return {
        fullPath,
        name,
        size: stats.size,
        sortTimeMs: createdAtMs ?? stats.birthtimeMs ?? stats.mtimeMs,
      };
    })
    .sort((a, b) => b.sortTimeMs - a.sortTimeMs);
}

function readIntegrityValue(row: Record<string, unknown> | undefined) {
  if (!row) return "";
  const firstValue = Object.values(row)[0];
  return typeof firstValue === "string" ? firstValue : String(firstValue ?? "");
}

async function checkSqliteIntegrity(dbPath: string): Promise<CheckResult> {
  const client = createClient({ url: `file:${dbPath}` });

  try {
    const integrity = await client.execute("PRAGMA integrity_check");
    const value = readIntegrityValue(integrity.rows[0] as Record<string, unknown> | undefined);
    if (value.toLowerCase() !== "ok") {
      return {
        name: "latest-backup-integrity",
        level: "fail",
        details: `PRAGMA integrity_check returned ${value || "empty result"}`,
      };
    }

    const tables = await client.execute("SELECT count(*) as count FROM sqlite_master WHERE type = 'table'");
    const tableCount = Number((tables.rows[0] as { count?: unknown } | undefined)?.count ?? 0);
    if (!Number.isFinite(tableCount) || tableCount < 1) {
      return {
        name: "latest-backup-integrity",
        level: "fail",
        details: "backup opens, but no tables were found",
      };
    }

    return {
      name: "latest-backup-integrity",
      level: "pass",
      details: `PRAGMA integrity_check ok, tables=${tableCount}`,
    };
  } catch (error) {
    return {
      name: "latest-backup-integrity",
      level: "fail",
      details: error instanceof Error ? error.message : "unknown error",
    };
  } finally {
    client.close();
  }
}

async function main() {
  const envTarget = resolveEnvTargetFromArgs(undefined, "production");
  loadDatabaseEnvForTarget(envTarget);

  const maxAgeHours = getFlagNumber("--max-age-hours", 2);
  const minBackups = getFlagNumber("--min-backups", 3);
  const backupDir = resolveBackupDirFromEnv();
  const db = resolveDatabaseFromEnv();
  const results: CheckResult[] = [];
  const backups = backupDbFiles(backupDir);

  if (db.kind === "missing") {
    results.push({
      name: "database-url",
      level: "fail",
      details: "DATABASE_URL is missing",
    });
  } else if (db.kind === "non-sqlite") {
    results.push({
      name: "database-url",
      level: "warn",
      details: "DATABASE_URL is not a local SQLite file; use provider backup health checks",
    });
  } else if (!fs.existsSync(db.dbPath)) {
    results.push({
      name: "source-database",
      level: "fail",
      details: `source DB is missing: ${db.dbPath}`,
    });
  } else {
    const sourceSize = fs.statSync(db.dbPath).size;
    results.push({
      name: "source-database",
      level: "pass",
      details: `${db.dbPath}, size=${sourceSize}`,
    });
  }

  if (backups.length < 1) {
    results.push({
      name: "backup-count",
      level: "fail",
      details: `no .db backups found in ${backupDir}`,
    });
  } else if (backups.length < minBackups) {
    results.push({
      name: "backup-count",
      level: "warn",
      details: `${backups.length} backup(s), expected at least ${minBackups}`,
    });
  } else {
    results.push({
      name: "backup-count",
      level: "pass",
      details: `${backups.length} backup(s) found`,
    });
  }

  const latest = backups[0];
  if (latest) {
    const ageHours = (Date.now() - latest.sortTimeMs) / 1000 / 60 / 60;
    const manifestPath = `${latest.fullPath}.json`;
    results.push({
      name: "latest-backup-age",
      level: ageHours <= maxAgeHours ? "pass" : "fail",
      details: `${latest.name}, age=${ageHours.toFixed(2)}h, max=${maxAgeHours}h`,
    });
    results.push({
      name: "latest-backup-size",
      level: latest.size > 1024 ? "pass" : "fail",
      details: `size=${latest.size}`,
    });
    results.push({
      name: "latest-backup-manifest",
      level: fs.existsSync(manifestPath) ? "pass" : "warn",
      details: fs.existsSync(manifestPath) ? manifestPath : "manifest is missing",
    });
    results.push(await checkSqliteIntegrity(latest.fullPath));
  }

  console.log(`Backup health for ${envTarget}`);
  console.log(`- Backup dir: ${backupDir}`);
  for (const result of results) {
    logResult(result);
  }

  const hasFail = results.some((result) => result.level === "fail");
  process.exit(hasFail ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
