import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { DeliveryStopStatus } from "@prisma/client";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import type {
  DeliveryDriver,
  DeliveryKmReferenceRow,
  DeliveryRunSummary,
  DeliveryRunStop,
} from "@/lib/types";
import { resolveDeliveryRunKm } from "@/lib/delivery-run-km";
import {
  buildDeliveryAddressKey,
  buildDeliveryAddressLabel,
  computeGoogleDeliveryRoute,
  geocodeAddressCached,
  getDeliveryDepotAddress,
  hasGoogleMapsApiKey,
  type LatLng,
  type DeliveryAddressInput,
} from "@/lib/google-maps";
import {
  computeCapacityPerBlock,
  getActiveDeliveryDriverCount,
  getDeliveryScheduleSettings,
  toDateKey,
} from "@/lib/delivery";
import {
  isDynamicDeliverySlotId,
  parseDynamicDeliverySlotId,
} from "@/lib/delivery-mode";

const DRIVER_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

const deliveryRunDetailInclude = Prisma.validator<Prisma.DeliveryRunInclude>()({
  driver: true,
  deliverySlot: true,
  stops: {
    orderBy: [{ finalSequence: "asc" }],
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          deliveryPhone: true,
          deliveryInstructions: true,
          shippingLine1: true,
          shippingCity: true,
          shippingRegion: true,
          shippingPostal: true,
          shippingCountry: true,
          deliveryStatus: true,
        },
      },
    },
  },
  accessTokens: {
    orderBy: [{ createdAt: "desc" }],
    take: 1,
  },
  _count: {
    select: {
      gpsSamples: true,
    },
  },
});

type DeliveryRunDetailRecord = Prisma.DeliveryRunGetPayload<{
  include: typeof deliveryRunDetailInclude;
}>;

type PrismaLike = Prisma.TransactionClient;
type SqliteTableRow = { name: string };

function hashDeliveryRunToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function buildDriverRunUrl(token: string) {
  return `${env.siteUrl}/driver/run/${token}`;
}

function isDeliveryRunsDisabledError(error: unknown) {
  return error instanceof Error && error.message === "DELIVERY_RUNS_DISABLED";
}

export function isDeliveryRunsEnabled() {
  return env.deliveryExperimentalRoutingEnabled;
}

export function isDeliveryGpsTrackingEnabled() {
  return env.deliveryExperimentalRoutingEnabled && env.deliveryGpsTrackingEnabled;
}

export function isGoogleRoutePlanningReady() {
  return Boolean(getDeliveryDepotAddress()) && hasGoogleMapsApiKey();
}

async function hasDeliveryRunsSchemaTables() {
  try {
    const rows = await prisma.$queryRaw<SqliteTableRow[]>`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name IN (
          'Driver',
          'DeliveryRun',
          'DeliveryStop',
          'DeliveryRunAccessToken',
          'DeliveryGpsSample',
          'GeocodedAddressCache'
        )
    `;

    const names = new Set(rows.map((row) => row.name));
    return (
      names.has("Driver") &&
      names.has("DeliveryRun") &&
      names.has("DeliveryStop") &&
      names.has("DeliveryRunAccessToken") &&
      names.has("DeliveryGpsSample") &&
      names.has("GeocodedAddressCache")
    );
  } catch {
    return true;
  }
}

export async function isDeliveryRunsSchemaAvailable() {
  return hasDeliveryRunsSchemaTables();
}

function hasDeliverySchemaMarker(message: string) {
  const normalized = message.toLowerCase();
  const deliveryMarkers = [
    "deliveryrun",
    "deliverystop",
    "deliveryrunaccesstoken",
    "deliverygpssample",
    "geocodedaddresscache",
    "driver",
  ];
  const schemaMarkers = [
    "no such table",
    "no such column",
    "does not exist in the current database",
    "table",
    "column",
    "unknown column",
    "relation",
  ];

  return (
    deliveryMarkers.some((marker) => normalized.includes(marker)) &&
    schemaMarkers.some((marker) => normalized.includes(marker))
  );
}

export function isDeliveryRunsSchemaUnavailableError(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  ) {
    return true;
  }

  if (error instanceof Error) {
    return hasDeliverySchemaMarker(error.message);
  }

  return false;
}

async function ensureDeliveryRunsEnabledForMutation() {
  if (!isDeliveryRunsEnabled()) {
    throw new Error("DELIVERY_RUNS_DISABLED");
  }

  if (!(await hasDeliveryRunsSchemaTables())) {
    throw new Error("DELIVERY_RUNS_SCHEMA_UNAVAILABLE");
  }
}

