import path from "node:path";
import {
  createSqliteBackup,
  getLatestBackupDbPath,
  loadEnvFilesInOrder,
  resolveDatabaseFromEnv,
  restoreSqliteBackup,
} from "./db-utils";

loadEnvFilesInOrder([
  ".env.production.local",
  ".env.production",
  ".env.local",
  ".env",
]);

const backupArg = process.argv[2];
const backupDir = process.argv[3] ?? path.resolve(process.cwd(), "backups");
const skipPreRestoreBackup = process.argv.includes("--no-pre-backup");

const db = resolveDatabaseFromEnv();

if (db.kind === "missing") {
  console.error("DATABASE_URL is missing. Unable to run db restore.");
  process.exit(1);
}

if (db.kind === "non-sqlite") {
  console.error(`DATABASE_URL is not a local sqlite file (value: ${db.databaseUrl}).`);
  console.error("Use provider-level restore strategy for managed DB engines.");
  process.exit(1);
}

const backupPath = backupArg
  ? path.resolve(process.cwd(), backupArg)
  : getLatestBackupDbPath(backupDir);

if (!backupPath) {
  console.error("No backup file found. Provide one explicitly or create a backup first.");
  process.exit(1);
}

if (!skipPreRestoreBackup) {
  const beforeRestore = createSqliteBackup(db.dbPath, backupDir, "before-restore");
  console.log("Safety backup created before restore:");
  console.log(`- ${beforeRestore.dbBackupPath}`);
}

const result = restoreSqliteBackup(backupPath, db.dbPath);

console.log("SQLite restore completed.");
console.log(`- Restored from: ${backupPath}`);
console.log(`- Target DB: ${db.dbPath}`);

if (result.restoredSidecars.length > 0) {
  for (const p of result.restoredSidecars) {
    console.log(`- Restored sidecar: ${p}`);
  }
}

if (result.deletedStaleSidecars.length > 0) {
  for (const p of result.deletedStaleSidecars) {
    console.log(`- Removed stale sidecar: ${p}`);
  }
}
