export {};

const requireAdminMock = vi.fn();
const getAdminInventorySnapshotExportMock = vi.fn();
const getAdminInventoryMovementExportMock = vi.fn();
const inventorySnapshotToCsvMock = vi.fn();
const inventoryMovementsToCsvMock = vi.fn();

vi.mock("@/lib/permissions", () => ({
  requireAdmin: (...args: unknown[]) => requireAdminMock(...args),
}));

vi.mock("@/lib/admin", () => ({
  getAdminInventorySnapshotExport: (...args: unknown[]) => getAdminInventorySnapshotExportMock(...args),
  getAdminInventoryMovementExport: (...args: unknown[]) => getAdminInventoryMovementExportMock(...args),
  inventorySnapshotToCsv: (...args: unknown[]) => inventorySnapshotToCsvMock(...args),
  inventoryMovementsToCsv: (...args: unknown[]) => inventoryMovementsToCsvMock(...args),
}));

vi.mock("@/lib/observability", () => ({
  logApiEvent: vi.fn(),
}));

describe("GET /api/admin/inventory/export", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireAdminMock.mockResolvedValue({ id: "admin_1" });
    getAdminInventorySnapshotExportMock.mockResolvedValue([{ sku: "SKU-1" }]);
    getAdminInventoryMovementExportMock.mockResolvedValue([{ id: "move_1" }]);
    inventorySnapshotToCsvMock.mockReturnValue('"sku"\n"SKU-1"');
    inventoryMovementsToCsvMock.mockReturnValue('"sku"\n"SKU-1"');
  });

  it("returns the snapshot CSV by default", async () => {
    const { GET } = await import("@/app/api/admin/inventory/export/route");

    const response = await GET(new Request("http://localhost:3101/api/admin/inventory/export"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/csv");
    expect(response.headers.get("Content-Disposition")).toContain("inventory-snapshot.csv");
    expect(await response.text()).toContain("SKU-1");
  });

  it("returns the movements CSV when requested", async () => {
    const { GET } = await import("@/app/api/admin/inventory/export/route");

    const response = await GET(new Request("http://localhost:3101/api/admin/inventory/export?view=movements"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toContain("inventory-movements.csv");
    expect(getAdminInventoryMovementExportMock).toHaveBeenCalledTimes(1);
  });

  it("rejects non-admin users", async () => {
    requireAdminMock.mockRejectedValueOnce(new Error("UNAUTHORIZED"));
    const { GET } = await import("@/app/api/admin/inventory/export/route");

    const response = await GET(new Request("http://localhost:3101/api/admin/inventory/export"));

    expect(response.status).toBe(401);
    expect(getAdminInventorySnapshotExportMock).not.toHaveBeenCalled();
  });
});