function mapDriver(driver: {
  id: string;
  name: string;
  phone: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): DeliveryDriver {
  return {
    id: driver.id,
    name: driver.name,
    phone: driver.phone,
    isActive: driver.isActive,
    createdAt: driver.createdAt.toISOString(),
    updatedAt: driver.updatedAt.toISOString(),
  };
}

function getStopCounts(stops: Array<{ status: DeliveryStopStatus }>) {
  return stops.reduce(
    (accumulator, stop) => {
      accumulator.total += 1;
      if (stop.status === "DELIVERED") {
        accumulator.delivered += 1;
      } else if (stop.status === "FAILED") {
        accumulator.failed += 1;
      } else {
        accumulator.pending += 1;
      }
      return accumulator;
    },
    { total: 0, pending: 0, delivered: 0, failed: 0 },
  );
}

function buildMapsHref(order: {
  shippingLine1: string | null;
  shippingCity: string | null;
  shippingRegion: string | null;
  shippingPostal: string | null;
  shippingCountry: string | null;
}) {
  const query = buildDeliveryAddressLabel({
    shippingLine1: order.shippingLine1 ?? "",
    shippingCity: order.shippingCity ?? "",
    shippingRegion: order.shippingRegion ?? "",
    shippingPostal: order.shippingPostal ?? "",
    shippingCountry: order.shippingCountry ?? "CA",
  });

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function mapRunStop(stop: DeliveryRunDetailRecord["stops"][number]): DeliveryRunStop {
  return {
    id: stop.id,
    orderId: stop.orderId,
    orderNumber: stop.order.orderNumber,
    customerName: stop.order.customerName,
    deliveryPhone: stop.order.deliveryPhone,
    deliveryInstructions: stop.order.deliveryInstructions,
    shippingLine1: stop.order.shippingLine1,
    shippingCity: stop.order.shippingCity,
    shippingRegion: stop.order.shippingRegion,
    shippingPostal: stop.order.shippingPostal,
    shippingCountry: stop.order.shippingCountry,
    plannedSequence: stop.plannedSequence,
    manualSequence: stop.manualSequence,
    finalSequence: stop.finalSequence,
    status: stop.status,
    plannedLegKm: stop.plannedLegKm,
    plannedCumulativeKm: stop.plannedCumulativeKm,
    plannedLegDurationSec: stop.plannedLegDurationSec,
    plannedEta: stop.plannedEta?.toISOString() ?? null,
    actualCumulativeKmAtStop: stop.actualCumulativeKmAtStop,
    arrivedAt: stop.arrivedAt?.toISOString() ?? null,
    completedAt: stop.completedAt?.toISOString() ?? null,
    note: stop.note,
    mapsHref: buildMapsHref(stop.order),
  };
}

function mapRunSummary(run: DeliveryRunDetailRecord): DeliveryRunSummary {
  const latestToken = run.accessTokens[0] ?? null;
  const now = new Date();

  return {
    id: run.id,
    status: run.status,
    dateKey: run.dateKey,
    includeReturnToDepot: run.includeReturnToDepot,
    plannedKm: run.plannedKm,
    plannedDurationSec: run.plannedDurationSec,
    actualKmGps: run.actualKmGps,
    actualKmOdometer: run.actualKmOdometer,
    actualKmFinal: run.actualKmFinal,
    actualKmSource: run.actualKmSource,
    odometerStartKm: run.odometerStartKm,
    odometerEndKm: run.odometerEndKm,
    note: run.note,
    startedAt: run.startedAt?.toISOString() ?? null,
    completedAt: run.completedAt?.toISOString() ?? null,
    publishedAt: run.publishedAt?.toISOString() ?? null,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    driver: mapDriver(run.driver),
    deliverySlot: {
      id: run.deliverySlot.id,
      startAt: run.deliverySlot.startAt.toISOString(),
      endAt: run.deliverySlot.endAt.toISOString(),
      capacity: run.deliverySlot.capacity,
      note: run.deliverySlot.note,
    },
    stops: run.stops.map((stop) => mapRunStop(stop)),
    stopCounts: getStopCounts(run.stops),
    accessToken: {
      hasActiveToken: Boolean(
        latestToken && !latestToken.revokedAt && latestToken.expiresAt.getTime() > now.getTime(),
      ),
      expiresAt: latestToken?.expiresAt.toISOString() ?? null,
      revokedAt: latestToken?.revokedAt?.toISOString() ?? null,
      lastAccessAt: latestToken?.lastAccessAt?.toISOString() ?? null,
    },
    gpsSampleCount: run._count.gpsSamples,
  };
}

async function loadRunDetail(runId: string, prismaLike: typeof prisma | PrismaLike = prisma) {
  return prismaLike.deliveryRun.findUnique({
    where: { id: runId },
    include: deliveryRunDetailInclude,
  });
}

async function loadRunSamples(runId: string, prismaLike: typeof prisma | PrismaLike = prisma) {
  return prismaLike.deliveryGpsSample.findMany({
    where: { runId },
    orderBy: [{ recordedAt: "asc" }],
    select: {
      recordedAt: true,
      lat: true,
      lng: true,
      accuracyMeters: true,
    },
  });
}

function getStopAddress(stop: DeliveryRunDetailRecord["stops"][number]): DeliveryAddressInput {
  if (
    !stop.order.shippingLine1 ||
    !stop.order.shippingCity ||
    !stop.order.shippingRegion ||
    !stop.order.shippingPostal ||
    !stop.order.shippingCountry
  ) {
    throw new Error("DELIVERY_STOP_ADDRESS_INCOMPLETE");
  }

  return {
    shippingLine1: stop.order.shippingLine1,
    shippingCity: stop.order.shippingCity,
    shippingRegion: stop.order.shippingRegion,
    shippingPostal: stop.order.shippingPostal,
    shippingCountry: stop.order.shippingCountry,
  };
}

type DeliveryRunStartLocationInput = {
  lat?: number;
  lng?: number;
  accuracyMeters?: number;
  speedMps?: number;
  heading?: number;
  recordedAt?: string;
};

async function planOrderedStops(
  run: DeliveryRunDetailRecord,
  orderedStops: DeliveryRunDetailRecord["stops"],
  optimizeWaypointOrder: boolean,
  options?: {
    originOverride?: LatLng;
  },
) {
  const depotAddress = getDeliveryDepotAddress();
  if (!depotAddress && !options?.originOverride) {
    throw new Error("DELIVERY_DEPOT_NOT_CONFIGURED");
  }

  const geocodeTasks = orderedStops.map((stop) => geocodeAddressCached(getStopAddress(stop)));
  const depotPoint = depotAddress ? await geocodeAddressCached(depotAddress) : null;
  const stopPoints = await Promise.all(geocodeTasks);
  const origin = options?.originOverride ?? (depotPoint ? { lat: depotPoint.lat, lng: depotPoint.lng } : null);

  if (!origin) {
    throw new Error("DELIVERY_DEPOT_NOT_CONFIGURED");
  }

  const route = await computeGoogleDeliveryRoute({
    origin,
    destination: run.includeReturnToDepot && depotPoint ? { lat: depotPoint.lat, lng: depotPoint.lng } : undefined,
    stops: stopPoints.map((point) => ({ lat: point.lat, lng: point.lng })),
    includeReturnToDepot: run.includeReturnToDepot,
    optimizeWaypointOrder,
  });

  const nextStops = optimizeWaypointOrder
    ? route.waypointOrder.map((index) => orderedStops[index])
    : orderedStops;

  return {
    route,
    orderedStops: nextStops,
  };
}

function sortStopsByFinalSequence(stops: DeliveryRunDetailRecord["stops"]) {
  return [...stops].sort((left, right) => left.finalSequence - right.finalSequence);
}

function mapCurrentStopsById(
  current: DeliveryRunDetailRecord,
  stopIds: string[],
) {
  const stopsById = new Map(current.stops.map((stop) => [stop.id, stop]));
  const mappedStops = stopIds
    .map((stopId) => stopsById.get(stopId) ?? null)
    .filter((stop): stop is NonNullable<typeof stop> => Boolean(stop));

  return mappedStops.length === stopIds.length ? mappedStops : null;
}

async function applyCurrentRoutePlan(
  tx: PrismaLike,
  run: DeliveryRunDetailRecord,
  orderedStops: DeliveryRunDetailRecord["stops"],
  routePlan: Awaited<ReturnType<typeof planOrderedStops>>["route"] | null,
) {
  let cumulativeKm = 0;
  let cumulativeDurationSec = 0;

  for (let index = 0; index < orderedStops.length; index += 1) {
    const stop = orderedStops[index];
    const leg = routePlan?.legs[index] ?? null;
    cumulativeKm = leg ? Number((cumulativeKm + leg.distanceKm).toFixed(3)) : 0;
    cumulativeDurationSec = leg ? cumulativeDurationSec + leg.durationSec : 0;

    await tx.deliveryStop.update({
      where: { id: stop.id },
      data: {
        plannedLegKm: leg?.distanceKm ?? null,
        plannedCumulativeKm: leg ? cumulativeKm : null,
        plannedLegDurationSec: leg?.durationSec ?? null,
        plannedEta: leg
          ? new Date(run.deliverySlot.startAt.getTime() + cumulativeDurationSec * 1000)
          : null,
      },
    });
  }

  await tx.deliveryRun.update({
    where: { id: run.id },
    data: {
      plannedKm: routePlan?.totalDistanceKm ?? null,
      plannedDurationSec: routePlan?.totalDurationSec ?? null,
    },
  });
}

async function applyAutoRoutePlan(
  tx: PrismaLike,
  run: DeliveryRunDetailRecord,
  orderedStops: DeliveryRunDetailRecord["stops"],
  routePlan: Awaited<ReturnType<typeof planOrderedStops>>["route"] | null,
) {
  let cumulativeKm = 0;
  let cumulativeDurationSec = 0;

  for (let index = 0; index < orderedStops.length; index += 1) {
    const stop = orderedStops[index];
    const leg = routePlan?.legs[index] ?? null;
    cumulativeKm = leg ? Number((cumulativeKm + leg.distanceKm).toFixed(3)) : 0;
    cumulativeDurationSec = leg ? cumulativeDurationSec + leg.durationSec : 0;

    await tx.deliveryStop.update({
      where: { id: stop.id },
      data: {
        plannedSequence: index + 1,
        manualSequence: null,
        finalSequence: index + 1,
        plannedLegKm: leg?.distanceKm ?? null,
        plannedCumulativeKm: leg ? cumulativeKm : null,
        plannedLegDurationSec: leg?.durationSec ?? null,
        plannedEta: leg
          ? new Date(run.deliverySlot.startAt.getTime() + cumulativeDurationSec * 1000)
          : null,
      },
    });
  }

  await tx.deliveryRun.update({
    where: { id: run.id },
    data: {
      plannedKm: routePlan?.totalDistanceKm ?? null,
      plannedDurationSec: routePlan?.totalDurationSec ?? null,
    },
  });
}

async function applyManualRoutePlan(
  tx: PrismaLike,
  run: DeliveryRunDetailRecord,
  orderedStops: DeliveryRunDetailRecord["stops"],
  routePlan: Awaited<ReturnType<typeof planOrderedStops>>["route"] | null,
) {
  let cumulativeKm = 0;
  let cumulativeDurationSec = 0;

  for (let index = 0; index < orderedStops.length; index += 1) {
    const stop = orderedStops[index];
    const leg = routePlan?.legs[index] ?? null;
    cumulativeKm = leg ? Number((cumulativeKm + leg.distanceKm).toFixed(3)) : 0;
    cumulativeDurationSec = leg ? cumulativeDurationSec + leg.durationSec : 0;

    await tx.deliveryStop.update({
      where: { id: stop.id },
      data: {
        manualSequence: index + 1,
        finalSequence: index + 1,
        plannedLegKm: leg?.distanceKm ?? null,
        plannedCumulativeKm: leg ? cumulativeKm : null,
        plannedLegDurationSec: leg?.durationSec ?? null,
        plannedEta: leg
          ? new Date(run.deliverySlot.startAt.getTime() + cumulativeDurationSec * 1000)
          : null,
      },
    });
  }

  await tx.deliveryRun.update({
    where: { id: run.id },
    data: {
      plannedKm: routePlan?.totalDistanceKm ?? null,
      plannedDurationSec: routePlan?.totalDurationSec ?? null,
    },
  });
}

function assertRunCanBeStarted(run: DeliveryRunDetailRecord) {
  if (run.status === "COMPLETED" || run.status === "CANCELLED") {
    throw new Error("DELIVERY_RUN_ALREADY_FINISHED");
  }
}

async function getRunByToken(token: string) {
  const access = await prisma.deliveryRunAccessToken.findUnique({
    where: { tokenHash: hashDeliveryRunToken(token) },
    include: {
      run: {
        include: deliveryRunDetailInclude,
      },
    },
  });

  if (!access) {
    throw new Error("DELIVERY_RUN_TOKEN_INVALID");
  }

  if (access.revokedAt) {
    throw new Error("DELIVERY_RUN_TOKEN_REVOKED");
  }

  if (access.expiresAt.getTime() <= Date.now()) {
    throw new Error("DELIVERY_RUN_TOKEN_EXPIRED");
  }

  await prisma.deliveryRunAccessToken.update({
    where: { id: access.id },
    data: { lastAccessAt: new Date() },
  });

  return access;
}

export async function listDeliveryDrivers() {
  if (!(await hasDeliveryRunsSchemaTables())) {
    return [] as DeliveryDriver[];
  }

  const drivers = await prisma.driver.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  return drivers.map((driver) => mapDriver(driver));
}

export async function createDeliveryDriver(input: {
  name: string;
  phone?: string;
  isActive?: boolean;
  actorUserId?: string;
}) {
  await ensureDeliveryRunsEnabledForMutation();

  const shouldActivate = input.isActive ?? true;
  const driver = await prisma.$transaction(async (tx) => {
    if (shouldActivate) {
      await tx.driver.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
    }

    return tx.driver.create({
      data: {
        name: input.name.trim(),
        phone: input.phone?.trim() || null,
        isActive: shouldActivate,
      },
    });
  });

  if (input.actorUserId) {
    await prisma.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "DELIVERY_DRIVER_CREATED",
        entity: "Driver",
        entityId: driver.id,
        metadata: JSON.stringify({ name: driver.name }),
      },
    });
  }

  return mapDriver(driver);
}

