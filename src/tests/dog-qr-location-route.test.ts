export {};

const applyRateLimitMock = vi.fn();
const getCurrentUserMock = vi.fn();
const createDogQrScanNotificationMock = vi.fn();
const recordDogQrScanMock = vi.fn();

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

vi.mock("@/lib/dog-scans", () => ({
  recordDogQrScan: (...args: unknown[]) => recordDogQrScanMock(...args),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

describe("POST /api/dog/[publicToken]/location", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    applyRateLimitMock.mockResolvedValue({ ok: true, remaining: 9, retryAfterSeconds: 0 });
    getCurrentUserMock.mockResolvedValue(null);
    createDogQrScanNotificationMock.mockResolvedValue({ id: "notif_1" });
    recordDogQrScanMock.mockResolvedValue({ id: "scan_1" });
    prismaMock.dogProfile.findUnique.mockResolvedValue({
      id: "dog_1",
      userId: "user_1",
      name: "Kratos",
      isActive: true,
      claimedAt: new Date("2026-05-03T10:00:00.000Z"),
      lostModeEnabled: true,
    });
  });

  it("enregistre une position volontaire quand le mode perdu est actif", async () => {
    const { POST } = await import("@/app/api/dog/[publicToken]/location/route");

    const response = await POST(
      new Request("http://localhost:3101/api/dog/token_123/location", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ latitude: 46.81, longitude: -71.2, accuracyMeters: 42 }),
      }),
      { params: Promise.resolve({ publicToken: "token_123" }) },
    );
    const payload = (await response.json()) as { shared?: boolean };

    expect(response.status).toBe(200);
    expect(payload.shared).toBe(true);
    expect(recordDogQrScanMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dogId: "dog_1",
        eventType: "LOCATION_SHARED",
        latitude: 46.81,
        longitude: -71.2,
        accuracyMeters: 42,
        lostModeAtScan: true,
      }),
    );
    expect(createDogQrScanNotificationMock).toHaveBeenCalledWith({
      userId: "user_1",
      dogId: "dog_1",
      dogName: "Kratos",
      lostMode: true,
      locationShared: true,
    });
  });

  it("refuse la position si le mode perdu est inactif", async () => {
    prismaMock.dogProfile.findUnique.mockResolvedValueOnce({
      id: "dog_1",
      userId: "user_1",
      name: "Kratos",
      isActive: true,
      claimedAt: new Date("2026-05-03T10:00:00.000Z"),
      lostModeEnabled: false,
    });
    const { POST } = await import("@/app/api/dog/[publicToken]/location/route");

    const response = await POST(
      new Request("http://localhost:3101/api/dog/token_123/location", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ latitude: 46.81, longitude: -71.2 }),
      }),
      { params: Promise.resolve({ publicToken: "token_123" }) },
    );
    const payload = (await response.json()) as { shared?: boolean; reason?: string };

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true, shared: false, reason: "LOST_MODE_INACTIVE" });
    expect(recordDogQrScanMock).not.toHaveBeenCalled();
  });

  it("valide les coordonnees", async () => {
    const { POST } = await import("@/app/api/dog/[publicToken]/location/route");

    const response = await POST(
      new Request("http://localhost:3101/api/dog/token_123/location", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ latitude: 999, longitude: -71.2 }),
      }),
      { params: Promise.resolve({ publicToken: "token_123" }) },
    );

    expect(response.status).toBe(400);
    expect(recordDogQrScanMock).not.toHaveBeenCalled();
  });
});
