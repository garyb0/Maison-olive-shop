import fs from "node:fs";
import path from "node:path";
import {
  copySqliteDatabaseWithSidecars,
  loadDatabaseEnvForTarget,
  resolveBackupDirFromEnv,
  resolveDataRootFromEnv,
  resolveEnvTargetFromArgs,
  resolveExternalProdDbPath,
  resolveLogDirFromEnv,
  resolveSecretsDirFromEnv,
  resolveDatabaseFromEnv,
} from "./db-utils";

const hasFlag = (flag: string) => process.argv.includes(flag);

if (hasFlag("--help") || hasFlag("-h")) {
  console.log("Usage: tsx scripts/prepare-release-data-root.ts [--env=production] [--dry-run] [--overwrite-db]");
  console.log("");
  console.log("- Creates the external Chez Olive data folders next to the repo by default.");
  console.log("- Copies the current SQLite production DB to the external data root when safe.");
  console.log("- Does not copy or print secrets.");
  process.exit(0);
}

const envTarget = resolveEnvTargetFromArgs(undefined, "production");
loadDatabaseEnvForTarget(envTarget);

const dryRun = hasFlag("--dry-run");
const overwriteDb = hasFlag("--overwrite-db");
const dataRoot = resolveDataRootFromEnv();
const dbDir = path.join(dataRoot, "db");
const backupDir = resolveBackupDirFromEnv();
const logDir = resolveLogDirFromEnv();
const secretsDir = resolveSecretsDirFromEnv();
const targetDbPath = resolveExternalProdDbPath();

const folders = [dataRoot, dbDir, backupDir, logDir, secretsDir];
const relativeDatabaseUrl = `file:${path.relative(process.cwd(), targetDbPath).replace(/\\/g, "/")}`;
const relativeBackupDir = path.relative(process.cwd(), backupDir).replace(/\\/g, "/");
const relativeLogDir = path.relative(process.cwd(), logDir).replace(/\\/g, "/");
const relativeDataRoot = path.relative(process.cwd(), dataRoot).replace(/\\/g, "/");

console.log("Preparing Chez Olive release data root.");
console.log(`- Environment: ${envTarget}`);
console.log(`- Mode: ${dryRun ? "dry-run" : "write"}`);
console.log(`- Data root: ${dataRoot}`);

for (const folder of folders) {
  if (dryRun) {
    console.log(`- Would ensure folder: ${folder}`);
  } else {
    fs.mkdirSync(folder, { recursive: true });
    console.log(`- Folder ready: ${folder}`);
  }
}

const db = resolveDatabaseFromEnv();

if (db.kind === "sqlite") {
  console.log(`- Current SQLite DB: ${db.dbPath}`);
  console.log(`- External SQLite DB: ${targetDbPath}`);

  if (dryRun) {
    console.log(`- Would copy SQLite DB${overwriteDb ? " with overwrite" : " if target is absent"}.`);
  } else {
    const copyResult = copySqliteDatabaseWithSidecars(db.dbPath, targetDbPath, { overwrite: overwriteDb });
    if (copyResult.copied) {
      console.log("- SQLite DB copied to external data root.");
      for (const sidecarPath of copyResult.sidecarTargetPaths) {
        console.log(`- SQLite sidecar copied: ${sidecarPath}`);
      }
    } else if (copyResult.reason === "same-file") {
      console.log("- SQLite DB is already using the external target path.");
    } else {
      console.log("- SQLite DB target already exists; kept it unchanged.");
      console.log("  Use --overwrite-db only after a fresh backup if you intentionally want to replace it.");
    }
  }
} else if (db.kind === "non-sqlite") {
  console.log("- DATABASE_URL is not a local SQLite file; no DB copy was attempted.");
  console.log("- Keep provider-level snapshots/backups enabled for this database.");
} else {
  console.log("- DATABASE_URL is missing; folders were prepared but no DB copy was attempted.");
}

console.log("");
console.log("Suggested production values:");
console.log(`CHEZOLIVE_DATA_ROOT=${relativeDataRoot}`);
console.log(`DATABASE_URL=${relativeDatabaseUrl}`);
console.log(`CHEZOLIVE_BACKUP_DIR=${relativeBackupDir}`);
console.log(`CHEZOLIVE_LOG_DIR=${relativeLogDir}`);
console.log("");
console.log("Secrets note:");
console.log("- Keep .env files ignored and never commit real secrets.");
console.log("- Move long-term production secrets to the host/PM2 environment when ready; this script does not duplicate them.");