export async function updateDeliveryDriver(input: {
  driverId: string;
  name?: string;
  phone?: string;
  isActive?: boolean;
  actorUserId?: string;
}) {
  await ensureDeliveryRunsEnabledForMutation();

  const existing = await prisma.driver.findUnique({
    where: { id: input.driverId },
  });
  if (!existing) {
    throw new Error("DELIVERY_DRIVER_NOT_FOUND");
  }

  const driver = await prisma.$transaction(async (tx) => {
    if (input.isActive === true) {
      await tx.driver.updateMany({
        where: {
          isActive: true,
          id: { not: input.driverId },
        },
        data: { isActive: false },
      });
    }

    return tx.driver.update({
      where: { id: input.driverId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.phone !== undefined ? { phone: input.phone.trim() || null } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
  });

  if (input.actorUserId) {
    await prisma.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "DELIVERY_DRIVER_UPDATED",
        entity: "Driver",
        entityId: driver.id,
      },
    });
  }

  return mapDriver(driver);
}

export async function deleteDeliveryDriver(input: {
  driverId: string;
  actorUserId?: string;
}) {
  await ensureDeliveryRunsEnabledForMutation();

  const runCount = await prisma.deliveryRun.count({
    where: { driverId: input.driverId },
  });
  if (runCount > 0) {
    throw new Error("DELIVERY_DRIVER_HAS_RUNS");
  }

  const existing = await prisma.driver.findUnique({
    where: { id: input.driverId },
  });
  if (!existing) {
    throw new Error("DELIVERY_DRIVER_NOT_FOUND");
  }

  await prisma.driver.delete({
    where: { id: input.driverId },
  });

  if (input.actorUserId) {
    await prisma.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "DELIVERY_DRIVER_DELETED",
        entity: "Driver",
        entityId: input.driverId,
        metadata: JSON.stringify({ name: existing.name }),
      },
    });
  }
}

