const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const bcrypt = require("bcryptjs");
const { createClient } = require("@libsql/client");
const { PrismaClient } = require("@prisma/client");
const { PrismaLibSql } = require("@prisma/adapter-libsql");

const DATABASE_URL = process.env.DATABASE_URL || "file:./delivery-dev.db";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3103";
const FIXTURE_PATH = process.env.DELIVERY_SANDBOX_FIXTURE
  ? path.resolve(process.env.DELIVERY_SANDBOX_FIXTURE)
  : path.join(__dirname, "fixtures", "delivery-sandbox-orders.json");
const SANDBOX_STATE_PATH = process.env.DELIVERY_SANDBOX_STATE_PATH
  ? path.resolve(process.env.DELIVERY_SANDBOX_STATE_PATH)
  : path.join(process.cwd(), ".delivery-sandbox", "latest.json");
const SANDBOX_ORDER_PREFIX = "SANDBOX-";
const SANDBOX_SLOT_NOTE_PREFIX = "Delivery sandbox";
const SANDBOX_ADMIN_EMAIL = process.env.DELIVERY_SANDBOX_ADMIN_EMAIL || "sandbox.admin@chezolive.local";
const SANDBOX_ADMIN_PASSWORD = process.env.DELIVERY_SANDBOX_ADMIN_PASSWORD || "SandboxAdmin123!";
const TOKEN_TTL_HOURS = 12;

function assertSandboxDatabaseUrl(databaseUrl) {
  const normalized = databaseUrl.trim().toLowerCase();
  const isSandboxFile =
    normalized === "file:./delivery-dev.db" ||
    normalized === "file:delivery-dev.db" ||
    normalized.endsWith("/delivery-dev.db") ||
    normalized.endsWith("\\delivery-dev.db");

  if (!isSandboxFile) {
    throw new Error(
      `Refusing to seed delivery sandbox into DATABASE_URL=${databaseUrl}. Use file:./delivery-dev.db.`,
    );
  }
}

function resolveSandboxDatabasePath() {
  return path.resolve(process.cwd(), "delivery-dev.db");
}

function refreshSandboxDatabaseFile() {
  const dbPath = resolveSandboxDatabasePath();
  const allowedPath = path.resolve(process.cwd(), "delivery-dev.db");

  if (dbPath !== allowedPath) {
    throw new Error("Refusing to refresh a non-sandbox database path.");
  }

  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    const target = `${dbPath}${suffix}`;
    if (fs.existsSync(target)) {
      try {
        fs.unlinkSync(target);
      } catch (error) {
        if (error && error.code === "EBUSY") {
          throw new Error(
            `Sandbox database is locked: ${target}. Stop npm run delivery:sandbox:dev, then rerun npm run delivery:sandbox:setup.`,
          );
        }
        throw error;
      }
    }
  }
}

