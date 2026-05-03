import fs from "node:fs";
import path from "node:path";

const DEFAULT_DATA_ROOT_NAME = "maison-olive-data";
const SQLITE_SIDECAR_SUFFIXES = ["-wal", "-shm", "-journal"];

function readBackupManifestCreatedAtMs(dbBackupPath: string): number | null {
  const manifestPath = `${dbBackupPath}.json`;
  if (!fs.existsSync(manifestPath)) return null;

  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as { createdAt?: unknown };
    if (typeof manifest.createdAt !== "string") return null;
    const createdAtMs = Date.parse(manifest.createdAt);
    return Number.isFinite(createdAtMs) ? createdAtMs : null;
  } catch {
    return null;
  }
}

function getBackupSortTimeMs(dbBackupPath: string, stats = fs.statSync(dbBackupPath)) {
  return readBackupManifestCreatedAtMs(dbBackupPath) ?? stats.birthtimeMs ?? stats.mtimeMs;
}

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
    return [".env.production.local", ".env.local", ".env.production", ".env"];
  }

  return [".env.development.local", ".env.local", ".env.development", ".env"];
}

export function loadExternalSecretEnvForTarget(target: EnvTarget) {
  const explicit = process.env.CHEZOLIVE_SECRETS_FILE?.trim();
  const defaultFileName =
    target === "production" ? "chez-olive.production.env" : "chez-olive.development.env";
  const defaultPath = path.join(resolveSecretsDirFromEnv(), defaultFileName);

  if (explicit) {
    loadEnvFileIfExists(explicit);
    return;
  }

  loadEnvFileIfExists(defaultPath);
}

export function loadEnvForTarget(target: EnvTarget) {
  loadEnvFilesInOrder(getEnvFilesForTarget(target));
  loadExternalSecretEnvForTarget(target);
}

export const loadDatabaseEnvForTarget = loadEnvForTarget;

export function getPositionalScriptArgs(args = process.argv) {
  return args.slice(2).filter((value) => !value.startsWith("--"));
}

export function resolveProjectPath(value: string) {
  return path.isAbsolute(value) ? path.normalize(value) : path.resolve(process.cwd(), value);
}

export function resolveDataRootFromEnv() {
  const configured = process.env.CHEZOLIVE_DATA_ROOT?.trim();
  if (configured) {
    return resolveProjectPath(configured);
  }

  return path.resolve(process.cwd(), "..", DEFAULT_DATA_ROOT_NAME);
}

export function resolveBackupDirFromEnv() {
  const configured = process.env.CHEZOLIVE_BACKUP_DIR?.trim();
  if (configured) {
    return resolveProjectPath(configured);
  }

  return path.join(resolveDataRootFromEnv(), "backups");
}

export function resolveLogDirFromEnv() {
  const configured = process.env.CHEZOLIVE_LOG_DIR?.trim();
  if (configured) {
    return resolveProjectPath(configured);
  }

  return path.join(resolveDataRootFromEnv(), "logs");
}

export function resolveSecretsDirFromEnv() {
  const configured = process.env.CHEZOLIVE_SECRETS_DIR?.trim();
  if (configured) {
    return resolveProjectPath(configured);
  }

  return path.join(resolveDataRootFromEnv(), "secrets");
}

export function resolveExternalProdDbPath() {
  const configured = process.env.CHEZOLIVE_PROD_DB_PATH?.trim();
  if (configured) {
    return resolveProjectPath(configured);
  }

  return path.join(resolveDataRootFromEnv(), "db", "prod.db");
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
  const createdAt = new Date();
  const dbBackupPath = path.join(backupDir, `${safeLabel}-${stamp}.db`);

  fs.copyFileSync(dbPath, dbBackupPath);
  fs.utimesSync(dbBackupPath, createdAt, createdAt);

  const sidecarBackupPaths: string[] = [];
  for (const suffix of SQLITE_SIDECAR_SUFFIXES) {
    const sidecarSource = `${dbPath}${suffix}`;
    if (!fs.existsSync(sidecarSource)) continue;

    const sidecarDestination = `${dbBackupPath}${suffix}`;
    fs.copyFileSync(sidecarSource, sidecarDestination);
    fs.utimesSync(sidecarDestination, createdAt, createdAt);
    sidecarBackupPaths.push(sidecarDestination);
  }

  const manifestPath = `${dbBackupPath}.json`;
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        createdAt: createdAt.toISOString(),
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

export type SqliteCopyResult = {
  copied: boolean;
  targetDbPath: string;
  sidecarTargetPaths: string[];
  reason?: "target-exists" | "same-file";
};

const samePath = (a: string, b: string) => {
  const left = path.resolve(a);
  const right = path.resolve(b);
  return process.platform === "win32" ? left.toLowerCase() === right.toLowerCase() : left === right;
};

export function copySqliteDatabaseWithSidecars(
  sourceDbPath: string,
  targetDbPath: string,
  options: { overwrite?: boolean } = {},
): SqliteCopyResult {
  if (!fs.existsSync(sourceDbPath)) {
    throw new Error(`DATABASE_FILE_NOT_FOUND: ${sourceDbPath}`);
  }

  if (samePath(sourceDbPath, targetDbPath)) {
    return {
      copied: false,
      targetDbPath,
      sidecarTargetPaths: [],
      reason: "same-file",
    };
  }

  if (fs.existsSync(targetDbPath) && !options.overwrite) {
    return {
      copied: false,
      targetDbPath,
      sidecarTargetPaths: [],
      reason: "target-exists",
    };
  }

  fs.mkdirSync(path.dirname(targetDbPath), { recursive: true });
  fs.copyFileSync(sourceDbPath, targetDbPath);

  const sidecarTargetPaths: string[] = [];
  for (const suffix of SQLITE_SIDECAR_SUFFIXES) {
    const sourceSidecar = `${sourceDbPath}${suffix}`;
    if (!fs.existsSync(sourceSidecar)) continue;

    const targetSidecar = `${targetDbPath}${suffix}`;
    fs.copyFileSync(sourceSidecar, targetSidecar);
    sidecarTargetPaths.push(targetSidecar);
  }

  return {
    copied: true,
    targetDbPath,
    sidecarTargetPaths,
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
      return { fullPath, sortTimeMs: getBackupSortTimeMs(fullPath, stats) };
    })
    .sort((a, b) => b.sortTimeMs - a.sortTimeMs);

  return entries[0]?.fullPath ?? null;
}