export async function listDeliveryRunsByDate(dateKey?: string) {
  if (!(await hasDeliveryRunsSchemaTables())) {
    return [] as DeliveryRunSummary[];
  }

  const key = dateKey ?? toDateKey(new Date());
  const runs = await prisma.deliveryRun.findMany({
    where: { dateKey: key },
    include: deliveryRunDetailInclude,
    orderBy: [{ deliverySlot: { startAt: "asc" } }],
  });

  return runs.map((run) => mapRunSummary(run));
}

export async function getDeliveryRunDetail(runId: string) {
  if (!(await hasDeliveryRunsSchemaTables())) {
    throw new Error("DELIVERY_RUNS_SCHEMA_UNAVAILABLE");
  }

  const run = await loadRunDetail(runId);
  if (!run) {
    throw new Error("DELIVERY_RUN_NOT_FOUND");
  }

  return mapRunSummary(run);
}

export async function createDeliveryRun(input: {
  deliverySlotId: string;
  driverId: string;
  includeReturnToDepot?: boolean;
  actorUserId?: string;
}) {
  await ensureDeliveryRunsEnabledForMutation();

  const dynamicWindow = parseDynamicDeliverySlotId(input.deliverySlotId);
  if (isDynamicDeliverySlotId(input.deliverySlotId) && !dynamicWindow) {
    throw new Error("DELIVERY_SLOT_NOT_FOUND");
  }

  let slot = dynamicWindow
    ? await prisma.deliverySlot.findFirst({
        where: {
          startAt: dynamicWindow.startAt,
          endAt: dynamicWindow.endAt,
        },
      })
    : await prisma.deliverySlot.findUnique({
        where: { id: input.deliverySlotId },
      });
  if (!slot) {
    if (!dynamicWindow) {
      throw new Error("DELIVERY_SLOT_NOT_FOUND");
    }
  } else {
    const existing = await prisma.deliveryRun.findUnique({
      where: { deliverySlotId: slot.id },
      include: deliveryRunDetailInclude,
    });
    if (existing) {
      return { run: mapRunSummary(existing), reusedExisting: true };
    }
  }

  const driver = await prisma.driver.findUnique({
    where: { id: input.driverId },
  });
  if (!driver) {
    throw new Error("DELIVERY_DRIVER_NOT_FOUND");
  }

  if (!slot && dynamicWindow) {
    const [settings, activeDriverCount] = await Promise.all([
      getDeliveryScheduleSettings(),
      getActiveDeliveryDriverCount(),
    ]);

    slot = await prisma.deliverySlot.create({
      data: {
        startAt: dynamicWindow.startAt,
        endAt: dynamicWindow.endAt,
        capacity: computeCapacityPerBlock(settings, activeDriverCount),
        isOpen: true,
        note: "Internal delivery block",
      },
    });
  }

  if (!slot) {
    throw new Error("DELIVERY_SLOT_NOT_FOUND");
  }

  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { deliverySlotId: slot.id },
        {
          deliverySlotId: null,
          deliveryWindowStartAt: slot.startAt,
          deliveryWindowEndAt: slot.endAt,
        },
      ],
      deliveryStatus: { in: ["SCHEDULED", "OUT_FOR_DELIVERY"] },
      status: { not: "CANCELLED" },
      paymentStatus: { not: "FAILED" },
    },
    orderBy: [
      { deliveryWindowStartAt: "asc" },
      { shippingPostal: "asc" },
      { shippingLine1: "asc" },
    ],
    select: {
      id: true,
    },
  });

  if (!orders.length) {
    throw new Error("DELIVERY_RUN_EMPTY");
  }

  const run = await prisma.$transaction(async (tx) => {
    await tx.order.updateMany({
      where: {
        id: { in: orders.map((order) => order.id) },
        deliverySlotId: null,
      },
      data: {
        deliverySlotId: slot.id,
      },
    });

    const created = await tx.deliveryRun.create({
      data: {
        deliverySlotId: slot.id,
        driverId: driver.id,
        dateKey: toDateKey(slot.startAt),
        includeReturnToDepot: input.includeReturnToDepot ?? true,
        stops: {
          create: orders.map((order, index) => ({
            orderId: order.id,
            plannedSequence: index + 1,
            finalSequence: index + 1,
          })),
        },
      },
      include: deliveryRunDetailInclude,
    });

    if (input.actorUserId) {
      await tx.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "DELIVERY_RUN_CREATED",
          entity: "DeliveryRun",
          entityId: created.id,
          metadata: JSON.stringify({
            deliverySlotId: slot.id,
            requestedDeliverySlotId: input.deliverySlotId,
            driverId: driver.id,
            orderCount: orders.length,
          }),
        },
      });
    }

    return created;
  });

  return { run: mapRunSummary(run), reusedExisting: false };
}

