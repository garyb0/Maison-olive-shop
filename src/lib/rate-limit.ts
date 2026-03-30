type RateLimitOptions = {
  namespace: string;
  windowMs: number;
  max: number;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

declare global {
  var __maisonOliveRateLimitStore: Map<string, RateLimitEntry> | undefined;
}

const getStore = () => {
  if (!globalThis.__maisonOliveRateLimitStore) {
    globalThis.__maisonOliveRateLimitStore = new Map<string, RateLimitEntry>();
  }
  return globalThis.__maisonOliveRateLimitStore;
};

const getClientIp = (request: Request) => {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "unknown";
};

const maybeCleanupExpiredEntries = (store: Map<string, RateLimitEntry>, now: number) => {
  if (store.size < 1000) return;
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
};

export function applyRateLimit(request: Request, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const store = getStore();
  maybeCleanupExpiredEntries(store, now);

  const ip = getClientIp(request);
  const key = `${options.namespace}:${ip}`;

  const current = store.get(key);
  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + options.windowMs });
    return {
      ok: true,
      remaining: options.max - 1,
      retryAfterSeconds: Math.ceil(options.windowMs / 1000),
    };
  }

  if (current.count >= options.max) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  store.set(key, current);

  return {
    ok: true,
    remaining: options.max - current.count,
    retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
  };
}
