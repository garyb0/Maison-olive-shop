import fs from "node:fs/promises";
import path from "node:path";
import { jsonError, jsonOk } from "@/lib/http";
import { logApiEvent } from "@/lib/observability";
import { requireAdmin } from "@/lib/permissions";

type OliveMode = "princess" | "gremlin";

const normalizeMode = (value: unknown): OliveMode | null => {
  return value === "princess" || value === "gremlin" ? value : null;
};

async function persistOliveMode(mode: OliveMode) {
  const envPath = path.resolve(process.cwd(), ".env");
  const nextLine = `OLIVE_MODE="${mode}"`;

  let content = "";
  try {
    content = await fs.readFile(envPath, "utf8");
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== "ENOENT") throw error;
  }

  if (/(^|\r?\n)OLIVE_MODE=.*/.test(content)) {
    content = content.replace(/(^|\r?\n)OLIVE_MODE=.*/m, (_match, prefix: string) => `${prefix}${nextLine}`);
  } else {
    content = content.trimEnd();
    content = `${content}${content ? "\n" : ""}${nextLine}\n`;
  }

  await fs.writeFile(envPath, content, "utf8");
  process.env.OLIVE_MODE = mode;
}

export async function GET() {
  try {
    await requireAdmin();
    const mode = normalizeMode(process.env.OLIVE_MODE) ?? "princess";
    return jsonOk({ mode });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }

    return jsonError("Forbidden", 403);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = (await request.json().catch(() => null)) as { mode?: unknown } | null;
    const mode = normalizeMode(body?.mode);

    if (!mode) {
      logApiEvent({
        level: "WARN",
        route: "/api/admin/olive-mode",
        event: "ADMIN_OLIVE_MODE_INVALID",
        status: 400,
      });
      return jsonError("Invalid olive mode", 400);
    }

    await persistOliveMode(mode);

    logApiEvent({
      level: "INFO",
      route: "/api/admin/olive-mode",
      event: "ADMIN_OLIVE_MODE_UPDATED",
      status: 200,
      details: { mode },
    });

    return jsonOk({ ok: true, mode });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      logApiEvent({
        level: "WARN",
        route: "/api/admin/olive-mode",
        event: "ADMIN_OLIVE_MODE_UNAUTHORIZED",
        status: 401,
        details: { error },
      });

      return jsonError("Unauthorized", 401);
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      logApiEvent({
        level: "WARN",
        route: "/api/admin/olive-mode",
        event: "ADMIN_OLIVE_MODE_FORBIDDEN",
        status: 403,
        details: { error },
      });

      return jsonError("Forbidden", 403);
    }

    logApiEvent({
      level: "ERROR",
      route: "/api/admin/olive-mode",
      event: "ADMIN_OLIVE_MODE_WRITE_FAILED",
      status: 500,
      details: { error },
    });

    return jsonError("Failed to update Olive mode", 500);
  }
}