export async function optimizeDeliveryRun(input: {
  runId: string;
  actorUserId?: string;
}) {
  await ensureDeliveryRunsEnabledForMutation();

  const run = await loadRunDetail(input.runId);
  if (!run) {
    throw new Error("DELIVERY_RUN_NOT_FOUND");
  }

  const originalStops = sortStopsByFinalSequence(run.stops);
  let warning: string | null = null;
  let plannedRoute: Awaited<ReturnType<typeof planOrderedStops>> | null = null;

  try {
    plannedRoute = await planOrderedStops(run, originalStops, true);
  } catch {
    warning =
      "Google Maps n'est pas disponible pour cette tournee. L'ordre brut a ete conserve et les KM planifies restent vides.";
  }

  await prisma.$transaction(async (tx) => {
    const current = await loadRunDetail(input.runId, tx);
    if (!current) {
      throw new Error("DELIVERY_RUN_NOT_FOUND");
    }

    const currentOriginalStops = sortStopsByFinalSequence(current.stops);
    const currentPlannedStops =
      plannedRoute ? mapCurrentStopsById(current, plannedRoute.orderedStops.map((stop) => stop.id)) : null;

    if (plannedRoute && currentPlannedStops) {
      await applyAutoRoutePlan(tx, current, currentPlannedStops, plannedRoute.route);
    } else {
      if (plannedRoute && !currentPlannedStops) {
        warning =
          warning ??
          "La tournee a change pendant l'optimisation. L'ordre courant a ete conserve et les KM planifies restent vides.";
      }
      await applyAutoRoutePlan(tx, current, currentOriginalStops, null);
    }

    if (input.actorUserId) {
      await tx.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "DELIVERY_RUN_OPTIMIZED",
          entity: "DeliveryRun",
          entityId: input.runId,
        },
      });
    }
  });

  return {
    run: await getDeliveryRunDetail(input.runId),
    warning,
  };
}

export async function reorderDeliveryRun(input: {
  runId: string;
  stopIds: string[];
  actorUserId?: string;
}) {
  await ensureDeliveryRunsEnabledForMutation();

  const run = await loadRunDetail(input.runId);
  if (!run) {
    throw new Error("DELIVERY_RUN_NOT_FOUND");
  }

  const currentStopIds = new Set(run.stops.map((stop) => stop.id));
  if (
    currentStopIds.size !== input.stopIds.length ||
    input.stopIds.some((stopId) => !currentStopIds.has(stopId))
  ) {
    throw new Error("DELIVERY_RUN_REORDER_INVALID");
  }

  const orderedStops = mapCurrentStopsById(run, input.stopIds);
  if (!orderedStops) {
    throw new Error("DELIVERY_RUN_REORDER_INVALID");
  }

  let warning: string | null = null;
  let plannedRoute: Awaited<ReturnType<typeof planOrderedStops>> | null = null;

  try {
    plannedRoute = await planOrderedStops(run, orderedStops, false);
  } catch {
    warning =
      "Google Maps n'a pas pu recalculer le trajet. Le nouvel ordre est conserve mais les KM planifies restent vides.";
  }

  await prisma.$transaction(async (tx) => {
    const current = await loadRunDetail(input.runId, tx);
    if (!current) {
      throw new Error("DELIVERY_RUN_NOT_FOUND");
    }

    const currentOrderedStops = mapCurrentStopsById(current, input.stopIds);
    if (!currentOrderedStops) {
      throw new Error("DELIVERY_RUN_REORDER_INVALID");
    }

    await applyManualRoutePlan(tx, current, currentOrderedStops, plannedRoute?.route ?? null);

    if (input.actorUserId) {
      await tx.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "DELIVERY_RUN_REORDERED",
          entity: "DeliveryRun",
          entityId: input.runId,
        },
      });
    }
  });

  return {
    run: await getDeliveryRunDetail(input.runId),
    warning,
  };
}

