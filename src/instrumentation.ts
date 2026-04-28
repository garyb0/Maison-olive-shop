import { validateEnv } from "@/lib/env";
export async function register() {
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const report = validateEnv("production");

  if (report.errors.length > 0) {
    throw new Error(`[env] production validation failed: ${report.errors.join(" | ")}`);
  }

  if (report.warnings.length > 0) {
    console.warn(`[env] production warnings: ${report.warnings.join(" | ")}`);
  }
}
