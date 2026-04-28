import fs from "node:fs";
import path from "node:path";
import {
  createSqliteBackup,
  getPositionalScriptArgs,
  loadDatabaseEnvForTarget,
  resolveEnvTargetFromArgs,
  resolveDatabaseFromEnv,
  timestampForFile,
} from "./db-utils";
import {
  createDeliveryCheckpointGitState,
  DeliveryCheckpointManifest,
  sanitizeDeliveryCheckpointLabel,
} from "./delivery-checkpoint-lib";

const envTarget = resolveEnvTargetFromArgs();
loadDatabaseEnvForTarget(envTarget);

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log("Usage: tsx scripts/delivery-checkpoint.ts [label] [--allow-dirty]");
  console.log("");
  console.log("- Creates a Git tag checkpoint for delivery work.");
  console.log("- Creates a SQLite backup when DATABASE_URL points to a local file.");
  console.log("- Refuses dirty Git worktrees unless --allow-dirty is provided.");
  console.log("- With --allow-dirty, captures an exact Git snapshot of the current worktree without touching your branch or index.");
  process.exit(0);
}

const [rawLabel = "delivery-change"] = getPositionalScriptArgs();
const label = sanitizeDeliveryCheckpointLabel(rawLabel);
const allowDirty = process.argv.includes("--allow-dirty");
const checkpointDir = path.resolve(process.cwd(), "backups", "delivery-checkpoints");
const stamp = timestampForFile();
const tag = `delivery-checkpoint-${stamp}-${label}`;

fs.mkdirSync(checkpointDir, { recursive: true });

let gitState;

try {
  gitState = createDeliveryCheckpointGitState({
    cwd: process.cwd(),
    checkpointDir,
    tag,
    label,
    allowDirty,
  });
} catch (error) {
  if (error instanceof Error && error.message === "GIT_WORKTREE_DIRTY") {
    console.error("Git worktree is not clean. Commit or stash your changes before creating a delivery checkpoint.");
    console.error("Use --allow-dirty to capture the exact current worktree into a synthetic checkpoint commit.");
    const status = typeof error === "object" && error !== null && "status" in error ? String(error.status ?? "") : "";
    if (status.trim()) {
      console.error("");
      console.error(status);
    }
    process.exit(1);
  }

  throw error;
}

const db = resolveDatabaseFromEnv();

let database: DeliveryCheckpointManifest["database"];

if (db.kind === "sqlite") {
  const backup = createSqliteBackup(db.dbPath, checkpointDir, tag);
  database = {
    kind: "sqlite",
    databaseUrl: db.databaseUrl,
    sourcePath: db.dbPath,
    backupPath: backup.dbBackupPath,
    manifestPath: backup.manifestPath,
    sidecarBackupPaths: backup.sidecarBackupPaths,
  };
} else if (db.kind === "non-sqlite") {
  database = {
    kind: "managed",
    databaseUrl: db.databaseUrl,
    note: "Use your managed database provider snapshot/restore flow before production delivery changes.",
  };
} else {
  database = {
    kind: "missing",
    note: "DATABASE_URL is missing. No database checkpoint was created.",
  };
}

const manifest: DeliveryCheckpointManifest = {
  version: 2,
  createdAt: new Date().toISOString(),
  label,
  environment: envTarget,
  git: gitState,
  database,
};

const manifestPath = path.join(checkpointDir, `${tag}.json`);
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

console.log("Delivery checkpoint created.");
console.log(`- Tag: ${tag}`);
console.log(`- Branch: ${gitState.branch}`);
console.log(`- Snapshot commit: ${gitState.commitSha}`);
if (gitState.commitSha !== gitState.headCommitSha) {
  console.log(`- Base HEAD commit: ${gitState.headCommitSha}`);
}
console.log(`- Snapshot type: ${gitState.snapshotKind}`);
console.log(`- Manifest: ${manifestPath}`);
console.log(`- Environment: ${envTarget}`);

if (database.kind === "sqlite") {
  console.log(`- Database backup: ${database.backupPath}`);
} else {
  console.log(`- Database: ${database.note}`);
}

if (gitState.dirty) {
  console.log("- Git worktree was dirty when checkpointed.");
  if (gitState.statusPath) {
    console.log(`- Git status snapshot: ${gitState.statusPath}`);
  }
  if (gitState.trackedDiffPath) {
    console.log(`- Git tracked diff: ${gitState.trackedDiffPath}`);
  }
  if (gitState.untrackedFilesPath) {
    console.log(`- Git untracked files list: ${gitState.untrackedFilesPath}`);
  }
}

console.log("");
console.log("Next safe steps:");
console.log("- Work on a dedicated branch (example: feature/delivery-km).");
console.log("- Run npm run test:module:orders before each deployment.");
console.log("- Use npm run delivery:rollback:plan to print the rollback procedure.");
