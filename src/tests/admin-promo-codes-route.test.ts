export {};

const requireAdminMock = vi.fn();
const logApiEventMock = vi.fn();

const prismaMock = {
  promoCode: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};

vi.mock("@/lib/permissions", () => ({
  requireAdmin: (...args: unknown[]) => requireAdminMock(...args),
}));

vi.mock("@/lib/observability", () => ({
  logApiEvent: (...args: unknown[]) => logApiEventMock(...args),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

describe("admin promo code routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    requireAdminMock.mockResolvedValue({ id: "admin_1" });
    prismaMock.promoCode.create.mockResolvedValue({
      id: "promo_1",
      code: "WELCOME15",
      description: "Rabais bienvenue",
      discountPercent: 15,
      isActive: true,
      createdAt: new Date().toISOString(),
    });
    prismaMock.promoCode.findUnique.mockResolvedValue({
      id: "promo_1",
      code: "WELCOME15",
    });
    prismaMock.promoCode.update.mockResolvedValue({
      id: "promo_1",
      code: "WELCOME20",
      description: "Rabais maj",
      discountPercent: 20,
      isActive: false,
      createdAt: new Date().toISOString(),
    });
    prismaMock.promoCode.delete.mockResolvedValue({ id: "promo_1" });
  });

  it("cree un code promo en le normalisant", async () => {
    const { POST } = await import("@/app/api/admin/promo-codes/route");
    const request = new Request("http://localhost:3101/api/admin/promo-codes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code: "welcome15",
        description: "Rabais bienvenue",
        discountPercent: 15,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
    expect(prismaMock.promoCode.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: "WELCOME15",
          discountPercent: 15,
        }),
      }),
    );
    expect(logApiEventMock).toHaveBeenCalled();
  });

  it("met a jour un code promo existant", async () => {
    const { PUT } = await import("@/app/api/admin/promo-codes/[id]/route");
    const request = new Request("http://localhost:3101/api/admin/promo-codes/promo_1", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code: "welcome20",
        discountPercent: 20,
        isActive: false,
      }),
    });

    const response = await PUT(request, { params: Promise.resolve({ id: "promo_1" }) });
    expect(response.status).toBe(200);
    expect(prismaMock.promoCode.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "promo_1" },
        data: expect.objectContaining({
          code: "WELCOME20",
          discountPercent: 20,
          isActive: false,
        }),
      }),
    );
  });

  it("retourne 404 si le code promo n'existe pas a la suppression", async () => {
    prismaMock.promoCode.findUnique.mockResolvedValueOnce(null);

    const { DELETE } = await import("@/app/api/admin/promo-codes/[id]/route");
    const request = new Request("http://localhost:3101/api/admin/promo-codes/promo_missing", {
      method: "DELETE",
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: "promo_missing" }) });
    expect(response.status).toBe(404);
    expect(prismaMock.promoCode.delete).not.toHaveBeenCalled();
  });
});
