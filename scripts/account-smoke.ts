import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { checkoutSchema } from "../src/lib/validators";
import { loadEnvForTarget, resolveEnvTargetFromArgs } from "./db-utils";

type CheckLevel = "pass" | "warn" | "fail";
type CleanupMode = "always" | "on-pass" | "never";

type CheckResult = {
  name: string;
  level: CheckLevel;
  details: string;
};

type ParsedResponse<T> = {
  response: Response;
  data: T | string | null;
  text: string;
};

type LoginPayload = {
  id?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: "CUSTOMER" | "ADMIN";
  requiresTwoFactor?: boolean;
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

type PublicDog = {
  id: string;
  publicToken: string;
  name: string | null;
  ageLabel?: string | null;
};

type AdminDog = {
  id: string;
  publicToken: string;
};

type AdminProduct = {
  id: string;
  slug: string;
  stock: number;
  isActive: boolean;
  isSubscription: boolean;
  priceCents: number;
  currency: string;
  nameFr: string;
  nameEn: string;
};

type PublicProduct = {
  id: string;
  slug: string;
  stock: number;
  isSubscription?: boolean;
};

type DeliverySlotAvailability = {
  id: string;
  startAt: string;
  endAt: string;
  remainingCapacity: number;
  isOpen: boolean;
  dateKey: string;
};

type OrderSummary = {
  id: string;
  orderNumber: string;
  status?: string;
  paymentStatus?: string;
  deliveryStatus?: string;
};

type SupportConversation = {
  id: string;
  customerEmail?: string;
  customerName?: string;
  lastMessagePreview?: string;
  messages?: Array<{ content?: string; senderType?: string }>;
};

type ScriptConfig = {
  allowRemote: boolean;
  artifactDir: string;
  baseUrl: string;
  cleanupMode: CleanupMode;
  envTarget: "development" | "production";
  keepArtifacts: boolean;
  runId: string;
  smokeClientIp: string;
  adminEmail: string;
  adminPassword: string;
  accountEmail: string;
  accountPassword: string;
  accountFirstName: string;
  accountLastName: string;
};

type SmokeState = {
  addressId?: string;
  accountWasCreated?: boolean;
  dogId?: string;
  dogName?: string;
  dogPublicToken?: string;
  orderId?: string;
  orderNumber?: string;
  productId?: string;
  productSlug?: string;
  supportConversationId?: string;
};

const DEFAULT_BASE_URL = "http://127.0.0.1:3101";
const SMOKE_PRODUCT_SLUG = "account-smoke-check";
const SMOKE_EMAIL_PREFIX = "smoke.account+";
const SMOKE_EMAIL_DOMAIN = "@chezolive.local";
const requireFromHere = createRequire(import.meta.url);

class SmokeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SmokeError";
  }
}

class HttpSession {
  private readonly cookies = new Map<string, string>();

  constructor(
    private readonly baseUrl: string,
    private readonly smokeClientIp: string,
  ) {}