export async function publishDeliveryRun(input: {
  runId: string;
  actorUserId?: string;
}) {
  await ensureDeliveryRunsEnabledForMutation();

  const run = await loadRunDetail(input.runId);
  if (!run) {
    throw new Error("DELIVERY_RUN_NOT_FOUND");
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashDeliveryRunToken(token);
  const expiresAt = new Date(run.deliverySlot.endAt.getTime() + DRIVER_TOKEN_TTL_MS);

  await prisma.$transaction(async (tx) => {
    await tx.deliveryRunAccessToken.updateMany({
      where: {
        runId: input.runId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    await tx.deliveryRunAccessToken.create({
      data: {
        runId: input.runId,
        tokenHash,
        expiresAt,
      },
    });

    await tx.deliveryRun.update({
      where: { id: input.runId },
      data: {
        status: run.status === "DRAFT" ? "PUBLISHED" : run.status,
        publishedAt: new Date(),
      },
    });

    if (input.actorUserId) {
      await tx.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "DELIVERY_RUN_PUBLISHED",
          entity: "DeliveryRun",
          entityId: input.runId,
          metadata: JSON.stringify({ expiresAt: expiresAt.toISOString() }),
        },
      });
    }
  });

  return {
    run: await getDeliveryRunDetail(input.runId),
    driverUrl: buildDriverRunUrl(token),
  };
}

export async function completeDeliveryRunFromAdmin(input: {
  runId: string;
  manualActualKmFinal?: number;
  note?: string;
  actorUserId?: string;
}) {
  await ensureDeliveryRunsEnabledForMutation();

  const run = await loadRunDetail(input.runId);
  if (!run) {
    throw new Error("DELIVERY_RUN_NOT_FOUND");
  }

  const samples = await loadRunSamples(input.runId);
  const km = resolveDeliveryRunKm({
    samples,
    odometerStartKm: run.odometerStartKm,
    odometerEndKm: run.odometerEndKm,
    manualActualKmFinal: input.manualActualKmFinal,
  });

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.deliveryRun.update({
      where: { id: input.runId },
      data: {
        status: "COMPLETED",
        completedAt: run.completedAt ?? new Date(),
        actualKmGps: km.actualKmGps,
        actualKmOdometer: km.actualKmOdometer,
        actualKmFinal: km.actualKmFinal,
        actualKmSource: km.actualKmSource,
        ...(input.note !== undefined ? { note: input.note.trim() || null } : {}),
      },
      include: deliveryRunDetailInclude,
    });

    if (input.actorUserId) {
      await tx.auditLog.create({
        data: {
          actorUserId: input.actorUserId,
          action: "DELIVERY_RUN_COMPLETED_BY_ADMIN",
          entity: "DeliveryRun",
          entityId: input.runId,
          metadata: JSON.stringify({
            actualKmFinal: km.actualKmFinal,
            actualKmSource: km.actualKmSource,
          }),
        },
      });
    }

    return next;
  });

  return mapRunSummary(updated);
}

export async function getDriverRunSnapshot(token: string) {
  if (!isDeliveryRunsEnabled()) {
    throw new Error("DELIVERY_RUNS_DISABLED");
  }

  if (!(await hasDeliveryRunsSchemaTables())) {
    throw new Error("DELIVERY_RUNS_SCHEMA_UNAVAILABLE");
  }

  const access = await getRunByToken(token);
  return mapRunSummary(access.run);
}

