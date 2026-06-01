export {};

const getDriverRunSnapshotMock = vi.fn();
const startDriverRunMock = vi.fn();
const finishDriverRunMock = vi.fn();
const optimizeDriverRunFromCurrentPositionMock = vi.fn();
const applyRateLimitMock = vi.fn();

vi.mock("@/lib/delivery-runs", () => ({
  getDeliveryRunTokenRateLimitIdentity: (token: string) => `driver-token:${token}`,
  getDriverRunSnapshot: (...args: unknown[]) => getDriverRunSnapshotMock(...args),
  startDriverRun: (...args: unknown[]) => startDriverRunMock(...args),
  finishDriverRun: (...args: unknown[]) => finishDriverRunMock(...args),
  optimizeDriverRunFromCurrentPosition: (...args: unknown[]) => optimizeDriverRunFromCurrentPositionMock(...args),
  mapDeliveryRunError: (error: unknown) => ({
    message: error instanceof Error ? error.message : "error",
    status:
      error instanceof Error && error.message === "NOT_FOUND"
        ? 404
        : error instanceof Error && error.message === "DELIVERY_RUN_TOKEN_INVALID"
          ? 404
          : error instanceof Error && error.message === "DELIVERY_RUN_NOT_IN_PROGRESS"
            ? 409
            : 500,
  }),
}));

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: (...args: unknown[]) => applyRateLimitMock(...args),
}));

describe("driver run routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    applyRateLimitMock.mockResolvedValue({ ok: true, remaining: 5, retryAfterSeconds: 0 });
  });

  it("retourne le snapshot du chauffeur", async () => {
    getDriverRunSnapshotMock.mockResolvedValueOnce({ id: "run_1" });
    const { GET } = await import("@/app/api/driver/run/[token]/route");
    const response = await GET(new Request("http://localhost:3101/api/driver/run/token_1"), {
      params: Promise.resolve({ token: "token_1" }),
    });
    const payload = (await response.json()) as { run?: { id: string } };

    expect(response.status).toBe(200);
    expect(payload.run?.id).toBe("run_1");
  });

  it("demarre la tournee chauffeur", async () => {
    startDriverRunMock.mockResolvedValueOnce({ id: "run_1", status: "IN_PROGRESS" });
    const { POST } = await import("@/app/api/driver/run/[token]/start/route");
    const response = await POST(new Request("http://localhost:3101/api/driver/run/token_1/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        lat: 48.45,
        lng: -68.52,
        accuracyMeters: 8,
        recordedAt: "2026-04-24T20:00:00.000Z",
      }),
    }), {
      params: Promise.resolve({ token: "token_1" }),
    });
    const payload = (await response.json()) as { run?: { status: string } };

    expect(response.status).toBe(200);
    expect(payload.run?.status).toBe("IN_PROGRESS");
    expect(startDriverRunMock).toHaveBeenCalledWith("token_1", {
      lat: 48.45,
      lng: -68.52,
      accuracyMeters: 8,
      recordedAt: "2026-04-24T20:00:00.000Z",
    });
  });

  it("refuse un payload de demarrage invalide", async () => {
    const { POST } = await import("@/app/api/driver/run/[token]/start/route");
    const response = await POST(new Request("http://localhost:3101/api/driver/run/token_1/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        lat: 48.45,
      }),
    }), {
      params: Promise.resolve({ token: "token_1" }),
    });
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid run start payload");
    expect(startDriverRunMock).not.toHaveBeenCalled();
  });

  it("termine la tournee avec odometre", async () => {
    finishDriverRunMock.mockResolvedValueOnce({ id: "run_1", actualKmFinal: 14.5 });
    const { POST } = await import("@/app/api/driver/run/[token]/finish/route");
    const response = await POST(new Request("http://localhost:3101/api/driver/run/token_1/finish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        odometerStartKm: 100,
        odometerEndKm: 114.5,
      }),
    }), {
      params: Promise.resolve({ token: "token_1" }),
    });
    const payload = (await response.json()) as { run?: { actualKmFinal: number } };

    expect(response.status).toBe(200);
    expect(payload.run?.actualKmFinal).toBe(14.5);
  });

  it("reoptimise la tournee chauffeur depuis une position GPS et retourne Waze", async () => {
    optimizeDriverRunFromCurrentPositionMock.mockResolvedValueOnce({
      run: { id: "run_1", status: "IN_PROGRESS" },
      navigationHref: "https://www.waze.com/ul?q=Rimouski&navigate=yes",
      warning: null,
    });
    const { POST } = await import("@/app/api/driver/run/[token]/optimize/route");
    const response = await POST(new Request("http://localhost:3101/api/driver/run/token_1/optimize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        lat: 48.45,
        lng: -68.52,
        accuracyMeters: 8,
        recordedAt: "2026-04-24T20:00:00.000Z",
      }),
    }), {
      params: Promise.resolve({ token: "token_1" }),
    });
    const payload = (await response.json()) as { navigationHref?: string };

    expect(response.status).toBe(200);
    expect(payload.navigationHref).toContain("waze.com");
    expect(applyRateLimitMock).toHaveBeenCalledWith(
      expect.any(Request),
      expect.objectContaining({
        namespace: "driver:optimize",
        windowMs: 600000,
        max: 6,
        identity: "driver-token:token_1",
      }),
    );
    expect(optimizeDriverRunFromCurrentPositionMock).toHaveBeenCalledWith("token_1", {
      lat: 48.45,
      lng: -68.52,
      accuracyMeters: 8,
      recordedAt: "2026-04-24T20:00:00.000Z",
      navigationProvider: "WAZE",
    });
  });

  it("limite la reoptimisation par token chauffeur", async () => {
    applyRateLimitMock.mockResolvedValueOnce({ ok: false, remaining: 0, retryAfterSeconds: 300 });
    const { POST } = await import("@/app/api/driver/run/[token]/optimize/route");
    const response = await POST(new Request("http://localhost:3101/api/driver/run/token_1/optimize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        lat: 48.45,
        lng: -68.52,
        accuracyMeters: 8,
        recordedAt: "2026-04-24T20:00:00.000Z",
      }),
    }), {
      params: Promise.resolve({ token: "token_1" }),
    });

    expect(response.status).toBe(429);
    expect(optimizeDriverRunFromCurrentPositionMock).not.toHaveBeenCalled();
  });

  it("refuse un payload de reoptimisation invalide", async () => {
    const { POST } = await import("@/app/api/driver/run/[token]/optimize/route");
    const response = await POST(new Request("http://localhost:3101/api/driver/run/token_1/optimize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        lat: 48.45,
        lng: -68.52,
      }),
    }), {
      params: Promise.resolve({ token: "token_1" }),
    });
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid run optimization payload");
    expect(optimizeDriverRunFromCurrentPositionMock).not.toHaveBeenCalled();
  });

  it("refuse la reoptimisation quand le token chauffeur est invalide", async () => {
    optimizeDriverRunFromCurrentPositionMock.mockRejectedValueOnce(new Error("DELIVERY_RUN_TOKEN_INVALID"));
    const { POST } = await import("@/app/api/driver/run/[token]/optimize/route");
    const response = await POST(new Request("http://localhost:3101/api/driver/run/bad_token/optimize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        lat: 48.45,
        lng: -68.52,
        accuracyMeters: 8,
        recordedAt: "2026-04-24T20:00:00.000Z",
      }),
    }), {
      params: Promise.resolve({ token: "bad_token" }),
    });

    expect(response.status).toBe(404);
  });
});