async function applySqliteMigrationsDirectly() {
  const client = createClient({ url: DATABASE_URL });
  const migrationsDir = path.join(process.cwd(), "prisma", "migrations");

  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "checksum" TEXT NOT NULL,
        "finished_at" DATETIME,
        "migration_name" TEXT NOT NULL,
        "logs" TEXT,
        "rolled_back_at" DATETIME,
        "started_at" DATETIME NOT NULL DEFAULT current_timestamp,
        "applied_steps_count" INTEGER NOT NULL DEFAULT 0
      )
    `);

    const appliedRows = await client.execute(
      `SELECT "migration_name" FROM "_prisma_migrations" WHERE "rolled_back_at" IS NULL`,
    );
    const applied = new Set(appliedRows.rows.map((row) => String(row.migration_name)));
    const migrationNames = fs
      .readdirSync(migrationsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => fs.existsSync(path.join(migrationsDir, name, "migration.sql")))
      .sort();

    for (const migrationName of migrationNames) {
      if (applied.has(migrationName)) continue;

      const sqlPath = path.join(migrationsDir, migrationName, "migration.sql");
      const sql = fs.readFileSync(sqlPath, "utf8").trim();
      const id = crypto.randomUUID();
      const checksum = crypto.createHash("sha256").update(sql).digest("hex");
      const startedAt = new Date().toISOString();

      await client.execute({
        sql: `
          INSERT INTO "_prisma_migrations" (
            "id", "checksum", "started_at", "migration_name", "applied_steps_count"
          ) VALUES (?, ?, ?, ?, 0)
        `,
        args: [id, checksum, startedAt, migrationName],
      });

      try {
        if (sql) {
          await client.executeMultiple(sql);
        }
        await client.execute({
          sql: `
            UPDATE "_prisma_migrations"
            SET "finished_at" = ?, "applied_steps_count" = 1
            WHERE "id" = ?
          `,
          args: [new Date().toISOString(), id],
        });
      } catch (error) {
        await client.execute({
          sql: `UPDATE "_prisma_migrations" SET "logs" = ? WHERE "id" = ?`,
          args: [error instanceof Error ? error.stack || error.message : String(error), id],
        });
        throw error;
      }
    }
  } finally {
    client.close();
  }
}

async function runPrismaMigrations() {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(npx, ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL,
    },
  });

  if (result.status !== 0) {
    console.log("Prisma migrate deploy failed for the sandbox DB. Applying SQLite migrations directly.");
    await applySqliteMigrationsDirectly();
  }
}

function readFixture() {
  if (!fs.existsSync(FIXTURE_PATH)) {
    throw new Error(`Delivery sandbox fixture not found: ${FIXTURE_PATH}`);
  }

  const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8"));
  if (!Array.isArray(fixture.orders) || fixture.orders.length === 0) {
    throw new Error("Delivery sandbox fixture must contain at least one order.");
  }
  return fixture;
}

function toDateKey(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function buildSlotWindow(slotConfig = {}) {
  const startAt = new Date();
  startAt.setDate(startAt.getDate() + Number(slotConfig.dateOffsetDays ?? 1));
  startAt.setHours(Number(slotConfig.startHour ?? 10), 0, 0, 0);

  const endAt = new Date(startAt);
  endAt.setHours(Number(slotConfig.endHour ?? 12), 0, 0, 0);

  return { startAt, endAt };
}

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function parseAddress(rawAddress, index) {
  if (typeof rawAddress === "object" && rawAddress) {
    return {
      shippingLine1: rawAddress.line1,
      shippingCity: rawAddress.city,
      shippingRegion: rawAddress.region,
      shippingPostal: rawAddress.postal,
      shippingCountry: rawAddress.country || "CA",
    };
  }

  if (typeof rawAddress !== "string" || !rawAddress.trim()) {
    throw new Error(`Fixture order #${index + 1} is missing an address.`);
  }

  const parts = rawAddress.split(",").map((part) => part.trim()).filter(Boolean);
  const [line1, city, regionPostal = "", country = "CA"] = parts;
  const regionPostalParts = regionPostal.split(/\s+/).filter(Boolean);
  const region = regionPostalParts.shift();
  const postal = regionPostalParts.join(" ");

  return {
    shippingLine1: line1,
    shippingCity: city,
    shippingRegion: region,
    shippingPostal: postal,
    shippingCountry: country,
  };
}

function normalizeOrder(rawOrder, index, slot, dateToken) {
  const address = parseAddress(rawOrder.address, index);
  const coordinates =
    rawOrder.coordinates &&
    Number.isFinite(Number(rawOrder.coordinates.lat)) &&
    Number.isFinite(Number(rawOrder.coordinates.lng))
      ? {
          lat: Number(rawOrder.coordinates.lat),
          lng: Number(rawOrder.coordinates.lng),
        }
      : null;
  const requiredAddressFields = [
    address.shippingLine1,
    address.shippingCity,
    address.shippingRegion,
    address.shippingPostal,
    address.shippingCountry,
  ];

  if (requiredAddressFields.some((value) => typeof value !== "string" || !value.trim())) {
    throw new Error(`Fixture order #${index + 1} has an incomplete address.`);
  }

  return {
    orderNumber: `${SANDBOX_ORDER_PREFIX}${dateToken}-${String(index + 1).padStart(2, "0")}`,
    customerEmail: rawOrder.email || `sandbox.client.${index + 1}@chezolive.local`,
    customerName: rawOrder.customerName || `Client Sandbox ${index + 1}`,
    deliveryPhone: rawOrder.phone || null,
    deliveryInstructions: rawOrder.instructions || null,
    deliveryWindowStartAt: rawOrder.deliveryWindow?.startAt
      ? new Date(rawOrder.deliveryWindow.startAt)
      : slot.startAt,
    deliveryWindowEndAt: rawOrder.deliveryWindow?.endAt
      ? new Date(rawOrder.deliveryWindow.endAt)
      : slot.endAt,
    coordinates,
    ...address,
  };
}