export async function startDriverRun(token: string, input?: DeliveryRunStartLocationInput) {
  await ensureDeliveryRunsEnabledForMutation();
  const access = await getRunByToken(token);

  assertRunCanBeStarted(access.run);

  const orderIds = access.run.stops.map((stop) => stop.orderId);
  const hasOriginOverride = input?.lat !== undefined && input?.lng !== undefined;
  const recordedAt =
    input?.recordedAt && !Number.isNaN(new Date(input.recordedAt).getTime())
      ? new Date(input.recordedAt)
      : new Date();

  const updated = await prisma.$transaction(async (tx) => {
    await tx.order.updateMany({
      where: {
        id: { in: orderIds },
        deliveryStatus: { in: ["SCHEDULED", "RESCHEDULED"] },
      },
      data: {
        deliveryStatus: "OUT_FOR_DELIVERY",
      },
    });

    if (hasOriginOverride) {
      await tx.deliveryGpsSample.create({
        data: {
          runId: access.run.id,
          recordedAt,
          lat: input!.lat!,
          lng: input!.lng!,
          accuracyMeters: input?.accuracyMeters ?? 25,
          speedMps: input?.speedMps ?? null,
          heading: input?.heading ?? null,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        action: "DELIVERY_RUN_STARTED",
        entity: "DeliveryRun",
        entityId: access.run.id,
        metadata: hasOriginOverride
          ? JSON.stringify({
              startLat: input?.lat,
              startLng: input?.lng,
              recordedAt: recordedAt.toISOString(),
            })
          : null,
      },
    });

    return tx.deliveryRun.update({
      where: { id: access.run.id },
      data: {
        status: "IN_PROGRESS",
        startedAt: access.run.startedAt ?? new Date(),
      },
      include: deliveryRunDetailInclude,
    });
  });

  if (hasOriginOverride) {
    let plannedRoute: Awaited<ReturnType<typeof planOrderedStops>> | null = null;

    try {
      plannedRoute = await planOrderedStops(updated, sortStopsByFinalSequence(updated.stops), false, {
        originOverride: {
          lat: input!.lat!,
          lng: input!.lng!,
        },
      });
    } catch {
      plannedRoute = null;
    }

    await prisma.$transaction(async (tx) => {
      const current = await loadRunDetail(access.run.id, tx);
      if (!current) {
        throw new Error("DELIVERY_RUN_NOT_FOUND");
      }

      await applyCurrentRoutePlan(tx, current, sortStopsByFinalSequence(current.stops), plannedRoute?.route ?? null);
    });

    return getDeliveryRunDetail(access.run.id);
  }

  return mapRunSummary(updated);
}

export async function recordDriverRunLocation(
  token: string,
  input: {
    lat: number;
    lng: number;
    accuracyMeters: number;
    speedMps?: number;
    heading?: number;
    recordedAt: string;
  },
) {
  await ensureDeliveryRunsEnabledForMutation();

  if (!isDeliveryGpsTrackingEnabled()) {
    throw new Error("DELIVERY_GPS_TRACKING_DISABLED");
  }

  const access = await getRunByToken(token);
  if (access.run.status !== "IN_PROGRESS") {
    throw new Error("DELIVERY_RUN_NOT_IN_PROGRESS");
  }

  const recordedAt = new Date(input.recordedAt);
  if (Number.isNaN(recordedAt.getTime())) {
    throw new Error("DELIVERY_GPS_SAMPLE_INVALID");
  }

  const lastSample = await prisma.deliveryGpsSample.findFirst({
    where: { runId: access.run.id },
    orderBy: [{ recordedAt: "desc" }],
  });

  const resolution = resolveDeliveryRunKm({
    samples: [
      ...(lastSample
        ? [
            {
              recordedAt: lastSample.recordedAt,
              lat: lastSample.lat,
              lng: lastSample.lng,
              accuracyMeters: lastSample.accuracyMeters,
            },
          ]
        : []),
      {
        recordedAt,
        lat: input.lat,
        lng: input.lng,
        accuracyMeters: input.accuracyMeters,
      },
    ],
  });

  const acceptedLastPoint = resolution.acceptedSamples.at(-1);
  const shouldPersist =
    acceptedLastPoint?.recordedAt.getTime() === recordedAt.getTime() &&
    acceptedLastPoint.lat === input.lat &&
    acceptedLastPoint.lng === input.lng;

  if (!shouldPersist) {
    return {
      accepted: false,
      actualKmGps: access.run.actualKmGps,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.deliveryGpsSample.create({
      data: {
        runId: access.run.id,
        recordedAt,
        lat: input.lat,
        lng: input.lng,
        accuracyMeters: input.accuracyMeters,
        speedMps: input.speedMps ?? null,
        heading: input.heading ?? null,
      },
    });

    const samples = await loadRunSamples(access.run.id, tx);
    const nextKm = resolveDeliveryRunKm({
      samples,
      odometerStartKm: access.run.odometerStartKm,
      odometerEndKm: access.run.odometerEndKm,
    });

    await tx.deliveryRun.update({
      where: { id: access.run.id },
      data: {
        actualKmGps: nextKm.actualKmGps,
      },
    });
  });

  const refreshed = await getDeliveryRunDetail(access.run.id);
  return {
    accepted: true,
    actualKmGps: refreshed.actualKmGps,
  };
}

export async function completeDriverStop(
  token: string,
  input: {
    stopId: string;
    result: "DELIVERED" | "FAILED";
    note?: string;
  },
) {
  await ensureDeliveryRunsEnabledForMutation();
  const access = await getRunByToken(token);

  if (access.run.status !== "IN_PROGRESS") {
    throw new Error("DELIVERY_RUN_NOT_IN_PROGRESS");
  }

  const stop = access.run.stops.find((row) => row.id === input.stopId);
  if (!stop) {
    throw new Error("DELIVERY_STOP_NOT_FOUND");
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const samples = await loadRunSamples(access.run.id, tx);
    const km = resolveDeliveryRunKm({
      samples,
      odometerStartKm: access.run.odometerStartKm,
      odometerEndKm: access.run.odometerEndKm,
    });

    await tx.deliveryStop.update({
      where: { id: stop.id },
      data: {
        status: input.result,
        note: input.note?.trim() || null,
        arrivedAt: stop.arrivedAt ?? now,
        completedAt: now,
        actualCumulativeKmAtStop: km.actualKmGps,
      },
    });

    await tx.order.update({
      where: { id: stop.orderId },
      data: {
        deliveryStatus: input.result === "DELIVERED" ? "DELIVERED" : "FAILED",
      },
    });

    await tx.auditLog.create({
      data: {
        action: "DELIVERY_STOP_COMPLETED",
        entity: "DeliveryStop",
        entityId: stop.id,
        metadata: JSON.stringify({
          result: input.result,
          orderId: stop.orderId,
        }),
      },
    });
  });

  return getDeliveryRunDetail(access.run.id);
}

