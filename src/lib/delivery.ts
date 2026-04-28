import { Prisma } from "@prisma/client";
import type { DeliveryScheduleSettings as DeliveryScheduleSettingsRecord, DeliverySlot } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildDynamicDeliverySlotId,
  isDynamicDeliverySlotId,
  isExperimentalDeliveryRoutingEnabled,
  resolveDeliveryCheckoutMode,
  type DeliveryCheckoutMode,
} from "@/lib/delivery-mode";
import { isRimouskiDeliveryAddress } from "@/lib/delivery-zone";

export const DELIVERY_MIN_LEAD_HOURS = 2;
export const DELIVERY_BOOKING_DAYS_AHEAD = 14;
export const DELIVERY_SAME_DAY_CUTOFF_HOUR = 16;

export const DEFAULT_DELIVERY_AVERAGE_MINUTES = 30;
export const DEFAULT_DELIVERY_BLOCK_MINUTES = 60;
export const DEFAULT_DELIVERY_AM_START_MINUTE = 9 * 60;
export const DEFAULT_DELIVERY_AM_END_MINUTE = 12 * 60;
export const DEFAULT_DELIVERY_PM_START_MINUTE = 13 * 60;
export const DEFAULT_DELIVERY_PM_END_MINUTE = 17 * 60;
export const DELIVERY_SCHEDULE_SETTINGS_ID = "default";
export const DELIVERY_CAPACITY_MODE_ACTIVE_DRIVERS = "ACTIVE_DRIVERS";

export type DeliveryPeriodKey = "AM" | "PM";

export type DeliveryScheduleSettings = {
  id: string;
  averageDeliveryMinutes: number;
  blockMinutes: number;
  amEnabled: boolean;
  amStartMinute: number;
  amEndMinute: number;
  pmEnabled: boolean;
  pmStartMinute: number;
  pmEndMinute: number;
  capacityMode: typeof DELIVERY_CAPACITY_MODE_ACTIVE_DRIVERS;
  createdAt: string | null;
  updatedAt: string | null;
};

type DeliveryPeriodConfig = {
  key: DeliveryPeriodKey;
  label: DeliveryPeriodKey;
  enabled: boolean;
  startMinute: number;
  endMinute: number;
};

type PrismaLike = Prisma.TransactionClient;

type SqliteTableRow = { name: string };

async function hasDeliverySchemaTables() {
  try {
    const rows = await prisma.$queryRaw<SqliteTableRow[]>`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name IN ('DeliverySlot', 'DeliveryException')
    `;
    const names = new Set(rows.map((row) => row.name));
    return names.has("DeliverySlot") && names.has("DeliveryException");
  } catch {
    // Si la DB n'est pas SQLite (ou metadonnees indisponibles), on garde le comportement normal.
    return true;
  }
}

async function hasDeliveryScheduleSettingsTable() {
  try {
    const rows = await prisma.$queryRaw<SqliteTableRow[]>`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name = 'DeliveryScheduleSettings'
    `;
    return rows.some((row) => row.name === "DeliveryScheduleSettings");
  } catch {
    return true;
  }
}

async function hasOrderDeliverySlotColumn() {
  try {
    const rows = await prisma.$queryRaw<SqliteTableRow[]>`PRAGMA table_info('Order')`;
    return rows.some((row) => row.name === "deliverySlotId");
  } catch {
    return true;
  }
}

function isDeliverySchemaUnavailableError(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  ) {
    return true;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("no such table") ||
      message.includes("no such column") ||
      message.includes("deliveryslot") ||
      message.includes("deliveryexception") ||
      message.includes("deliveryslotid")
    );
  }

  return false;
}

async function ensureDeliverySchemaAvailableForMutation() {
  const [hasTables, hasOrderDeliveryColumn] = await Promise.all([
    hasDeliverySchemaTables(),
    hasOrderDeliverySlotColumn(),
  ]);

  if (!hasTables || !hasOrderDeliveryColumn) {
    throw new Error("DELIVERY_SCHEMA_UNAVAILABLE");
  }
}

export type DeliverySlotAvailability = {
  id: string;
  startAt: string;
  endAt: string;
  periodKey: DeliveryPeriodKey;
  periodLabel: string;
  capacity: number;
  reservedCount: number;
  remainingCapacity: number;
  isOpen: boolean;
  note: string | null;
  dateKey: string;
};

type AvailabilityInput = {
  postalCode?: string;
  country?: string;
  from?: Date;
  to?: Date;
  now?: Date;
};

