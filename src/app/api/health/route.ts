import { prisma } from "@/lib/prisma";
import { logApiEvent } from "@/lib/observability";
import { readFileSync } from "fs";
import path from "path";

type DbHealth = {
  ok: boolean;
  latencyMs: number;
  timeout: boolean;
  error?: string;
};

let cachedBuildId: string | null = null;

function getBuildIdFromDisk(): string | null {
  if (cachedBuildId !== null) return cachedBuildId;

  try {
    const buildIdPath = path.join(process.cwd(), ".next", "BUILD_ID");
    const buildId = readFileSync(buildIdPath, "utf-8").trim();
    cachedBuildId = buildId || "";
  } catch {
    cachedBuildId = "";
  }

  return cachedBuildId || null;
}

async function checkDbHealth(timeoutMs: number): Promise<DbHealth> {
  const startedAt = Date.now();

  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("DB_HEALTH_TIMEOUT")), timeoutMs);
      }),
    ]);

    return {
      ok: true,
      latencyMs: Date.now() - startedAt,
      timeout: false,
    };
  } catch (error) {
    const isTimeout = error instanceof Error && error.message === "DB_HEALTH_TIMEOUT";
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      timeout: isTimeout,
      error: error instanceof Error ? error.message : "UNKNOWN_DB_ERROR",
    };
  }
}

export async function GET() {
  const db = await checkDbHealth(1200);
  const degraded = !db.ok;
  const buildId = getBuildIdFromDisk();
  const version = process.env.npm_package_version ?? "0.0.0";
  const release =
    process.env.APP_RELEASE ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.GIT_COMMIT_SHA ??
    process.env.npm_package_gitHead ??
    buildId ??
    `v${version}`;

  const payload = {
    ok: !degraded,
    degraded,
    service: "chez-olive-shop",
    version,
    release,
    timestamp: new Date().toISOString(),
    checks: {
      db,
    },
  };

  if (degraded) {
    logApiEvent({
      level: "WARN",
      route: "/api/health",
      event: "HEALTHCHECK_DEGRADED",
      status: 503,
      details: {
        db,
      },
    });
  }

  return Response.json(payload, { status: degraded ? 503 : 200 });
}

