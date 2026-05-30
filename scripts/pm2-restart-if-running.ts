import { spawnSync } from "node:child_process";

const processName = process.argv[2] ?? "chez-olive-shop";
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

function runPm2(args: string[], stdio: "pipe" | "inherit" = "pipe") {
  return spawnSync(npxCommand, ["pm2", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio,
    shell: process.platform === "win32",
  });
}

const listResult = runPm2(["jlist"]);

if (listResult.status !== 0 || !listResult.stdout) {
  console.log(`[pm2] ${processName}: PM2 unavailable, skipping restart.`);
  process.exit(0);
}

let apps: Array<{ name?: string; pm2_env?: { status?: string } }>;
try {
  apps = JSON.parse(listResult.stdout) as typeof apps;
} catch {
  console.log(`[pm2] ${processName}: unable to read PM2 list, skipping restart.`);
  process.exit(0);
}

const app = apps.find((candidate) => candidate.name === processName);
if (!app || app.pm2_env?.status === "stopped") {
  console.log(`[pm2] ${processName}: not running, skipping restart.`);
  process.exit(0);
}

console.log(`[pm2] ${processName}: restarting after build so production uses the current .next chunks.`);
const restartResult = runPm2(["restart", processName, "--update-env"], "inherit");
process.exit(restartResult.status ?? 1);