  async request<T = unknown>(
    requestPath: string,
    init: RequestInit & { json?: unknown } = {},
  ): Promise<ParsedResponse<T>> {
    const url = requestPath.startsWith("http://") || requestPath.startsWith("https://")
      ? requestPath
      : `${this.baseUrl}${requestPath.startsWith("/") ? requestPath : `/${requestPath}`}`;

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
    if (this.smokeClientIp && !headers.has("x-forwarded-for")) {
      headers.set("x-forwarded-for", this.smokeClientIp);
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

function parseOptionalFlagValue(flagName: string) {
  return parseFlagValue(flagName)?.trim() || undefined;
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

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function formatError(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

function summarizeBody(value: unknown) {
  if (typeof value === "string") return value.slice(0, 240);
  if (value && typeof value === "object") {
    try {
      return JSON.stringify(value).slice(0, 240);
    } catch {
      return "[unserializable body]";
    }
  }
  return value === null || value === undefined ? "" : String(value);
}

function summarizeValidationIssues(issues: Array<{ path: PropertyKey[]; message: string }>) {
  return issues
    .map((issue) => `${issue.path.map(String).join(".") || "<root>"}: ${issue.message}`)
    .join("; ");
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

function isLocalTarget(baseUrl: string) {
  const hostname = new URL(baseUrl).hostname.toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function createRunId() {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `${timestamp}-${randomBytes(3).toString("hex")}`;
}

function createSmokeClientIp(runId: string) {
  let hash = 0;
  for (const character of runId) {
    hash = (hash * 31 + character.charCodeAt(0)) % 240;
  }
  return `198.51.100.${hash + 10}`;
}

function createPassword() {
  return `Smoke-${randomBytes(12).toString("base64url")}9a`;
}

function normalizeCleanupMode(value: string | undefined): CleanupMode {
  const normalized = (value ?? "always").trim().toLowerCase();
  if (normalized === "always" || normalized === "on-pass" || normalized === "never") {
    return normalized;
  }
  throw new SmokeError(`Invalid cleanup mode "${value}". Use always, on-pass, or never.`);
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

function isSafeSmokeAccountEmail(email: string, runId?: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized.startsWith(SMOKE_EMAIL_PREFIX) || !normalized.endsWith(SMOKE_EMAIL_DOMAIN)) {
    return false;
  }
  return runId ? normalized.includes(`+${runId.toLowerCase()}@`) : true;
}

function resolveConfig(): ScriptConfig {
  const envTarget = resolveEnvTargetFromArgs(process.argv, "development");
  loadEnvForTarget(envTarget);

  const allowRemote = hasFlag("--allow-remote")
    ? true
    : parseEnvBoolean(process.env.ACCOUNT_SMOKE_ALLOW_REMOTE) ?? false;
  const runId = parseOptionalFlagValue("--run-id") ?? process.env.ACCOUNT_SMOKE_RUN_ID ?? createRunId();
  const smokeClientIp = process.env.ACCOUNT_SMOKE_CLIENT_IP ?? createSmokeClientIp(runId);
  process.env.ACCOUNT_SMOKE_CLIENT_IP = smokeClientIp;
  const baseUrl = stripTrailingSlash(
    parseOptionalFlagValue("--base-url") ??
      process.env.ACCOUNT_SMOKE_BASE_URL ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      DEFAULT_BASE_URL,
  );
  const cleanupMode = normalizeCleanupMode(
    parseOptionalFlagValue("--cleanup") ?? process.env.ACCOUNT_SMOKE_CLEANUP,
  );
  const keepArtifacts = hasFlag("--keep-artifacts")
    ? true
    : parseEnvBoolean(process.env.ACCOUNT_SMOKE_KEEP_ARTIFACTS) ?? false;
  const artifactDir =
    parseOptionalFlagValue("--artifact-dir") ??
    process.env.ACCOUNT_SMOKE_ARTIFACT_DIR ??
    path.join("test-results", "account-smoke", runId);

  const adminEmail =
    parseOptionalFlagValue("--admin-email") ??
    process.env.ACCOUNT_SMOKE_ADMIN_EMAIL ??
    process.env.DELIVERY_SMOKE_ADMIN_EMAIL ??
    "";
  const adminPassword =
    parseOptionalFlagValue("--admin-password") ??
    process.env.ACCOUNT_SMOKE_ADMIN_PASSWORD ??
    process.env.DELIVERY_SMOKE_ADMIN_PASSWORD ??
    "";
  const accountEmail =
    parseOptionalFlagValue("--account-email") ??
    process.env.ACCOUNT_SMOKE_EMAIL ??
    `${SMOKE_EMAIL_PREFIX}${runId}${SMOKE_EMAIL_DOMAIN}`;
  const accountPassword =
    parseOptionalFlagValue("--account-password") ??
    process.env.ACCOUNT_SMOKE_PASSWORD ??
    createPassword();

  if (!adminEmail || !adminPassword) {
    throw new SmokeError(
      "Missing admin credentials. Set ACCOUNT_SMOKE_ADMIN_EMAIL and ACCOUNT_SMOKE_ADMIN_PASSWORD, or pass --admin-email/--admin-password.",
    );
  }

  if (!allowRemote && !isLocalTarget(baseUrl)) {
    throw new SmokeError(
      `Refusing to run account smoke checks against ${baseUrl}. Re-run with --allow-remote if this target is intentional.`,
    );
  }

  if (!isSafeSmokeAccountEmail(accountEmail)) {
    throw new SmokeError(
      `Refusing unsafe smoke account email ${accountEmail}. Use smoke.account+<runId>@chezolive.local.`,
    );
  }

  return {
    allowRemote,
    artifactDir,
    baseUrl,
    cleanupMode,
    envTarget,
    keepArtifacts,
    runId,
    smokeClientIp,
    adminEmail,
    adminPassword,
    accountEmail,
    accountPassword,
    accountFirstName: "Smoke",
    accountLastName: `Account ${runId}`,
  };
}

async function login(session: HttpSession, email: string, password: string, label: string) {
  const result = await session.request<LoginPayload>("/api/auth/login", {
    method: "POST",
    json: { email, password },
  });

  ensureOkStatus(result, 200, `${label} login`);
  const payload = expectObjectPayload<LoginPayload>(result.data, `${label} login`);

  if (payload.requiresTwoFactor) {
    throw new SmokeError(`${label} login requires two-factor verification, which this script does not automate.`);
  }

  return payload;
}

async function ensureCustomerAccount(session: HttpSession, config: ScriptConfig) {
  const loginResult = await session.request<LoginPayload & { error?: string }>("/api/auth/login", {
    method: "POST",
    json: {
      email: config.accountEmail,
      password: config.accountPassword,
    },
  });

  if (loginResult.response.status === 200) {
    const payload = expectObjectPayload<LoginPayload>(loginResult.data, "account login");
    if (payload.requiresTwoFactor) {
      throw new SmokeError("Smoke account requires two-factor verification, which this script does not automate.");
    }
    if (payload.role !== "CUSTOMER") {
      throw new SmokeError(`Expected CUSTOMER role for smoke account, received ${payload.role ?? "unknown"}.`);
    }
    return { created: false, payload };
  }

  if (loginResult.response.status !== 401) {
    throw new SmokeError(
      `Smoke account login failed with HTTP ${loginResult.response.status}: ${getResultMessage(loginResult.data, loginResult.text)}`,
    );
  }

  const registerResult = await session.request<LoginPayload & { error?: string }>("/api/auth/register", {
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
      `Smoke account ${config.accountEmail} already exists, but the provided password does not work.`,
    );
  }

  ensureOkStatus(registerResult, 200, "account register");
  const payload = expectObjectPayload<LoginPayload>(registerResult.data, "account register");
  await login(session, config.accountEmail, config.accountPassword, "account");

  return { created: true, payload };
}

async function prepareSmokeProduct(
  adminSession: HttpSession,
  results: CheckResult[],
  cleanupTasks: Array<() => Promise<void>>,
  state: SmokeState,
  runId: string,
) {
  const adminProducts = await runStep(results, "admin:products-list", async () => {
    const result = await adminSession.request<{ products?: AdminProduct[] }>("/api/admin/products");
    ensureOkStatus(result, 200, "admin products list");
    const payload = expectObjectPayload<{ products?: AdminProduct[] }>(result.data, "admin products list");
    return {
      details: `count=${Array.isArray(payload.products) ? payload.products.length : 0}`,
      value: Array.isArray(payload.products) ? payload.products : [],
    };
  });

  const existingSmokeProduct = adminProducts.find((product) => product.slug === SMOKE_PRODUCT_SLUG) ?? null;
  const restoreActiveState = existingSmokeProduct?.isActive ?? false;

  if (!existingSmokeProduct) {
    const createdProduct = await runStep(results, "admin:product-create", async () => {
      const result = await adminSession.request<{ product?: AdminProduct }>("/api/admin/products", {
        method: "POST",
        json: {
          slug: SMOKE_PRODUCT_SLUG,
          category: "Smoke QA",
          nameFr: "Produit smoke compte",
          nameEn: "Account smoke product",
          descriptionFr: `Produit temporaire smoke compte ${runId}.`,
          descriptionEn: `Temporary account smoke product ${runId}.`,
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
      state.productId = payload.product.id;
      state.productSlug = payload.product.slug;
      return {
        details: `id=${payload.product.id} slug=${payload.product.slug}`,
        value: payload.product,
      };
    });

    cleanupTasks.push(async () => {
      if (!createdProduct.id) return;
      const cleanupResult = await adminSession.request<{ product?: AdminProduct }>("/api/admin/products", {
        method: "PATCH",
        json: { id: createdProduct.id, isActive: false },
      });
      ensureOkStatus(cleanupResult, 200, "product deactivate cleanup");
    });

    return createdProduct;
  }

  state.productId = existingSmokeProduct.id;
  state.productSlug = existingSmokeProduct.slug;

  cleanupTasks.push(async () => {
    const cleanupResult = await adminSession.request<{ product?: AdminProduct }>("/api/admin/products", {
      method: "PATCH",
      json: { id: existingSmokeProduct.id, isActive: restoreActiveState },
    });
    ensureOkStatus(cleanupResult, 200, "product restore cleanup");
  });

  await runStep(results, "admin:product-prepare", async () => {
    const activateResult = await adminSession.request<{ product?: AdminProduct }>("/api/admin/products", {
      method: "PATCH",
      json: {
        id: existingSmokeProduct.id,
        nameFr: "Produit smoke compte",
        nameEn: "Account smoke product",
        descriptionFr: `Produit temporaire smoke compte ${runId}.`,
        descriptionEn: `Temporary account smoke product ${runId}.`,
        isActive: true,
        isSubscription: false,
      },
    });
    ensureOkStatus(activateResult, 200, "product activate");

    if (existingSmokeProduct.stock < 3) {
      const adjustResult = await adminSession.request<{ product?: AdminProduct }>(
        "/api/admin/products/stock",
        {
          method: "POST",
          json: {
            productId: existingSmokeProduct.id,
            quantityChange: 8,
            reason: "ACCOUNT_SMOKE_TOPUP",
          },
        },
      );
      ensureOkStatus(adjustResult, 200, "product stock top-up");
    }

    return {
      details: `id=${existingSmokeProduct.id} active=true stock=${Math.max(existingSmokeProduct.stock, 3)}`,
      value: existingSmokeProduct,
    };
  });

  return existingSmokeProduct;
}

async function runPlaywrightMobileAccount(config: ScriptConfig, state: SmokeState) {
  mkdirSync(config.artifactDir, { recursive: true });
  const playwrightCliPath = requireFromHere.resolve("@playwright/test/cli");

  const command = spawnSync(
    process.execPath,
    [
      playwrightCliPath,
      "test",
      "src/e2e/mobile-account-authenticated.spec.ts",
      "src/e2e/mobile-admin-lite-authenticated.spec.ts",
      "--project=chromium",
      "--reporter=list",
      "--workers=1",
      "--global-timeout=180000",
      `--output=${path.join(config.artifactDir, "playwright-output")}`,
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        E2E_BASE_URL: config.baseUrl,
        ACCOUNT_SMOKE_EMAIL: config.accountEmail,
        ACCOUNT_SMOKE_PASSWORD: config.accountPassword,
        ACCOUNT_SMOKE_ADMIN_EMAIL: config.adminEmail,
        ACCOUNT_SMOKE_ADMIN_PASSWORD: config.adminPassword,
        ACCOUNT_SMOKE_RUN_ID: config.runId,
        ACCOUNT_SMOKE_CLIENT_IP: config.smokeClientIp,
        ACCOUNT_SMOKE_ARTIFACT_DIR: config.artifactDir,
        ACCOUNT_SMOKE_ORDER_NUMBER: state.orderNumber ?? "",
        ACCOUNT_SMOKE_DOG_NAME: state.dogName ?? "",
        ACCOUNT_SMOKE_DOG_TOKEN: state.dogPublicToken ?? "",
        ACCOUNT_SMOKE_PRODUCT_ID: state.productId ?? "",
      },
      stdio: "inherit",
    },
  );

  if (command.error) {
    throw command.error;
  }

  if (command.status !== 0) {
    throw new SmokeError(`Playwright account mobile smoke failed with status ${command.status ?? "unknown"}.`);
  }
}

async function cleanupDirect(config: ScriptConfig, results: CheckResult[], state: SmokeState) {
  const { prisma } = await import("../src/lib/prisma");
  let accountGone = false;

  try {
    if (state.supportConversationId) {
      const conversation = await prisma.supportConversation.findUnique({
        where: { id: state.supportConversationId },
        include: { messages: true },
      });
      const hasRunMessage = conversation?.messages.some((message) => message.content.includes(config.runId)) ?? false;
      if (conversation && conversation.customerEmail === config.accountEmail && hasRunMessage) {
        await prisma.supportConversation.delete({ where: { id: conversation.id } });
        printResult({ name: "cleanup:support", level: "pass", details: `deleted=${conversation.id}` });
      } else if (conversation) {
        pushWarning(results, "cleanup:support", "support conversation did not pass smoke ownership guards");
      }
    }

    if (state.dogId) {
      const dog = await prisma.dogProfile.findUnique({ where: { id: state.dogId } });
      const dogLooksOwned =
        dog?.publicToken === state.dogPublicToken &&
        dog?.name?.includes(config.runId);
      if (dog && dogLooksOwned) {
        await prisma.dogProfile.delete({ where: { id: dog.id } });
        printResult({ name: "cleanup:dog", level: "pass", details: `deleted=${dog.id}` });
      } else if (dog) {
        pushWarning(results, "cleanup:dog", "dog profile did not pass smoke ownership guards");
      }
    }

    if (state.orderId) {
      const updated = await prisma.order.updateMany({
        where: { id: state.orderId, customerEmail: config.accountEmail },
        data: { status: "CANCELLED", deliveryStatus: "FAILED" },
      });
      if (updated.count > 0) {
        printResult({ name: "cleanup:order", level: "pass", details: `cancelled=${state.orderId}` });
      }
    }

    if (state.productSlug === SMOKE_PRODUCT_SLUG || state.productId) {
      const updated = await prisma.product.updateMany({
        where: state.productId ? { id: state.productId, slug: SMOKE_PRODUCT_SLUG } : { slug: SMOKE_PRODUCT_SLUG },
        data: { isActive: false },
      });
      if (updated.count > 0) {
        printResult({ name: "cleanup:product", level: "pass", details: `deactivated=${SMOKE_PRODUCT_SLUG}` });
      }
    }

    const user = await prisma.user.findUnique({
      where: { email: config.accountEmail },
      include: {
        subscriptions: true,
        orders: true,
        deliveryAddresses: true,
        dogProfiles: true,
        sessions: true,
        customerSupportConversations: true,
      },
    });

    if (!user) {
      accountGone = true;
      return accountGone;
    }

    const accountDeletable = isSafeSmokeAccountEmail(user.email, config.runId);
    const unsafeRole = user.role !== "CUSTOMER";
    const activeSubscriptions = user.subscriptions.filter((subscription) =>
      ["ACTIVE", "PAST_DUE", "PAUSED"].includes(subscription.status),
    );
    const unsafeOrders = user.orders.filter((order) => {
      if (order.id === state.orderId && order.status === "CANCELLED") return false;
      return order.status !== "CANCELLED" || order.paymentStatus === "PAID";
    });
    const untaggedDogs = user.dogProfiles.filter((dog) => !dog.name?.includes(config.runId));
    const untaggedSupport = user.customerSupportConversations.filter((conversation) =>
      conversation.id !== state.supportConversationId,
    );

    if (
      !accountDeletable ||
      unsafeRole ||
      activeSubscriptions.length > 0 ||
      unsafeOrders.length > 0 ||
      untaggedDogs.length > 0 ||
      untaggedSupport.length > 0
    ) {
      pushWarning(
        results,
        "cleanup:account",
        "smoke account was kept because safety guards found role/subscription/order or untagged data risk",
      );
      return accountGone;
    }

    await prisma.user.delete({ where: { id: user.id } });
    accountGone = true;
    printResult({
      name: "cleanup:account",
      level: "pass",
      details: `deleted=${user.email} sessions=${user.sessions.length} addresses=${user.deliveryAddresses.length}`,
    });
    return accountGone;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const config = resolveConfig();
  const results: CheckResult[] = [];
  const cleanupTasks: Array<() => Promise<void>> = [];
  const state: SmokeState = {};

  const adminSession = new HttpSession(config.baseUrl, config.smokeClientIp);
  const accountSession = new HttpSession(config.baseUrl, config.smokeClientIp);

  console.log(
    `Account smoke target: ${config.baseUrl} (env=${config.envTarget}, remote=${config.allowRemote ? "allowed" : "blocked"}, cleanup=${config.cleanupMode})`,
  );
  console.log(`Run id: ${config.runId}`);
  console.log(`Smoke account: ${config.accountEmail}`);
  console.log(`Artifacts: ${config.artifactDir}${config.keepArtifacts ? " (kept)" : ""}`);

  try {
    await runStep(results, "health", async () => {
      const result = await adminSession.request<{ ok?: boolean; release?: string }>("/api/health");
      ensureOkStatus(result, 200, "health");
      const payload = expectObjectPayload<{ ok?: boolean; release?: string }>(result.data, "health");
      if (payload.ok !== true) {
        throw new SmokeError(`Unexpected health payload: ${summarizeBody(payload)}`);
      }
      return {
        details: `release=${payload.release ?? "n/a"}`,
        value: payload,
      };
    });

    await runStep(results, "auth:admin-login", async () => {
      const payload = await login(adminSession, config.adminEmail, config.adminPassword, "admin");
      if (payload.role !== "ADMIN") {
        throw new SmokeError(`Expected ADMIN role, received ${payload.role ?? "unknown"}.`);
      }
      return {
        details: `email=${payload.email ?? config.adminEmail}`,
        value: payload,
      };
    });

    await runStep(results, "auth:account-login", async () => {
      const account = await ensureCustomerAccount(accountSession, config);
      state.accountWasCreated = account.created;
      return {
        details: `${account.created ? "created" : "reused"} email=${config.accountEmail}`,
        value: account.payload,
      };
    });

    const selectedAddress = await runStep(results, "account:address-create", async () => {
      const result = await accountSession.request<{ address?: DeliveryAddress }>("/api/account/delivery-addresses", {
        method: "POST",
        json: {
          label: `Smoke Account ${config.runId}`,
          shippingLine1: `123 Rue Smoke ${config.runId}`,
          shippingCity: "Rimouski",
          shippingRegion: "QC",
          shippingPostal: "G5L 1A1",
          shippingCountry: "CA",
          deliveryPhone: "4185550101",
          deliveryInstructions: `Smoke account delivery ${config.runId}`,
        },
      });
      ensureOkStatus(result, 200, "delivery address create");
      const payload = expectObjectPayload<{ address?: DeliveryAddress }>(result.data, "delivery address create");
      if (!payload.address?.id) {
        throw new SmokeError(`Address create returned an unexpected payload: ${summarizeBody(payload)}`);
      }
      state.addressId = payload.address.id;
      cleanupTasks.push(async () => {
        const cleanupResult = await accountSession.request<{ deleted?: boolean }>(
          `/api/account/delivery-addresses/${payload.address!.id}`,
          { method: "DELETE" },
        );
        if (![200, 404].includes(cleanupResult.response.status)) {
          ensureOkStatus(cleanupResult, 200, "address cleanup");
        }
      });
      return {
        details: `id=${payload.address.id}`,
        value: payload.address,
      };
    });

    await runStep(results, "account:address-list", async () => {
      const result = await accountSession.request<{ addresses?: DeliveryAddress[] }>("/api/account/delivery-addresses");
      ensureOkStatus(result, 200, "delivery addresses list");
      const payload = expectObjectPayload<{ addresses?: DeliveryAddress[] }>(result.data, "delivery addresses list");
      const found = payload.addresses?.some((address) => address.id === selectedAddress.id);
      if (!found) {
        throw new SmokeError("Created address was not returned by account delivery addresses.");
      }
      return {
        details: `visible=${selectedAddress.id}`,
        value: payload.addresses ?? [],
      };
    });

    const claimedDog = await runStep(results, "dogs:claim-edit-public", async () => {
      const tokenResult = await adminSession.request<{ dogs?: AdminDog[] }>("/api/admin/dogs", {
        method: "POST",
        json: { count: 1 },
      });
      ensureOkStatus(tokenResult, 200, "admin dog token create");
      const tokenPayload = expectObjectPayload<{ dogs?: AdminDog[] }>(tokenResult.data, "admin dog token create");
      const token = tokenPayload.dogs?.[0];
      if (!token?.id || !token.publicToken) {
        throw new SmokeError(`Dog token create returned an unexpected payload: ${summarizeBody(tokenPayload)}`);
      }

      const dogName = `Smoke Chien ${config.runId}`;
      const claimResult = await accountSession.request<{ dog?: PublicDog }>("/api/account/dogs", {
        method: "POST",
        json: {
          publicToken: token.publicToken,
          name: dogName,
          photoUrl: null,
          ageLabel: "Smoke test",
          ownerPhone: "4185550101",
          importantNotes: `Smoke dog ${config.runId}`,
          publicProfileEnabled: true,
          showPhotoPublic: false,
          showAgePublic: true,
          showPhonePublic: false,
          showNotesPublic: true,
        },
      });
      ensureOkStatus(claimResult, 200, "dog claim");
      const claimPayload = expectObjectPayload<{ dog?: PublicDog }>(claimResult.data, "dog claim");
      if (!claimPayload.dog?.id) {
        throw new SmokeError(`Dog claim returned an unexpected payload: ${summarizeBody(claimPayload)}`);
      }

      state.dogId = claimPayload.dog.id;
      state.dogName = dogName;
      state.dogPublicToken = token.publicToken;

      const patchResult = await accountSession.request<{ dog?: PublicDog }>(
        `/api/account/dogs/${claimPayload.dog.id}`,
        {
          method: "PATCH",
          json: {
            ageLabel: "Smoke QA updated",
            importantNotes: `Smoke dog updated ${config.runId}`,
            showNotesPublic: true,
          },
        },
      );
      ensureOkStatus(patchResult, 200, "dog edit");

      const publicResult = await accountSession.request<string>(`/dog/${encodeURIComponent(token.publicToken)}`, {
        headers: { accept: "text/html" },
      });
      ensureOkStatus(publicResult, 200, "dog public page");
      if (!publicResult.text.includes(dogName)) {
        throw new SmokeError("Public dog page did not include the smoke dog name.");
      }

      return {
        details: `dogId=${claimPayload.dog.id} token=${token.publicToken}`,
        value: claimPayload.dog,
      };
    });

    await runStep(results, "dogs:account-list", async () => {
      const result = await accountSession.request<{ dogs?: PublicDog[] }>("/api/account/dogs");
      ensureOkStatus(result, 200, "dogs list");
      const payload = expectObjectPayload<{ dogs?: PublicDog[] }>(result.data, "dogs list");
      const found = payload.dogs?.some((dog) => dog.id === claimedDog.id);
      if (!found) {
        throw new SmokeError("Claimed dog was not returned by /api/account/dogs.");
      }
      return {
        details: `visible=${claimedDog.id}`,
        value: payload.dogs ?? [],
      };
    });

    await runStep(results, "support:create-admin-visible", async () => {
      const message = `Smoke support conversation ${config.runId}`;
      const supportResult = await accountSession.request<{ conversation?: SupportConversation }>(
        "/api/support/conversations",
        {
          method: "POST",
          json: { message },
        },
      );
      ensureOkStatus(supportResult, 200, "support conversation create");
      const supportPayload = expectObjectPayload<{ conversation?: SupportConversation }>(
        supportResult.data,
        "support conversation create",
      );
      const conversationId = supportPayload.conversation?.id;
      if (!conversationId) {
        throw new SmokeError(`Support create returned an unexpected payload: ${summarizeBody(supportPayload)}`);
      }
      state.supportConversationId = conversationId;

      const adminResult = await adminSession.request<{ conversations?: SupportConversation[] }>(
        "/api/admin/support/conversations",
      );
      ensureOkStatus(adminResult, 200, "admin support conversations");
      const adminPayload = expectObjectPayload<{ conversations?: SupportConversation[] }>(
        adminResult.data,
        "admin support conversations",
      );
      const visible = adminPayload.conversations?.some((conversation) => {
        const hasMessage = conversation.messages?.some((item) => item.content?.includes(config.runId));
        return conversation.id === conversationId || hasMessage || conversation.lastMessagePreview?.includes(config.runId);
      });
      if (!visible) {
        throw new SmokeError("Smoke support conversation was not visible in admin support list.");
      }

      return {
        details: `conversation=${conversationId}`,
        value: supportPayload.conversation,
      };
    });

    const smokeProduct = await prepareSmokeProduct(adminSession, results, cleanupTasks, state, config.runId);

    const storefrontProduct = await runStep(results, "checkout:storefront-product", async () => {
      const result = await accountSession.request<{ products?: PublicProduct[] }>("/api/products");
      ensureOkStatus(result, 200, "storefront products");
      const payload = expectObjectPayload<{ products?: PublicProduct[] }>(result.data, "storefront products");
      const product = payload.products?.find((item) => item.slug === SMOKE_PRODUCT_SLUG);
      if (!product?.id) {
        throw new SmokeError("Smoke product is not visible on the storefront.");
      }
      return {
        details: `slug=${product.slug} stock=${product.stock}`,
        value: product,
      };
    });

    const slot = await runStep(results, "checkout:delivery-slot", async () => {
      const result = await accountSession.request<{
        mode?: string;
        slots?: DeliverySlotAvailability[];
      }>("/api/delivery/slots?postalCode=G5L%201A1&country=CA");
      ensureOkStatus(result, 200, "delivery slots");
      const payload = expectObjectPayload<{ mode?: string; slots?: DeliverySlotAvailability[] }>(
        result.data,
        "delivery slots",
      );
      const selectedSlot = payload.slots?.find((item) => item.isOpen && item.remainingCapacity > 0) ?? null;
      if (!selectedSlot) {
        pushWarning(
          results,
          "checkout:delivery-slot",
          "no checkout slot available; order smoke will continue as unscheduled with delivery phone",
        );
      }
      return {
        details: selectedSlot ? `slot=${selectedSlot.id} date=${selectedSlot.dateKey}` : "unscheduled fallback",
        value: selectedSlot,
      };
    });

    const createdOrder = await runStep(results, "checkout:manual-order", async () => {
      const orderPayload = {
        paymentMethod: "MANUAL",
        items: [
          {
            productId: storefrontProduct.id,
            quantity: 1,
          },
        ],
        deliveryAddressId: selectedAddress.id,
        deliveryAddressLabel: selectedAddress.label ?? `Smoke ${config.runId}`,
        customerEmail: config.accountEmail,
        customerName: `${config.accountFirstName} ${config.accountLastName}`,
        shippingLine1: selectedAddress.shippingLine1,
        shippingCity: selectedAddress.shippingCity,
        shippingRegion: selectedAddress.shippingRegion,
        shippingPostal: selectedAddress.shippingPostal,
        shippingCountry: selectedAddress.shippingCountry,
        deliveryPhone: selectedAddress.deliveryPhone ?? "4185550101",
        deliveryInstructions: selectedAddress.deliveryInstructions ?? `Smoke checkout ${config.runId}`,
        ...(slot
          ? {
              deliveryWindowStartAt: slot.startAt,
              deliveryWindowEndAt: slot.endAt,
            }
          : {}),
      };
      const parsedOrderPayload = checkoutSchema.safeParse(orderPayload);
      if (!parsedOrderPayload.success) {
        throw new SmokeError(
          `Smoke checkout payload invalid: ${summarizeValidationIssues(parsedOrderPayload.error.issues)}`,
        );
      }

      const result = await accountSession.request<{ order?: OrderSummary }>("/api/orders", {
        method: "POST",
        json: orderPayload,
      });
      if (result.response.status !== 200) {
        throw new SmokeError(
          `Order create failed with HTTP ${result.response.status}: ${getResultMessage(result.data, result.text)}`,
        );
      }
      const payload = expectObjectPayload<{ order?: OrderSummary }>(result.data, "order create");
      if (!payload.order?.id || !payload.order.orderNumber) {
        throw new SmokeError(`Order create returned an unexpected payload: ${summarizeBody(payload)}`);
      }

      state.orderId = payload.order.id;
      state.orderNumber = payload.order.orderNumber;
      cleanupTasks.push(async () => {
        const cleanupResult = await adminSession.request<{ order?: OrderSummary }>("/api/admin/orders", {
          method: "PATCH",
          json: {
            orderId: payload.order!.id,
            status: "CANCELLED",
            deliveryStatus: "FAILED",
          },
        });
        ensureOkStatus(cleanupResult, 200, "smoke order cancel cleanup");
      });

      return {
        details: `orderNumber=${payload.order.orderNumber} product=${smokeProduct.slug}`,
        value: payload.order,
      };
    });

    await runStep(results, "checkout:orders-list", async () => {
      const result = await accountSession.request<{ orders?: OrderSummary[] }>("/api/orders");
      ensureOkStatus(result, 200, "orders list");
      const payload = expectObjectPayload<{ orders?: OrderSummary[] }>(result.data, "orders list");
      const found = payload.orders?.some((order) => order.id === createdOrder.id);
      if (!found) {
        throw new SmokeError("Created smoke order was not returned by account order history.");
      }
      return {
        details: `orderNumber=${createdOrder.orderNumber} visible`,
        value: payload.orders ?? [],
      };
    });

    await runStep(results, "mobile:account-playwright", async () => {
      await runPlaywrightMobileAccount(config, state);
      return {
        details: `screenshots=${config.artifactDir}`,
        value: true,
      };
    });
  } finally {
    const hadFailure = results.some((result) => result.level === "fail");
    const shouldCleanup =
      config.cleanupMode === "always" ||
      (config.cleanupMode === "on-pass" && !hadFailure);

    if (!shouldCleanup) {
      pushWarning(results, "cleanup", `skipped because cleanup=${config.cleanupMode}`);
    } else {
      const cleanupTaskErrors: string[] = [];
      while (cleanupTasks.length > 0) {
        const task = cleanupTasks.pop();
        if (!task) continue;
        try {
          await task();
        } catch (error) {
          cleanupTaskErrors.push(formatError(error));
        }
      }

      let directCleanupConfirmed = false;
      try {
        directCleanupConfirmed = await cleanupDirect(config, results, state);
      } catch (error) {
        pushWarning(results, "cleanup:direct", formatError(error));
      }

      if (cleanupTaskErrors.length > 0 && !directCleanupConfirmed) {
        for (const error of cleanupTaskErrors) {
          pushWarning(results, "cleanup", error);
        }
      }
    }
  }

  const failures = results.filter((result) => result.level === "fail").length;
  const warnings = results.filter((result) => result.level === "warn").length;
  console.log(
    `Account smoke verdict: ${failures > 0 ? "FAIL" : warnings > 0 ? "WARN" : "PASS"} (${results.length} checks, ${warnings} warnings, ${failures} failures)`,
  );

  if (failures > 0) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  console.error(`Account smoke aborted: ${formatError(error)}`);
  process.exitCode = 1;
});
