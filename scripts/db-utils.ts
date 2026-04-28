import fs from "node:fs";
import path from "node:path";

export function loadEnvFileIfExists(fileName: string) {
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

export function loadEnvFilesInOrder(fileNames: string[]) {
  for (const fileName of fileNames) {
    loadEnvFileIfExists(fileName);
  }
}

export type EnvTarget = "development" | "production";

export function resolveEnvTargetFromArgs(
  args = process.argv,
  fallback: EnvTarget = process.env.NODE_ENV === "production" ? "production" : "development",
): EnvTarget {
  const explicit = args.find((value) => value.startsWith("--env="));
  if (explicit === "--env=production") {
    return "production";
  }
  if (explicit === "--env=development") {
    return "development";
  }
  return fallback;
}

export function getEnvFilesForTarget(target: EnvTarget) {
  if (target === "production") {
    return [".env.production.local", ".env.production", ".env"];
  }

  return [".env.local", ".env"];
}

export function loadDatabaseEnvForTarget(target: EnvTarget) {
  loadEnvFilesInOrder(getEnvFilesForTarget(target));
}

export function getPositionalScriptArgs(args = process.argv) {
  return args.slice(2).filter((value) => !value.startsWith("--"));
}

const stripQueryAndHash = (value: string) => value.split(/[?#]/)[0];

export function resolveSqliteDbPathFromUrl(databaseUrl: string | undefined): string | null {
  if (!databaseUrl) return null;
  if (!databaseUrl.startsWith("file:")) return null;

  let rawPath = "";

  if (databaseUrl.startsWith("file://")) {
    try {
      rawPath = decodeURIComponent(new URL(databaseUrl).pathname);
    } catch {
      rawPath = databaseUrl.slice(5);
    }
  } else {
    rawPath = databaseUrl.slice(5);
  }

  rawPath = stripQueryAndHash(rawPath).trim();
  if (!rawPath) return null;

  if (/^\/[A-Za-z]:[\\/]/.test(rawPath)) {
    rawPath = rawPath.slice(1);
  }

  if (/^[A-Za-z]:[\\/]/.test(rawPath) || rawPath.startsWith("\\\\") || path.isAbsolute(rawPath)) {
    return path.normalize(rawPath);
  }

  return path.resolve(process.cwd(), rawPath);
}

export type ResolvedDatabase =
  | { kind: "sqlite"; databaseUrl: string; dbPath: string }
  | { kind: "missing" }
  | { kind: "non-sqlite"; databaseUrl: string };

export function resolveDatabaseFromEnv(): ResolvedDatabase {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) return { kind: "missing" };

  const dbPath = resolveSqliteDbPathFromUrl(databaseUrl);
  if (!dbPath) {
    return { kind: "non-sqlite", databaseUrl };
  }

  return { kind: "sqlite", databaseUrl, dbPath };
}

export function timestampForFile(date = new Date()) {
  const pad = (v: number) => String(v).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

const sanitizeLabel = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "backup";

const SQLITE_SIDECAR_SUFFIXES = ["-wal", "-shm", "-journal"];

export type BackupResult = {
  dbBackupPath: string;
  sidecarBackupPaths: string[];
  manifestPath: string;
};

export function createSqliteBackup(dbPath: string, backupDir: string, label: string): BackupResult {
  if (!fs.existsSync(dbPath)) {
    throw new Error(`DATABASE_FILE_NOT_FOUND: ${dbPath}`);
  }

  fs.mkdirSync(backupDir, { recursive: true });

  const safeLabel = sanitizeLabel(label);
  const stamp = timestampForFile();
  const dbBackupPath = path.join(backupDir, `${safeLabel}-${stamp}.db`);

  fs.copyFileSync(dbPath, dbBackupPath);

  const sidecarBackupPaths: string[] = [];
  for (const suffix of SQLITE_SIDECAR_SUFFIXES) {
    const sidecarSource = `${dbPath}${suffix}`;
    if (!fs.existsSync(sidecarSource)) continue;

    const sidecarDestination = `${dbBackupPath}${suffix}`;
    fs.copyFileSync(sidecarSource, sidecarDestination);
    sidecarBackupPaths.push(sidecarDestination);
  }

  const manifestPath = `${dbBackupPath}.json`;
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        sourceDbPath: dbPath,
        dbBackupPath,
        sidecarBackupPaths,
      },
      null,
      2
    ),
    "utf8"
  );

  return {
    dbBackupPath,
    sidecarBackupPaths,
    manifestPath,
  };
}

export function restoreSqliteBackup(sourceDbPath: string, targetDbPath: string) {
  if (!fs.existsSync(sourceDbPath)) {
    throw new Error(`BACKUP_FILE_NOT_FOUND: ${sourceDbPath}`);
  }

  fs.mkdirSync(path.dirname(targetDbPath), { recursive: true });
  fs.copyFileSync(sourceDbPath, targetDbPath);

  const restoredSidecars: string[] = [];
  const deletedStaleSidecars: string[] = [];

  for (const suffix of SQLITE_SIDECAR_SUFFIXES) {
    const sourceSidecar = `${sourceDbPath}${suffix}`;
    const targetSidecar = `${targetDbPath}${suffix}`;

    if (fs.existsSync(sourceSidecar)) {
      fs.copyFileSync(sourceSidecar, targetSidecar);
      restoredSidecars.push(targetSidecar);
      continue;
    }

    if (fs.existsSync(targetSidecar)) {
      fs.unlinkSync(targetSidecar);
      deletedStaleSidecars.push(targetSidecar);
    }
  }

  return { restoredSidecars, deletedStaleSidecars };
}

export function getLatestBackupDbPath(backupDir: string): string | null {
  if (!fs.existsSync(backupDir)) return null;

  const entries = fs
    .readdirSync(backupDir)
    .filter((name) => name.toLowerCase().endsWith(".db"))
    .map((name) => {
      const fullPath = path.join(backupDir, name);
      const stats = fs.statSync(fullPath);
      return { fullPath, mtime: stats.mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);

  return entries[0]?.fullPath ?? null;
}
