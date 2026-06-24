import { pathToFileURL } from "node:url";

export const REQUIRED_CONFIRMATION_1 = "GARY_CONFIRM_SCOPE";
export const REQUIRED_CONFIRMATION_2 = "GARY_CONFIRM_EXECUTE";
const MIN_REASON_LENGTH = 8;
const TRUSTED_CI_REPOSITORY = "garyb0/Maison-olive-shop";
const TRUSTED_CI_WORKFLOW = "CI";

const protectedCommands = new Set([
  "check",
  "build",
  "deploy",
  "android",
  "migrate",
  "site-state",
  "prod",
]);

type ProjectLockResult = {
  exitCode: number;
  stdout: string[];
  stderr: string[];
};

export function hasDoubleConfirmation(env: NodeJS.ProcessEnv) {
  return (
    env.CHEZ_OLIVE_UNLOCK_CONFIRMATION_1 === REQUIRED_CONFIRMATION_1 &&
    env.CHEZ_OLIVE_UNLOCK_CONFIRMATION_2 === REQUIRED_CONFIRMATION_2
  );
}

export function hasUnlockReason(env: NodeJS.ProcessEnv) {
  return (env.CHEZ_OLIVE_UNLOCK_REASON ?? "").trim().length >= MIN_REASON_LENGTH;
}

export function isTrustedGithubActionsBuild(env: NodeJS.ProcessEnv) {
  return (
    env.GITHUB_ACTIONS === "true" &&
    env.CI === "true" &&
    env.GITHUB_WORKFLOW === TRUSTED_CI_WORKFLOW &&
    env.GITHUB_REPOSITORY === TRUSTED_CI_REPOSITORY
  );
}

function statusLines() {
  return [
    "Project lock: ACTIVE",
    "Protected commands require two Gary confirmations plus CHEZ_OLIVE_UNLOCK_REASON.",
    `Confirmation 1: ${REQUIRED_CONFIRMATION_1}`,
    `Confirmation 2: ${REQUIRED_CONFIRMATION_2}`,
  ];
}

function blockedLines(command: string) {
  return [
    "",
    "PROJECT LOCK ACTIVE",
    `Blocked command: ${command}`,
    "",
    "Gary must confirm twice in the current conversation before changing the site/app:",
    "1. Confirm the exact scope.",
    "2. Confirm execution now.",
    "",
    "Then run the protected command with:",
    `  CHEZ_OLIVE_UNLOCK_CONFIRMATION_1=${REQUIRED_CONFIRMATION_1}`,
    `  CHEZ_OLIVE_UNLOCK_CONFIRMATION_2=${REQUIRED_CONFIRMATION_2}`,
    "  CHEZ_OLIVE_UNLOCK_REASON=<approved reason>",
    "",
  ];
}

export function evaluateProjectLock(command: string, env: NodeJS.ProcessEnv = process.env): ProjectLockResult {
  if (command === "status") {
    return { exitCode: 0, stdout: statusLines(), stderr: [] };
  }

  if (!protectedCommands.has(command)) {
    return { exitCode: 1, stdout: [], stderr: blockedLines(command) };
  }

  if (command === "build" && isTrustedGithubActionsBuild(env)) {
    return {
      exitCode: 0,
      stdout: [
        "Project lock: GitHub Actions CI build validation allowed.",
        `Repository: ${env.GITHUB_REPOSITORY}`,
        `Workflow: ${env.GITHUB_WORKFLOW}`,
      ],
      stderr: [],
    };
  }

  if (!hasDoubleConfirmation(env) || !hasUnlockReason(env)) {
    return { exitCode: 1, stdout: [], stderr: blockedLines(command) };
  }

  return {
    exitCode: 0,
    stdout: [
      `Project lock: double confirmation received for ${command}.`,
      `Reason: ${env.CHEZ_OLIVE_UNLOCK_REASON?.trim()}`,
    ],
    stderr: [],
  };
}

function printLines(lines: string[], printer: (line: string) => void) {
  for (const line of lines) printer(line);
}

function main() {
  const command = process.argv[2] ?? "check";
  const result = evaluateProjectLock(command);
  printLines(result.stdout, console.log);
  printLines(result.stderr, console.error);
  process.exit(result.exitCode);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
