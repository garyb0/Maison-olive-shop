import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { evaluateProjectLock } from "../../scripts/project-lock-guard";

describe("project lock guard", () => {
  it("reports the lock status", () => {
    const result = evaluateProjectLock("status", {});

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Project lock: ACTIVE");
  });

  it("blocks protected commands without two confirmations", () => {
    const result = evaluateProjectLock("build", {});

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("PROJECT LOCK ACTIVE");
  });

  it("allows protected commands with two confirmations and a reason", () => {
    const result = evaluateProjectLock("deploy", {
      CHEZ_OLIVE_UNLOCK_CONFIRMATION_1: "GARY_CONFIRM_SCOPE",
      CHEZ_OLIVE_UNLOCK_CONFIRMATION_2: "GARY_CONFIRM_EXECUTE",
      CHEZ_OLIVE_UNLOCK_REASON: "Gary approved lock verification",
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.join("\n")).toContain("double confirmation received");
  });

  it("guards the npm scripts that can change production or the native app", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts.build).toContain("scripts/project-lock-guard.ts build");
    expect(packageJson.scripts["host:pm2:restart"]).toContain("scripts/project-lock-guard.ts deploy");
    expect(packageJson.scripts["android:sync"]).toContain("scripts/project-lock-guard.ts android");
    expect(packageJson.scripts["prisma:migrate:deploy"]).toContain("scripts/project-lock-guard.ts migrate");
    expect(packageJson.scripts["site:open"]).toContain("scripts/project-lock-guard.ts site-state");
    expect(packageJson.scripts["site:close"]).toContain("scripts/project-lock-guard.ts site-state");
  });
});
