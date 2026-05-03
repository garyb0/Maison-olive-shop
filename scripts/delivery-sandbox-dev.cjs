const path = require("node:path");
const { spawn } = require("node:child_process");

const PORT = "3103";
const SITE_URL = `http://localhost:${PORT}`;

const env = {
  ...process.env,
  DATABASE_URL: "file:./delivery-dev.db",
  NEXT_PUBLIC_SITE_URL: SITE_URL,
  DELIVERY_EXPERIMENTAL_ROUTING_ENABLED: "true",
  DELIVERY_GPS_TRACKING_ENABLED: "true",
  DELIVERY_DEPOT_LABEL: process.env.DELIVERY_DEPOT_LABEL || "Chez Olive",
  DELIVERY_DEPOT_LINE1: process.env.DELIVERY_DEPOT_LINE1 || "125 Rue des Pins",
  DELIVERY_DEPOT_CITY: process.env.DELIVERY_DEPOT_CITY || "Rimouski",
  DELIVERY_DEPOT_REGION: process.env.DELIVERY_DEPOT_REGION || "QC",
  DELIVERY_DEPOT_POSTAL: process.env.DELIVERY_DEPOT_POSTAL || "G5L 1A1",
  DELIVERY_DEPOT_COUNTRY: process.env.DELIVERY_DEPOT_COUNTRY || "CA",
};

const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");

console.log("Starting delivery sandbox dev server.");
console.log(`- URL: ${SITE_URL}`);
console.log(`- DB: ${env.DATABASE_URL}`);
console.log("- Flags: delivery routing + GPS enabled for this local process only");

const child = spawn(process.execPath, [nextBin, "dev", "-p", PORT], {
  env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
