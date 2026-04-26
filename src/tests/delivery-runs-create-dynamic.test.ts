export {};

const { prismaMock, txMock } = vi.hoisted(() => {
  const tx = {
    order: {
      updateMany: vi.fn(),
    },
    deliveryRun: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  };

  return {
    txMock: tx,
    prismaMock: {
      $queryRaw: vi.fn(),
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
      deliverySlot: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      deliveryException: {
        findMany: vi.fn(),
      },
      order: {
        findMany: vi.fn(),
      },
      driver: {
        findUnique: vi.fn(),
        count: vi.fn(),
      },
      deliveryRun: {
        findUnique: vi.fn(),
      },
    },
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/lib/env", () => ({
  env: {
    deliveryExperimentalRoutingEnabled: true,
    deliveryGpsTrackingEnabled: true,
    siteUrl: "http://localhost:3101",
    googleMapsApiKey: "",
    deliveryDepotLabel: "Depot",
    deliveryDepotLine1: "22 Rue de l'Etang",
    deliveryDepotCity: "Rimouski",
    deliveryDepotRegion: "QC",
    deliveryDepotPostal: "G0L 1B0",
    deliveryDepotCountry: "CA",
  },
}));

const deliveryRunTables = [
  { name: "Driver" },
  { name: "DeliveryRun" },
  { name: "DeliveryStop" },
  { name: "DeliveryRunAccessToken" },
  { name: "DeliveryGpsSample" },
  { name: "GeocodedAddressCache" },
  { name: "DeliverySlot" },
  { name: "DeliveryException" },
];

const createdAt = new Date("2026-04-24T20:00:00.000Z");
const startAt = new Date("2026-04-25T12:00:00.000Z");
const endAt = new Date("2026-04-25T14:00:00.000Z");

function buildRunDetail() {
  const driver = {
    id: "driver_1",
    name: "Gary",
    phone: null,
    isActive: true,
    createdAt,
    updatedAt: createdAt,
  };
  const deliverySlot = {
    id: "slot_dynamic",
    startAt,
    endAt,
    capacity: 2,
    isOpen: true,
    note: "Dynamic delivery window",
    createdAt,
    updatedAt: createdAt,
  };

  return {
    id: "run_1",
    deliverySlotId: "slot_dynamic",
    driverId: "driver_1",
    status: "DRAFT",
    dateKey: "2026-04-25",
    includeReturnToDepot: true,
    plannedKm: null,
    plannedDurationSec: null,
    actualKmGps: null,
    actualKmOdometer: null,
    actualKmFinal: null,
    actualKmSource: null,
    odometerStartKm: null,
    odometerEndKm: null,
    note: null,
    startedAt: null,
    completedAt: null,
    publishedAt: null,
    createdAt,
    updatedAt: createdAt,
    driver,
    deliverySlot,
    accessTokens: [],
    _count: { gpsSamples: 0 },
    stops: ["order_1", "order_2"].map((orderId, index) => ({
      id: `stop_${index + 1}`,
      runId: "run_1",
      orderId,
      plannedSequence: index + 1,
      manualSequence: null,
      finalSequence: index + 1,
      status: "PENDING",
      plannedLegKm: null,
      plannedCumulativeKm: null,
      plannedLegDurationSec: null,
      plannedEta: null,
      actualCumulativeKmAtStop: null,
      arrivedAt: null,
      completedAt: null,
      note: null,
      createdAt,
      updatedAt: createdAt,
      order: {
        id: orderId,
        orderNumber: `MO-${index + 1}`,
        customerName: "Client test",
        deliveryPhone: null,
        deliveryInstructions: null,
        shippingLine1: `${index + 1} Rue Test`,
        shippingCity: "Rimouski",
        shippingRegion: "QC",
        shippingPostal: "G0L 1B0",
        shippingCountry: "CA",
        deliveryStatus: "SCHEDULED",
      },
    })),
  };
}

