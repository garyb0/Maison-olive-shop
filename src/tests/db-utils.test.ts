import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  copySqliteDatabaseWithSidecars,
  createSqliteBackup,
  getLatestBackupDbPath,
  loadExternalSecretEnvForTarget,
  resolveBackupDirFromEnv,
  resolveDataRootFromEnv,
  resolveExternalProdDbPath,
  resolveLogDirFromEnv,
} from "../../scripts/db-utils";

const savedEnv = {
  CHEZOLIVE_BACKUP_DIR: process.env.CHEZOLIVE_BACKUP_DIR,
  CHEZOLIVE_DATA_ROOT: process.env.CHEZOLIVE_DATA_ROOT,
  CHEZOLIVE_LOG_DIR: process.env.CHEZOLIVE_LOG_DIR,
  CHEZOLIVE_PROD_DB_PATH: process.env.CHEZOLIVE_PROD_DB_PATH,
  CHEZOLIVE_SECRETS_FILE: process.env.CHEZOLIVE_SECRETS_FILE,
  SESSION_SECRET: process.env.SESSION_SECRET,
};

afterEach(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("release data root helpers", () => {
  it("resolves external data folders by default", () => {
    delete process.env.CHEZOLIVE_BACKUP_DIR;
    delete process.env.CHEZOLIVE_DATA_ROOT;
    delete process.env.CHEZOLIVE_LOG_DIR;
    delete process.env.CHEZOLIVE_PROD_DB_PATH;

    const dataRoot = path.resolve(process.cwd(), "..", "maison-olive-data");

    expect(resolveDataRootFromEnv()).toBe(dataRoot);
    expect(resolveBackupDirFromEnv()).toBe(path.join(dataRoot, "backups"));
    expect(resolveLogDirFromEnv()).toBe(path.join(dataRoot, "logs"));
    expect(resolveExternalProdDbPath()).toBe(path.join(dataRoot, "db", "prod.db"));
  });

  it("copies a sqlite DB without overwriting an existing target unless requested", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "chez-olive-db-"));
    const sourceDb = path.join(tempDir, "source.db");
    const targetDb = path.join(tempDir, "target", "prod.db");

    fs.writeFileSync(sourceDb, "source", "utf8");
    fs.mkdirSync(path.dirname(targetDb), { recursive: true });
    fs.writeFileSync(targetDb, "existing", "utf8");

    const skipped = copySqliteDatabaseWithSidecars(sourceDb, targetDb);
    expect(skipped).toMatchObject({ copied: false, reason: "target-exists" });
    expect(fs.readFileSync(targetDb, "utf8")).toBe("existing");

    const copied = copySqliteDatabaseWithSidecars(sourceDb, targetDb, { overwrite: true });
    expect(copied).toMatchObject({ copied: true, targetDbPath: targetDb });
    expect(fs.readFileSync(targetDb, "utf8")).toBe("source");

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("uses manifest createdAt when resolving the latest backup", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "chez-olive-latest-"));
    const sourceDir = path.join(tempDir, "source");
    const backupDir = path.join(tempDir, "backups");
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.mkdirSync(backupDir, { recursive: true });
    const sourceDb = path.join(sourceDir, "source.db");
    fs.writeFileSync(sourceDb, "source", "utf8");

    const older = createSqliteBackup(sourceDb, backupDir, "older");
    const newer = createSqliteBackup(sourceDb, backupDir, "newer");

    fs.writeFileSync(
      older.manifestPath,
      JSON.stringify({ createdAt: "2026-01-01T00:00:00.000Z" }),
      "utf8",
    );
    fs.writeFileSync(
      newer.manifestPath,
      JSON.stringify({ createdAt: "2026-01-02T00:00:00.000Z" }),
      "utf8",
    );

    expect(getLatestBackupDbPath(backupDir)).toBe(newer.dbBackupPath);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("loads external secret files from the data root without requiring repo secrets", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "chez-olive-secrets-"));
    const secretsDir = path.join(tempDir, "secrets");
    fs.mkdirSync(secretsDir, { recursive: true });
    fs.writeFileSync(
      path.join(secretsDir, "chez-olive.production.env"),
      "SESSION_SECRET=external-secret-value\n",
      "utf8",
    );

    process.env.CHEZOLIVE_DATA_ROOT = tempDir;
    delete process.env.CHEZOLIVE_SECRETS_FILE;
    delete process.env.SESSION_SECRET;

    loadExternalSecretEnvForTarget("production");

    expect(process.env.SESSION_SECRET).toBe("external-secret-value");

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
