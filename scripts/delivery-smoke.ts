import { spawnSync } from "node:child_process";
import { getEnvFilesForTarget, loadEnvFilesInOrder, resolveEnvTargetFromArgs } from "./db-utils";

type CheckLevel = "pass" | "warn" | "fail";

type CheckResult = {
  name: string;
  level: CheckLevel;
  details: string;
};

type DeliveryDriver = {
  id: string;
  name: string;
  phone: string | null;
  isActive: boolean;
};

type DeliveryStop = {
  id: string;
  status: string;
};

type DeliveryRunSummary = {
  id: string;
  status: string;
  dateKey: string;
  plannedKm?: number | null;
  driver: DeliveryDriver;
  deliverySlot: {
    id: string;
    note: string | null;
    startAt: string;
    endAt: string;
  };
  stops: DeliveryStop[];
  stopCounts: {
    pending: number;
    delivered: number;
    failed: number;
    total: number;
  };
  gpsSampleCount: number;
  actualKmFinal: number | null;
  actualKmSource: string | null;
};

type DeliverySlotAvailability = {
  id: string;
  startAt: string;
  endAt: string;
  capacity: number;
  remainingCapacity: number;
  note: string | null;
  dateKey: string;
};

type DeliveryAddress = {
  id: string;
  label: string | null;
  shippingLine1: string;
  shippingCity: string;
  shippingRegion: string;
  shippingPostal: string;
  shippingCountry: string;
  deliveryPhone: string | null;
  deliveryInstructions: string | null;
};

type AdminProduct = {
  id: string;
  slug: string;
  stock: number;
  isActive: boolean;
  priceCents: number;
  currency: string;
  nameFr: string;
  nameEn: string;
};

type PublicProduct = {
  id: string;
  slug: string;
  stock: number;
  priceCents: number;
};

type ParsedResponse<T> = {
  response: Response;
  data: T | string | null;
  text: string;
};

type ScriptConfig = {
  allowRemote: boolean;
  adminEmail: string;
  adminPassword: string;
  accountEmail: string;
  accountPassword: string;
  accountFirstName: string;
  accountLastName: string;
  baseUrl: string;
  envTarget: "development" | "production";
  reuseAdminAccount: boolean;
  seedDemo: boolean;
};

const DEFAULT_BASE_URL = "http://127.0.0.1:3103";
const DEMO_DRIVER_NAME = "Demo chauffeur local";
const DEMO_SLOT_NOTE_PREFIX = "Delivery runs demo";
const SMOKE_ADDRESS_LABEL = "Smoke Delivery QA";
const SMOKE_PRODUCT_SLUG = "delivery-smoke-check";

class SmokeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SmokeError";
  }
}

class HttpSession {
  private readonly cookies = new Map<string, string>();

  constructor(private readonly baseUrl: string) {}