type DeliverySelection = {
  deliverySlotId: string | null;
  deliveryWindowStartAt: Date | null;
  deliveryWindowEndAt: Date | null;
  deliveryStatus:
    | "UNSCHEDULED"
    | "SCHEDULED";
};

export type CheckoutDeliverySlotsResult = {
  mode: DeliveryCheckoutMode;
  slots: DeliverySlotAvailability[];
  settings: DeliveryScheduleSettings;
  activeDriverCount: number;
};

export function toDateKey(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function startOfLocalDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfLocalDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function getBookingWindow(now: Date) {
  const earliest = new Date(now);
  earliest.setHours(earliest.getHours() + DELIVERY_MIN_LEAD_HOURS);

  const latest = new Date(now);
  latest.setDate(latest.getDate() + DELIVERY_BOOKING_DAYS_AHEAD);
  latest.setHours(23, 59, 59, 999);

  return { earliest, latest };
}

function isSameLocalDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isSlotBookableByPolicy(slot: DeliverySlot, now: Date) {
  const { earliest, latest } = getBookingWindow(now);
  if (slot.endAt <= earliest) return false;
  if (slot.startAt > latest) return false;

  if (isSameLocalDay(slot.startAt, now) && now.getHours() >= DELIVERY_SAME_DAY_CUTOFF_HOUR) {
    return false;
  }

  return true;
}

async function getReservedCountMap(prismaLike: PrismaLike, slotIds: string[]) {
  if (!slotIds.length) return new Map<string, number>();
  if (!(await hasOrderDeliverySlotColumn())) return new Map<string, number>();

  const bookedOrders = await prismaLike.order.findMany({
    where: {
      deliverySlotId: { in: slotIds },
      status: { not: "CANCELLED" },
      paymentStatus: { not: "FAILED" },
    },
    select: {
      deliverySlotId: true,
    },
  });

  const countMap = new Map<string, number>();
  for (const row of bookedOrders) {
    if (!row.deliverySlotId) continue;
    countMap.set(row.deliverySlotId, (countMap.get(row.deliverySlotId) ?? 0) + 1);
  }

  return countMap;
}

// ✅ NOUVEAU: Algorithme de fenêtres glissantes dynamiques
export type DynamicDeliveryWindow = {
  startAt: string;
  endAt: string;
  dateKey: string;
  periodKey: DeliveryPeriodKey;
  periodLabel: string;
  available: boolean;
  remainingSpots: number;
  overlapCount: number;
  capacity: number;
};

/**
 * Génère toutes les fenêtres de livraison possible et calcule leur disponibilité
 * Algorithme: Fenêtres glissantes avec vérification de chevauchement
 * Intègre les DeliveryException (jours fermés)
 */
export async function getDynamicDeliveryWindows(input: AvailabilityInput): Promise<DynamicDeliveryWindow[]> {
  const now = input.now ?? new Date();
  
  if (!isRimouskiDeliveryAddress({ postalCode: input.postalCode, country: input.country })) {
    return [];
  }

  const [settings, activeDriverCount] = await Promise.all([
    getDeliveryScheduleSettings(),
    getActiveDeliveryDriverCount(),
  ]);
  const defaultBlockCapacity = computeCapacityPerBlock(settings, activeDriverCount);
  const { earliest, latest } = getBookingWindow(now);
  const windows: DynamicDeliveryWindow[] = [];

  // Récupérer toutes les commandes existantes dans la période
  const existingDeliveries = await prisma.order.findMany({
    where: {
      AND: [
        { deliveryWindowStartAt: { lt: latest } },
        { deliveryWindowEndAt: { gt: earliest } },
        { status: { not: "CANCELLED" } },
        { paymentStatus: { not: "FAILED" } }
      ]
    },
    select: {
      deliveryWindowStartAt: true,
      deliveryWindowEndAt: true
    }
  });

  // Récupérer les exceptions (jours fermés) pour la période
  const startDateKey = toDateKey(earliest);
  const endDateKey = toDateKey(latest);
  const exceptionMap = new Map<string, { isClosed: boolean; capacityOverride: number | null }>();

  try {
    const exceptions = await prisma.deliveryException.findMany({
      where: {
        dateKey: { gte: startDateKey, lte: endDateKey },
      },
      select: { dateKey: true, isClosed: true, capacityOverride: true },
    });
    for (const exception of exceptions) {
      exceptionMap.set(exception.dateKey, {
        isClosed: exception.isClosed,
        capacityOverride: exception.capacityOverride,
      });
    }
  } catch {
    // Si la table n'existe pas encore, on continue sans exceptions
  }

  // Générer toutes les fenêtres possibles jour par jour
  const currentDate = input.from ? startOfLocalDay(input.from) : new Date(earliest);
  currentDate.setHours(0, 0, 0, 0);
  const lastDate = input.to ? endOfLocalDay(input.to) : latest;

  while (currentDate <= lastDate && currentDate <= latest) {
    const dateKey = toDateKey(currentDate);
    const exception = exceptionMap.get(dateKey);

    // Vérifier si le jour est fermé par exception
    if (exception?.isClosed) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    // Vérifier si on peut commander ce jour (cutoff même jour)
    if (isSameLocalDay(currentDate, now) && now.getHours() >= DELIVERY_SAME_DAY_CUTOFF_HOUR) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    // Générer les fenêtres pour cette journée
    const capacity = exception?.capacityOverride ?? defaultBlockCapacity;

    for (const period of getSchedulePeriods(settings)) {
      if (!period.enabled) continue;

      for (
        let minute = period.startMinute;
        minute + settings.blockMinutes <= period.endMinute;
        minute += settings.blockMinutes
      ) {
        const windowStart = setLocalMinuteOfDay(currentDate, minute);
        const windowEnd = new Date(windowStart);
        windowEnd.setMinutes(windowEnd.getMinutes() + settings.blockMinutes);

      // Ne pas afficher les fenêtres déjà passées
        if (windowEnd <= earliest) continue;
        if (windowStart > latest) continue;

      // Compter combien de livraisons existent déjà qui chevauchent cette fenêtre
      let overlapCount = 0;
      for (const delivery of existingDeliveries) {
        if (!delivery.deliveryWindowStartAt || !delivery.deliveryWindowEndAt) continue;
        
        // Vérification standard de chevauchement d'intervalle
        if (windowStart < delivery.deliveryWindowEndAt && windowEnd > delivery.deliveryWindowStartAt) {
          overlapCount++;
        }
      }

        const remainingSpots = Math.max(0, capacity - overlapCount);

      windows.push({
        startAt: windowStart.toISOString(),
        endAt: windowEnd.toISOString(),
        dateKey,
        periodKey: period.key,
        periodLabel: period.label,
        available: remainingSpots > 0,
        remainingSpots,
        overlapCount,
        capacity,
      });
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return windows;
}

export async function getCheckoutDeliverySlots(
  input: AvailabilityInput & { mode?: DeliveryCheckoutMode | null },
): Promise<CheckoutDeliverySlotsResult> {
  const mode = resolveDeliveryCheckoutMode(input.mode);
  const [settings, activeDriverCount] = await Promise.all([
    getDeliveryScheduleSettings(),
    getActiveDeliveryDriverCount(),
  ]);

  if (mode === "dynamic") {
    const windows = await getDynamicDeliveryWindows(input);

    return {
      mode,
      slots: windows
        .filter((window) => window.available)
        .map((window) => ({
          id: buildDynamicDeliverySlotId(window.startAt, window.endAt),
          startAt: window.startAt,
          endAt: window.endAt,
          periodKey: window.periodKey,
          periodLabel: window.periodLabel,
          capacity: window.capacity,
          reservedCount: window.overlapCount,
          remainingCapacity: window.remainingSpots,
          isOpen: window.available,
          note: null,
          dateKey: window.dateKey,
        })),
      settings,
      activeDriverCount,
    };
  }

  return {
    mode,
    slots: await getAvailableDeliverySlots(input),
    settings,
    activeDriverCount,
  };
}

export async function getAvailableDeliverySlots(input: AvailabilityInput): Promise<DeliverySlotAvailability[]> {
  const now = input.now ?? new Date();

  if (
    !isRimouskiDeliveryAddress({
      postalCode: input.postalCode,
      country: input.country,
    })
  ) {
    return [];
  }

  const from = input.from ?? startOfLocalDay(now);
  const to = input.to ?? endOfLocalDay(new Date(now.getTime() + DELIVERY_BOOKING_DAYS_AHEAD * 24 * 60 * 60 * 1000));

  if (!(await hasDeliverySchemaTables())) {
    return [];
  }

  const settings = await getDeliveryScheduleSettings();

  try {
    const slots = await prisma.deliverySlot.findMany({
      where: {
        isOpen: true,
        startAt: { gte: from, lte: to },
      },
      orderBy: { startAt: "asc" },
    });

    if (!slots.length) return [];

    const dateKeys = Array.from(new Set(slots.map((slot) => toDateKey(slot.startAt))));
    const exceptions = await prisma.deliveryException.findMany({
      where: { dateKey: { in: dateKeys } },
      select: {
        dateKey: true,
        isClosed: true,
        capacityOverride: true,
      },
    });
    const exceptionMap = new Map(exceptions.map((item) => [item.dateKey, item] as const));

    const reservedCountMap = await getReservedCountMap(prisma, slots.map((s) => s.id));

    return slots
      .filter((slot) => isSlotBookableByPolicy(slot, now))
      .map((slot) => {
        const dateKey = toDateKey(slot.startAt);
        const exception = exceptionMap.get(dateKey);
        const isClosedByException = exception?.isClosed ?? false;
        const capacity = exception?.capacityOverride ?? slot.capacity;
        const reservedCount = reservedCountMap.get(slot.id) ?? 0;
        const remainingCapacity = Math.max(0, capacity - reservedCount);
        const period = getSlotPeriod(slot.startAt, slot.endAt, settings);

        return {
          id: slot.id,
          startAt: slot.startAt.toISOString(),
          endAt: slot.endAt.toISOString(),
          periodKey: period.key,
          periodLabel: period.label,
          capacity,
          reservedCount,
          remainingCapacity,
          isOpen: slot.isOpen && !isClosedByException,
          note: slot.note,
          dateKey,
        };
      })
      .filter((slot) => slot.isOpen && slot.remainingCapacity > 0);
  } catch (error) {
    if (isDeliverySchemaUnavailableError(error)) {
      return [];
    }
    throw error;
  }
}

export async function getAdminDeliverySlots(input?: { from?: Date; to?: Date }) {
  const now = new Date();
  const from = input?.from ?? startOfLocalDay(now);
  const to = input?.to ?? endOfLocalDay(new Date(now.getTime() + DELIVERY_BOOKING_DAYS_AHEAD * 24 * 60 * 60 * 1000));

  if (!(await hasDeliverySchemaTables())) {
    return [];
  }

  const settings = await getDeliveryScheduleSettings();

  try {
    const slots = await prisma.deliverySlot.findMany({
      where: {
        startAt: { gte: from, lte: to },
      },
      orderBy: { startAt: "asc" },
    });

    if (!slots.length) return [];

    const dateKeys = Array.from(new Set(slots.map((slot) => toDateKey(slot.startAt))));
    const exceptions = await prisma.deliveryException.findMany({
      where: { dateKey: { in: dateKeys } },
      select: {
        dateKey: true,
        isClosed: true,
        capacityOverride: true,
        reason: true,
      },
    });
    const exceptionMap = new Map(exceptions.map((item) => [item.dateKey, item] as const));
    const reservedCountMap = await getReservedCountMap(prisma, slots.map((s) => s.id));

    return slots.map((slot) => {
      const dateKey = toDateKey(slot.startAt);
      const exception = exceptionMap.get(dateKey);
      const capacity = exception?.capacityOverride ?? slot.capacity;
      const reservedCount = reservedCountMap.get(slot.id) ?? 0;
      const period = getSlotPeriod(slot.startAt, slot.endAt, settings);

      return {
        id: slot.id,
        startAt: slot.startAt,
        endAt: slot.endAt,
        periodKey: period.key,
        periodLabel: period.label,
        isOpen: slot.isOpen,
        note: slot.note,
        dateKey,
        exception: exception
          ? {
              isClosed: exception.isClosed,
              capacityOverride: exception.capacityOverride,
              reason: exception.reason,
            }
          : null,
        capacity,
        reservedCount,
        remainingCapacity: Math.max(0, capacity - reservedCount),
      };
    });
  } catch (error) {
    if (isDeliverySchemaUnavailableError(error)) {
      return [];
    }
    throw error;
  }
}

function getDefaultDeliveryScheduleSettings(): DeliveryScheduleSettings {
  return {
    id: DELIVERY_SCHEDULE_SETTINGS_ID,
    averageDeliveryMinutes: DEFAULT_DELIVERY_AVERAGE_MINUTES,
    blockMinutes: DEFAULT_DELIVERY_BLOCK_MINUTES,
    amEnabled: true,
    amStartMinute: DEFAULT_DELIVERY_AM_START_MINUTE,
    amEndMinute: DEFAULT_DELIVERY_AM_END_MINUTE,
    pmEnabled: true,
    pmStartMinute: DEFAULT_DELIVERY_PM_START_MINUTE,
    pmEndMinute: DEFAULT_DELIVERY_PM_END_MINUTE,
    capacityMode: DELIVERY_CAPACITY_MODE_ACTIVE_DRIVERS,
    createdAt: null,
    updatedAt: null,
  };
}

function normalizeScheduleSettings(
  row?: Partial<DeliveryScheduleSettingsRecord> | null,
): DeliveryScheduleSettings {
  const defaults = getDefaultDeliveryScheduleSettings();
  if (!row) return defaults;

  return {
    id: typeof row.id === "string" ? row.id : defaults.id,
    averageDeliveryMinutes: row.averageDeliveryMinutes ?? defaults.averageDeliveryMinutes,
    blockMinutes: row.blockMinutes ?? defaults.blockMinutes,
    amEnabled: row.amEnabled ?? defaults.amEnabled,
    amStartMinute: row.amStartMinute ?? defaults.amStartMinute,
    amEndMinute: row.amEndMinute ?? defaults.amEndMinute,
    pmEnabled: row.pmEnabled ?? defaults.pmEnabled,
    pmStartMinute: row.pmStartMinute ?? defaults.pmStartMinute,
    pmEndMinute: row.pmEndMinute ?? defaults.pmEndMinute,
    capacityMode:
      row.capacityMode === DELIVERY_CAPACITY_MODE_ACTIVE_DRIVERS
        ? DELIVERY_CAPACITY_MODE_ACTIVE_DRIVERS
        : defaults.capacityMode,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : defaults.createdAt,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : defaults.updatedAt,
  };
}

function getSchedulePeriods(settings: DeliveryScheduleSettings): DeliveryPeriodConfig[] {
  return [
    {
      key: "AM",
      label: "AM",
      enabled: settings.amEnabled,
      startMinute: settings.amStartMinute,
      endMinute: settings.amEndMinute,
    },
    {
      key: "PM",
      label: "PM",
      enabled: settings.pmEnabled,
      startMinute: settings.pmStartMinute,
      endMinute: settings.pmEndMinute,
    },
  ];
}

function getMinuteOfDay(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function setLocalMinuteOfDay(date: Date, minuteOfDay: number) {
  const next = new Date(date);
  next.setHours(0, minuteOfDay, 0, 0);
  return next;
}

function getPeriodForWindow(
  startAt: Date,
  endAt: Date,
  settings: DeliveryScheduleSettings,
) {
  const startMinute = getMinuteOfDay(startAt);
  const endMinute = getMinuteOfDay(endAt);
  return getSchedulePeriods(settings).find(
    (period) =>
      period.enabled &&
      startMinute >= period.startMinute &&
      endMinute <= period.endMinute,
    ) ?? null;
}

function getSlotPeriod(startAt: Date, endAt: Date, settings: DeliveryScheduleSettings) {
  const matchingPeriod = getPeriodForWindow(startAt, endAt, settings);
  if (matchingPeriod) return matchingPeriod;

  const startMinute = getMinuteOfDay(startAt);
  const periods = getSchedulePeriods(settings);
  return (
    periods.find((period) => startMinute >= period.startMinute && startMinute < period.endMinute) ??
    periods.find((period) => period.key === (startMinute < 12 * 60 ? "AM" : "PM")) ??
    periods[0]
  );
}

export function formatDeliveryMinute(minuteOfDay: number) {
  const hours = Math.floor(minuteOfDay / 60);
  const minutes = minuteOfDay % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function computeCapacityPerBlock(settings: DeliveryScheduleSettings, activeDriverCount: number) {
  if (activeDriverCount <= 0) return 0;
  const deliveriesPerDriver = Math.floor(settings.blockMinutes / settings.averageDeliveryMinutes);
  return Math.max(0, deliveriesPerDriver) * activeDriverCount;
}

export async function getActiveDeliveryDriverCount() {
  try {
    if (!(await hasDeliverySchemaTables())) return 0;
    return prisma.driver.count({
      where: { isActive: true },
    });
  } catch {
    return 0;
  }
}

export async function getDeliveryScheduleSettings() {
  if (!(await hasDeliveryScheduleSettingsTable())) {
    return getDefaultDeliveryScheduleSettings();
  }

  try {
    const existing = await prisma.deliveryScheduleSettings.findUnique({
      where: { id: DELIVERY_SCHEDULE_SETTINGS_ID },
    });
    return normalizeScheduleSettings(existing);
  } catch (error) {
    if (isDeliverySchemaUnavailableError(error)) {
      return getDefaultDeliveryScheduleSettings();
    }
    throw error;
  }
}

export async function updateDeliveryScheduleSettings(input: {
  averageDeliveryMinutes: number;
  blockMinutes: number;
  amEnabled: boolean;
  amStartMinute: number;
  amEndMinute: number;
  pmEnabled: boolean;
  pmStartMinute: number;
  pmEndMinute: number;
}) {
  await ensureDeliverySchemaAvailableForMutation();
  if (!(await hasDeliveryScheduleSettingsTable())) {
    throw new Error("DELIVERY_SCHEMA_UNAVAILABLE");
  }

  const saved = await prisma.deliveryScheduleSettings.upsert({
    where: { id: DELIVERY_SCHEDULE_SETTINGS_ID },
    create: {
      id: DELIVERY_SCHEDULE_SETTINGS_ID,
      ...input,
      capacityMode: DELIVERY_CAPACITY_MODE_ACTIVE_DRIVERS,
    },
    update: {
      ...input,
      capacityMode: DELIVERY_CAPACITY_MODE_ACTIVE_DRIVERS,
    },
  });

  return normalizeScheduleSettings(saved);
}

async function getAdminDynamicDeliveryWindowSlots(
  input?: { from?: Date; to?: Date },
  existingWindowKeys = new Set<string>(),
) {
  const now = new Date();
  const from = input?.from ?? startOfLocalDay(now);
  const to = input?.to ?? endOfLocalDay(new Date(now.getTime() + DELIVERY_BOOKING_DAYS_AHEAD * 24 * 60 * 60 * 1000));

  if (!(await hasDeliverySchemaTables())) {
    return [];
  }

  const [settings, activeDriverCount] = await Promise.all([
    getDeliveryScheduleSettings(),
    getActiveDeliveryDriverCount(),
  ]);
  const defaultCapacity = computeCapacityPerBlock(settings, activeDriverCount);

  const orders = await prisma.order.findMany({
    where: {
      deliverySlotId: null,
      deliveryWindowStartAt: { gte: from, lte: to },
      deliveryWindowEndAt: { not: null },
      deliveryStatus: { in: ["SCHEDULED", "OUT_FOR_DELIVERY"] },
      status: { not: "CANCELLED" },
      paymentStatus: { not: "FAILED" },
    },
    select: {
      deliveryWindowStartAt: true,
      deliveryWindowEndAt: true,
    },
    orderBy: [
      { deliveryWindowStartAt: "asc" },
      { deliveryWindowEndAt: "asc" },
    ],
  });

  const windows = new Map<string, { startAt: Date; endAt: Date; count: number }>();
  for (const order of orders) {
    if (!order.deliveryWindowStartAt || !order.deliveryWindowEndAt) continue;

    const key = `${order.deliveryWindowStartAt.toISOString()}|${order.deliveryWindowEndAt.toISOString()}`;
    if (existingWindowKeys.has(key)) continue;

    const current = windows.get(key);
    if (current) {
      current.count += 1;
      continue;
    }

    windows.set(key, {
      startAt: order.deliveryWindowStartAt,
      endAt: order.deliveryWindowEndAt,
      count: 1,
    });
  }

  return Array.from(windows.values()).map((window) => {
    const period = getSlotPeriod(window.startAt, window.endAt, settings);

    return {
      id: buildDynamicDeliverySlotId(window.startAt.toISOString(), window.endAt.toISOString()),
      startAt: window.startAt,
      endAt: window.endAt,
      periodKey: period.key,
      periodLabel: period.label,
      isOpen: true,
      note: "Fenetre dynamique",
      dateKey: toDateKey(window.startAt),
      exception: null,
      capacity: defaultCapacity,
      reservedCount: window.count,
      remainingCapacity: Math.max(0, defaultCapacity - window.count),
    };
  });
}

export async function getAdminDeliveryRunSlots(input?: { from?: Date; to?: Date }) {
  const legacySlots = await getAdminDeliverySlots(input);
  const existingWindowKeys = new Set(
    legacySlots.map((slot) => `${slot.startAt.toISOString()}|${slot.endAt.toISOString()}`),
  );
  const dynamicSlots = await getAdminDynamicDeliveryWindowSlots(input, existingWindowKeys);

  return [...legacySlots, ...dynamicSlots].sort(
    (left, right) => left.startAt.getTime() - right.startAt.getTime(),
  );
}

export async function createAdminDeliverySlot(input: {
  startAt: Date;
  endAt: Date;
  capacity: number;
  isOpen?: boolean;
  note?: string;
}) {
  await ensureDeliverySchemaAvailableForMutation();

  if (input.endAt <= input.startAt) {
    throw new Error("INVALID_SLOT_RANGE");
  }

  // Vérifier chevauchement avec des créneaux existants
  const overlappingSlots = await prisma.deliverySlot.findMany({
    where: {
      AND: [
        { startAt: { lt: input.endAt } },
        { endAt: { gt: input.startAt } }
      ]
    }
  });

  if (overlappingSlots.length > 0) {
    throw new Error("SLOT_OVERLAP");
  }

  return prisma.deliverySlot.create({
    data: {
      startAt: input.startAt,
      endAt: input.endAt,
      capacity: input.capacity,
      isOpen: input.isOpen ?? true,
      note: input.note ?? null,
    },
  });
}

export async function updateAdminDeliverySlot(input: {
  id: string;
  startAt?: Date;
  endAt?: Date;
  capacity?: number;
  isOpen?: boolean;
  note?: string;
}) {
  await ensureDeliverySchemaAvailableForMutation();

  const existing = await prisma.deliverySlot.findUnique({ where: { id: input.id } });
  if (!existing) {
    throw new Error("DELIVERY_SLOT_NOT_FOUND");
  }

  const nextStartAt = input.startAt ?? existing.startAt;
  const nextEndAt = input.endAt ?? existing.endAt;
  if (nextEndAt <= nextStartAt) {
    throw new Error("INVALID_SLOT_RANGE");
  }

  // Vérifier chevauchement avec des créneaux existants (sauf lui-même)
  const overlappingSlots = await prisma.deliverySlot.findMany({
    where: {
      AND: [
        { id: { not: input.id } },
        { startAt: { lt: nextEndAt } },
        { endAt: { gt: nextStartAt } }
      ]
    }
  });

  if (overlappingSlots.length > 0) {
    throw new Error("SLOT_OVERLAP");
  }

  return prisma.deliverySlot.update({
    where: { id: input.id },
    data: {
      ...(input.startAt !== undefined ? { startAt: input.startAt } : {}),
      ...(input.endAt !== undefined ? { endAt: input.endAt } : {}),
      ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
      ...(input.isOpen !== undefined ? { isOpen: input.isOpen } : {}),
      ...(input.note !== undefined ? { note: input.note || null } : {}),
    },
  });
}

export async function deleteAdminDeliverySlot(input: { id: string }) {
  await ensureDeliverySchemaAvailableForMutation();

  const existing = await prisma.deliverySlot.findUnique({ where: { id: input.id } });
  if (!existing) {
    throw new Error("DELIVERY_SLOT_NOT_FOUND");
  }

  const activeOrderCount = await prisma.order.count({
    where: {
      deliverySlotId: input.id,
      status: { not: "CANCELLED" },
    },
  });

  if (activeOrderCount > 0) {
    throw new Error("DELIVERY_SLOT_HAS_ORDERS");
  }

  await prisma.deliverySlot.delete({ where: { id: input.id } });
  return { id: input.id };
}

export async function upsertAdminDeliveryException(input: {
  dateKey: string;
  isClosed?: boolean;
  capacityOverride?: number | null;
  reason?: string;
}) {
  await ensureDeliverySchemaAvailableForMutation();

  return prisma.deliveryException.upsert({
    where: { dateKey: input.dateKey },
    create: {
      dateKey: input.dateKey,
      isClosed: input.isClosed ?? true,
      capacityOverride: input.capacityOverride ?? null,
      reason: input.reason ?? null,
    },
    update: {
      ...(input.isClosed !== undefined ? { isClosed: input.isClosed } : {}),
      ...(input.capacityOverride !== undefined ? { capacityOverride: input.capacityOverride } : {}),
      ...(input.reason !== undefined ? { reason: input.reason || null } : {}),
    },
  });
}

export async function deleteAdminDeliveryException(input: { dateKey: string }) {
  await ensureDeliverySchemaAvailableForMutation();

  const existing = await prisma.deliveryException.findUnique({ where: { dateKey: input.dateKey } });
  if (!existing) {
    throw new Error("DELIVERY_EXCEPTION_NOT_FOUND");
  }

  await prisma.deliveryException.delete({ where: { dateKey: input.dateKey } });
  return { dateKey: input.dateKey };
}

export async function resolveDeliverySelectionForOrder(
  prismaLike: PrismaLike,
  input: { 
    deliverySlotId?: string,
    deliveryWindowStartAt?: Date,
    deliveryWindowEndAt?: Date,
    excludeOrderId?: string,
  },
): Promise<DeliverySelection> {
  const deliverySlotId = input.deliverySlotId?.trim();
  const hasWindowStart = Boolean(input.deliveryWindowStartAt);
  const hasWindowEnd = Boolean(input.deliveryWindowEndAt);

  if (hasWindowStart !== hasWindowEnd) {
    throw new Error("DELIVERY_WINDOW_INCOMPLETE");
  }

  if ((hasWindowStart || hasWindowEnd) && !isExperimentalDeliveryRoutingEnabled()) {
    throw new Error("DELIVERY_DYNAMIC_DISABLED");
  }

  if (deliverySlotId && isDynamicDeliverySlotId(deliverySlotId)) {
    throw new Error("DELIVERY_WINDOW_INCOMPLETE");
  }
  
  // ✅ NOUVEAU: Validation des fenêtres dynamiques
  if (input.deliveryWindowStartAt && input.deliveryWindowEndAt) {
    const now = new Date();
    const windowStart = new Date(input.deliveryWindowStartAt);
    const windowEnd = new Date(input.deliveryWindowEndAt);
    const [settings, activeDriverCount] = await Promise.all([
      getDeliveryScheduleSettings(),
      getActiveDeliveryDriverCount(),
    ]);

    // Vérifier que la fenêtre est dans le futur
    if (windowEnd < now) {
      throw new Error("DELIVERY_WINDOW_PAST");
    }

    const { earliest, latest } = getBookingWindow(now);
    if (
      windowEnd <= earliest ||
      windowStart > latest ||
      (isSameLocalDay(windowStart, now) && now.getHours() >= DELIVERY_SAME_DAY_CUTOFF_HOUR)
    ) {
      throw new Error("DELIVERY_SLOT_OUTSIDE_BOOKING_WINDOW");
    }

    const period = getPeriodForWindow(windowStart, windowEnd, settings);
    if (!period) {
      throw new Error("DELIVERY_WINDOW_INVALID_PERIOD");
    }

    const dateKey = toDateKey(windowStart);
    const exception = await prismaLike.deliveryException.findUnique({ where: { dateKey } });
    if (exception?.isClosed) {
      throw new Error("DELIVERY_SLOT_CLOSED");
    }

    const effectiveCapacity = exception?.capacityOverride ?? computeCapacityPerBlock(settings, activeDriverCount);

    // Vérifier que la durée est correcte (2h)
    const duration = windowEnd.getTime() - windowStart.getTime();
    if (duration !== settings.blockMinutes * 60 * 1000) {
      throw new Error("DELIVERY_WINDOW_INVALID_DURATION");
    }

    // Compter combien de livraisons existent déjà sur cette plage
    const overlappingCount = await prismaLike.order.count({
      where: {
        AND: [
          { deliveryWindowStartAt: { lt: windowEnd } },
          { deliveryWindowEndAt: { gt: windowStart } },
          { status: { not: "CANCELLED" } },
          { paymentStatus: { not: "FAILED" } },
          ...(input.excludeOrderId ? [{ id: { not: input.excludeOrderId } }] : []),
        ]
      }
    });

    if (overlappingCount >= effectiveCapacity) {
      throw new Error("DELIVERY_WINDOW_FULL");
    }

    // ✅ Fenêtre valide
    return {
      deliverySlotId: null,
      deliveryWindowStartAt: windowStart,
      deliveryWindowEndAt: windowEnd,
      deliveryStatus: "SCHEDULED",
    };
  }

  // Comportement legacy pour anciens créneaux
  if (!deliverySlotId) {
    return {
      deliverySlotId: null,
      deliveryWindowStartAt: null,
      deliveryWindowEndAt: null,
      deliveryStatus: "UNSCHEDULED",
    };
  }

  const now = new Date();
  const slot = await prismaLike.deliverySlot.findUnique({ where: { id: deliverySlotId } });
  if (!slot) {
    throw new Error("DELIVERY_SLOT_NOT_FOUND");
  }
  if (!slot.isOpen) {
    throw new Error("DELIVERY_SLOT_CLOSED");
  }
  if (!isSlotBookableByPolicy(slot, now)) {
    throw new Error("DELIVERY_SLOT_OUTSIDE_BOOKING_WINDOW");
  }

  const dateKey = toDateKey(slot.startAt);
  const exception = await prismaLike.deliveryException.findUnique({ where: { dateKey } });
  if (exception?.isClosed) {
    throw new Error("DELIVERY_SLOT_CLOSED");
  }

  const effectiveCapacity = exception?.capacityOverride ?? slot.capacity;
  const reservedCount = await prismaLike.order.count({
    where: {
      deliverySlotId: slot.id,
      status: { not: "CANCELLED" },
      paymentStatus: { not: "FAILED" },
      ...(input.excludeOrderId ? { id: { not: input.excludeOrderId } } : {}),
    },
  });

  if (reservedCount >= effectiveCapacity) {
    throw new Error("DELIVERY_SLOT_FULL");
  }

  return {
    deliverySlotId: slot.id,
    deliveryWindowStartAt: slot.startAt,
    deliveryWindowEndAt: slot.endAt,
    deliveryStatus: "SCHEDULED",
  };
}
