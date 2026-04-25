import { loadEnvFilesInOrder } from "./db-utils";
import { getMaintenanceState, setMaintenanceState } from "../src/lib/maintenance";

loadEnvFilesInOrder([".env.production.local", ".env.production", ".env.local", ".env"]);

type Command = "status" | "open" | "close";

function printUsage() {
  console.log("Usage: tsx scripts/site-maintenance.ts <status|open|close>");
}

function formatState() {
  const state = getMaintenanceState();
  const summary = {
    enabled: state.enabled,
    message: state.message,
    openAt: state.openAt?.toISOString() ?? null,
    updatedAt: state.updatedAt.toISOString(),
    updatedBy: state.updatedBy,
  };

  console.log(JSON.stringify(summary, null, 2));
}

function main() {
  const command = (process.argv[2] ?? "status").toLowerCase() as Command;

  if (!["status", "open", "close"].includes(command)) {
    printUsage();
    process.exit(1);
  }

  if (command === "status") {
    formatState();
    return;
  }

  if (command === "open") {
    const state = setMaintenanceState(false, {
      updatedBy: "cli:site-open",
    });
    console.log(`[site] maintenance disabled at ${state.updatedAt.toISOString()}`);
    formatState();
    return;
  }

  const state = setMaintenanceState(true, {
    updatedBy: "cli:site-close",
  });
  console.log(`[site] maintenance enabled at ${state.updatedAt.toISOString()}`);
  formatState();
}

main();
