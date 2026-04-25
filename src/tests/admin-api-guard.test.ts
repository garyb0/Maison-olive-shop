export {};

const requireAdminMock = vi.fn();
const getAdminProductsMock = vi.fn();
const getAdminDogProfilesMock = vi.fn();
const getAdminCustomersMock = vi.fn();
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

vi.mock("@/lib/observability", () => ({
  logApiEvent: (...args: unknown[]) => logApiEventMock(...args),
}));

describe("protections des routes admin", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
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
});