export async function finishDriverRun(
  token: string,
  input: {
    odometerStartKm?: number;
    odometerEndKm?: number;
    note?: string;
  },
) {
  await ensureDeliveryRunsEnabledForMutation();
  const access = await getRunByToken(token);

  const samples = await loadRunSamples(access.run.id);
  const km = resolveDeliveryRunKm({
    samples,
    odometerStartKm: input.odometerStartKm ?? access.run.odometerStartKm,
    odometerEndKm: input.odometerEndKm ?? access.run.odometerEndKm,
  });

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.deliveryRun.update({
      where: { id: access.run.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        odometerStartKm: input.odometerStartKm ?? access.run.odometerStartKm,
        odometerEndKm: input.odometerEndKm ?? access.run.odometerEndKm,
        actualKmGps: km.actualKmGps,
        actualKmOdometer: km.actualKmOdometer,
        actualKmFinal: km.actualKmFinal,
        actualKmSource: km.actualKmSource,
        ...(input.note !== undefined ? { note: input.note.trim() || null } : {}),
      },
      include: deliveryRunDetailInclude,
    });

    await tx.auditLog.create({
      data: {
        action: "DELIVERY_RUN_FINISHED",
        entity: "DeliveryRun",
        entityId: access.run.id,
        metadata: JSON.stringify({
          actualKmFinal: km.actualKmFinal,
          actualKmSource: km.actualKmSource,
        }),
      },
    });

    return next;
  });

  return mapRunSummary(updated);
}

export async function exportDeliveryRunCsv(runId: string) {
  const run = await getDeliveryRunDetail(runId);
  const rows = toDeliveryKmReferenceRows(run);
  const header = [
    "runId",
    "dateKey",
    "orderNumber",
    "customerName",
    "shippingPostal",
    "finalSequence",
    "stopStatus",
    "plannedLegKm",
    "plannedCumulativeKm",
    "actualCumulativeKmAtStop",
    "actualKmFinal",
    "actualKmSource",
  ];

  const escapeValue = (value: string | number | null) => {
    if (value === null) return "";
    const text = String(value);
    if (text.includes(",") || text.includes('"') || text.includes("\n")) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  return [
    header.join(","),
    ...rows.map((row) =>
      [
        row.runId,
        row.dateKey,
        row.orderNumber,
        row.customerName,
        row.shippingPostal,
        row.finalSequence,
        row.stopStatus,
        row.plannedLegKm,
        row.plannedCumulativeKm,
        row.actualCumulativeKmAtStop,
        row.actualKmFinal,
        row.actualKmSource,
      ]
        .map((value) => escapeValue(value))
        .join(","),
    ),
  ].join("\n");
}

export function toDeliveryKmReferenceRows(run: DeliveryRunSummary): DeliveryKmReferenceRow[] {
  return run.stops.map((stop) => ({
    runId: run.id,
    dateKey: run.dateKey,
    orderNumber: stop.orderNumber,
    customerName: stop.customerName,
    shippingPostal: stop.shippingPostal,
    finalSequence: stop.finalSequence,
    stopStatus: stop.status,
    plannedLegKm: stop.plannedLegKm,
    plannedCumulativeKm: stop.plannedCumulativeKm,
    actualCumulativeKmAtStop: stop.actualCumulativeKmAtStop,
    actualKmFinal: run.actualKmFinal,
    actualKmSource: run.actualKmSource,
  }));
}

export function getStopAddressKey(stop: DeliveryRunStop) {
  return buildDeliveryAddressKey({
    shippingLine1: stop.shippingLine1 ?? "",
    shippingCity: stop.shippingCity ?? "",
    shippingRegion: stop.shippingRegion ?? "",
    shippingPostal: stop.shippingPostal ?? "",
    shippingCountry: stop.shippingCountry ?? "CA",
  });
}

export function mapDeliveryRunError(error: unknown) {
  if (isDeliveryRunsDisabledError(error)) {
    return { message: "Experimental delivery runs are disabled.", status: 409 };
  }

  if (error instanceof Error) {
    switch (error.message) {
      case "DELIVERY_RUNS_SCHEMA_UNAVAILABLE":
        return { message: "Delivery runs schema is unavailable. Run Prisma migrations first.", status: 503 };
      case "DELIVERY_SLOT_NOT_FOUND":
        return { message: "Delivery slot not found.", status: 404 };
      case "DELIVERY_DRIVER_NOT_FOUND":
        return { message: "Driver not found.", status: 404 };
      case "DELIVERY_DRIVER_HAS_RUNS":
        return { message: "Cannot delete a driver already assigned to delivery runs.", status: 409 };
      case "DELIVERY_RUN_NOT_FOUND":
        return { message: "Delivery run not found.", status: 404 };
      case "DELIVERY_STOP_NOT_FOUND":
        return { message: "Delivery stop not found.", status: 404 };
      case "DELIVERY_RUN_EMPTY":
        return { message: "No eligible scheduled orders exist for this slot.", status: 400 };
      case "DELIVERY_RUN_REORDER_INVALID":
        return { message: "Reorder payload does not match the current run stops.", status: 400 };
      case "DELIVERY_RUN_TOKEN_INVALID":
      case "DELIVERY_RUN_TOKEN_REVOKED":
      case "DELIVERY_RUN_TOKEN_EXPIRED":
        return { message: "This driver link is no longer valid.", status: 404 };
      case "DELIVERY_RUN_NOT_IN_PROGRESS":
        return { message: "The delivery run has not started yet.", status: 409 };
      case "DELIVERY_GPS_TRACKING_DISABLED":
        return { message: "GPS tracking is disabled for this environment.", status: 409 };
      case "DELIVERY_RUN_ALREADY_FINISHED":
        return { message: "This delivery run is already completed or cancelled.", status: 409 };
      case "DELIVERY_STOP_ADDRESS_INCOMPLETE":
      case "DELIVERY_DEPOT_NOT_CONFIGURED":
      case "GOOGLE_MAPS_NOT_CONFIGURED":
        return { message: "Google route planning is not fully configured.", status: 409 };
      default:
        break;
    }
  }

  if (isDeliveryRunsSchemaUnavailableError(error)) {
    return { message: "Delivery runs schema is unavailable. Run Prisma migrations first.", status: 503 };
  }

  return { message: "Unable to process the delivery run request.", status: 500 };
}