async function resetSandboxData(prisma) {
  await prisma.$transaction(async (tx) => {
    const slots = await tx.deliverySlot.findMany({
      where: { note: { startsWith: SANDBOX_SLOT_NOTE_PREFIX } },
      select: { id: true },
    });
    const slotIds = slots.map((slot) => slot.id);

    const orders = await tx.order.findMany({
      where: {
        OR: [
          { orderNumber: { startsWith: SANDBOX_ORDER_PREFIX } },
          ...(slotIds.length ? [{ deliverySlotId: { in: slotIds } }] : []),
        ],
      },
      select: { id: true },
    });
    const orderIds = orders.map((order) => order.id);

    const runs = slotIds.length
      ? await tx.deliveryRun.findMany({
          where: { deliverySlotId: { in: slotIds } },
          select: { id: true },
        })
      : [];
    const stopRunIds = orderIds.length
      ? await tx.deliveryStop.findMany({
          where: { orderId: { in: orderIds } },
          select: { runId: true },
        })
      : [];
    const runIds = Array.from(new Set([...runs.map((run) => run.id), ...stopRunIds.map((stop) => stop.runId)]));

    if (runIds.length) {
      await tx.deliveryGpsSample.deleteMany({ where: { runId: { in: runIds } } });
      await tx.deliveryRunAccessToken.deleteMany({ where: { runId: { in: runIds } } });
      await tx.deliveryStop.deleteMany({ where: { runId: { in: runIds } } });
      await tx.deliveryRun.deleteMany({ where: { id: { in: runIds } } });
    }

    if (orderIds.length) {
      await tx.order.deleteMany({ where: { id: { in: orderIds } } });
    }

    if (slotIds.length) {
      await tx.deliverySlot.deleteMany({ where: { id: { in: slotIds } } });
    }

    await tx.driver.deleteMany({
      where: { name: { startsWith: "Sandbox chauffeur" } },
    });
  });
}

async function createSandbox(prisma, fixture) {
  const { startAt, endAt } = buildSlotWindow(fixture.slot);
  const dateKey = toDateKey(startAt);
  const dateToken = dateKey.replace(/-/g, "");

  const driver = await prisma.driver.create({
    data: {
      name: fixture.driver?.name || "Sandbox chauffeur Waze",
      phone: fixture.driver?.phone || "4185550000",
      isActive: true,
    },
  });

  const slot = await prisma.deliverySlot.create({
    data: {
      startAt,
      endAt,
      capacity: Number(fixture.slot?.capacity ?? Math.max(fixture.orders.length, 4)),
      isOpen: true,
      note: `${SANDBOX_SLOT_NOTE_PREFIX} ${dateKey}`,
    },
  });

  const normalizedOrders = fixture.orders.map((order, index) => normalizeOrder(order, index, slot, dateToken));
  const orders = [];

  for (const [index, order] of normalizedOrders.entries()) {
    orders.push(
      await prisma.order.create({
        data: {
          orderNumber: order.orderNumber,
          customerEmail: order.customerEmail,
          customerName: order.customerName,
          status: "PAID",
          paymentStatus: "PAID",
          paymentMethod: "MANUAL",
          subtotalCents: 4200 + index * 700,
          discountCents: 0,
          taxCents: 629 + index * 105,
          shippingCents: 899,
          totalCents: 5728 + index * 805,
          currency: "CAD",
          shippingLine1: order.shippingLine1,
          shippingCity: order.shippingCity,
          shippingRegion: order.shippingRegion,
          shippingPostal: order.shippingPostal,
          shippingCountry: order.shippingCountry,
          deliverySlotId: slot.id,
          deliveryWindowStartAt: order.deliveryWindowStartAt,
          deliveryWindowEndAt: order.deliveryWindowEndAt,
          deliveryStatus: "SCHEDULED",
          deliveryInstructions: order.deliveryInstructions,
          deliveryPhone: order.deliveryPhone,
        },
      }),
    );
  }

  const run = await prisma.deliveryRun.create({
    data: {
      deliverySlotId: slot.id,
      driverId: driver.id,
      status: "PUBLISHED",
      dateKey,
      includeReturnToDepot: true,
      publishedAt: new Date(),
    },
  });

  for (const [index, order] of orders.entries()) {
    await prisma.deliveryStop.create({
      data: {
        runId: run.id,
        orderId: order.id,
        plannedSequence: index + 1,
        finalSequence: index + 1,
        status: "PENDING",
        geocodedLat: normalizedOrders[index]?.coordinates?.lat ?? null,
        geocodedLng: normalizedOrders[index]?.coordinates?.lng ?? null,
        geocodedAt: normalizedOrders[index]?.coordinates ? new Date() : null,
      },
    });
  }

  const token = crypto.randomBytes(32).toString("base64url");
  await prisma.deliveryRunAccessToken.create({
    data: {
      runId: run.id,
      tokenHash: hashToken(token),
      expiresAt: addHours(slot.endAt, TOKEN_TTL_HOURS),
    },
  });

  return {
    run,
    token,
    driver,
    slot,
    orders,
    driverUrl: `${SITE_URL}/driver/run/${token}`,
  };
}

