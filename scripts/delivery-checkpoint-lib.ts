import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

export type DeliveryCheckpointManifest = {
  version?: number;
  createdAt: string;
  label: string;
  environment?: "development" | "production";
  git: {
    branch: string;
    commitSha: string;
    headCommitSha?: string;
    tag: string;
    dirty: boolean;
    snapshotKind?: "head" | "worktree";
    statusPath?: string | null;
    trackedDiffPath?: string | null;
    untrackedFilesPath?: string | null;
  };
  database:
    | {
        kind: "sqlite";
        databaseUrl: string;
        sourcePath: string;
        backupPath: string;
        manifestPath: string;
        sidecarBackupPaths: string[];
      }
    | {
        kind: "managed";
        databaseUrl: string;
        note: string;
      }
    | {
        kind: "missing";
        note: string;
      };
};

export type DeliveryCheckpointGitState = {
  branch: string;
  commitSha: string;
  headCommitSha: string;
  tag: string;
  dirty: boolean;
  snapshotKind: "head" | "worktree";
  statusPath: string | null;
  trackedDiffPath: string | null;
  untrackedFilesPath: string | null;
};

type GitRunOptions = {
  cwd: string;
  env?: Record<string, string | undefined>;
  trim?: boolean;
};

function runGit(args: string[], options: GitRunOptions) {
  const output = execFileSync("git", args, {
    cwd: options.cwd,
    env: {
      ...process.env,
      ...(options.env ?? {}),
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  return options.trim === false ? output : output.trim();
}

function ensureFileDir(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeTextFileIfNotEmpty(filePath: string, content: string) {
  if (!content.trim()) {
    return null;
  }

  ensureFileDir(filePath);
  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
}

function createWorktreeSnapshotCommit(options: {
  cwd: string;
  checkpointDir: string;
  headCommitSha: string;
  label: string;
}) {
  const tempDir = fs.mkdtempSync(path.join(options.checkpointDir, ".git-snapshot-"));
  const tempIndexPath = path.join(tempDir, "index");
  const indexEnv = { GIT_INDEX_FILE: tempIndexPath };

  try {
    runGit(["read-tree", options.headCommitSha], {
      cwd: options.cwd,
      env: indexEnv,
    });
    runGit(["add", "--all", "--", "."], {
      cwd: options.cwd,
      env: indexEnv,
    });

    const treeSha = runGit(["write-tree"], {
      cwd: options.cwd,
      env: indexEnv,
    });

    return runGit(
      [
        "commit-tree",
        treeSha,
        "-p",
        options.headCommitSha,
        "-m",
        `delivery checkpoint snapshot: ${options.label}`,
      ],
      {
        cwd: options.cwd,
        env: indexEnv,
      },
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

export function sanitizeDeliveryCheckpointLabel(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "delivery-change"
  );
}

export function createDeliveryCheckpointGitState(options: {
  cwd: string;
  checkpointDir: string;
  tag: string;
  label: string;
  allowDirty: boolean;
}) {
  fs.mkdirSync(options.checkpointDir, { recursive: true });

  const gitStatus = runGit(["status", "--short"], {
    cwd: options.cwd,
    trim: false,
  });
  const dirty = gitStatus.trim().length > 0;

  if (dirty && !options.allowDirty) {
    const error = new Error("GIT_WORKTREE_DIRTY");
    Object.assign(error, { status: gitStatus });
    throw error;
  }

  const branch = runGit(["rev-parse", "--abbrev-ref", "HEAD"], {
    cwd: options.cwd,
  });
  const headCommitSha = runGit(["rev-parse", "HEAD"], {
    cwd: options.cwd,
  });

  let commitSha = headCommitSha;
  let snapshotKind: DeliveryCheckpointGitState["snapshotKind"] = "head";
  let statusPath: string | null = null;
  let trackedDiffPath: string | null = null;
  let untrackedFilesPath: string | null = null;

  if (dirty) {
    snapshotKind = "worktree";
    statusPath = writeTextFileIfNotEmpty(
      path.join(options.checkpointDir, `${options.tag}.git-status.txt`),
      gitStatus,
    );
    trackedDiffPath = writeTextFileIfNotEmpty(
      path.join(options.checkpointDir, `${options.tag}.git-diff.patch`),
      runGit(["diff", "--binary", "HEAD"], {
        cwd: options.cwd,
        trim: false,
      }),
    );
    untrackedFilesPath = writeTextFileIfNotEmpty(
      path.join(options.checkpointDir, `${options.tag}.untracked.txt`),
      runGit(["ls-files", "--others", "--exclude-standard"], {
        cwd: options.cwd,
        trim: false,
      }),
    );
    commitSha = createWorktreeSnapshotCommit({
      cwd: options.cwd,
      checkpointDir: options.checkpointDir,
      headCommitSha,
      label: options.label,
    });
  }

  runGit(["tag", options.tag, commitSha], {
    cwd: options.cwd,
  });

  return {
    branch,
    commitSha,
    headCommitSha,
    tag: options.tag,
    dirty,
    snapshotKind,
    statusPath,
    trackedDiffPath,
    untrackedFilesPath,
  } satisfies DeliveryCheckpointGitState;
}

export function readDeliveryCheckpointManifest(cwd: string, explicitArg?: string) {
  const checkpointDir = path.resolve(cwd, "backups", "delivery-checkpoints");

  if (explicitArg) {
    const byPath = path.resolve(cwd, explicitArg);
    if (fs.existsSync(byPath)) {
      return JSON.parse(fs.readFileSync(byPath, "utf8")) as DeliveryCheckpointManifest;
    }

    const byTagPath = path.join(checkpointDir, `${explicitArg}.json`);
    if (fs.existsSync(byTagPath)) {
      return JSON.parse(fs.readFileSync(byTagPath, "utf8")) as DeliveryCheckpointManifest;
    }

    throw new Error(`CHECKPOINT_NOT_FOUND: ${explicitArg}`);
  }

  if (!fs.existsSync(checkpointDir)) {
    throw new Error("CHECKPOINT_DIR_NOT_FOUND");
  }

  const latestManifest = fs
    .readdirSync(checkpointDir)
    .filter((name) => name.endsWith(".json") && name.startsWith("delivery-checkpoint-"))
    .map((name) => {
      const fullPath = path.join(checkpointDir, name);
      return {
        fullPath,
        mtimeMs: fs.statSync(fullPath).mtimeMs,
      };
    })
    .sort((left, right) => right.mtimeMs - left.mtimeMs)[0];

  if (!latestManifest) {
    throw new Error("CHECKPOINT_NOT_FOUND");
  }

  return JSON.parse(fs.readFileSync(latestManifest.fullPath, "utf8")) as DeliveryCheckpointManifest;
}
