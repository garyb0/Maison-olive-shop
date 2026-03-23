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

const sanitizeError = (value: unknown) => {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: isProduction ? undefined : value.stack,
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
          Object.entries(input.details).map(([key, value]) => [key, sanitizeError(value)])
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
