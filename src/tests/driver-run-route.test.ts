export {};

const getDriverRunSnapshotMock = vi.fn();
const startDriverRunMock = vi.fn();
const finishDriverRunMock = vi.fn();

vi.mock("@/lib/delivery-runs", () => ({
  getDriverRunSnapshot: (...args: unknown[]) => getDriverRunSnapshotMock(...args),
  startDriverRun: (...args: unknown[]) => startDriverRunMock(...args),
  finishDriverRun: (...args: unknown[]) => finishDriverRunMock(...args),
  mapDeliveryRunError: (error: unknown) => ({
    message: error instanceof Error ? error.message : "error",
    status: error instanceof Error && error.message === "NOT_FOUND" ? 404 : 500,
  }),
}));

describe("driver run routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
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
});
