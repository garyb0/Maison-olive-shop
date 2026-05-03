import { describe, expect, it } from "vitest";
import { analyzeReleaseStatus, formatReleaseAudit } from "../../scripts/release-audit";

describe("release audit", () => {
  it("fails added or modified backup and storage artifacts", () => {
    const report = analyzeReleaseStatus([
      "?? storage/proofs/photo.jpg",
      " M backups/dev-20260322-083817.db",
    ].join("\n"));

    expect(report.items.find((item) => item.name === "runtime-artifacts")).toMatchObject({
      level: "fail",
    });
  });

  it("allows deleted legacy backup artifacts", () => {
    const report = analyzeReleaseStatus(" D backups/dev-20260322-083817.db");

    expect(report.items.find((item) => item.name === "runtime-artifacts")).toMatchObject({
      level: "pass",
    });
  });

  it("warns on env and sandbox assets without marking them as runtime artifacts", () => {
    const report = analyzeReleaseStatus([
      " M .env.production.example",
      "?? scripts/fixtures/delivery-sandbox-orders.json",
      "?? scripts/account-smoke.ts",
    ].join("\n"));

    expect(report.items.find((item) => item.name === "env-files")).toMatchObject({ level: "warn" });
    expect(report.items.find((item) => item.name === "demo-smoke-assets")).toMatchObject({ level: "warn" });
    expect(report.items.find((item) => item.name === "runtime-artifacts")).toMatchObject({ level: "pass" });
  });

  it("formats a readable report", () => {
    const output = formatReleaseAudit(analyzeReleaseStatus(""));

    expect(output).toContain("Release audit");
    expect(output).toContain("PASS worktree");
  });

  it("passes release feature checks on a clean committed tree", () => {
    const report = analyzeReleaseStatus("");

    expect(report.items.find((item) => item.name === "pwa-v1")).toMatchObject({ level: "pass" });
    expect(report.items.find((item) => item.name === "help-redirect-cleanup")).toMatchObject({ level: "pass" });
  });
});
