import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { loadDatabaseEnvForTarget, resolveLogDirFromEnv, type EnvTarget } from "./db-utils";

type CheckLevel = "pass" | "warn" | "fail";

type Check = {
  level: CheckLevel;
  name: string;
  details: string;
};

type HourlyTaskPayload = {
  Present?: boolean;
  TaskName?: string;
  State?: string;
  LastRunTime?: string;
  LastTaskResult?: number;
  NextRunTime?: string;
  Execute?: string;
  Arguments?: string;
  WorkingDirectory?: string;
};

function flagValue(name: string, fallback: string) {
  const prefix = `${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function flagEnvTarget(fallback: EnvTarget = "production"): EnvTarget {
  return flagValue("--env", fallback) === "development" ? "development" : "production";
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

function formatAgeHours(date: Date) {
  const ageHours = (Date.now() - date.getTime()) / 3_600_000;
  if (!Number.isFinite(ageHours) || ageHours < 0) return "unknown age";
  return ageHours < 1 ? "<1h" : `${ageHours.toFixed(1)}h`;
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
  if (process.platform !== "win32") {
    return { level: "warn", name: "scheduled-tasks", details: "Windows scheduled tasks unavailable" };
  }

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

function isHiddenHourlyAction(payload: HourlyTaskPayload) {
  const execute = payload.Execute ?? "";
  const args = payload.Arguments ?? "";
  return (
    /(^|\\)powershell(\.exe)?$/i.test(execute) &&
    args.includes("-WindowStyle Hidden") &&
    args.includes("db-backup-hourly-hidden.ps1") &&
    !args.toLowerCase().includes(".cmd")
  );
}

function checkHourlyTaskDetails(): Check {
  if (process.platform !== "win32") {
    return { level: "warn", name: "hourly-backup-task", details: "Windows scheduled tasks unavailable" };
  }

  const script = [
    "$task = Get-ScheduledTask -TaskName 'MaisonOlive-DB-Backup-Hourly' -ErrorAction SilentlyContinue;",
    "if (-not $task) { [pscustomobject]@{ Present = $false } | ConvertTo-Json -Compress; exit 0 }",
    "$info = Get-ScheduledTaskInfo -TaskName 'MaisonOlive-DB-Backup-Hourly';",
    "$action = @($task.Actions)[0];",
    "[pscustomobject]@{",
    "Present = $true;",
    "TaskName = $task.TaskName;",
    "State = $task.State.ToString();",
    "LastRunTime = $info.LastRunTime.ToString('o');",
    "LastTaskResult = $info.LastTaskResult;",
    "NextRunTime = $info.NextRunTime.ToString('o');",
    "Execute = $action.Execute;",
    "Arguments = $action.Arguments;",
    "WorkingDirectory = $action.WorkingDirectory;",
    "} | ConvertTo-Json -Compress",
  ].join(" ");

  const result = run(commandName("powershell"), ["-NoProfile", "-Command", script], 30_000);
  if (!result.ok) return { level: "warn", name: "hourly-backup-task", details: "unable to query hourly task" };

  try {
    const payload = JSON.parse(result.output) as HourlyTaskPayload;
    if (!payload.Present) {
      return { level: "warn", name: "hourly-backup-task", details: "MaisonOlive-DB-Backup-Hourly missing" };
    }

    const hidden = isHiddenHourlyAction(payload);
    const stateOk = payload.State === "Ready" || payload.State === "Running";
    const resultOk = payload.LastTaskResult === 0;
    const level: CheckLevel = stateOk && resultOk && hidden ? "pass" : "warn";
    const details = [
      `state=${payload.State ?? "unknown"}`,
      `last=${payload.LastTaskResult ?? "unknown"}`,
      `next=${payload.NextRunTime ?? "unknown"}`,
      `hidden=${hidden}`,
      `action=${payload.Execute ?? "unknown"} ${payload.Arguments ?? ""}`,
    ].join(", ");

    return { level, name: "hourly-backup-task", details };
  } catch {
    return { level: "warn", name: "hourly-backup-task", details: "unable to parse hourly task details" };
  }
}

function checkHourlyBackupLogs(): Check {
  const logDir = resolveLogDirFromEnv();
  if (!fs.existsSync(logDir)) {
    return { level: "warn", name: "hourly-backup-logs", details: `missing log dir ${logDir}` };
  }

  const logs = fs.readdirSync(logDir)
    .filter((name) => /^db-backup-hourly-\d{8}-\d{6}\.(out|err)\.log$/.test(name))
    .map((name) => {
      const fullPath = path.join(logDir, name);
      const stats = fs.statSync(fullPath);
      return { name, fullPath, stats };
    })
    .sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);

  if (logs.length < 1) {
    return { level: "warn", name: "hourly-backup-logs", details: `no hourly logs in ${logDir}` };
  }

  const latest = logs[0];
  const latestErr = logs.find((log) => log.name.endsWith(".err.log") && log.stats.size > 0);
  return {
    level: latestErr ? "warn" : "pass",
    name: "hourly-backup-logs",
    details: latestErr
      ? `latest=${latest.name} (${formatAgeHours(latest.stats.mtime)}), non-empty err=${latestErr.name}`
      : `latest=${latest.name} (${formatAgeHours(latest.stats.mtime)}), count=${logs.length}`,
  };
}

function checkSmokeAdminEnv(): Check {
  const email = process.env.ACCOUNT_SMOKE_ADMIN_EMAIL || process.env.DELIVERY_SMOKE_ADMIN_EMAIL || "";
  const password = process.env.ACCOUNT_SMOKE_ADMIN_PASSWORD || process.env.DELIVERY_SMOKE_ADMIN_PASSWORD || "";

  if (email && password) {
    return { level: "pass", name: "smoke-admin-env", details: `email=${email}, password=set` };
  }

  if (process.platform === "win32") {
    const script = [
      "$email = [Environment]::GetEnvironmentVariable('ACCOUNT_SMOKE_ADMIN_EMAIL', 'User');",
      "$pass = [Environment]::GetEnvironmentVariable('ACCOUNT_SMOKE_ADMIN_PASSWORD', 'User');",
      "[pscustomobject]@{ Email = $email; PasswordSet = [bool]$pass } | ConvertTo-Json -Compress",
    ].join(" ");
    const result = run(commandName("powershell"), ["-NoProfile", "-Command", script], 30_000);
    if (result.ok) {
      try {
        const payload = JSON.parse(result.output) as { Email?: string; PasswordSet?: boolean };
        if (payload.Email && payload.PasswordSet) {
          return { level: "pass", name: "smoke-admin-env", details: `email=${payload.Email}, password=set (Windows user env)` };
        }
      } catch {
        // fall through to warning
      }
    }
  }

  return {
    level: "warn",
    name: "smoke-admin-env",
    details: "ACCOUNT_SMOKE_ADMIN_EMAIL/PASSWORD missing for automated smokes",
  };
}

function checkLatestAccountSmokeArtifact(): Check {
  const smokeRoot = path.resolve(process.cwd(), "test-results", "account-smoke");
  if (!fs.existsSync(smokeRoot)) {
    return { level: "warn", name: "latest-account-smoke", details: "no account smoke artifact directory" };
  }

  const runs = fs.readdirSync(smokeRoot)
    .map((name) => {
      const fullPath = path.join(smokeRoot, name);
      const stats = fs.statSync(fullPath);
      return { name, fullPath, stats };
    })
    .filter((entry) => entry.stats.isDirectory())
    .sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);

  if (runs.length < 1) {
    return { level: "warn", name: "latest-account-smoke", details: "no account smoke run found" };
  }

  const latest = runs[0];
  const screenshotCount = fs.readdirSync(latest.fullPath).filter((name) => name.endsWith(".png")).length;
  return {
    level: "pass",
    name: "latest-account-smoke",
    details: `run=${latest.name}, age=${formatAgeHours(latest.stats.mtime)}, screenshots=${screenshotCount}`,
  };
}

function checkPushEnv(): Check {
  const publicServer = process.env.WEB_PUSH_PUBLIC_KEY?.trim() ?? "";
  const publicClient = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY?.trim() ?? "";
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY?.trim() ?? "";
  const subject = process.env.WEB_PUSH_SUBJECT?.trim() ?? "";
  const configured = Boolean(publicServer && publicClient && privateKey && subject);
  const partiallyConfigured = Boolean(publicServer || publicClient || privateKey || subject);

  if (configured) {
    return {
      level: "pass",
      name: "push-env",
      details: "WEB_PUSH_PUBLIC_KEY, NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY, WEB_PUSH_PRIVATE_KEY, WEB_PUSH_SUBJECT set",
    };
  }

  if (partiallyConfigured) {
    return {
      level: "warn",
      name: "push-env",
      details: [
        `WEB_PUSH_PUBLIC_KEY=${Boolean(publicServer)}`,
        `NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY=${Boolean(publicClient)}`,
        `WEB_PUSH_PRIVATE_KEY=${Boolean(privateKey)}`,
        `WEB_PUSH_SUBJECT=${Boolean(subject)}`,
      ].join(", "),
    };
  }

  return {
    level: "warn",
    name: "push-env",
    details: "web push not configured; in-app notifications still work",
  };
}

function checkReleaseIdentity(): Check {
  const commit = run("git", ["rev-parse", "--short", "HEAD"]);
  const branch = run("git", ["branch", "--show-current"]);
  if (!commit.ok) {
    return { level: "warn", name: "release-identity", details: "unable to read git commit" };
  }

  return {
    level: "pass",
    name: "release-identity",
    details: `branch=${branch.ok ? branch.output.trim() || "unknown" : "unknown"}, commit=${commit.output.trim()}`,
  };
}

async function checkBusinessSignals(): Promise<Check> {
  const target = flagEnvTarget();
  const noOrderWarnHours = Number(flagValue("--no-order-warn-hours", process.env.OPS_NO_ORDER_WARN_HOURS ?? "24"));
  const checkoutErrorWarnHours = Number(flagValue("--checkout-error-warn-hours", process.env.OPS_CHECKOUT_ERROR_WARN_HOURS ?? "24"));

  try {
    loadDatabaseEnvForTarget(target);
    const { prisma } = await import("../src/lib/prisma");
    const now = Date.now();
    const noOrderSince = new Date(now - Math.max(1, noOrderWarnHours) * 3_600_000);
    const checkoutErrorSince = new Date(now - Math.max(1, checkoutErrorWarnHours) * 3_600_000);

    const conversionTables = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT name FROM sqlite_master WHERE type='table' AND name='ConversionEvent'
    `.catch(() => []);
    const hasConversionTable = conversionTables.length > 0;

    const [lastOrder, recentOrderCount, criticalStockCount, criticalProducts] = await Promise.all([
      prisma.order.findFirst({
        where: { status: { not: "CANCELLED" } },
        orderBy: { createdAt: "desc" },
        select: { orderNumber: true, createdAt: true },
      }),
      prisma.order.count({
        where: {
          status: { not: "CANCELLED" },
          createdAt: { gte: noOrderSince },
        },
      }),
      prisma.product.count({ where: { isActive: true, stock: { lte: 0 } } }),
      prisma.product.findMany({
        where: { isActive: true, stock: { lte: 0 } },
        orderBy: [{ stock: "asc" }, { updatedAt: "desc" }],
        take: 3,
        select: { slug: true, stock: true },
      }),
    ]);
    const checkoutErrorCount = hasConversionTable
      ? await prisma.conversionEvent.count({
          where: {
            type: "CHECKOUT_ERROR",
            createdAt: { gte: checkoutErrorSince },
          },
        })
      : null;

    const warnings: string[] = [];
    if (recentOrderCount === 0) {
      warnings.push(
        lastOrder
          ? `no order in ${noOrderWarnHours}h; last=${lastOrder.orderNumber} (${formatAgeHours(lastOrder.createdAt)})`
          : `no order found in ${target} DB`,
      );
    }
    if ((checkoutErrorCount ?? 0) > 0) {
      warnings.push(`${checkoutErrorCount} checkout error(s) in ${checkoutErrorWarnHours}h`);
    }
    if (criticalStockCount > 0) {
      const examples = criticalProducts.map((product) => `${product.slug}(${product.stock})`).join(", ");
      warnings.push(
        `${criticalStockCount} stock action(s) to review: active product(s) visible but not buyable${examples ? `: ${examples}` : ""}`,
      );
    }

    return {
      level: warnings.length > 0 ? "warn" : "pass",
      name: "business-signals",
      details: warnings.length > 0
        ? warnings.join("; ")
        : `orders=${recentOrderCount}/${noOrderWarnHours}h, checkoutErrors=${checkoutErrorCount ?? "n/a"}/${checkoutErrorWarnHours}h, criticalStock=0`,
    };
  } catch (error) {
    return {
      level: "warn",
      name: "business-signals",
      details: error instanceof Error ? error.message : "unable to read business signals",
    };
  }
}

async function main() {
  const baseUrl = flagValue("--base-url", "https://chezolive.ca");
  const target = flagEnvTarget();
  loadDatabaseEnvForTarget(target);
  const checks: Check[] = [
    checkGit(),
    checkReleaseIdentity(),
    await checkHealth(baseUrl),
    checkPm2(),
    checkBackupHealth(),
    checkScheduledTasks(),
    checkHourlyTaskDetails(),
    checkHourlyBackupLogs(),
    checkSmokeAdminEnv(),
    checkLatestAccountSmokeArtifact(),
    checkPushEnv(),
    await checkBusinessSignals(),
  ];

  console.log(`Ops status for ${baseUrl} (env=${target})`);
  for (const check of checks) print(check);

  process.exit(checks.some((check) => check.level === "fail") ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
