export {};

const requireAdminMock = vi.fn();
const getAdminDogProfilesMock = vi.fn();
const updateDogProfileByAdminMock = vi.fn();
const createAdminDogTokenBatchMock = vi.fn();

vi.mock("@/lib/permissions", () => ({
  requireAdmin: (...args: unknown[]) => requireAdminMock(...args),
}));

vi.mock("@/lib/dogs", async () => {
  const actual = await vi.importActual<typeof import("@/lib/dogs")>("@/lib/dogs");
  return {
    ...actual,
    getAdminDogProfiles: (...args: unknown[]) => getAdminDogProfilesMock(...args),
    updateDogProfileByAdmin: (...args: unknown[]) => updateDogProfileByAdminMock(...args),
    createAdminDogTokenBatch: (...args: unknown[]) => createAdminDogTokenBatchMock(...args),
  };
});

describe("admin dog QR route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireAdminMock.mockResolvedValue({ id: "admin_1" });
  });

  it("retourne les tokens QR admin", async () => {
    getAdminDogProfilesMock.mockResolvedValue([{ id: "dog_1", publicToken: "dog-token-001" }]);

    const { GET } = await import("@/app/api/admin/dogs/route");
    const response = await GET();
    const payload = (await response.json()) as { dogs?: Array<{ publicToken: string }> };

    expect(response.status).toBe(200);
    expect(payload.dogs?.[0]?.publicToken).toBe("dog-token-001");
  });

  it("libere un token reclame", async () => {
    updateDogProfileByAdminMock.mockResolvedValue({
      id: "dog_1",
      publicToken: "dog-token-001",
      userId: null,
      name: null,
      isActive: true,
    });

    const { PATCH } = await import("@/app/api/admin/dogs/route");
    const request = new Request("http://localhost:3101/api/admin/dogs", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        dogId: "dog_1",
        releaseClaim: true,
      }),
    });

    const response = await PATCH(request);
    const payload = (await response.json()) as { dog?: { userId: string | null } };

    expect(response.status).toBe(200);
    expect(payload.dog?.userId).toBeNull();
    expect(updateDogProfileByAdminMock).toHaveBeenCalledWith(
      "dog_1",
      expect.objectContaining({ releaseClaim: true }),
      "admin_1",
    );
  });

  it("retourne 400 si le payload est invalide", async () => {
    const { PATCH } = await import("@/app/api/admin/dogs/route");
    const request = new Request("http://localhost:3101/api/admin/dogs", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        dogId: "",
      }),
    });

    const response = await PATCH(request);
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid payload");
    expect(updateDogProfileByAdminMock).not.toHaveBeenCalled();
  });

  it("cree un lot de tokens QR", async () => {
    createAdminDogTokenBatchMock.mockResolvedValue([
      { id: "dog_1", publicToken: "dog-token-001" },
      { id: "dog_2", publicToken: "dog-token-002" },
    ]);

    const { POST } = await import("@/app/api/admin/dogs/route");
    const request = new Request("http://localhost:3101/api/admin/dogs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ count: 2 }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { dogs?: Array<{ publicToken: string }> };

    expect(response.status).toBe(200);
    expect(payload.dogs).toHaveLength(2);
    expect(createAdminDogTokenBatchMock).toHaveBeenCalledWith(2, "admin_1");
  });
});
