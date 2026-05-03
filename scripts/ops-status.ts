import { execFileSync, execSync } from "node:child_process";

type CheckLevel = "pass" | "warn" | "fail";

type Check = {
  level: CheckLevel;
  name: string;
  details: string;
};

function flagValue(name: string, fallback: string) {
  const prefix = `${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function run(command: string, args: string[], timeout = 30_000) {
  try {
    if (process.platform === "win32" && (command === "npm.cmd" || command === "npx.cmd")) {
      const commandLine = [command, ...args.map((arg) => `"${arg.replace(/"/g, '\\"')}"`)].join(" ");
      return {
        ok: true,
        output: execSync(commandLine, {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          timeout,
        }),
      };
    }

    return {
      ok: true,
      output: execFileSync(command, args, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout,
      }),
    };
  } catch (error) {
    return {
      ok: false,
      output: error instanceof Error ? error.message : "unknown error",
    };
  }
}

function commandName(baseName: "npm" | "npx" | "powershell" | "git") {
  if (process.platform !== "win32") return baseName;
  if (baseName === "npm" || baseName === "npx") return `${baseName}.cmd`;
  return baseName;
}

function print(check: Check) {
  const label = check.level === "pass" ? "PASS" : check.level === "warn" ? "WARN" : "FAIL";
  console.log(`${label} ${check.name}: ${check.details}`);
}

async function checkHealth(baseUrl: string): Promise<Check> {
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/health`, { cache: "no-store" });
    const payload = (await response.json()) as { ok?: boolean; degraded?: boolean; release?: string };
    if (!response.ok || !payload.ok) {
      return { level: "fail", name: "health", details: `HTTP ${response.status}` };
    }
    return {
      level: payload.degraded ? "warn" : "pass",
      name: "health",
      details: `release=${payload.release ?? "unknown"}`,
    };
  } catch (error) {
    return { level: "fail", name: "health", details: error instanceof Error ? error.message : "fetch failed" };
  }
}

function checkGit(): Check {
  const status = run("git", ["status", "--short", "--branch"]);
  if (!status.ok) return { level: "warn", name: "git", details: status.output };
  const lines = status.output.trim().split(/\r?\n/).filter(Boolean);
  return {
    level: lines.length <= 1 ? "pass" : "warn",
    name: "git",
    details: lines.join(" | ") || "clean",
  };
}

function checkPm2(): Check {
  const result = run(commandName("npx"), ["pm2", "jlist"], 30_000);
  if (!result.ok) return { level: "warn", name: "pm2", details: "pm2 unavailable" };

  try {
    const apps = JSON.parse(result.output) as Array<{ name?: string; pm2_env?: { status?: string } }>;
    const summary = apps.map((app) => `${app.name ?? "app"}=${app.pm2_env?.status ?? "unknown"}`).join(", ");
    const hasOffline = apps.some((app) => app.pm2_env?.status !== "online");
    return { level: hasOffline ? "fail" : "pass", name: "pm2", details: summary || "no apps" };
  } catch {
    return { level: "warn", name: "pm2", details: "unable to parse pm2 output" };
  }
}

function checkBackupHealth(): Check {
  const result = run(commandName("npm"), ["run", "db:backup:health"], 120_000);
  const failCount = (result.output.match(/^FAIL /gm) ?? []).length;
  const warnCount = (result.output.match(/^WARN /gm) ?? []).length;
  if (!result.ok || failCount > 0) {
    return { level: "fail", name: "backup-health", details: `${failCount || 1} fail(s)` };
  }
  return {
    level: warnCount > 0 ? "warn" : "pass",
    name: "backup-health",
    details: warnCount > 0 ? `${warnCount} warning(s)` : "latest backup opens and is recent",
  };
}

function checkScheduledTasks(): Check {
  const script = [
    "$names = 'MaisonOlive-DB-Backup','MaisonOlive-DB-Backup-Hourly','MaisonOlive-DB-Backup-Health';",
    "Get-ScheduledTask -TaskName $names -ErrorAction SilentlyContinue |",
    "ForEach-Object { [pscustomobject]@{ TaskName = $_.TaskName; State = $_.State.ToString() } } |",
    "ConvertTo-Json -Compress",
  ].join(" ");
  const result = run(commandName("powershell"), ["-NoProfile", "-Command", script], 30_000);
  if (!result.ok) return { level: "warn", name: "scheduled-tasks", details: "Windows task state unavailable" };

  try {
    const raw = JSON.parse(result.output || "[]") as { TaskName?: string; State?: string } | Array<{ TaskName?: string; State?: string }>;
    const tasks = Array.isArray(raw) ? raw : [raw];
    const summary = tasks.map((task) => `${task.TaskName}=${task.State}`).join(", ");
    const hourly = tasks.find((task) => task.TaskName === "MaisonOlive-DB-Backup-Hourly");
    return {
      level: hourly?.State === "Ready" ? "pass" : "warn",
      name: "scheduled-tasks",
      details: summary || "no MaisonOlive tasks found",
    };
  } catch {
    return { level: "warn", name: "scheduled-tasks", details: "unable to parse task state" };
  }
}

async function main() {
  const baseUrl = flagValue("--base-url", "https://chezolive.ca");
  const checks: Check[] = [
    checkGit(),
    await checkHealth(baseUrl),
    checkPm2(),
    checkBackupHealth(),
    checkScheduledTasks(),
  ];

  console.log(`Ops status for ${baseUrl}`);
  for (const check of checks) print(check);

  process.exit(checks.some((check) => check.level === "fail") ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
