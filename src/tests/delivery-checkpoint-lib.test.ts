import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { createDeliveryCheckpointGitState } from "../../scripts/delivery-checkpoint-lib";

function runGit(cwd: string, args: string[], trim = true) {
  const output = execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  return trim ? output.trim() : output;
}

function createTempRepo() {
  const repoDir = fs.mkdtempSync(path.join(process.cwd(), ".tmp-delivery-checkpoint-test-"));

  runGit(repoDir, ["init"]);
  runGit(repoDir, ["config", "user.name", "Vitest"]);
  runGit(repoDir, ["config", "user.email", "vitest@example.com"]);

  fs.writeFileSync(path.join(repoDir, "tracked.txt"), "before\n", "utf8");
  fs.mkdirSync(path.join(repoDir, "nested"), { recursive: true });
  fs.writeFileSync(path.join(repoDir, "nested", "kept.txt"), "keep\n", "utf8");
  runGit(repoDir, ["add", "."]);
  runGit(repoDir, ["commit", "-m", "init"]);

  return repoDir;
}

const reposToCleanup: string[] = [];

afterEach(() => {
  while (reposToCleanup.length > 0) {
    const repoDir = reposToCleanup.pop();
    if (!repoDir) continue;
    fs.rmSync(repoDir, { recursive: true, force: true });
  }
});

describe("delivery checkpoint git state", () => {
  it("uses HEAD directly when the worktree is clean", () => {
    const repoDir = createTempRepo();
    reposToCleanup.push(repoDir);

    const checkpointDir = path.join(repoDir, "backups", "delivery-checkpoints");
    const headCommitSha = runGit(repoDir, ["rev-parse", "HEAD"]);

    const state = createDeliveryCheckpointGitState({
      cwd: repoDir,
      checkpointDir,
      tag: "delivery-checkpoint-clean-test",
      label: "clean-test",
      allowDirty: false,
    });

    expect(state.dirty).toBe(false);
    expect(state.snapshotKind).toBe("head");
    expect(state.commitSha).toBe(headCommitSha);
    expect(state.headCommitSha).toBe(headCommitSha);
    expect(state.statusPath).toBeNull();
    expect(runGit(repoDir, ["rev-parse", state.tag])).toBe(headCommitSha);
  });

  it("captures an exact worktree snapshot when allowDirty is enabled", () => {
    const repoDir = createTempRepo();
    reposToCleanup.push(repoDir);

    fs.writeFileSync(path.join(repoDir, "tracked.txt"), "after\n", "utf8");
    fs.writeFileSync(path.join(repoDir, "new-file.txt"), "new\n", "utf8");
    fs.rmSync(path.join(repoDir, "nested", "kept.txt"));

    const checkpointDir = path.join(repoDir, "backups", "delivery-checkpoints");
    const headCommitSha = runGit(repoDir, ["rev-parse", "HEAD"]);

    const state = createDeliveryCheckpointGitState({
      cwd: repoDir,
      checkpointDir,
      tag: "delivery-checkpoint-dirty-test",
      label: "dirty-test",
      allowDirty: true,
    });

    expect(state.dirty).toBe(true);
    expect(state.snapshotKind).toBe("worktree");
    expect(state.headCommitSha).toBe(headCommitSha);
    expect(state.commitSha).not.toBe(headCommitSha);
    expect(state.statusPath).not.toBeNull();
    expect(state.trackedDiffPath).not.toBeNull();
    expect(state.untrackedFilesPath).not.toBeNull();
    expect(fs.existsSync(state.statusPath!)).toBe(true);
    expect(fs.existsSync(state.trackedDiffPath!)).toBe(true);
    expect(fs.existsSync(state.untrackedFilesPath!)).toBe(true);
    expect(runGit(repoDir, ["show", `${state.commitSha}:tracked.txt`], false)).toBe("after\n");
    expect(runGit(repoDir, ["show", `${state.commitSha}:new-file.txt`], false)).toBe("new\n");
    expect(() => runGit(repoDir, ["show", `${state.commitSha}:nested/kept.txt`], false)).toThrow();
    expect(runGit(repoDir, ["show", `${headCommitSha}:tracked.txt`], false)).toBe("before\n");
  });
});
