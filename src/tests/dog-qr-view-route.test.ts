export {};

const applyRateLimitMock = vi.fn();
const getCurrentUserMock = vi.fn();
const createDogQrScanNotificationMock = vi.fn();

const prismaMock = {
  dogProfile: {
    findUnique: vi.fn(),
  },
};

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: (...args: unknown[]) => applyRateLimitMock(...args),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: (...args: unknown[]) => getCurrentUserMock(...args),
}));

vi.mock("@/lib/app-notifications", () => ({
  createDogQrScanNotification: (...args: unknown[]) => createDogQrScanNotificationMock(...args),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

describe("POST /api/dog/[publicToken]/view", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    applyRateLimitMock.mockResolvedValue({ ok: true, remaining: 29, retryAfterSeconds: 0 });
    getCurrentUserMock.mockResolvedValue(null);
    createDogQrScanNotificationMock.mockResolvedValue({ id: "notif_1" });
    prismaMock.dogProfile.findUnique.mockResolvedValue({
      id: "dog_1",
      userId: "user_1",
      name: "Kratos",
      isActive: true,
      claimedAt: new Date("2026-05-03T10:00:00.000Z"),
    });
  });

  it("cree une notification proprietaire quand un QR actif est consulte", async () => {
    const { POST } = await import("@/app/api/dog/[publicToken]/view/route");

    const response = await POST(
      new Request("http://localhost:3101/api/dog/token_123/view", { method: "POST" }),
      { params: Promise.resolve({ publicToken: "token_123" }) },
    );
    const payload = (await response.json()) as { tracked?: boolean };

    expect(response.status).toBe(200);
    expect(payload.tracked).toBe(true);
    expect(createDogQrScanNotificationMock).toHaveBeenCalledWith({
      userId: "user_1",
      dogId: "dog_1",
      dogName: "Kratos",
    });
  });

  it("ignore la consultation du proprietaire pour eviter le bruit", async () => {
    getCurrentUserMock.mockResolvedValueOnce({ id: "user_1" });
    const { POST } = await import("@/app/api/dog/[publicToken]/view/route");

    const response = await POST(
      new Request("http://localhost:3101/api/dog/token_123/view", { method: "POST" }),
      { params: Promise.resolve({ publicToken: "token_123" }) },
    );
    const payload = (await response.json()) as { tracked?: boolean };

    expect(response.status).toBe(200);
    expect(payload.tracked).toBe(false);
    expect(createDogQrScanNotificationMock).not.toHaveBeenCalled();
  });

  it("ignore les profils non reclames ou inactifs", async () => {
    prismaMock.dogProfile.findUnique.mockResolvedValueOnce({
      id: "dog_1",
      userId: null,
      name: null,
      isActive: true,
      claimedAt: null,
    });
    const { POST } = await import("@/app/api/dog/[publicToken]/view/route");

    const response = await POST(
      new Request("http://localhost:3101/api/dog/token_123/view", { method: "POST" }),
      { params: Promise.resolve({ publicToken: "token_123" }) },
    );

    expect(response.status).toBe(200);
    expect(createDogQrScanNotificationMock).not.toHaveBeenCalled();
  });

  it("applique le rate limit public", async () => {
    applyRateLimitMock.mockResolvedValueOnce({ ok: false, remaining: 0, retryAfterSeconds: 60 });
    const { POST } = await import("@/app/api/dog/[publicToken]/view/route");

    const response = await POST(
      new Request("http://localhost:3101/api/dog/token_123/view", { method: "POST" }),
      { params: Promise.resolve({ publicToken: "token_123" }) },
    );

    expect(response.status).toBe(429);
    expect(createDogQrScanNotificationMock).not.toHaveBeenCalled();
  });
});
