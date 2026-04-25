import path from "node:path";
import {
  createSqliteBackup,
  loadDatabaseEnvForTarget,
  resolveEnvTargetFromArgs,
  resolveDatabaseFromEnv,
} from "./db-utils";

const envTarget = resolveEnvTargetFromArgs(undefined, "production");
loadDatabaseEnvForTarget(envTarget);

const backupDir = path.resolve(process.cwd(), "backups");

const db = resolveDatabaseFromEnv();

if (db.kind === "missing") {
  console.error("DATABASE_URL is missing. Unable to run daily backup.");
  process.exit(1);
}

if (db.kind === "non-sqlite") {
  console.error(`DATABASE_URL is not a local sqlite file (value: ${db.databaseUrl}).`);
  console.error("Use provider-level automated backups for managed DB engines.");
  process.exit(1);
}

const result = createSqliteBackup(db.dbPath, backupDir, "daily");

console.log("Daily SQLite backup created.");
console.log(`- Environment: ${envTarget}`);
console.log(`- Source: ${db.dbPath}`);
console.log(`- Backup DB: ${result.dbBackupPath}`);
console.log(`- Manifest: ${result.manifestPath}`);
