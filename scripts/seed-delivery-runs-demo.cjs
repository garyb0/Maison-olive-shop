const crypto = require("node:crypto");
const { PrismaClient } = require("@prisma/client");
const { PrismaLibSql } = require("@prisma/adapter-libsql");

const DATABASE_URL = process.env.DATABASE_URL || "file:./delivery-dev.db";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3103";
const DEMO_DRIVER_NAME = "Demo chauffeur local";
const DEMO_SLOT_NOTE_PREFIX = "Delivery runs demo";

const adapter = new PrismaLibSql({ url: DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function toDateKey(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function buildDemoOrders(slot) {
  const dateToken = slot.startAt.toISOString().slice(0, 10).replace(/-/g, "");
  return [
    {
      orderNumber: `DEMO-${dateToken}-01`,
      customerEmail: "demo.client.1@chezolive.local",
      customerName: "Client Demo 1",
      shippingLine1: "125 Rue des Pins",
      shippingCity: "Rimouski",
      shippingRegion: "QC",
      shippingPostal: "G5L 1A1",
      shippingCountry: "CA",
      deliveryPhone: "4185550101",
      deliveryInstructions: "Laisser a la porte avant si absent.",
    },
    {
      orderNumber: `DEMO-${dateToken}-02`,
      customerEmail: "demo.client.2@chezolive.local",
      customerName: "Client Demo 2",
      shippingLine1: "280 Avenue de la Mer",
      shippingCity: "Rimouski",
      shippingRegion: "QC",
      shippingPostal: "G5L 7C3",
      shippingCountry: "CA",
      deliveryPhone: "4185550102",
      deliveryInstructions: "Sonner puis remettre en main propre.",
    },
    {
      orderNumber: `DEMO-${dateToken}-03`,
      customerEmail: "demo.client.3@chezolive.local",
      customerName: "Client Demo 3",
      shippingLine1: "48 Rue du Fleuve",
      shippingCity: "Rimouski",
      shippingRegion: "QC",
      shippingPostal: "G5M 1B8",
      shippingCountry: "CA",
      deliveryPhone: "4185550103",
      deliveryInstructions: "Appeler 5 minutes avant l'arrivee.",
    },
  ];
}

async function ensureDemoDriver() {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.driver.findFirst({
      where: { name: DEMO_DRIVER_NAME },
    });

    await tx.driver.updateMany({
      where: existing
        ? {
            isActive: true,
            id: { not: existing.id },
          }
        : { isActive: true },
      data: { isActive: false },
    });

    if (existing) {
      return tx.driver.update({
        where: { id: existing.id },
        data: {
          phone: "4185550000",
          isActive: true,
        },
      });
    }

    return tx.driver.create({
      data: {
        name: DEMO_DRIVER_NAME,
        phone: "4185550000",
        isActive: true,
      },
    });
  });
}

async function ensureFutureSlot() {
  const slotStart = new Date();
  slotStart.setDate(slotStart.getDate() + 1);
  slotStart.setHours(10, 0, 0, 0);
  const slotEnd = new Date(slotStart);
  slotEnd.setHours(12, 0, 0, 0);
  const note = `${DEMO_SLOT_NOTE_PREFIX} ${toDateKey(slotStart)}`;

  const existing = await prisma.deliverySlot.findFirst({
    where: { note },
  });

  if (existing) {
    return existing;
  }

  return prisma.deliverySlot.create({
    data: {
      startAt: slotStart,
      endAt: slotEnd,
      capacity: 6,
      isOpen: true,
      note,
    },
  });
}

async function ensureDemoOrders(slot) {
  const demoOrders = buildDemoOrders(slot);
  const created = [];

  for (const [index, order] of demoOrders.entries()) {
    const existing = await prisma.order.findUnique({
      where: { orderNumber: order.orderNumber },
    });

    const commonData = {
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
      deliveryWindowStartAt: slot.startAt,
      deliveryWindowEndAt: slot.endAt,
      deliveryStatus: "SCHEDULED",
      deliveryInstructions: order.deliveryInstructions,
      deliveryPhone: order.deliveryPhone,
    };

    const saved = existing
      ? await prisma.order.update({
          where: { orderNumber: order.orderNumber },
          data: commonData,
        })
      : await prisma.order.create({
          data: {
            orderNumber: order.orderNumber,
            ...commonData,
          },
        });

    created.push(saved);
  }

  return created;
}

async function ensureDemoRun(slot, driver, orders) {
  let run = await prisma.deliveryRun.findUnique({
    where: { deliverySlotId: slot.id },
    include: { stops: true },
  });

  if (!run) {
    run = await prisma.deliveryRun.create({
      data: {
        deliverySlotId: slot.id,
        driverId: driver.id,
        status: "DRAFT",
        dateKey: toDateKey(slot.startAt),
        includeReturnToDepot: true,
      },
      include: { stops: true },
    });
  } else if (run.driverId !== driver.id) {
    run = await prisma.deliveryRun.update({
      where: { id: run.id },
      data: { driverId: driver.id },
      include: { stops: true },
    });
  }

  const existingStopOrderIds = new Set(run.stops.map((stop) => stop.orderId));

  for (const [index, order] of orders.entries()) {
    if (existingStopOrderIds.has(order.id)) {
      continue;
    }

    await prisma.deliveryStop.create({
      data: {
        runId: run.id,
        orderId: order.id,
        plannedSequence: index + 1,
        finalSequence: index + 1,
        status: "PENDING",
      },
    });
  }

  return prisma.deliveryRun.findUniqueOrThrow({
    where: { id: run.id },
    include: {
      stops: {
        orderBy: { finalSequence: "asc" },
      },
    },
  });
}

async function publishRun(run, slot) {
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const expiresAt = addHours(slot.endAt, 12);

  await prisma.$transaction(async (tx) => {
    await tx.deliveryRunAccessToken.updateMany({
      where: {
        runId: run.id,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    await tx.deliveryRun.update({
      where: { id: run.id },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
        completedAt: null,
        startedAt: null,
        actualKmGps: null,
        actualKmOdometer: null,
        actualKmFinal: null,
        actualKmSource: null,
      },
    });

    await tx.deliveryRunAccessToken.create({
      data: {
        runId: run.id,
        tokenHash: hashToken(rawToken),
        expiresAt,
      },
    });
  });

  return `${SITE_URL}/driver/run/${rawToken}`;
}

async function main() {
  const adminCount = await prisma.user.count({
    where: { role: "ADMIN" },
  });

  if (adminCount === 0) {
    throw new Error("Aucun compte admin trouve dans dev.db.");
  }

  const driver = await ensureDemoDriver();
  const slot = await ensureFutureSlot();
  const orders = await ensureDemoOrders(slot);
  const run = await ensureDemoRun(slot, driver, orders);
  const driverUrl = await publishRun(run, slot);

  console.log("Delivery runs demo ready.");
  console.log(`- DB: ${DATABASE_URL}`);
  console.log(`- Admin route: ${SITE_URL}/admin/delivery/runs`);
  console.log(`- Driver route: ${driverUrl}`);
  console.log(`- Slot: ${slot.startAt.toISOString()} -> ${slot.endAt.toISOString()}`);
  console.log(`- Driver: ${driver.name}`);
  console.log(`- Orders linked: ${orders.map((order) => order.orderNumber).join(", ")}`);
}

main()
  .catch((error) => {
    console.error("Unable to seed delivery demo.");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