  async request<T = unknown>(
    path: string,
    init: RequestInit & { json?: unknown } = {},
  ): Promise<ParsedResponse<T>> {
    const url = path.startsWith("http://") || path.startsWith("https://")
      ? path
      : `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

    const headers = new Headers(init.headers ?? {});
    if (!headers.has("accept")) {
      headers.set("accept", "application/json");
    }

    if (init.json !== undefined) {
      headers.set("content-type", "application/json");
    }

    const cookieHeader = this.getCookieHeader();
    if (cookieHeader) {
      headers.set("cookie", cookieHeader);
    }

    const response = await fetch(url, {
      ...init,
      headers,
      body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
      redirect: "manual",
    });

    this.storeCookiesFromResponse(response);

    const text = await response.text();
    const contentType = response.headers.get("content-type") ?? "";
    let data: T | string | null = text.length ? text : null;

    if (text.length && contentType.includes("application/json")) {
      try {
        data = JSON.parse(text) as T;
      } catch {
        data = text;
      }
    }

    return { response, data, text };
  }

  private getCookieHeader() {
    if (!this.cookies.size) return "";
    return Array.from(this.cookies.entries())
      .map(([key, value]) => `${key}=${value}`)
      .join("; ");
  }

  private storeCookiesFromResponse(response: Response) {
    const maybeHeaders = response.headers as Headers & {
      getSetCookie?: () => string[];
    };

    const setCookies =
      typeof maybeHeaders.getSetCookie === "function"
        ? maybeHeaders.getSetCookie()
        : readCombinedSetCookieHeader(response.headers.get("set-cookie"));

    for (const rawCookie of setCookies) {
      const firstChunk = rawCookie.split(";", 1)[0]?.trim();
      if (!firstChunk) continue;

      const separatorIndex = firstChunk.indexOf("=");
      if (separatorIndex <= 0) continue;

      const name = firstChunk.slice(0, separatorIndex).trim();
      const value = firstChunk.slice(separatorIndex + 1).trim();

      if (!value) {
        this.cookies.delete(name);
      } else {
        this.cookies.set(name, value);
      }
    }
  }
}

function readCombinedSetCookieHeader(header: string | null) {
  if (!header) return [];

  const parts: string[] = [];
  let buffer = "";
  let inExpiresValue = false;

  for (let index = 0; index < header.length; index += 1) {
    const char = header[index];
    const upcoming = header.slice(index, index + 8).toLowerCase();

    if (upcoming === "expires=") {
      inExpiresValue = true;
    }

    if (char === "," && !inExpiresValue) {
      parts.push(buffer.trim());
      buffer = "";
      continue;
    }

    if (inExpiresValue && char === ";") {
      inExpiresValue = false;
    }

    buffer += char;
  }

  if (buffer.trim()) {
    parts.push(buffer.trim());
  }

  return parts;
}

function parseFlagValue(flagName: string) {
  const prefix = `${flagName}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function hasFlag(flagName: string) {
  return process.argv.includes(flagName);
}

function parseEnvBoolean(value: string | undefined) {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return null;
}

function parseOptionalFlagValue(flagName: string) {
  const value = parseFlagValue(flagName);
  return value?.trim() || undefined;
}

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function withTime(date: Date, hours: number, minutes: number) {
  const next = new Date(date);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

function toDateKey(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatError(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

function summarizeBody(value: unknown) {
  if (typeof value === "string") return value.slice(0, 200);
  if (value && typeof value === "object") {
    try {
      return JSON.stringify(value).slice(0, 200);
    } catch {
      return "[unserializable body]";
    }
  }
  return value === null || value === undefined ? "" : String(value);
}

function isLocalTarget(baseUrl: string) {
  const hostname = new URL(baseUrl).hostname.toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function parseTokenFromDriverUrl(driverUrl: string) {
  const match = driverUrl.match(/\/driver\/run\/([^/?#]+)/);
  if (!match?.[1]) {
    throw new SmokeError(`Unable to parse driver token from ${driverUrl}`);
  }
  return match[1];
}

function getResultMessage(data: unknown, fallback: string) {
  if (data && typeof data === "object" && "error" in data) {
    const errorValue = (data as { error?: unknown }).error;
    if (typeof errorValue === "string" && errorValue.trim()) {
      return errorValue;
    }
  }
  const summary = summarizeBody(data);
  return summary || fallback;
}

function ensureOkStatus<T>(result: ParsedResponse<T>, expectedStatus: number, context: string) {
  if (result.response.status !== expectedStatus) {
    throw new SmokeError(
      `${context} failed with HTTP ${result.response.status}: ${getResultMessage(result.data, result.text)}`,
    );
  }
}

function expectObjectPayload<T extends object>(data: T | string | null, context: string): T {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new SmokeError(`Unexpected ${context} payload: ${summarizeBody(data)}`);
  }
  return data;
}

function printResult(result: CheckResult) {
  const prefix = result.level === "pass" ? "PASS" : result.level === "warn" ? "WARN" : "FAIL";
  console.log(`${prefix} ${result.name}: ${result.details}`);
}

async function runStep<T>(
  results: CheckResult[],
  name: string,
  action: () => Promise<{ details: string; value: T }>,
) {
  try {
    const outcome = await action();
    results.push({ name, level: "pass", details: outcome.details });
    printResult(results.at(-1)!);
    return outcome.value;
  } catch (error) {
    results.push({ name, level: "fail", details: formatError(error) });
    printResult(results.at(-1)!);
    throw error;
  }
}

function pushWarning(results: CheckResult[], name: string, details: string) {
  results.push({ name, level: "warn", details });
  printResult(results.at(-1)!);
}

function resolveConfig(): ScriptConfig {
  const envTarget = resolveEnvTargetFromArgs(process.argv, "development");
  loadEnvFilesInOrder(getEnvFilesForTarget(envTarget));

  const envSeedDemo = parseEnvBoolean(process.env.DELIVERY_SMOKE_SEED_DEMO);
  const seedDemo = hasFlag("--no-seed-demo")
    ? false
    : hasFlag("--seed-demo")
      ? true
      : envSeedDemo ?? true;
  const reuseAdminAccount = hasFlag("--reuse-admin-account")
    ? true
    : parseEnvBoolean(process.env.DELIVERY_SMOKE_REUSE_ADMIN_ACCOUNT) ?? false;

  const allowRemote = hasFlag("--allow-remote")
    ? true
    : parseEnvBoolean(process.env.DELIVERY_SMOKE_ALLOW_REMOTE) ?? false;

  const baseUrl = stripTrailingSlash(
    parseFlagValue("--base-url") ??
      process.env.DELIVERY_SMOKE_BASE_URL ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      DEFAULT_BASE_URL,
  );

  const adminEmail =
    parseFlagValue("--admin-email") ??
    process.env.DELIVERY_SMOKE_ADMIN_EMAIL ??
    "";
  const adminPassword =
    parseFlagValue("--admin-password") ??
    process.env.DELIVERY_SMOKE_ADMIN_PASSWORD ??
    "";
  const defaultAccountEmail = reuseAdminAccount
    ? adminEmail
    : "delivery-smoke-customer@chezolive.local";
  const accountEmail =
    parseOptionalFlagValue("--account-email") ??
    process.env.DELIVERY_SMOKE_ACCOUNT_EMAIL ??
    defaultAccountEmail;
  const accountPassword =
    parseOptionalFlagValue("--account-password") ??
    process.env.DELIVERY_SMOKE_ACCOUNT_PASSWORD ??
    adminPassword;
  const accountFirstName =
    parseOptionalFlagValue("--account-first-name") ??
    process.env.DELIVERY_SMOKE_ACCOUNT_FIRST_NAME ??
    "Delivery";
  const accountLastName =
    parseOptionalFlagValue("--account-last-name") ??
    process.env.DELIVERY_SMOKE_ACCOUNT_LAST_NAME ??
    "Smoke";

  if (!adminEmail || !adminPassword) {
    throw new SmokeError(
      "Missing admin credentials. Set DELIVERY_SMOKE_ADMIN_EMAIL and DELIVERY_SMOKE_ADMIN_PASSWORD or pass --admin-email/--admin-password.",
    );
  }

  if (!accountEmail || !accountPassword) {
    throw new SmokeError(
      "Missing account credentials. Set DELIVERY_SMOKE_ACCOUNT_EMAIL and DELIVERY_SMOKE_ACCOUNT_PASSWORD, or let them default to the admin credentials.",
    );
  }

  if (!allowRemote && !isLocalTarget(baseUrl)) {
    throw new SmokeError(
      `Refusing to run destructive smoke checks against ${baseUrl}. Re-run with --allow-remote if this target is intentional.`,
    );
  }

  return {
    allowRemote,
    adminEmail,
    adminPassword,
    accountEmail,
    accountPassword,
    accountFirstName,
    accountLastName,
    baseUrl,
    envTarget,
    reuseAdminAccount,
    seedDemo,
  };
}

async function login(session: HttpSession, email: string, password: string, label: string) {
  const result = await session.request<{
    email?: string;
    requiresTwoFactor?: boolean;
    role?: "CUSTOMER" | "ADMIN";
  }>("/api/auth/login", {
    method: "POST",
    json: { email, password },
  });

  ensureOkStatus(result, 200, `${label} login`);
  const payload = expectObjectPayload<{
    email?: string;
    requiresTwoFactor?: boolean;
    role?: "CUSTOMER" | "ADMIN";
  }>(result.data, `${label} login`);

  if (payload.requiresTwoFactor) {
    throw new SmokeError(`${label} login requires two-factor verification, which this script does not automate.`);
  }

  return payload;
}

async function ensureCustomerAccount(
  session: HttpSession,
  config: ScriptConfig,
) {
  const loginResult = await session.request<{
    email?: string;
    requiresTwoFactor?: boolean;
    role?: "CUSTOMER" | "ADMIN";
    error?: string;
  }>("/api/auth/login", {
    method: "POST",
    json: {
      email: config.accountEmail,
      password: config.accountPassword,
    },
  });

  if (loginResult.response.status === 200) {
    const payload = expectObjectPayload<{
      email?: string;
      requiresTwoFactor?: boolean;
      role?: "CUSTOMER" | "ADMIN";
    }>(loginResult.data, "account login");

    if (payload.requiresTwoFactor) {
      throw new SmokeError("Dedicated smoke account requires two-factor verification, which this script does not automate.");
    }

    if (payload.role !== "CUSTOMER") {
      throw new SmokeError(
        `Expected a CUSTOMER smoke account for ${config.accountEmail}, received role=${payload.role ?? "unknown"}. Use --reuse-admin-account only if that is intentional.`,
      );
    }

    return {
      created: false,
      payload,
    };
  }

  if (loginResult.response.status !== 401) {
    throw new SmokeError(
      `Dedicated account login failed with HTTP ${loginResult.response.status}: ${getResultMessage(loginResult.data, loginResult.text)}`,
    );
  }

  const registerResult = await session.request<{
    id?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    error?: string;
  }>("/api/auth/register", {
    method: "POST",
    json: {
      email: config.accountEmail,
      password: config.accountPassword,
      firstName: config.accountFirstName,
      lastName: config.accountLastName,
      language: "fr",
    },
  });

  if (registerResult.response.status === 409) {
    throw new SmokeError(
      `The dedicated smoke account ${config.accountEmail} already exists but the provided password does not work. Update DELIVERY_SMOKE_ACCOUNT_PASSWORD or choose a different account email.`,
    );
  }

  ensureOkStatus(registerResult, 200, "account register");
  await login(session, config.accountEmail, config.accountPassword, "account");

  return {
    created: true,
    payload: expectObjectPayload<{
      id?: string;
      email?: string;
      firstName?: string;
      lastName?: string;
    }>(registerResult.data, "account register"),
  };
}

function seedDemoData(baseUrl: string) {
  const command = spawnSync(process.execPath, ["scripts/seed-delivery-runs-demo.cjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NEXT_PUBLIC_SITE_URL: baseUrl,
    },
    encoding: "utf8",
  });

  if (command.status !== 0) {
    const stderr = command.stderr?.trim();
    const stdout = command.stdout?.trim();
    throw new SmokeError(
      `Unable to seed delivery demo data.${stderr ? ` ${stderr}` : stdout ? ` ${stdout}` : ""}`,
    );
  }

  return command.stdout.trim();
}

async function main() {
  const config = resolveConfig();
  const results: CheckResult[] = [];
  const cleanupTasks: Array<() => Promise<void>> = [];

  const adminSession = new HttpSession(config.baseUrl);
  const accountSession =
    config.reuseAdminAccount || (
      config.accountEmail === config.adminEmail && config.accountPassword === config.adminPassword
    )
      ? adminSession
      : new HttpSession(config.baseUrl);

  let createdSmokeSlotId: string | null = null;
  let keepCreatedSmokeSlot = false;

  console.log(
    `Delivery smoke target: ${config.baseUrl} (env=${config.envTarget}, remote=${config.allowRemote ? "allowed" : "blocked"})`,
  );

  try {
    await runStep(results, "health", async () => {
      const result = await adminSession.request<{ ok?: boolean; release?: string }>("/api/health");
      ensureOkStatus(result, 200, "health");

      if (!result.data || typeof result.data !== "object" || result.data.ok !== true) {
        throw new SmokeError(`Unexpected health payload: ${summarizeBody(result.data)}`);
      }

      return {
        details: `release=${result.data.release ?? "n/a"}`,
        value: result.data,
      };
    });

    await runStep(results, "auth:admin-login", async () => {
      const payload = await login(adminSession, config.adminEmail, config.adminPassword, "admin");
      return {
        details: `email=${payload?.email ?? config.adminEmail}`,
        value: payload,
      };
    });

    if (config.reuseAdminAccount) {
      pushWarning(results, "auth:account-login", "reusing the admin session for account-level smoke checks");
    } else if (accountSession !== adminSession) {
      await runStep(results, "auth:account-login", async () => {
        const account = await ensureCustomerAccount(accountSession, config);
        return {
          details: `${account.created ? "created" : "reused"} email=${config.accountEmail}`,
          value: account.payload,
        };
      });
    } else {
      pushWarning(results, "auth:account-login", "reusing the admin session for account-level smoke checks");
    }

    const timestampToken = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
    const driverName = `Smoke Driver ${timestampToken}`;
    const slotDay = addDays(new Date(), 3);
    const slotStart = withTime(slotDay, 13, 0);
    const slotEnd = withTime(slotDay, 15, 0);
    const slotNote = `Smoke route ${timestampToken}`;
    const exceptionDateKey = toDateKey(addDays(slotDay, 1));

    await runStep(results, "admin:drivers-list", async () => {
      const result = await adminSession.request<{ drivers?: DeliveryDriver[] }>("/api/admin/delivery/drivers");
      ensureOkStatus(result, 200, "driver list");
      const payload = expectObjectPayload<{ drivers?: DeliveryDriver[] }>(result.data, "driver list");
      const count = Array.isArray(payload.drivers) ? payload.drivers.length : 0;
      return {
        details: `count=${count}`,
        value: payload.drivers ?? [],
      };
    });

    const createdDriver = await runStep(results, "admin:driver-create", async () => {
      const result = await adminSession.request<{ driver?: DeliveryDriver }>("/api/admin/delivery/drivers", {
        method: "POST",
        json: {
          name: driverName,
          phone: "4185550199",
          isActive: true,
        },
      });
      ensureOkStatus(result, 200, "driver create");
      const payload = expectObjectPayload<{ driver?: DeliveryDriver }>(result.data, "driver create");
      if (!payload.driver?.id) {
        throw new SmokeError(`Driver create returned an unexpected payload: ${summarizeBody(payload)}`);
      }
      const driverId = payload.driver.id;

      cleanupTasks.push(async () => {
        const cleanupResult = await adminSession.request<{ deleted?: boolean }>(
          `/api/admin/delivery/drivers/${driverId}`,
          { method: "DELETE" },
        );
        ensureOkStatus(cleanupResult, 200, "driver cleanup");
      });

      return {
        details: `id=${driverId}`,
        value: payload.driver,
      };
    });

    await runStep(results, "admin:driver-update", async () => {
      const result = await adminSession.request<{ driver?: DeliveryDriver }>(
        `/api/admin/delivery/drivers/${createdDriver.id}`,
        {
          method: "PATCH",
          json: {
            name: `${driverName} archive`,
            isActive: false,
          },
        },
      );
      ensureOkStatus(result, 200, "driver update");
      const payload = expectObjectPayload<{ driver?: DeliveryDriver }>(result.data, "driver update");

      return {
        details: `isActive=${payload.driver?.isActive ?? "n/a"}`,
        value: payload,
      };
    });

    const createdSlot = await runStep(results, "admin:slot-create", async () => {
      const result = await adminSession.request<{ slot?: { id: string; capacity: number } }>("/api/admin/delivery", {
        method: "POST",
        json: {
          startAt: slotStart.toISOString(),
          endAt: slotEnd.toISOString(),
          capacity: 5,
          isOpen: true,
          note: slotNote,
        },
      });
      ensureOkStatus(result, 200, "slot create");
      const payload = expectObjectPayload<{ slot?: { id: string; capacity: number } }>(
        result.data,
        "slot create",
      );
      if (!payload.slot?.id) {
        throw new SmokeError(`Slot create returned an unexpected payload: ${summarizeBody(payload)}`);
      }

      createdSmokeSlotId = payload.slot.id;
      cleanupTasks.push(async () => {
        if (keepCreatedSmokeSlot || !createdSmokeSlotId) {
          return;
        }

        const cleanupResult = await adminSession.request<{ deleted?: boolean }>("/api/admin/delivery", {
          method: "DELETE",
          json: { id: createdSmokeSlotId },
        });
        ensureOkStatus(cleanupResult, 200, "slot cleanup");
      });

      return {
        details: `id=${payload.slot.id}`,
        value: payload.slot,
      };
    });

    await runStep(results, "admin:slot-update", async () => {
      const result = await adminSession.request<{ slot?: { capacity: number } }>("/api/admin/delivery", {
        method: "PATCH",
        json: {
          id: createdSlot.id,
          capacity: 7,
          note: `${slotNote} updated`,
        },
      });
      ensureOkStatus(result, 200, "slot update");
      const payload = expectObjectPayload<{ slot?: { capacity: number } }>(result.data, "slot update");

      return {
        details: `capacity=${payload.slot?.capacity ?? "n/a"}`,
        value: payload,
      };
    });

    await runStep(results, "admin:slots-list", async () => {
      const from = withTime(slotDay, 0, 0).toISOString();
      const to = withTime(slotDay, 23, 59).toISOString();
      const result = await adminSession.request<{ slots?: Array<{ id: string }> }>(
        `/api/admin/delivery?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      );
      ensureOkStatus(result, 200, "slot list");
      const payload = expectObjectPayload<{ slots?: Array<{ id: string }> }>(result.data, "slot list");

      const hasSlot = Array.isArray(payload.slots)
        ? payload.slots.some((slot: { id: string }) => slot.id === createdSlot.id)
        : false;

      if (!hasSlot) {
        throw new SmokeError("Created slot was not returned by the admin planner listing.");
      }

      return {
        details: `created slot visible in planner`,
        value: payload.slots ?? [],
      };
    });

    await runStep(results, "admin:exception-upsert", async () => {
      const result = await adminSession.request<{ exception?: { dateKey?: string } }>("/api/admin/delivery", {
        method: "POST",
        json: {
          dateKey: exceptionDateKey,
          isClosed: true,
          reason: `Smoke exception ${timestampToken}`,
        },
      });
      ensureOkStatus(result, 200, "exception upsert");

      return {
        details: `dateKey=${result.data && typeof result.data === "object" ? result.data.exception?.dateKey : "n/a"}`,
        value: result.data,
      };
    });

    await runStep(results, "admin:exception-delete", async () => {
      const result = await adminSession.request<{ deleted?: boolean; dateKey?: string }>("/api/admin/delivery", {
        method: "DELETE",
        json: { dateKey: exceptionDateKey },
      });
      ensureOkStatus(result, 200, "exception delete");

      return {
        details: `dateKey=${result.data && typeof result.data === "object" ? result.data.dateKey : exceptionDateKey}`,
        value: result.data,
      };
    });

    if (config.seedDemo) {
      await runStep(results, "seed:demo-run", async () => {
        const output = seedDemoData(config.baseUrl);
        return {
          details: output.split(/\r?\n/)[0] ?? "demo data prepared",
          value: output,
        };
      });
    } else {
      pushWarning(
        results,
        "seed:demo-run",
        "skipped demo seed; admin/driver checks will use whatever run data already exists",
      );
    }

    const demoDateKey = toDateKey(addDays(new Date(), 1));
    const listedRuns = await runStep(results, "admin:runs-list", async () => {
      const result = await adminSession.request<{ runs?: DeliveryRunSummary[] }>(
        `/api/admin/delivery/runs?date=${encodeURIComponent(demoDateKey)}`,
      );
      ensureOkStatus(result, 200, "run list");
      const payload = expectObjectPayload<{ runs?: DeliveryRunSummary[] }>(result.data, "run list");
      const runs = Array.isArray(payload.runs) ? payload.runs : [];
      if (!runs.length) {
        throw new SmokeError(
          `No delivery run found for ${demoDateKey}. Seed demo data or create a run before replaying the smoke script.`,
        );
      }

      return {
        details: `count=${runs.length} date=${demoDateKey}`,
        value: runs,
      };
    });

    const targetRun = listedRuns.find(
      (run: DeliveryRunSummary) =>
        run.driver.name === DEMO_DRIVER_NAME ||
        run.deliverySlot.note?.startsWith(DEMO_SLOT_NOTE_PREFIX),
    ) ?? listedRuns[0];

    const runDetail = await runStep(results, "admin:run-detail", async () => {
      const result = await adminSession.request<{ run?: DeliveryRunSummary }>(
        `/api/admin/delivery/runs/${targetRun.id}`,
      );
      ensureOkStatus(result, 200, "run detail");
      const payload = expectObjectPayload<{ run?: DeliveryRunSummary }>(result.data, "run detail");
      if (!payload.run?.id) {
        throw new SmokeError(`Run detail returned an unexpected payload: ${summarizeBody(payload)}`);
      }

      return {
        details: `id=${payload.run.id} status=${payload.run.status}`,
        value: payload.run,
      };
    });

    await runStep(results, "admin:run-csv", async () => {
      const result = await adminSession.request<string>(
        `/api/admin/delivery/runs/${targetRun.id}?format=csv`,
      );
      ensureOkStatus(result, 200, "run csv export");

      if (typeof result.data !== "string" || !result.data.includes("runId")) {
        throw new SmokeError("CSV export did not include the expected header.");
      }

      return {
        details: "csv exported",
        value: result.data,
      };
    });

    const optimizedRun = await runStep(results, "admin:run-optimize", async () => {
      const result = await adminSession.request<{ run?: DeliveryRunSummary; warning?: string }>(
        `/api/admin/delivery/runs/${targetRun.id}/optimize`,
        { method: "POST" },
      );
      ensureOkStatus(result, 200, "run optimize");
      const payload = expectObjectPayload<{ run?: DeliveryRunSummary; warning?: string }>(
        result.data,
        "run optimize",
      );

      if (payload.warning) {
        pushWarning(results, "admin:run-optimize-warning", payload.warning);
      }

      if (!payload.run?.id) {
        throw new SmokeError(`Run optimize returned an unexpected payload: ${summarizeBody(payload)}`);
      }

      return {
        details: `status=${payload.run.status} plannedKm=${payload.run.plannedKm ?? "n/a"}`,
        value: payload.run,
      };
    });

    const reorderedRun = await runStep(results, "admin:run-reorder", async () => {
      const reorderedStopIds = [...optimizedRun.stops].map((stop) => stop.id).reverse();
      const result = await adminSession.request<{ run?: DeliveryRunSummary; warning?: string }>(
        `/api/admin/delivery/runs/${targetRun.id}/reorder`,
        {
          method: "PATCH",
          json: { stopIds: reorderedStopIds },
        },
      );
      ensureOkStatus(result, 200, "run reorder");
      const payload = expectObjectPayload<{ run?: DeliveryRunSummary; warning?: string }>(
        result.data,
        "run reorder",
      );

      if (payload.warning) {
        pushWarning(results, "admin:run-reorder-warning", payload.warning);
      }

      if (!payload.run?.id) {
        throw new SmokeError(`Run reorder returned an unexpected payload: ${summarizeBody(payload)}`);
      }

      return {
        details: `stopCount=${payload.run.stops.length}`,
        value: payload.run,
      };
    });

    const publishedRun = await runStep(results, "admin:run-publish", async () => {
      const result = await adminSession.request<{ run?: DeliveryRunSummary; driverUrl?: string }>(
        `/api/admin/delivery/runs/${targetRun.id}/publish`,
        { method: "POST" },
      );
      ensureOkStatus(result, 200, "run publish");
      const payload = expectObjectPayload<{ run?: DeliveryRunSummary; driverUrl?: string }>(
        result.data,
        "run publish",
      );
      if (!payload.run?.id || !payload.driverUrl) {
        throw new SmokeError(`Run publish returned an unexpected payload: ${summarizeBody(payload)}`);
      }
      const driverUrl = payload.driverUrl;

      return {
        details: `driverUrl=${driverUrl}`,
        value: {
          run: payload.run,
          driverUrl,
        },
      };
    });

    const driverToken = parseTokenFromDriverUrl(publishedRun.driverUrl);

    const driverSnapshot = await runStep(results, "driver:snapshot-before-start", async () => {
      const result = await adminSession.request<{ run?: DeliveryRunSummary }>(`/api/driver/run/${driverToken}`);
      ensureOkStatus(result, 200, "driver snapshot");
      const payload = expectObjectPayload<{ run?: DeliveryRunSummary }>(result.data, "driver snapshot");
      if (!payload.run?.id) {
        throw new SmokeError(`Driver snapshot returned an unexpected payload: ${summarizeBody(payload)}`);
      }

      return {
        details: `status=${payload.run.status} stops=${payload.run.stopCounts.total}`,
        value: payload.run,
      };
    });

    await runStep(results, "driver:start", async () => {
      const result = await adminSession.request<{ run?: DeliveryRunSummary }>(
        `/api/driver/run/${driverToken}/start`,
        {
          method: "POST",
          json: {
            lat: 48.451,
            lng: -68.5262,
            accuracyMeters: 8,
            speedMps: 0,
            heading: 0,
            recordedAt: new Date().toISOString(),
          },
        },
      );
      ensureOkStatus(result, 200, "driver start");
      const payload = expectObjectPayload<{ run?: DeliveryRunSummary }>(result.data, "driver start");
      if (payload.run?.status !== "IN_PROGRESS") {
        throw new SmokeError(`Driver start returned an unexpected payload: ${summarizeBody(payload)}`);
      }

      return {
        details: `status=${payload.run.status} gpsSamples=${payload.run.gpsSampleCount}`,
        value: payload.run,
      };
    });

    const locationResult = await adminSession.request<{ accepted?: boolean; actualKmGps?: number; error?: string }>(
      `/api/driver/run/${driverToken}/location`,
      {
        method: "POST",
        json: {
          lat: 48.4512,
          lng: -68.5264,
          accuracyMeters: 8,
          speedMps: 5.1,
          heading: 180,
          recordedAt: new Date().toISOString(),
        },
      },
    );

    if (locationResult.response.status === 200) {
      results.push({
        name: "driver:location",
        level: "pass",
        details: `accepted=${locationResult.data && typeof locationResult.data === "object" ? locationResult.data.accepted : "n/a"} actualKmGps=${locationResult.data && typeof locationResult.data === "object" ? locationResult.data.actualKmGps ?? "n/a" : "n/a"}`,
      });
      printResult(results.at(-1)!);
    } else if (
      locationResult.response.status === 409 &&
      locationResult.data &&
      typeof locationResult.data === "object" &&
      typeof locationResult.data.error === "string" &&
      locationResult.data.error.toUpperCase().includes("GPS")
    ) {
      pushWarning(results, "driver:location", locationResult.data.error);
    } else {
      throw new SmokeError(
        `Driver location failed with HTTP ${locationResult.response.status}: ${getResultMessage(locationResult.data, locationResult.text)}`,
      );
    }

    const stopToComplete =
      driverSnapshot.stops.find((stop) => stop.status === "PENDING") ??
      driverSnapshot.stops.find((stop) => stop.status !== "DELIVERED") ??
      driverSnapshot.stops[0];

    if (!stopToComplete) {
      throw new SmokeError("The selected delivery run does not have any stops to complete.");
    }

    await runStep(results, "driver:stop-complete", async () => {
      const result = await adminSession.request<{ run?: DeliveryRunSummary }>(
        `/api/driver/run/${driverToken}/stops/${stopToComplete.id}`,
        {
          method: "POST",
          json: {
            result: "DELIVERED",
            note: "Smoke delivery success",
          },
        },
      );
      ensureOkStatus(result, 200, "driver stop completion");
      const payload = expectObjectPayload<{ run?: DeliveryRunSummary }>(result.data, "driver stop completion");
      const updatedStop = payload.run?.stops.find((stop) => stop.id === stopToComplete.id) ?? null;

      if (!updatedStop || updatedStop.status !== "DELIVERED") {
        throw new SmokeError(`Unexpected stop completion payload: ${summarizeBody(payload)}`);
      }

      return {
        details: `stopId=${stopToComplete.id} status=${updatedStop.status}`,
        value: payload.run,
      };
    });

    await runStep(results, "driver:finish", async () => {
      const result = await adminSession.request<{ run?: DeliveryRunSummary }>(
        `/api/driver/run/${driverToken}/finish`,
        {
          method: "POST",
          json: {
            odometerStartKm: 1200,
            odometerEndKm: 1206.4,
            note: "Smoke finish",
          },
        },
      );
      ensureOkStatus(result, 200, "driver finish");
      const payload = expectObjectPayload<{ run?: DeliveryRunSummary }>(result.data, "driver finish");
      if (payload.run?.status !== "COMPLETED") {
        throw new SmokeError(`Driver finish returned an unexpected payload: ${summarizeBody(payload)}`);
      }

      return {
        details: `status=${payload.run.status} actualKmFinal=${payload.run.actualKmFinal ?? "n/a"}`,
        value: payload.run,
      };
    });

    await runStep(results, "driver:snapshot-after-finish", async () => {
      const result = await adminSession.request<{ run?: DeliveryRunSummary }>(`/api/driver/run/${driverToken}`);
      ensureOkStatus(result, 200, "driver final snapshot");
      const payload = expectObjectPayload<{ run?: DeliveryRunSummary }>(result.data, "driver final snapshot");
      if (payload.run?.status !== "COMPLETED") {
        throw new SmokeError(`Unexpected final snapshot payload: ${summarizeBody(payload)}`);
      }

      return {
        details: `delivered=${payload.run.stopCounts.delivered} pending=${payload.run.stopCounts.pending} gpsSamples=${payload.run.gpsSampleCount}`,
        value: payload.run,
      };
    });

    const accountAddressesBefore = await runStep(results, "account:addresses-list", async () => {
      const result = await accountSession.request<{ addresses?: DeliveryAddress[] }>("/api/account/delivery-addresses");
      ensureOkStatus(result, 200, "address list");
      const payload = expectObjectPayload<{ addresses?: DeliveryAddress[] }>(result.data, "address list");

      return {
        details: `count=${Array.isArray(payload.addresses) ? payload.addresses.length : 0}`,
        value: Array.isArray(payload.addresses) ? payload.addresses : [],
      };
    });

    const staleSmokeAddresses = accountAddressesBefore.filter(
      (address: DeliveryAddress) => address.label?.startsWith(SMOKE_ADDRESS_LABEL),
    );

    for (const address of staleSmokeAddresses) {
      const cleanupResult = await accountSession.request<{ ok?: boolean }>(
        `/api/account/delivery-addresses/${address.id}`,
        { method: "DELETE" },
      );
      ensureOkStatus(cleanupResult, 200, "stale smoke address cleanup");
    }

    const refreshedAddresses = await accountSession.request<{ addresses?: DeliveryAddress[] }>("/api/account/delivery-addresses");
    ensureOkStatus(refreshedAddresses, 200, "address refresh");
    const refreshedPayload = expectObjectPayload<{ addresses?: DeliveryAddress[] }>(
      refreshedAddresses.data,
      "address refresh",
    );
    const availableAddresses = Array.isArray(refreshedPayload.addresses) ? refreshedPayload.addresses : [];

    let selectedAddress = availableAddresses[0] ?? null;
    let createdAddressId: string | null = null;

    if (availableAddresses.length < 3) {
      const createdAddress = await runStep(results, "account:address-create", async () => {
        const result = await accountSession.request<{ address?: DeliveryAddress }>("/api/account/delivery-addresses", {
          method: "POST",
          json: {
            label: SMOKE_ADDRESS_LABEL,
            shippingLine1: "125 Rue des Pins",
            shippingCity: "Rimouski",
            shippingRegion: "QC",
            shippingPostal: "G5L 1A1",
            shippingCountry: "CA",
            deliveryPhone: "4185550101",
            deliveryInstructions: "Smoke address",
          },
        });
        ensureOkStatus(result, 200, "address create");
        const payload = expectObjectPayload<{ address?: DeliveryAddress }>(result.data, "address create");
        if (!payload.address?.id) {
          throw new SmokeError(`Address create returned an unexpected payload: ${summarizeBody(payload)}`);
        }

        createdAddressId = payload.address.id;
        cleanupTasks.push(async () => {
          if (!createdAddressId) return;
          const cleanupResult = await accountSession.request<{ ok?: boolean }>(
            `/api/account/delivery-addresses/${createdAddressId}`,
            { method: "DELETE" },
          );
          ensureOkStatus(cleanupResult, 200, "address cleanup");
        });

        return {
          details: `id=${payload.address.id}`,
          value: payload.address,
        };
      });

      selectedAddress = createdAddress;

      const duplicateResult = await accountSession.request<{ error?: string }>("/api/account/delivery-addresses", {
        method: "POST",
        json: {
          label: SMOKE_ADDRESS_LABEL,
          shippingLine1: "125 Rue des Pins",
          shippingCity: "Rimouski",
          shippingRegion: "QC",
          shippingPostal: "G5L 1A1",
          shippingCountry: "CA",
          deliveryPhone: "4185550101",
          deliveryInstructions: "Smoke address",
        },
      });

      if (duplicateResult.response.status !== 409) {
        throw new SmokeError(
          `Duplicate address check expected HTTP 409 but received ${duplicateResult.response.status}: ${getResultMessage(duplicateResult.data, duplicateResult.text)}`,
        );
      }

      results.push({
        name: "account:address-duplicate",
        level: "pass",
        details: getResultMessage(duplicateResult.data, "duplicate address blocked"),
      });
      printResult(results.at(-1)!);
    } else if (selectedAddress) {
      pushWarning(
        results,
        "account:address-create",
        "account already has the maximum number of saved addresses; reusing the first one for checkout",
      );
    } else {
      throw new SmokeError("No delivery address is available for checkout and the account address limit is already reached.");
    }

    const slotResult = await runStep(results, "checkout:slots", async () => {
      const result = await accountSession.request<{
        mode?: string;
        slots?: DeliverySlotAvailability[];
      }>(
        "/api/delivery/slots?postalCode=G5L+1A1&country=CA",
      );
      ensureOkStatus(result, 200, "checkout slots");
      const payload = expectObjectPayload<{ mode?: string; slots?: DeliverySlotAvailability[] }>(
        result.data,
        "checkout slots",
      );

      const slots = Array.isArray(payload.slots) ? payload.slots : [];
      if (!slots.length) {
        throw new SmokeError("Checkout did not return any delivery slot/window for G5L 1A1.");
      }

      return {
        details: `mode=${payload.mode ?? "unknown"} count=${slots.length}`,
        value: {
          mode: payload.mode ?? "unknown",
          slots,
        },
      };
    });

    const preferredSlot =
      slotResult.slots.find((slot: DeliverySlotAvailability) => slot.id !== createdSmokeSlotId) ??
      slotResult.slots[0];

    if (!preferredSlot) {
      throw new SmokeError("No usable delivery slot was found for checkout.");
    }

    if (preferredSlot.id === createdSmokeSlotId) {
      keepCreatedSmokeSlot = true;
      pushWarning(
        results,
        "checkout:slot-selection",
        "the smoke-created admin slot was the only checkout slot available, so it will be kept for traceability",
      );
    } else {
      results.push({
        name: "checkout:slot-selection",
        level: "pass",
        details: `slotId=${preferredSlot.id} dateKey=${preferredSlot.dateKey}`,
      });
      printResult(results.at(-1)!);
    }

    const adminProducts = await runStep(results, "admin:products-list", async () => {
      const result = await adminSession.request<{ products?: AdminProduct[] }>("/api/admin/products");
      ensureOkStatus(result, 200, "admin products list");
      const payload = expectObjectPayload<{ products?: AdminProduct[] }>(result.data, "admin products list");
      return {
        details: `count=${Array.isArray(payload.products) ? payload.products.length : 0}`,
        value: Array.isArray(payload.products) ? payload.products : [],
      };
    });

    const existingSmokeProduct = adminProducts.find(
      (product: AdminProduct) => product.slug === SMOKE_PRODUCT_SLUG,
    ) ?? null;
    let smokeProductId = existingSmokeProduct?.id ?? null;
    const restoreProductActiveState = existingSmokeProduct?.isActive ?? false;

    if (!existingSmokeProduct) {
      const createdProduct = await runStep(results, "admin:product-create", async () => {
        const result = await adminSession.request<{ product?: AdminProduct }>("/api/admin/products", {
          method: "POST",
          json: {
            slug: SMOKE_PRODUCT_SLUG,
            category: "Smoke QA",
            nameFr: "Produit smoke livraison",
            nameEn: "Delivery smoke product",
            descriptionFr: "Produit temporaire pour le smoke delivery.",
            descriptionEn: "Temporary product for the delivery smoke check.",
            priceCents: 2199,
            costCents: 0,
            currency: "CAD",
            stock: 8,
            isActive: true,
            isSubscription: false,
          },
        });
        ensureOkStatus(result, 200, "product create");
        const payload = expectObjectPayload<{ product?: AdminProduct }>(result.data, "product create");
        if (!payload.product?.id) {
          throw new SmokeError(`Product create returned an unexpected payload: ${summarizeBody(payload)}`);
        }

        smokeProductId = payload.product.id;
        return {
          details: `id=${payload.product.id}`,
          value: payload.product,
        };
      });

      cleanupTasks.push(async () => {
        if (!smokeProductId) return;
        const cleanupResult = await adminSession.request<{ product?: AdminProduct }>("/api/admin/products", {
          method: "PATCH",
          json: {
            id: smokeProductId,
            isActive: false,
          },
        });
        ensureOkStatus(cleanupResult, 200, "product deactivate cleanup");
      });

      smokeProductId = createdProduct.id;
    } else {
      cleanupTasks.push(async () => {
        if (!smokeProductId) return;
        const cleanupResult = await adminSession.request<{ product?: AdminProduct }>("/api/admin/products", {
          method: "PATCH",
          json: {
            id: smokeProductId,
            isActive: restoreProductActiveState,
          },
        });
        ensureOkStatus(cleanupResult, 200, "product restore cleanup");
      });

      await runStep(results, "admin:product-prepare", async () => {
        const activateResult = await adminSession.request<{ product?: AdminProduct }>("/api/admin/products", {
          method: "PATCH",
          json: {
            id: existingSmokeProduct.id,
            isActive: true,
          },
        });
        ensureOkStatus(activateResult, 200, "product activate");

        if (existingSmokeProduct.stock < 2) {
          const adjustResult = await adminSession.request<{ product?: AdminProduct }>(
            "/api/admin/products/stock",
            {
              method: "POST",
              json: {
                productId: existingSmokeProduct.id,
                quantityChange: 5,
                reason: "DELIVERY_SMOKE_TOPUP",
              },
            },
          );
          ensureOkStatus(adjustResult, 200, "product stock top-up");
        }

        return {
          details: `id=${existingSmokeProduct.id} active=true`,
          value: existingSmokeProduct,
        };
      });
    }

    const storefrontProducts = await runStep(results, "checkout:products", async () => {
      const result = await accountSession.request<{ products?: PublicProduct[] }>("/api/products");
      ensureOkStatus(result, 200, "storefront products");
      const payload = expectObjectPayload<{ products?: PublicProduct[] }>(result.data, "storefront products");
      const products = Array.isArray(payload.products) ? payload.products : [];
      const smokeProduct = products.find((product: PublicProduct) => product.slug === SMOKE_PRODUCT_SLUG);
      if (!smokeProduct) {
        throw new SmokeError("The smoke product is not visible on the storefront after preparation.");
      }

      return {
        details: `slug=${smokeProduct.slug} stock=${smokeProduct.stock}`,
        value: smokeProduct,
      };
    });

    const createdOrder = await runStep(results, "checkout:order-create", async () => {
      if (!selectedAddress) {
        throw new SmokeError("No delivery address is available for checkout.");
      }

      const result = await accountSession.request<{
        order?: {
          id: string;
          orderNumber: string;
        };
      }>("/api/orders", {
        method: "POST",
        json: {
          paymentMethod: "MANUAL",
          items: [
            {
              productId: storefrontProducts.id,
              quantity: 1,
            },
          ],
          deliveryAddressId: selectedAddress.id,
          deliveryWindowStartAt: preferredSlot.startAt,
          deliveryWindowEndAt: preferredSlot.endAt,
        },
      });
      ensureOkStatus(result, 200, "order create");

      if (!result.data || typeof result.data !== "object" || !result.data.order?.id) {
        throw new SmokeError(`Order create returned an unexpected payload: ${summarizeBody(result.data)}`);
      }

      return {
        details: `orderNumber=${result.data.order.orderNumber}`,
        value: result.data.order,
      };
    });

    await runStep(results, "checkout:orders-list", async () => {
      const result = await accountSession.request<{
        orders?: Array<{ id: string; orderNumber: string }>;
      }>("/api/orders");
      ensureOkStatus(result, 200, "orders list");
      const payload = expectObjectPayload<{ orders?: Array<{ id: string; orderNumber: string }> }>(
        result.data,
        "orders list",
      );

      const orderFound = Array.isArray(payload.orders)
        ? payload.orders.some((order: { id: string; orderNumber: string }) => order.id === createdOrder.id)
        : false;

      if (!orderFound) {
        throw new SmokeError("The freshly created smoke order was not returned by /api/orders.");
      }

      return {
        details: `orderNumber=${createdOrder.orderNumber} visible in account history`,
        value: payload.orders ?? [],
      };
    });
  } finally {
    while (cleanupTasks.length > 0) {
      const task = cleanupTasks.pop();
      if (!task) continue;

      try {
        await task();
      } catch (error) {
        pushWarning(results, "cleanup", formatError(error));
      }
    }
  }

  const failures = results.filter((result) => result.level === "fail").length;
  const warnings = results.filter((result) => result.level === "warn").length;
  console.log(
    `Delivery smoke verdict: ${failures > 0 ? "FAIL" : warnings > 0 ? "WARN" : "PASS"} (${results.length} checks, ${warnings} warnings, ${failures} failures)`,
  );

  if (failures > 0) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  console.error(`Delivery smoke aborted: ${formatError(error)}`);
  process.exitCode = 1;
});
