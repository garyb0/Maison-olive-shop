import { loadDatabaseEnvForTarget, resolveDatabaseFromEnv, resolveEnvTargetFromArgs } from "./db-utils";

const CONFIRMATION = "clean-prod-test-data";

const USERS_TO_KEEP = [
  "jeurk40@gmail.com",
  "gary_b0@hotmail.fr",
  "smoke.admin@chezolive.local",
  "smoke.delivery@chezolive.local",
] as const;

const USERS_TO_DELETE = [
  "smoke.admin@chezolive.ca",
  "dry12345678@hotmail.com",
  "home-return-1777362076400@chezolive.local",
] as const;

const COUNT_MODELS = [
  "User",
  "Session",
  "OAuthAccount",
  "PasswordReset",
  "Order",
  "OrderItem",
  "Subscription",
  "StripeWebhookEvent",
  "ConversionEvent",
  "Product",
  "Category",
  "ProductSubcategory",
  "InventoryMovement",
  "PromoCode",
  "PromoBanner",
  "DeliverySlot",
  "DeliveryException",
  "DeliveryScheduleSettings",
  "Driver",
  "DeliveryRun",
  "DeliveryStop",
  "DeliveryRunAccessToken",
  "DeliveryGpsSample",
  "SupportConversation",
  "SupportMessage",
  "SupportInternalNote",
  "SupportNotificationPreference",
  "SupportQuickReply",
  "NotificationPreference",
  "AppNotification",
  "WebPushSubscription",
  "NativePushToken",
  "DogProfile",
  "UserDeliveryAddress",
  "GeocodedAddressCache",
  "AuditLog",
  "RateLimitBucket",
] as const;

const TABLES_TO_ZERO = [
  "Session",
  "OAuthAccount",
  "PasswordReset",
  "Order",
  "OrderItem",
  "Subscription",
  "StripeWebhookEvent",
  "ConversionEvent",
  "Product",
  "Category",
  "ProductSubcategory",
  "InventoryMovement",
  "PromoCode",
  "PromoBanner",
  "DeliverySlot",
  "DeliveryException",
  "DeliveryScheduleSettings",
  "Driver",
  "DeliveryRun",
  "DeliveryStop",
  "DeliveryRunAccessToken",
  "DeliveryGpsSample",
  "SupportConversation",
  "SupportMessage",
  "SupportInternalNote",
  "SupportNotificationPreference",
  "SupportQuickReply",
  "NotificationPreference",
  "AppNotification",
  "WebPushSubscription",
  "NativePushToken",
  "DogProfile",
  "UserDeliveryAddress",
  "GeocodedAddressCache",
  "AuditLog",
  "RateLimitBucket",
] as const;

