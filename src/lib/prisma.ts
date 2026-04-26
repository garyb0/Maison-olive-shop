import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

declare global {
  var __prisma: PrismaClient | undefined;
}

const REQUIRED_MODEL_DELEGATES = [
  "order",
  "deliverySlot",
  "deliveryException",
  "deliveryScheduleSettings",
  "driver",
  "deliveryRun",
  "deliveryStop",
  "deliveryRunAccessToken",
  "deliveryGpsSample",
  "geocodedAddressCache",
  "dogProfile",
  "rateLimitBucket",
] as const;

function hasRequiredModelDelegates(client: PrismaClient) {
  return REQUIRED_MODEL_DELEGATES.every((delegateName) => {
    const delegate = (client as unknown as Record<string, unknown>)[delegateName];
    return (
      typeof delegate === "object" &&
      delegate !== null &&
      typeof (delegate as { findMany?: unknown }).findMany === "function"
    );
  });
}

const createPrismaClient = () => {
  const adapter = new PrismaLibSql({
    url: process.env.DATABASE_URL || "file:./dev.db",
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
};

const globalForPrisma = globalThis as typeof globalThis & {
  __prisma?: PrismaClient;
};

const cachedClient = globalForPrisma.__prisma;
const prismaClient = cachedClient && hasRequiredModelDelegates(cachedClient)
  ? cachedClient
  : createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__prisma = prismaClient;
}

export const prisma = prismaClient;



