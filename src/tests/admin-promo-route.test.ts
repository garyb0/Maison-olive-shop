export {};

const requireAdminMock = vi.fn();
const logApiEventMock = vi.fn();

const prismaMock = {
  promoBanner: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
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

describe("admin promo routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    requireAdminMock.mockResolvedValue({ id: "admin_1" });
    prismaMock.promoBanner.create.mockResolvedValue({
      id: "banner_1",
      isActive: true,
      sortOrder: 0,
      badge: "Badge",
      title: "Titre",
      price1: "1 pour 64,99 $",
      price2: "2 pour 100 $",
      point1: "Point 1",
      point2: "Point 2",
      point3: "Point 3",
      ctaText: "Magasiner",
      ctaLink: "/checkout",
      createdAt: new Date().toISOString(),
    });
    prismaMock.promoBanner.findUnique.mockResolvedValue({
      id: "banner_1",
    });
    prismaMock.promoBanner.update.mockResolvedValue({
      id: "banner_1",
      ctaLink: "/products/olive-bed",
    });
  });

  it("rejects an invalid storefront CTA link on create", async () => {
    const { POST } = await import("@/app/api/admin/promo/route");
    const request = new Request("http://localhost:3101/api/admin/promo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        titleFr: "Promo test",
        ctaLink: "/route-inexistante",
      }),
    });

    const response = await POST(request);
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain("/checkout");
    expect(prismaMock.promoBanner.create).not.toHaveBeenCalled();
  });

  it("accepts a valid storefront CTA link on create", async () => {
    const { POST } = await import("@/app/api/admin/promo/route");
    const request = new Request("http://localhost:3101/api/admin/promo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        titleFr: "Promo test",
        ctaLink: "/products/olive-bed",
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(prismaMock.promoBanner.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ctaLink: "/products/olive-bed",
        }),
      }),
    );
    expect(logApiEventMock).toHaveBeenCalled();
  });

  it("rejects an invalid storefront CTA link on update", async () => {
    const { PUT } = await import("@/app/api/admin/promo/[id]/route");
    const request = new Request("http://localhost:3101/api/admin/promo/banner_1", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ctaLink: "/admin/orders",
      }),
    });

    const response = await PUT(request, { params: Promise.resolve({ id: "banner_1" }) });
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain("/checkout");
    expect(prismaMock.promoBanner.update).not.toHaveBeenCalled();
  });
});