type CountTable = (typeof COUNT_MODELS)[number];

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function flagValue(name: string) {
  const prefix = `${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function quotedIdentifier(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function formatRows(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return "(none)";
  return rows.map((row) => JSON.stringify(row)).join("\n");
}

async function countTables(prisma: typeof import("../src/lib/prisma").prisma) {
  const counts: Record<CountTable, number> = {} as Record<CountTable, number>;

  for (const table of COUNT_MODELS) {
    const result = await prisma.$queryRawUnsafe<Array<{ count: bigint | number }>>(
      `SELECT count(*) AS count FROM ${quotedIdentifier(table)}`,
    );
    counts[table] = Number(result[0]?.count ?? 0);
  }

  return counts;
}

async function readUsers(prisma: typeof import("../src/lib/prisma").prisma) {
  return prisma.user.findMany({
    orderBy: [{ role: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      createdAt: true,
      _count: {
        select: {
          orders: true,
          sessions: true,
          dogProfiles: true,
          deliveryAddresses: true,
          appNotifications: true,
        },
      },
    },
  });
}

function printSnapshot(label: string, input: {
  counts: Record<CountTable, number>;
  users: Awaited<ReturnType<typeof readUsers>>;
}) {
  console.log(`\n${label}`);
  console.log("Users:");
  console.log(formatRows(input.users.map((user) => ({
    email: user.email,
    role: user.role,
    name: `${user.firstName} ${user.lastName}`,
    orders: user._count.orders,
    sessions: user._count.sessions,
    dogs: user._count.dogProfiles,
    addresses: user._count.deliveryAddresses,
    notifications: user._count.appNotifications,
  }))));

  console.log("\nCounts:");
  for (const table of COUNT_MODELS) {
    console.log(`- ${table}: ${input.counts[table]}`);
  }
}

function assertExpectedUsers(users: Awaited<ReturnType<typeof readUsers>>) {
  const emails = new Set(users.map((user) => user.email.toLowerCase()));
  const expectedEmails = new Set([...USERS_TO_KEEP, ...USERS_TO_DELETE].map((email) => email.toLowerCase()));
  const missingKeep = USERS_TO_KEEP.filter((email) => !emails.has(email.toLowerCase()));
  const missingDelete = USERS_TO_DELETE.filter((email) => !emails.has(email.toLowerCase()));
  const unexpectedUsers = users
    .map((user) => user.email)
    .filter((email) => !expectedEmails.has(email.toLowerCase()));

  if (missingKeep.length > 0) {
    throw new Error(`Missing required user(s) to keep: ${missingKeep.join(", ")}`);
  }

  if (missingDelete.length > 0) {
    throw new Error(`Missing expected test user(s) to delete: ${missingDelete.join(", ")}`);
  }

  if (unexpectedUsers.length > 0) {
    throw new Error(`Unexpected user(s) found; refusing cleanup: ${unexpectedUsers.join(", ")}`);
  }
}

async function cleanDatabase(prisma: typeof import("../src/lib/prisma").prisma) {
  await prisma.$transaction(async (tx) => {
    await tx.appNotification.deleteMany();
    await tx.webPushSubscription.deleteMany();
    await tx.nativePushToken.deleteMany();
    await tx.notificationPreference.deleteMany();
    await tx.supportNotificationPreference.deleteMany();
    await tx.session.deleteMany();
    await tx.passwordReset.deleteMany();
    await tx.oAuthAccount.deleteMany();

    await tx.supportInternalNote.deleteMany();
    await tx.supportMessage.deleteMany();
    await tx.supportQuickReply.deleteMany();
    await tx.supportConversation.deleteMany();

    await tx.deliveryRunAccessToken.deleteMany();
    await tx.deliveryGpsSample.deleteMany();
    await tx.deliveryStop.deleteMany();
    await tx.deliveryRun.deleteMany();
    await tx.deliverySlot.deleteMany();
    await tx.deliveryException.deleteMany();
    await tx.deliveryScheduleSettings.deleteMany();
    await tx.driver.deleteMany();

    await tx.inventoryMovement.deleteMany();
    await tx.orderItem.deleteMany();
    await tx.order.deleteMany();
    await tx.subscription.deleteMany();
    await tx.stripeWebhookEvent.deleteMany();
    await tx.conversionEvent.deleteMany();

    await tx.dogProfile.deleteMany();
    await tx.userDeliveryAddress.deleteMany();
    await tx.geocodedAddressCache.deleteMany();
    await tx.auditLog.deleteMany();
    await tx.rateLimitBucket.deleteMany();

    await tx.product.deleteMany();
    await tx.productSubcategory.deleteMany();
    await tx.category.deleteMany();
    await tx.promoCode.deleteMany();
    await tx.promoBanner.deleteMany();

    await tx.user.deleteMany({
      where: {
        email: {
          in: [...USERS_TO_DELETE],
        },
      },
    });
  }, { timeout: 60_000 });
}

function assertPostCleanup(input: {
  counts: Record<CountTable, number>;
  users: Awaited<ReturnType<typeof readUsers>>;
}) {
  const emails = input.users.map((user) => user.email).sort();
  const expectedEmails = [...USERS_TO_KEEP].sort();
  if (emails.length !== expectedEmails.length || emails.some((email, index) => email !== expectedEmails[index])) {
    throw new Error(`Unexpected remaining users: ${emails.join(", ")}`);
  }

  for (const table of TABLES_TO_ZERO) {
    if (input.counts[table] !== 0) {
      throw new Error(`Expected ${table}=0 after cleanup, received ${input.counts[table]}`);
    }
  }
}

async function main() {
  const envTarget = resolveEnvTargetFromArgs(undefined, "production");
  const execute = hasFlag("--execute");
  const confirmation = flagValue("--confirm");

  if (envTarget !== "production") {
    throw new Error("This cleanup script is production-only. Pass --env=production.");
  }

  loadDatabaseEnvForTarget("production");
  const db = resolveDatabaseFromEnv();
  if (db.kind !== "sqlite") {
    throw new Error(`Expected a local SQLite production database, got ${db.kind}.`);
  }

  const { prisma } = await import("../src/lib/prisma");
  try {
    const before = {
      counts: await countTables(prisma),
      users: await readUsers(prisma),
    };
    assertExpectedUsers(before.users);
    printSnapshot(execute ? "Before cleanup" : "Dry-run snapshot", before);

    if (!execute) {
      console.log(`\nDry-run only. To execute: npm run db:clean-test-data -- --env=production --execute --confirm=${CONFIRMATION}`);
      return;
    }

    if (confirmation !== CONFIRMATION) {
      throw new Error(`Refusing to execute without --confirm=${CONFIRMATION}`);
    }

    await cleanDatabase(prisma);

    const after = {
      counts: await countTables(prisma),
      users: await readUsers(prisma),
    };
    printSnapshot("After cleanup", after);
    assertPostCleanup(after);
    console.log("\nProduction test data cleanup complete.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
