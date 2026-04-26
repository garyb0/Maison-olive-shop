const requireAdminMock = vi.fn();
export {};

const transactionMock = vi.fn();
const findUniqueMock = vi.fn();
const updateMock = vi.fn();
const createAuditLogMock = vi.fn();
const resolveDeliverySelectionForOrderMock = vi.fn();

vi.mock("@/lib/permissions", () => ({
  requireAdmin: (...args: unknown[]) => requireAdminMock(...args),
}));

vi.mock("@/lib/delivery", () => ({
  resolveDeliverySelectionForOrder: (...args: unknown[]) => resolveDeliverySelectionForOrderMock(...args),
  toDateKey: (value: Date) => value.toISOString().slice(0, 10),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: (...args: unknown[]) => transactionMock(...args),
    order: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
      count: vi.fn(),
    },
    auditLog: {
      create: (...args: unknown[]) => createAuditLogMock(...args),
    },
  },
}));

vi.mock("@/lib/observability", () => ({
  logApiEvent: vi.fn(),
}));

describe("PATCH /api/admin/orders updates", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    requireAdminMock.mockResolvedValue({ id: "admin_1" });
    findUniqueMock.mockResolvedValue({
      id: "order_1",
      status: "PENDING",
      paymentStatus: "PENDING",
      deliveryStatus: "SCHEDULED",
      deliverySlotId: null,
      deliveryWindowStartAt: null,
      deliveryWindowEndAt: null,
      deliveryPhone: null,
      deliveryInstructions: null,
    });
    updateMock.mockResolvedValue({
      id: "order_1",
      status: "PENDING",
      paymentStatus: "PENDING",
      deliveryStatus: "OUT_FOR_DELIVERY",
      deliverySlotId: null,
      deliveryWindowStartAt: null,
      deliveryWindowEndAt: null,
      deliveryPhone: null,
      deliveryInstructions: null,
    });
    createAuditLogMock.mockResolvedValue({});
    transactionMock.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({
        order: {
          findUnique: findUniqueMock,
          update: updateMock,
        },
        auditLog: {
          create: createAuditLogMock,
        },
      }),
    );
  });

  it("met a jour le statut de livraison", async () => {
    const { PATCH } = await import("@/app/api/admin/orders/route");

    const req = new Request("http://localhost:3101/api/admin/orders", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        orderId: "order_1",
        deliveryStatus: "OUT_FOR_DELIVERY",
      }),
    });

    const res = await PATCH(req);
    const payload = (await res.json()) as { order?: { deliveryStatus: string } };

    expect(res.status).toBe(200);
    expect(payload.order?.deliveryStatus).toBe("OUT_FOR_DELIVERY");
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "order_1" },
        data: { deliveryStatus: "OUT_FOR_DELIVERY" },
      }),
    );
    expect(createAuditLogMock).toHaveBeenCalledTimes(1);
  });

  it("met a jour le statut de commande", async () => {
    updateMock.mockResolvedValueOnce({
      id: "order_1",
      status: "PROCESSING",
      paymentStatus: "PENDING",
      deliveryStatus: "SCHEDULED",
      deliverySlotId: null,
      deliveryWindowStartAt: null,
      deliveryWindowEndAt: null,
      deliveryPhone: null,
      deliveryInstructions: null,
    });

    const { PATCH } = await import("@/app/api/admin/orders/route");

    const req = new Request("http://localhost:3101/api/admin/orders", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        orderId: "order_1",
        status: "PROCESSING",
      }),
    });

    const res = await PATCH(req);
    const payload = (await res.json()) as { order?: { status: string } };

    expect(res.status).toBe(200);
    expect(payload.order?.status).toBe("PROCESSING");
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "order_1" },
        data: { status: "PROCESSING" },
      }),
    );
    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "ORDER_STATUS_UPDATED",
        }),
      }),
    );
  });

  it("met a jour le statut de paiement", async () => {
    updateMock.mockResolvedValueOnce({
      id: "order_1",
      status: "PENDING",
      paymentStatus: "PAID",
      deliveryStatus: "SCHEDULED",
      deliverySlotId: null,
      deliveryWindowStartAt: null,
      deliveryWindowEndAt: null,
      deliveryPhone: null,
      deliveryInstructions: null,
    });

    const { PATCH } = await import("@/app/api/admin/orders/route");

    const req = new Request("http://localhost:3101/api/admin/orders", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        orderId: "order_1",
        paymentStatus: "PAID",
      }),
    });

    const res = await PATCH(req);
    const payload = (await res.json()) as { order?: { paymentStatus: string } };

    expect(res.status).toBe(200);
    expect(payload.order?.paymentStatus).toBe("PAID");
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "order_1" },
        data: { paymentStatus: "PAID" },
      }),
    );
    expect(createAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "PAYMENT_STATUS_UPDATED",
        }),
      }),
    );
  });

  it("replanifie une commande sur un autre creneau", async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: "order_1",
      deliverySlotId: "slot_old",
      deliveryWindowStartAt: new Date("2026-04-10T08:00:00.000Z"),
      deliveryWindowEndAt: new Date("2026-04-10T10:00:00.000Z"),
      deliveryStatus: "SCHEDULED",
    });
    resolveDeliverySelectionForOrderMock.mockResolvedValueOnce({
      deliverySlotId: "slot_new",
      deliveryWindowStartAt: new Date("2026-04-11T10:00:00.000Z"),
      deliveryWindowEndAt: new Date("2026-04-11T12:00:00.000Z"),
      deliveryStatus: "SCHEDULED",
    });
    updateMock.mockResolvedValueOnce({
      id: "order_1",
      deliverySlotId: "slot_new",
      deliveryWindowStartAt: new Date("2026-04-11T10:00:00.000Z"),
      deliveryWindowEndAt: new Date("2026-04-11T12:00:00.000Z"),
      deliveryStatus: "RESCHEDULED",
    });

    const { PATCH } = await import("@/app/api/admin/orders/route");

    const req = new Request("http://localhost:3101/api/admin/orders", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        orderId: "order_1",
        deliverySlotId: "slot_new",
      }),
    });

    const res = await PATCH(req);
    const payload = (await res.json()) as {
      order?: { deliverySlotId: string | null; deliveryStatus: string; dateKey: string | null };
    };

    expect(res.status).toBe(200);
    expect(resolveDeliverySelectionForOrderMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        deliverySlotId: "slot_new",
        excludeOrderId: "order_1",
      }),
    );
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "order_1" },
        data: expect.objectContaining({
          deliverySlotId: "slot_new",
          deliveryStatus: "RESCHEDULED",
        }),
      }),
    );
    expect(payload.order).toEqual(
      expect.objectContaining({
        deliverySlotId: "slot_new",
        deliveryStatus: "RESCHEDULED",
        dateKey: "2026-04-11",
      }),
    );
    expect(createAuditLogMock).toHaveBeenCalledTimes(1);
  });

  it("retourne 400 quand le payload est invalide", async () => {
    const { PATCH } = await import("@/app/api/admin/orders/route");

    const req = new Request("http://localhost:3101/api/admin/orders", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        orderId: "",
        deliveryStatus: "NOT_A_STATUS",
      }),
    });

    const res = await PATCH(req);
    const payload = (await res.json()) as { error?: string };

    expect(res.status).toBe(400);
    expect(payload.error).toBe("Invalid payload");
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("retourne 404 quand la commande est introuvable", async () => {
    findUniqueMock.mockResolvedValueOnce(null);

    const { PATCH } = await import("@/app/api/admin/orders/route");

    const req = new Request("http://localhost:3101/api/admin/orders", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        orderId: "missing_order",
        status: "PROCESSING",
      }),
    });

    const res = await PATCH(req);
    const payload = (await res.json()) as { error?: string };

    expect(res.status).toBe(404);
    expect(payload.error).toBe("Order not found");
  });
});
