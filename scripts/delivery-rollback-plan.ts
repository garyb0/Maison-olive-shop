import { readDeliveryCheckpointManifest } from "./delivery-checkpoint-lib";

try {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log("Usage: tsx scripts/delivery-rollback-plan.ts [checkpoint-tag-or-manifest-path]");
    console.log("");
    console.log("- Reads the latest delivery checkpoint manifest by default.");
    console.log("- Prints the recommended rollback sequence without changing code or data.");
    process.exit(0);
  }

  const manifest = readDeliveryCheckpointManifest(process.cwd(), process.argv[2]);
  const rollbackBranch = `rollback-${manifest.git.tag}`;
  const snapshotKind = manifest.git.snapshotKind ?? "head";
  const headCommitSha = manifest.git.headCommitSha ?? manifest.git.commitSha;

  console.log("Delivery rollback plan");
  console.log(`- Checkpoint label: ${manifest.label}`);
  console.log(`- Created at: ${manifest.createdAt}`);
  console.log(`- Git tag: ${manifest.git.tag}`);
  console.log(`- Snapshot commit: ${manifest.git.commitSha}`);
  console.log(`- Base HEAD commit: ${headCommitSha}`);
  console.log(`- Original branch: ${manifest.git.branch}`);
  console.log(`- Snapshot type: ${snapshotKind}`);
  if (manifest.environment) {
    console.log(`- Environment: ${manifest.environment}`);
  }
  if (manifest.git.statusPath || manifest.git.trackedDiffPath || manifest.git.untrackedFilesPath) {
    console.log("- Captured Git artifacts:");
    if (manifest.git.statusPath) {
      console.log(`  - status: ${manifest.git.statusPath}`);
    }
    if (manifest.git.trackedDiffPath) {
      console.log(`  - tracked diff: ${manifest.git.trackedDiffPath}`);
    }
    if (manifest.git.untrackedFilesPath) {
      console.log(`  - untracked files: ${manifest.git.untrackedFilesPath}`);
    }
  }
  console.log("");
  console.log("Suggested rollback sequence:");
  console.log("1. Put the storefront into maintenance mode:");
  console.log("   npm run site:close");
  if (snapshotKind === "worktree") {
    console.log("2. Restore the exact captured worktree snapshot from the checkpoint tag into a dedicated rollback branch:");
  } else {
    console.log("2. Restore the code from the checkpoint tag into a dedicated rollback branch:");
  }
  console.log(`   git switch -c ${rollbackBranch} ${manifest.git.tag}`);

  if (manifest.database.kind === "sqlite") {
    console.log("3. Restore the SQLite database backup captured for this checkpoint:");
    console.log(`   npm run db:restore -- "${manifest.database.backupPath}"`);
  } else if (manifest.database.kind === "managed") {
    console.log("3. Restore the managed database snapshot taken at the same checkpoint:");
    console.log(`   ${manifest.database.note}`);
  } else {
    console.log("3. No database backup was captured automatically:");
    console.log(`   ${manifest.database.note}`);
  }

  console.log("4. Rebuild and restart the production process:");
  console.log("   npm run build");
  console.log("   npm run host:pm2:restart");
  console.log("5. Verify the site before reopening:");
  console.log("   npm run preopen:check");
  console.log("6. Reopen the storefront:");
  console.log("   npm run site:open");
} catch (error) {
  if (error instanceof Error && error.message === "CHECKPOINT_DIR_NOT_FOUND") {
    console.error("No delivery checkpoint directory exists yet. Run npm run delivery:checkpoint first.");
    process.exit(1);
  }

  if (error instanceof Error && error.message === "CHECKPOINT_NOT_FOUND") {
    console.error("No delivery checkpoint manifest was found. Run npm run delivery:checkpoint first.");
    process.exit(1);
  }

  if (error instanceof Error && error.message.startsWith("CHECKPOINT_NOT_FOUND:")) {
    console.error(`Checkpoint not found: ${error.message.slice("CHECKPOINT_NOT_FOUND:".length).trim()}`);
    process.exit(1);
  }

  console.error(error instanceof Error ? error.message : "Unable to build rollback plan.");
  process.exit(1);
}
