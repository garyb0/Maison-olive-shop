export {};

const requireAdminMock = vi.fn();
const getAdminDeliverySlotsMock = vi.fn();
const createAdminDeliverySlotMock = vi.fn();
const updateAdminDeliverySlotMock = vi.fn();
const deleteAdminDeliverySlotMock = vi.fn();
const upsertAdminDeliveryExceptionMock = vi.fn();
const deleteAdminDeliveryExceptionMock = vi.fn();

vi.mock("@/lib/permissions", () => ({
  requireAdmin: (...args: unknown[]) => requireAdminMock(...args),
}));

vi.mock("@/lib/delivery", () => ({
  getAdminDeliverySlots: (...args: unknown[]) => getAdminDeliverySlotsMock(...args),
  createAdminDeliverySlot: (...args: unknown[]) => createAdminDeliverySlotMock(...args),
  updateAdminDeliverySlot: (...args: unknown[]) => updateAdminDeliverySlotMock(...args),
  deleteAdminDeliverySlot: (...args: unknown[]) => deleteAdminDeliverySlotMock(...args),
  upsertAdminDeliveryException: (...args: unknown[]) => upsertAdminDeliveryExceptionMock(...args),
  deleteAdminDeliveryException: (...args: unknown[]) => deleteAdminDeliveryExceptionMock(...args),
}));

describe("admin delivery planner route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireAdminMock.mockResolvedValue({ id: "admin_1" });
  });

  it("liste les creneaux admin avec bornes de date", async () => {
    getAdminDeliverySlotsMock.mockResolvedValueOnce([{ id: "slot_1" }]);
    const { GET } = await import("@/app/api/admin/delivery/route");

    const response = await GET(
      new Request(
        "http://localhost:3101/api/admin/delivery?from=2026-04-23T00:00:00.000Z&to=2026-04-24T23:59:59.999Z",
      ),
    );
    const payload = (await response.json()) as { slots?: Array<{ id: string }> };

    expect(response.status).toBe(200);
    expect(payload.slots?.[0]?.id).toBe("slot_1");
    expect(getAdminDeliverySlotsMock).toHaveBeenCalledWith({
      from: new Date("2026-04-23T00:00:00.000Z"),
      to: new Date("2026-04-24T23:59:59.999Z"),
    });
  });

  it("cree un creneau admin", async () => {
    createAdminDeliverySlotMock.mockResolvedValueOnce({ id: "slot_2" });
    const { POST } = await import("@/app/api/admin/delivery/route");

    const response = await POST(
      new Request("http://localhost:3101/api/admin/delivery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          startAt: "2026-04-24T10:00:00.000Z",
          endAt: "2026-04-24T12:00:00.000Z",
          capacity: 6,
          isOpen: true,
          note: "Route nord",
        }),
      }),
    );
    const payload = (await response.json()) as { slot?: { id: string } };

    expect(response.status).toBe(200);
    expect(payload.slot?.id).toBe("slot_2");
    expect(createAdminDeliverySlotMock).toHaveBeenCalledWith(
      expect.objectContaining({
        startAt: new Date("2026-04-24T10:00:00.000Z"),
        endAt: new Date("2026-04-24T12:00:00.000Z"),
        capacity: 6,
        isOpen: true,
        note: "Route nord",
      }),
    );
  });

  it("cree ou met a jour une exception de livraison", async () => {
    upsertAdminDeliveryExceptionMock.mockResolvedValueOnce({ dateKey: "2026-04-24", isClosed: true });
    const { POST } = await import("@/app/api/admin/delivery/route");

    const response = await POST(
      new Request("http://localhost:3101/api/admin/delivery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          dateKey: "2026-04-24",
          isClosed: true,
          reason: "Jour ferme",
        }),
      }),
    );
    const payload = (await response.json()) as { exception?: { dateKey: string } };

    expect(response.status).toBe(200);
    expect(payload.exception?.dateKey).toBe("2026-04-24");
    expect(upsertAdminDeliveryExceptionMock).toHaveBeenCalledWith({
      dateKey: "2026-04-24",
      isClosed: true,
      reason: "Jour ferme",
    });
  });

  it("met a jour un creneau admin", async () => {
    updateAdminDeliverySlotMock.mockResolvedValueOnce({ id: "slot_2", capacity: 8 });
    const { PATCH } = await import("@/app/api/admin/delivery/route");

    const response = await PATCH(
      new Request("http://localhost:3101/api/admin/delivery", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: "slot_2",
          capacity: 8,
          note: "Capacite revue",
        }),
      }),
    );
    const payload = (await response.json()) as { slot?: { id: string; capacity: number } };

    expect(response.status).toBe(200);
    expect(payload.slot).toEqual(
      expect.objectContaining({
        id: "slot_2",
        capacity: 8,
      }),
    );
    expect(updateAdminDeliverySlotMock).toHaveBeenCalledWith({
      id: "slot_2",
      capacity: 8,
      note: "Capacite revue",
    });
  });

  it("supprime un creneau admin", async () => {
    deleteAdminDeliverySlotMock.mockResolvedValueOnce({ id: "slot_2" });
    const { DELETE } = await import("@/app/api/admin/delivery/route");

    const response = await DELETE(
      new Request("http://localhost:3101/api/admin/delivery", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: "slot_2" }),
      }),
    );
    const payload = (await response.json()) as { deleted?: boolean; id?: string };

    expect(response.status).toBe(200);
    expect(payload.deleted).toBe(true);
    expect(payload.id).toBe("slot_2");
    expect(deleteAdminDeliverySlotMock).toHaveBeenCalledWith({ id: "slot_2" });
  });

  it("supprime une exception de livraison", async () => {
    deleteAdminDeliveryExceptionMock.mockResolvedValueOnce({ dateKey: "2026-04-24" });
    const { DELETE } = await import("@/app/api/admin/delivery/route");

    const response = await DELETE(
      new Request("http://localhost:3101/api/admin/delivery", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dateKey: "2026-04-24" }),
      }),
    );
    const payload = (await response.json()) as { deleted?: boolean; dateKey?: string };

    expect(response.status).toBe(200);
    expect(payload.deleted).toBe(true);
    expect(payload.dateKey).toBe("2026-04-24");
    expect(deleteAdminDeliveryExceptionMock).toHaveBeenCalledWith({ dateKey: "2026-04-24" });
  });

  it("retourne 503 quand le schema livraison est indisponible", async () => {
    createAdminDeliverySlotMock.mockRejectedValueOnce(new Error("DELIVERY_SCHEMA_UNAVAILABLE"));
    const { POST } = await import("@/app/api/admin/delivery/route");

    const response = await POST(
      new Request("http://localhost:3101/api/admin/delivery", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          startAt: "2026-04-24T10:00:00.000Z",
          endAt: "2026-04-24T12:00:00.000Z",
          capacity: 6,
        }),
      }),
    );
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(payload.error).toBe("Schema livraison non initialise. Execute la migration Prisma.");
  });
});
