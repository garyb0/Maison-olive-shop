
import { prisma } from "@/lib/prisma";

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
  var __chezoliveRateLimitStore: Map<string, RateLimitEntry> | undefined;
  var __chezoliveRateLimitDbCleanupAt: number | undefined;
}

const RATE_LIMIT_DB_CLEANUP_INTERVAL_MS = 60_000;

const getStore = () => {
  if (!globalThis.__chezoliveRateLimitStore) {
    globalThis.__chezoliveRateLimitStore = new Map<string, RateLimitEntry>();
  }
  return globalThis.__chezoliveRateLimitStore;
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

const maybeCleanupExpiredEntriesMemory = (store: Map<string, RateLimitEntry>, now: number) => {
  if (store.size < 1000) return;
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
};

async function maybeCleanupExpiredEntriesDb(now: number) {
  const lastCleanupAt = globalThis.__chezoliveRateLimitDbCleanupAt ?? 0;
  if (now - lastCleanupAt < RATE_LIMIT_DB_CLEANUP_INTERVAL_MS) return;
  globalThis.__chezoliveRateLimitDbCleanupAt = now;

  await prisma.rateLimitBucket.deleteMany({
    where: {
      resetAt: {
        lte: new Date(now),
      },
    },
  });
}

async function applyRateLimitWithDatabase(
  request: Request,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const now = Date.now();
  const ip = getClientIp(request);
  const id = `${options.namespace}:${ip}`;
  const resetAt = new Date(now + options.windowMs);

  await maybeCleanupExpiredEntriesDb(now);

  return prisma.$transaction(async (tx) => {
    const current = await tx.rateLimitBucket.findUnique({
      where: { id },
      select: {
        count: true,
        resetAt: true,
      },
    });

    if (!current || current.resetAt.getTime() <= now) {
      await tx.rateLimitBucket.upsert({
        where: { id },
        create: {
          id,
          count: 1,
          resetAt,
        },
        update: {
          count: 1,
          resetAt,
        },
      });

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
        retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt.getTime() - now) / 1000)),
      };
    }

    const nextCount = current.count + 1;
    await tx.rateLimitBucket.update({
      where: { id },
      data: { count: nextCount },
    });

    return {
      ok: true,
      remaining: Math.max(0, options.max - nextCount),
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt.getTime() - now) / 1000)),
    };
  });
}

function applyRateLimitInMemory(request: Request, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const store = getStore();
  maybeCleanupExpiredEntriesMemory(store, now);

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

export async function applyRateLimit(
  request: Request,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  try {
    return await applyRateLimitWithDatabase(request, options);
  } catch {
    return applyRateLimitInMemory(request, options);
  }
}
