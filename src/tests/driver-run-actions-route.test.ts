export {};

const recordDriverRunLocationMock = vi.fn();
const completeDriverStopMock = vi.fn();

vi.mock("@/lib/delivery-runs", () => ({
  recordDriverRunLocation: (...args: unknown[]) => recordDriverRunLocationMock(...args),
  completeDriverStop: (...args: unknown[]) => completeDriverStopMock(...args),
  mapDeliveryRunError: (error: unknown) => ({
    message: error instanceof Error ? error.message : "error",
    status: error instanceof Error && error.message === "DELIVERY_STOP_NOT_FOUND" ? 404 : 500,
  }),
}));

describe("driver run action routes", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("enregistre un echantillon GPS chauffeur", async () => {
    recordDriverRunLocationMock.mockResolvedValueOnce({
      accepted: true,
      actualKmGps: 4.2,
    });
    const { POST } = await import("@/app/api/driver/run/[token]/location/route");

    const response = await POST(
      new Request("http://localhost:3101/api/driver/run/token_1/location", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lat: 48.45,
          lng: -68.52,
          accuracyMeters: 8,
          speedMps: 5.1,
          heading: 180,
          recordedAt: "2026-04-23T10:05:00.000Z",
        }),
      }),
      { params: Promise.resolve({ token: "token_1" }) },
    );
    const payload = (await response.json()) as { accepted?: boolean; actualKmGps?: number };

    expect(response.status).toBe(200);
    expect(payload.accepted).toBe(true);
    expect(payload.actualKmGps).toBe(4.2);
    expect(recordDriverRunLocationMock).toHaveBeenCalledWith("token_1", {
      lat: 48.45,
      lng: -68.52,
      accuracyMeters: 8,
      speedMps: 5.1,
      heading: 180,
      recordedAt: "2026-04-23T10:05:00.000Z",
    });
  });

  it("refuse un payload GPS invalide", async () => {
    const { POST } = await import("@/app/api/driver/run/[token]/location/route");

    const response = await POST(
      new Request("http://localhost:3101/api/driver/run/token_1/location", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lat: 123,
          lng: -68.52,
          accuracyMeters: 8,
          recordedAt: "2026-04-23T10:05:00.000Z",
        }),
      }),
      { params: Promise.resolve({ token: "token_1" }) },
    );
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid location payload");
    expect(recordDriverRunLocationMock).not.toHaveBeenCalled();
  });

  it("marque un arret chauffeur comme livre", async () => {
    completeDriverStopMock.mockResolvedValueOnce({
      id: "run_1",
      stops: [{ id: "stop_1", status: "DELIVERED" }],
    });
    const { POST } = await import("@/app/api/driver/run/[token]/stops/[stopId]/route");

    const response = await POST(
      new Request("http://localhost:3101/api/driver/run/token_1/stops/stop_1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          result: "DELIVERED",
          note: "Client present",
        }),
      }),
      { params: Promise.resolve({ token: "token_1", stopId: "stop_1" }) },
    );
    const payload = (await response.json()) as {
      run?: { id: string; stops: Array<{ id: string; status: string }> };
    };

    expect(response.status).toBe(200);
    expect(payload.run?.id).toBe("run_1");
    expect(payload.run?.stops[0]).toEqual(
      expect.objectContaining({
        id: "stop_1",
        status: "DELIVERED",
      }),
    );
    expect(completeDriverStopMock).toHaveBeenCalledWith("token_1", {
      stopId: "stop_1",
      result: "DELIVERED",
      note: "Client present",
    });
  });

  it("refuse un payload de cloture d'arret invalide", async () => {
    const { POST } = await import("@/app/api/driver/run/[token]/stops/[stopId]/route");

    const response = await POST(
      new Request("http://localhost:3101/api/driver/run/token_1/stops/stop_1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          result: "UNKNOWN",
        }),
      }),
      { params: Promise.resolve({ token: "token_1", stopId: "stop_1" }) },
    );
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid stop completion payload");
    expect(completeDriverStopMock).not.toHaveBeenCalled();
  });
});
