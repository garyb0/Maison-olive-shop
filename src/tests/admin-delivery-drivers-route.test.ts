export {};

const requireAdminMock = vi.fn();
const listDeliveryDriversMock = vi.fn();
const createDeliveryDriverMock = vi.fn();
const updateDeliveryDriverMock = vi.fn();
const deleteDeliveryDriverMock = vi.fn();

vi.mock("@/lib/permissions", () => ({
  requireAdmin: (...args: unknown[]) => requireAdminMock(...args),
}));

vi.mock("@/lib/delivery-runs", () => ({
  listDeliveryDrivers: (...args: unknown[]) => listDeliveryDriversMock(...args),
  createDeliveryDriver: (...args: unknown[]) => createDeliveryDriverMock(...args),
  updateDeliveryDriver: (...args: unknown[]) => updateDeliveryDriverMock(...args),
  deleteDeliveryDriver: (...args: unknown[]) => deleteDeliveryDriverMock(...args),
  mapDeliveryRunError: (error: unknown) => ({
    message: error instanceof Error ? error.message : "error",
    status: error instanceof Error && error.message === "DELIVERY_DRIVER_HAS_RUNS" ? 409 : 500,
  }),
}));

describe("admin delivery driver routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireAdminMock.mockResolvedValue({ id: "admin_1" });
  });

  it("liste les chauffeurs", async () => {
    listDeliveryDriversMock.mockResolvedValueOnce([{ id: "driver_1" }]);
    const { GET } = await import("@/app/api/admin/delivery/drivers/route");

    const response = await GET();
    const payload = (await response.json()) as { drivers?: Array<{ id: string }> };

    expect(response.status).toBe(200);
    expect(payload.drivers?.[0]?.id).toBe("driver_1");
  });

  it("cree un chauffeur", async () => {
    createDeliveryDriverMock.mockResolvedValueOnce({ id: "driver_2" });
    const { POST } = await import("@/app/api/admin/delivery/drivers/route");

    const response = await POST(
      new Request("http://localhost:3101/api/admin/delivery/drivers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Chauffeur 2",
          phone: "4185550002",
          isActive: true,
        }),
      }),
    );
    const payload = (await response.json()) as { driver?: { id: string } };

    expect(response.status).toBe(200);
    expect(payload.driver?.id).toBe("driver_2");
    expect(createDeliveryDriverMock).toHaveBeenCalledWith({
      name: "Chauffeur 2",
      phone: "4185550002",
      isActive: true,
      actorUserId: "admin_1",
    });
  });

  it("met a jour un chauffeur", async () => {
    updateDeliveryDriverMock.mockResolvedValueOnce({ id: "driver_2", isActive: false });
    const { PATCH } = await import("@/app/api/admin/delivery/drivers/[driverId]/route");

    const response = await PATCH(
      new Request("http://localhost:3101/api/admin/delivery/drivers/driver_2", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Chauffeur archive",
          isActive: false,
        }),
      }),
      { params: Promise.resolve({ driverId: "driver_2" }) },
    );
    const payload = (await response.json()) as { driver?: { id: string; isActive: boolean } };

    expect(response.status).toBe(200);
    expect(payload.driver).toEqual(
      expect.objectContaining({
        id: "driver_2",
        isActive: false,
      }),
    );
    expect(updateDeliveryDriverMock).toHaveBeenCalledWith({
      driverId: "driver_2",
      name: "Chauffeur archive",
      isActive: false,
      actorUserId: "admin_1",
    });
  });

  it("supprime un chauffeur", async () => {
    deleteDeliveryDriverMock.mockResolvedValueOnce(undefined);
    const { DELETE } = await import("@/app/api/admin/delivery/drivers/[driverId]/route");

    const response = await DELETE(
      new Request("http://localhost:3101/api/admin/delivery/drivers/driver_2", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ driverId: "driver_2" }) },
    );
    const payload = (await response.json()) as { deleted?: boolean };

    expect(response.status).toBe(200);
    expect(payload.deleted).toBe(true);
    expect(deleteDeliveryDriverMock).toHaveBeenCalledWith({
      driverId: "driver_2",
      actorUserId: "admin_1",
    });
  });

  it("remonte le conflit si un chauffeur a deja des tournees", async () => {
    deleteDeliveryDriverMock.mockRejectedValueOnce(new Error("DELIVERY_DRIVER_HAS_RUNS"));
    const { DELETE } = await import("@/app/api/admin/delivery/drivers/[driverId]/route");

    const response = await DELETE(
      new Request("http://localhost:3101/api/admin/delivery/drivers/driver_2", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ driverId: "driver_2" }) },
    );
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(409);
    expect(payload.error).toBe("DELIVERY_DRIVER_HAS_RUNS");
  });
});
