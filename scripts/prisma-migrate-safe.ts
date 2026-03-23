import { spawnSync } from "node:child_process";
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

const db = resolveDatabaseFromEnv();
const isSqlite = db.kind === "sqlite";

if (db.kind === "missing") {
  console.error("DATABASE_URL is missing. Cannot run safe migration.");
  process.exit(1);
}

if (isSqlite) {
  const backupDir = path.resolve(process.cwd(), "backups");
  const backup = createSqliteBackup(db.dbPath, backupDir, "before-migrate");

  console.log("Pre-migration SQLite backup created:");
  console.log(`- ${backup.dbBackupPath}`);
  console.log(`- ${backup.manifestPath}`);
}

if (db.kind === "non-sqlite") {
  console.warn("DATABASE_URL is non-sqlite. Local file backup skipped.");
  console.warn("Make sure provider snapshot/backup exists before migration.");
}

const migrationName = process.argv[2] ?? "safe-migration";

const result = spawnSync(
  process.platform === "win32" ? "cmd" : "npm",
  process.platform === "win32"
    ? ["/c", "npm", "run", "prisma:migrate", "--", "--name", migrationName]
    : ["run", "prisma:migrate", "--", "--name", migrationName],
  {
    stdio: "inherit",
    shell: false,
    env: process.env,
  }
);

if (typeof result.status === "number") {
  process.exit(result.status);
}

process.exit(1);
