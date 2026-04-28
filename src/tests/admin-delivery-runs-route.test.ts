export {};

const requireAdminMock = vi.fn();
const listDeliveryRunsByDateMock = vi.fn();
const createDeliveryRunMock = vi.fn();

vi.mock("@/lib/permissions", () => ({
  requireAdmin: (...args: unknown[]) => requireAdminMock(...args),
}));

vi.mock("@/lib/delivery-runs", () => ({
  listDeliveryRunsByDate: (...args: unknown[]) => listDeliveryRunsByDateMock(...args),
  createDeliveryRun: (...args: unknown[]) => createDeliveryRunMock(...args),
  mapDeliveryRunError: (error: unknown) => ({
    message: error instanceof Error ? error.message : "error",
    status: 500,
  }),
}));

describe("admin delivery runs route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireAdminMock.mockResolvedValue({ id: "admin_1" });
  });

  it("liste les tournees par date", async () => {
    listDeliveryRunsByDateMock.mockResolvedValueOnce([{ id: "run_1" }]);
    const { GET } = await import("@/app/api/admin/delivery/runs/route");
    const response = await GET(new Request("http://localhost:3101/api/admin/delivery/runs?date=2026-04-23"));
    const payload = (await response.json()) as { runs?: Array<{ id: string }> };

    expect(response.status).toBe(200);
    expect(payload.runs?.[0]?.id).toBe("run_1");
    expect(listDeliveryRunsByDateMock).toHaveBeenCalledWith("2026-04-23");
  });

  it("cree une nouvelle tournee", async () => {
    createDeliveryRunMock.mockResolvedValueOnce({
      run: { id: "run_2" },
      reusedExisting: false,
    });
    const { POST } = await import("@/app/api/admin/delivery/runs/route");
    const response = await POST(
      new Request("http://localhost:3101/api/admin/delivery/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          deliverySlotId: "slot_1",
          driverId: "driver_1",
          includeReturnToDepot: true,
        }),
      }),
    );
    const payload = (await response.json()) as { run?: { id: string } };

    expect(response.status).toBe(200);
    expect(payload.run?.id).toBe("run_2");
    expect(createDeliveryRunMock).toHaveBeenCalledWith(
      expect.objectContaining({
        deliverySlotId: "slot_1",
        driverId: "driver_1",
        actorUserId: "admin_1",
      }),
    );
  });
});
