import { env } from "@/lib/env";

type LogLevel = "INFO" | "WARN" | "ERROR";

type ApiLogInput = {
  level: LogLevel;
  route: string;
  event: string;
  status?: number;
  details?: Record<string, unknown>;
};

const isProduction = env.nodeEnv === "production";

const REDACTED = "[REDACTED]";

const sensitiveKeyPattern = /(token|secret|password|authorization|cookie|signature|api.?key|webhook|session)/i;
const piiKeyPattern = /(email|phone|address|postal|shippingLine|deliveryInstructions)/i;

function maskEmail(value: string) {
  const [name, domain] = value.split("@");
  if (!name || !domain) return REDACTED;
  return `${name.slice(0, 2)}***@${domain}`;
}

function redactString(value: string) {
  return value
    .replace(/\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9_]+\b/g, REDACTED)
    .replace(/\bpk_(?:live|test)_[A-Za-z0-9_]+\b/g, REDACTED)
    .replace(/\bwhsec_[A-Za-z0-9_]+\b/g, REDACTED)
    .replace(/\bsk-proj-[A-Za-z0-9_-]+\b/g, REDACTED)
    .replace(/([?&](?:token|session_id|client_secret)=)[^&\s]+/gi, `$1${REDACTED}`);
}

function sanitizeValue(key: string, value: unknown, depth = 0): unknown {
  if (sensitiveKeyPattern.test(key)) return REDACTED;

  if (typeof value === "string") {
    if (piiKeyPattern.test(key)) {
      return key.toLowerCase().includes("email") ? maskEmail(value) : REDACTED;
    }

    return redactString(value);
  }

  if (value instanceof Error) {
    return sanitizeError(value);
  }

  if (!value || typeof value !== "object" || depth >= 4) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeValue(key, item, depth + 1));
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [
      childKey,
      sanitizeValue(childKey, childValue, depth + 1),
    ]),
  );
}

const sanitizeError = (value: unknown) => {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
      stack: isProduction ? undefined : redactString(value.stack ?? ""),
    };
  }
  return value;
};

export function logApiEvent(input: ApiLogInput) {
  const payload = {
    ts: new Date().toISOString(),
    level: input.level,
    route: input.route,
    event: input.event,
    status: input.status,
    details: input.details
      ? Object.fromEntries(
          Object.entries(input.details).map(([key, value]) => [key, sanitizeValue(key, value)])
        )
      : undefined,
  };

  const line = JSON.stringify(payload);

  if (input.level === "ERROR") {
    console.error(line);
    return;
  }

  if (input.level === "WARN") {
    console.warn(line);
    return;
  }

  console.log(line);
}
