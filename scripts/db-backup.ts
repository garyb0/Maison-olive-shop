import path from "node:path";
import {
  createSqliteBackup,
  loadEnvFilesInOrder,
  resolveDatabaseFromEnv,
} from "./db-utils";

loadEnvFilesInOrder([
  ".env.production.local",
  ".env.production",
  ".env.local",
  ".env",
]);

const label = process.argv[2] ?? "manual";
const backupDir = process.argv[3] ?? path.resolve(process.cwd(), "backups");

const db = resolveDatabaseFromEnv();

if (db.kind === "missing") {
  console.error("DATABASE_URL is missing. Unable to run db backup.");
  process.exit(1);
}

if (db.kind === "non-sqlite") {
  console.error(`DATABASE_URL is not a local sqlite file (value: ${db.databaseUrl}).`);
  console.error("Use provider-level backup strategy for managed DB engines.");
  process.exit(1);
}

const result = createSqliteBackup(db.dbPath, backupDir, label);

console.log("SQLite backup created.");
console.log(`- Source: ${db.dbPath}`);
console.log(`- Backup DB: ${result.dbBackupPath}`);
if (result.sidecarBackupPaths.length > 0) {
  for (const p of result.sidecarBackupPaths) {
    console.log(`- Sidecar: ${p}`);
  }
}
console.log(`- Manifest: ${result.manifestPath}`);
