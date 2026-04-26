export {};

const requireAdminMock = vi.fn();
const getAdminProductsMock = vi.fn();
const getAdminDogProfilesMock = vi.fn();
const getAdminCustomersMock = vi.fn();
const getDeliveryScheduleSettingsMock = vi.fn();
const updateDeliveryScheduleSettingsMock = vi.fn();
const getActiveDeliveryDriverCountMock = vi.fn();
const logApiEventMock = vi.fn();

vi.mock("@/lib/permissions", () => ({
  requireAdmin: (...args: unknown[]) => requireAdminMock(...args),
}));

vi.mock("@/lib/admin", () => ({
  getAdminProducts: (...args: unknown[]) => getAdminProductsMock(...args),
  getAdminCustomers: (...args: unknown[]) => getAdminCustomersMock(...args),
}));

vi.mock("@/lib/dogs", () => ({
  AdminDogProfileNotFoundError: class AdminDogProfileNotFoundError extends Error {},
  getAdminDogProfiles: (...args: unknown[]) => getAdminDogProfilesMock(...args),
  createAdminDogTokenBatch: vi.fn(),
  updateDogProfileByAdmin: vi.fn(),
}));

vi.mock("@/lib/delivery", () => ({
  getDeliveryScheduleSettings: (...args: unknown[]) => getDeliveryScheduleSettingsMock(...args),
  updateDeliveryScheduleSettings: (...args: unknown[]) => updateDeliveryScheduleSettingsMock(...args),
  getActiveDeliveryDriverCount: (...args: unknown[]) => getActiveDeliveryDriverCountMock(...args),
}));

vi.mock("@/lib/observability", () => ({
  logApiEvent: (...args: unknown[]) => logApiEventMock(...args),
}));

describe("protections des routes admin", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireAdminMock.mockResolvedValue({ id: "admin_1", role: "ADMIN" });
  });

  it("refuse la liste produits quand le user n'est pas admin", async () => {
    requireAdminMock.mockRejectedValue(new Error("FORBIDDEN"));

    const { GET } = await import("@/app/api/admin/products/route");
    const res = await GET();

    expect(res.status).toBe(403);
    expect(getAdminProductsMock).not.toHaveBeenCalled();
  });

  it("refuse les tokens chiens QR quand le user n'est pas admin", async () => {
    requireAdminMock.mockRejectedValue(new Error("FORBIDDEN"));

    const { GET } = await import("@/app/api/admin/dogs/route");
    const res = await GET();

    expect(res.status).toBe(403);
    expect(getAdminDogProfilesMock).not.toHaveBeenCalled();
  });

  it("refuse les clients admin quand aucune session n'est presente", async () => {
    requireAdminMock.mockRejectedValue(new Error("UNAUTHORIZED"));

    const { GET } = await import("@/app/api/admin/customers/route");
    const req = new Request("http://localhost:3101/api/admin/customers");
    const res = await GET(req);

    expect(res.status).toBe(401);
    expect(getAdminCustomersMock).not.toHaveBeenCalled();
  });

  it("retourne les reglages de planification livraison", async () => {
    const settings = {
      id: "default",
      averageDeliveryMinutes: 30,
      blockMinutes: 60,
      amEnabled: true,
      amStartMinute: 540,
      amEndMinute: 720,
      pmEnabled: true,
      pmStartMinute: 780,
      pmEndMinute: 1020,
      capacityMode: "ACTIVE_DRIVERS",
      createdAt: null,
      updatedAt: null,
    };
    getDeliveryScheduleSettingsMock.mockResolvedValue(settings);
    getActiveDeliveryDriverCountMock.mockResolvedValue(2);

    const { GET } = await import("@/app/api/admin/delivery/settings/route");
    const res = await GET();
    const payload = (await res.json()) as { settings?: typeof settings; activeDriverCount?: number };

    expect(res.status).toBe(200);
    expect(payload.settings).toEqual(settings);
    expect(payload.activeDriverCount).toBe(2);
  });

  it("met a jour les reglages de planification livraison", async () => {
    const settings = {
      id: "default",
      averageDeliveryMinutes: 25,
      blockMinutes: 60,
      amEnabled: true,
      amStartMinute: 540,
      amEndMinute: 720,
      pmEnabled: true,
      pmStartMinute: 780,
      pmEndMinute: 1020,
      capacityMode: "ACTIVE_DRIVERS",
      createdAt: null,
      updatedAt: null,
    };
    updateDeliveryScheduleSettingsMock.mockResolvedValue(settings);
    getActiveDeliveryDriverCountMock.mockResolvedValue(1);

    const { PATCH } = await import("@/app/api/admin/delivery/settings/route");
    const res = await PATCH(
      new Request("http://localhost:3101/api/admin/delivery/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          averageDeliveryMinutes: 25,
          blockMinutes: 60,
          amEnabled: true,
          amStartMinute: 540,
          amEndMinute: 720,
          pmEnabled: true,
          pmStartMinute: 780,
          pmEndMinute: 1020,
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(updateDeliveryScheduleSettingsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        averageDeliveryMinutes: 25,
        blockMinutes: 60,
      }),
    );
  });
});