async function ensureSandboxAdmin(prisma) {
  const passwordHash = await bcrypt.hash(SANDBOX_ADMIN_PASSWORD, 10);

  return prisma.user.upsert({
    where: { email: SANDBOX_ADMIN_EMAIL },
    update: {
      passwordHash,
      firstName: "Sandbox",
      lastName: "Admin",
      role: "ADMIN",
      language: "fr",
      twoFactorEnabled: false,
      twoFactorSecretCiphertext: null,
      twoFactorBackupCodesJson: null,
      twoFactorEnabledAt: null,
    },
    create: {
      email: SANDBOX_ADMIN_EMAIL,
      passwordHash,
      firstName: "Sandbox",
      lastName: "Admin",
      role: "ADMIN",
      language: "fr",
    },
  });
}

function writeSandboxState(sandbox) {
  fs.mkdirSync(path.dirname(SANDBOX_STATE_PATH), { recursive: true });
  fs.writeFileSync(
    SANDBOX_STATE_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        databaseUrl: DATABASE_URL,
        siteUrl: SITE_URL,
        fixturePath: FIXTURE_PATH,
        runId: sandbox.run.id,
        token: sandbox.token,
        driverUrl: sandbox.driverUrl,
        slot: {
          id: sandbox.slot.id,
          startAt: sandbox.slot.startAt.toISOString(),
          endAt: sandbox.slot.endAt.toISOString(),
        },
        driver: {
          id: sandbox.driver.id,
          name: sandbox.driver.name,
          phone: sandbox.driver.phone,
        },
        orders: sandbox.orders.map((order) => ({
          id: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
        })),
        smoke: {
          adminEmail: SANDBOX_ADMIN_EMAIL,
          adminPassword: SANDBOX_ADMIN_PASSWORD,
          accountEmail: "delivery-smoke-customer@chezolive.local",
          accountPassword: SANDBOX_ADMIN_PASSWORD,
        },
      },
      null,
      2,
    ),
  );
}

async function main() {
  assertSandboxDatabaseUrl(DATABASE_URL);
  const fixture = readFixture();

  console.log("Preparing isolated delivery sandbox DB.");
  console.log(`- DB: ${DATABASE_URL}`);
  console.log(`- Fixture: ${FIXTURE_PATH}`);

  refreshSandboxDatabaseFile();
  await runPrismaMigrations();

  const adapter = new PrismaLibSql({ url: DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    await resetSandboxData(prisma);
    await ensureSandboxAdmin(prisma);
    const sandbox = await createSandbox(prisma, fixture);
    writeSandboxState(sandbox);

    console.log("Delivery sandbox ready.");
    console.log(`- Dev server: npm run delivery:sandbox:dev`);
    console.log(`- Driver route: ${sandbox.driverUrl}`);
    console.log(`- State file: ${SANDBOX_STATE_PATH}`);
    console.log("- Smoke credentials:");
    console.log(`  DELIVERY_SMOKE_ADMIN_EMAIL=${SANDBOX_ADMIN_EMAIL}`);
    console.log(`  DELIVERY_SMOKE_ADMIN_PASSWORD=${SANDBOX_ADMIN_PASSWORD}`);
    console.log("  DELIVERY_SMOKE_ACCOUNT_EMAIL=delivery-smoke-customer@chezolive.local");
    console.log(`  DELIVERY_SMOKE_ACCOUNT_PASSWORD=${SANDBOX_ADMIN_PASSWORD}`);
    console.log(`- Slot: ${sandbox.slot.startAt.toISOString()} -> ${sandbox.slot.endAt.toISOString()}`);
    console.log(`- Driver: ${sandbox.driver.name}`);
    console.log(`- Orders: ${sandbox.orders.map((order) => order.orderNumber).join(", ")}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Unable to prepare delivery sandbox.");
  console.error(error);
  process.exit(1);
});