describe("delivery run dynamic windows", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    prismaMock.$queryRaw.mockResolvedValue(deliveryRunTables);
    prismaMock.driver.count.mockResolvedValue(1);
  });

  it("expose les commandes a fenetre dynamique comme creneaux de tournee admin", async () => {
    prismaMock.deliverySlot.findMany.mockResolvedValueOnce([]);
    prismaMock.order.findMany.mockResolvedValueOnce([
      { deliveryWindowStartAt: startAt, deliveryWindowEndAt: endAt },
      { deliveryWindowStartAt: startAt, deliveryWindowEndAt: endAt },
    ]);

    const { getAdminDeliveryRunSlots } = await import("@/lib/delivery");
    const slots = await getAdminDeliveryRunSlots({
      from: new Date("2026-04-25T00:00:00.000Z"),
      to: new Date("2026-04-25T23:59:59.999Z"),
    });

    expect(slots).toHaveLength(1);
    expect(slots[0]).toEqual(
      expect.objectContaining({
        id: "dynamic:2026-04-25T12:00:00.000Z|2026-04-25T14:00:00.000Z",
        capacity: 2,
        reservedCount: 2,
        remainingCapacity: 0,
      }),
    );
  });

  it("genere 3 blocs AM et 4 blocs PM avec une capacite de 2 par chauffeur actif", async () => {
    prismaMock.driver.count.mockResolvedValueOnce(1);
    prismaMock.order.findMany.mockResolvedValueOnce([]);
    prismaMock.deliveryException.findMany.mockResolvedValueOnce([]);

    const { getDynamicDeliveryWindows } = await import("@/lib/delivery");
    const windows = await getDynamicDeliveryWindows({
      postalCode: "G5L 1A1",
      country: "CA",
      from: new Date(2026, 3, 25, 0, 0, 0),
      to: new Date(2026, 3, 25, 23, 59, 59),
      now: new Date(2026, 3, 24, 8, 0, 0),
    });

    expect(windows.filter((slot) => slot.periodKey === "AM")).toHaveLength(3);
    expect(windows.filter((slot) => slot.periodKey === "PM")).toHaveLength(4);
    expect(windows.every((slot) => slot.capacity === 2 && slot.remainingSpots === 2)).toBe(true);
  });

  it("augmente la capacite de bloc quand deux chauffeurs sont actifs", async () => {
    prismaMock.driver.count.mockResolvedValueOnce(2);
    prismaMock.order.findMany.mockResolvedValueOnce([]);
    prismaMock.deliveryException.findMany.mockResolvedValueOnce([]);

    const { getDynamicDeliveryWindows } = await import("@/lib/delivery");
    const windows = await getDynamicDeliveryWindows({
      postalCode: "G5L 1A1",
      country: "CA",
      from: new Date(2026, 3, 25, 0, 0, 0),
      to: new Date(2026, 3, 25, 23, 59, 59),
      now: new Date(2026, 3, 24, 8, 0, 0),
    });

    expect(windows).toHaveLength(7);
    expect(windows.every((slot) => slot.capacity === 4 && slot.remainingSpots === 4)).toBe(true);
  });

  it("masque une periode au checkout quand tous ses blocs internes sont pleins", async () => {
    const day = new Date(2026, 3, 25, 0, 0, 0);
    const fullAmDeliveries = [9, 10, 11].flatMap((hour) => {
      const deliveryWindowStartAt = new Date(day);
      deliveryWindowStartAt.setHours(hour, 0, 0, 0);
      const deliveryWindowEndAt = new Date(deliveryWindowStartAt);
      deliveryWindowEndAt.setHours(hour + 1, 0, 0, 0);
      return [
        { deliveryWindowStartAt, deliveryWindowEndAt },
        { deliveryWindowStartAt, deliveryWindowEndAt },
      ];
    });

    prismaMock.driver.count.mockResolvedValue(1);
    prismaMock.order.findMany.mockResolvedValueOnce(fullAmDeliveries);
    prismaMock.deliveryException.findMany.mockResolvedValueOnce([]);

    const { getCheckoutDeliverySlots } = await import("@/lib/delivery");
    const result = await getCheckoutDeliverySlots({
      mode: "dynamic",
      postalCode: "G5L 1A1",
      country: "CA",
      from: new Date(2026, 3, 25, 0, 0, 0),
      to: new Date(2026, 3, 25, 23, 59, 59),
      now: new Date(2026, 3, 24, 8, 0, 0),
    });

    expect(result.slots).toHaveLength(4);
    expect(new Set(result.slots.map((slot) => slot.periodKey))).toEqual(new Set(["PM"]));
  });

  it("cree une tournee depuis une fenetre dynamique et rattache les commandes au slot cree", async () => {
    prismaMock.deliverySlot.findFirst.mockResolvedValueOnce(null);
    prismaMock.driver.findUnique.mockResolvedValueOnce({
      id: "driver_1",
      name: "Gary",
      phone: null,
      isActive: true,
      createdAt,
      updatedAt: createdAt,
    });
    prismaMock.deliverySlot.create.mockResolvedValueOnce({
      id: "slot_dynamic",
      startAt,
      endAt,
      capacity: 2,
      isOpen: true,
      note: "Dynamic delivery window",
      createdAt,
      updatedAt: createdAt,
    });
    prismaMock.order.findMany.mockResolvedValueOnce([{ id: "order_1" }, { id: "order_2" }]);
    txMock.order.updateMany.mockResolvedValueOnce({ count: 2 });
    txMock.deliveryRun.create.mockResolvedValueOnce(buildRunDetail());
    txMock.auditLog.create.mockResolvedValueOnce({});

    const { createDeliveryRun } = await import("@/lib/delivery-runs");
    const result = await createDeliveryRun({
      deliverySlotId: "dynamic:2026-04-25T12:00:00.000Z|2026-04-25T14:00:00.000Z",
      driverId: "driver_1",
      actorUserId: "admin_1",
    });

    expect(prismaMock.deliverySlot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        startAt,
        endAt,
        capacity: 2,
      }),
    });
    expect(prismaMock.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { deliverySlotId: "slot_dynamic" },
            {
              deliverySlotId: null,
              deliveryWindowStartAt: startAt,
              deliveryWindowEndAt: endAt,
            },
          ]),
        }),
      }),
    );
    expect(txMock.order.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["order_1", "order_2"] },
        deliverySlotId: null,
      },
      data: {
        deliverySlotId: "slot_dynamic",
      },
    });
    expect(result.reusedExisting).toBe(false);
    expect(result.run.stopCounts.total).toBe(2);
  });
});
