import { execSync, spawn, spawnSync, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

type StepLevel = "pass" | "warn" | "fail";

type StepResult = {
  name: string;
  command: string;
  level: StepLevel;
  durationMs: number;
  exitCode: number | null;
};

function commandName(baseName: "npm" | "npx") {
  if (process.platform !== "win32") return baseName;
  return `${baseName}.cmd`;
}

function timestampForRunId(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    skipBuild: args.includes("--skip-build"),
    skipE2e: args.includes("--skip-e2e"),
    e2ePort: Number(args.find((arg) => arg.startsWith("--e2e-port="))?.slice("--e2e-port=".length) || "3104"),
    runId: args.find((arg) => arg.startsWith("--run-id="))?.slice("--run-id=".length) || timestampForRunId(),
  };
}

function formatCommand(command: string, args: string[]) {
  return [command, ...args].join(" ");
}

function windowsCommandLine(command: string, args: string[]) {
  const quote = (value: string) => {
    if (/^[\w./:=@+-]+$/.test(value)) return value;
    return `"${value.replace(/"/g, '\\"')}"`;
  };

  return [command, ...args].map(quote).join(" ");
}

function commandForSpawn(command: string, args: string[]) {
  if (process.platform !== "win32") return { command, args };

  return {
    command: "cmd.exe",
    args: ["/d", "/s", "/c", windowsCommandLine(command, args)],
  };
}

function runStep(input: {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  warnOnly?: boolean;
}) {
  const startedAt = Date.now();
  const displayCommand = formatCommand(input.command, input.args);

  console.log(`\n== ${input.name}`);
  console.log(`$ ${displayCommand}`);

  const spawnInput = commandForSpawn(input.command, input.args);
  const result = spawnSync(spawnInput.command, spawnInput.args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...(input.env ?? {}),
    },
    stdio: "inherit",
  });
  if (result.error) {
    console.error(result.error.message);
  }
  const durationMs = Date.now() - startedAt;
  const passed = result.status === 0;
  const level: StepLevel = passed ? "pass" : input.warnOnly ? "warn" : "fail";

  return {
    name: input.name,
    command: displayCommand,
    level,
    durationMs,
    exitCode: result.status,
  } satisfies StepResult;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(baseUrl: string, timeoutMs = 60_000) {
  const startedAt = Date.now();
  let lastError = "server did not respond";

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/api/health`, { cache: "no-store" });
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "fetch failed";
    }
    await sleep(1_000);
  }

  throw new Error(`Timed out waiting for ${baseUrl}: ${lastError}`);
}

function isPortAvailable(port: number) {
  return new Promise<boolean>((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

async function findAvailablePort(startPort: number) {
  for (let port = startPort; port < startPort + 30; port += 1) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No available E2E port found from ${startPort} to ${startPort + 29}`);
}

async function startE2eServer(port: number) {
  const baseUrl = `http://127.0.0.1:${port}`;
  const spawnInput = commandForSpawn(commandName("npx"), ["next", "start", "-p", String(port)]);
  const child = spawn(spawnInput.command, spawnInput.args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout?.on("data", (chunk) => process.stdout.write(`[next-start] ${chunk}`));
  child.stderr?.on("data", (chunk) => process.stderr.write(`[next-start] ${chunk}`));

  await waitForServer(baseUrl);
  return { child, baseUrl };
}

function stopE2eServer(child: ChildProcess) {
  if (!child.pid) return;

  try {
    if (process.platform === "win32") {
      execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: "ignore" });
      return;
    }
    child.kill("SIGTERM");
  } catch {
    child.kill();
  }
}

function printSummary(results: StepResult[], artifactDir: string) {
  console.log("\nSolid release summary");
  console.log(`Artifacts: ${artifactDir}`);

  for (const result of results) {
    const prefix = result.level === "pass" ? "PASS" : result.level === "warn" ? "WARN" : "FAIL";
    const seconds = (result.durationMs / 1000).toFixed(1);
    console.log(`${prefix} ${result.name}: exit=${result.exitCode ?? "null"}, ${seconds}s, ${result.command}`);
  }

  const failCount = results.filter((result) => result.level === "fail").length;
  const warnCount = results.filter((result) => result.level === "warn").length;
  console.log(`Verdict: ${failCount > 0 ? "FAIL" : warnCount > 0 ? "WARN" : "PASS"} (${results.length} step(s))`);
}

async function main() {
  const options = parseArgs();
  const artifactDir = path.join("test-results", "solid-release", options.runId);
  fs.mkdirSync(artifactDir, { recursive: true });

  const e2eEnv: Record<string, string> = {
    SOLID_RELEASE_RUN_ID: options.runId,
    SOLID_RELEASE_ARTIFACT_DIR: artifactDir,
  };

  const steps: Array<{ name: string; command: string; args: string[]; env?: Record<string, string> }> = [
    { name: "release audit", command: commandName("npm"), args: ["run", "release:audit"] },
    { name: "typescript", command: commandName("npx"), args: ["tsc", "--noEmit"] },
    { name: "auth module", command: commandName("npm"), args: ["run", "test:module:auth"] },
    { name: "dogs module", command: commandName("npm"), args: ["run", "test:module:dogs"] },
    { name: "orders module", command: commandName("npm"), args: ["run", "test:module:orders"] },
    { name: "support module", command: commandName("npm"), args: ["run", "test:module:support"] },
    { name: "admin module", command: commandName("npm"), args: ["run", "test:module:admin"] },
    { name: "stripe module", command: commandName("npm"), args: ["run", "test:module:stripe"] },
  ];

  if (!options.skipBuild) {
    steps.push({ name: "production build", command: commandName("npm"), args: ["run", "build"] });
  }

  if (!options.skipE2e) {
    steps.push({
      name: "mobile solid e2e",
      command: commandName("npm"),
      args: ["run", "test:e2e:mobile-solid"],
      env: e2eEnv,
    });
  }

  steps.push({ name: "ops status", command: commandName("npm"), args: ["run", "ops:status"] });

  const results: StepResult[] = [];
  let e2eServer: ChildProcess | null = null;

  for (const step of steps) {
    let currentStep = step;

    if (step.name === "mobile solid e2e") {
      const port = await findAvailablePort(options.e2ePort);
      if (port !== options.e2ePort) {
        console.log(`E2E port ${options.e2ePort} is busy; using ${port}.`);
      }
      const server = await startE2eServer(port);
      e2eServer = server.child;
      currentStep = {
        ...step,
        env: {
          ...(step.env ?? {}),
          E2E_BASE_URL: server.baseUrl,
        },
      };
    }

    try {
      const result = runStep(currentStep);
      results.push(result);
      if (result.level === "fail") {
        break;
      }
    } finally {
      if (step.name === "mobile solid e2e" && e2eServer) {
        stopE2eServer(e2eServer);
        e2eServer = null;
      }
    }
  }

  printSummary(results, artifactDir);

  if (results.some((result) => result.level === "fail")) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
