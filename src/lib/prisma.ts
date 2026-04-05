import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

declare global {
  var prisma: PrismaClient | undefined;
}

let prismaClient: PrismaClient | undefined = global.prisma;

const createPrismaClient = () => {
  const adapter = new PrismaLibSql({
    url: process.env.DATABASE_URL || "file:./dev.db",
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
};

const getPrismaClient = () => {
  if (!prismaClient) {
    prismaClient = createPrismaClient();

    if (process.env.NODE_ENV !== "production") {
      global.prisma = prismaClient;
    }
  }

  return prismaClient;
};

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const client = getPrismaClient() as unknown as Record<PropertyKey, unknown>;
    const value = Reflect.get(client, property, receiver);

    return typeof value === "function" ? value.bind(client) : value;
  },
}) as PrismaClient;


