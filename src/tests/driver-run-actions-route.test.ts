export {};

const recordDriverRunLocationMock = vi.fn();
const completeDriverStopMock = vi.fn();
const arriveDriverStopMock = vi.fn();
const uploadDriverStopProofMock = vi.fn();
const getDriverStopProofFileMock = vi.fn();

vi.mock("@/lib/delivery-runs", () => ({
  recordDriverRunLocation: (...args: unknown[]) => recordDriverRunLocationMock(...args),
  completeDriverStop: (...args: unknown[]) => completeDriverStopMock(...args),
  arriveDriverStop: (...args: unknown[]) => arriveDriverStopMock(...args),
  uploadDriverStopProof: (...args: unknown[]) => uploadDriverStopProofMock(...args),
  getDriverStopProofFile: (...args: unknown[]) => getDriverStopProofFileMock(...args),
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

  it("enregistre une arrivee chauffeur sur un arret", async () => {
    arriveDriverStopMock.mockResolvedValueOnce({
      id: "run_1",
      stops: [{ id: "stop_1", arrivedAt: "2026-04-23T10:08:00.000Z" }],
    });
    const { POST } = await import("@/app/api/driver/run/[token]/stops/[stopId]/arrive/route");

    const response = await POST(
      new Request("http://localhost:3101/api/driver/run/token_1/stops/stop_1/arrive", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lat: 48.45,
          lng: -68.52,
          accuracyMeters: 8,
          recordedAt: "2026-04-23T10:08:00.000Z",
        }),
      }),
      { params: Promise.resolve({ token: "token_1", stopId: "stop_1" }) },
    );
    const payload = (await response.json()) as {
      run?: { id: string; stops: Array<{ id: string; arrivedAt: string }> };
    };

    expect(response.status).toBe(200);
    expect(payload.run?.id).toBe("run_1");
    expect(arriveDriverStopMock).toHaveBeenCalledWith("token_1", {
      stopId: "stop_1",
      lat: 48.45,
      lng: -68.52,
      accuracyMeters: 8,
      recordedAt: "2026-04-23T10:08:00.000Z",
    });
  });

  it("refuse un payload d'arrivee invalide", async () => {
    const { POST } = await import("@/app/api/driver/run/[token]/stops/[stopId]/arrive/route");

    const response = await POST(
      new Request("http://localhost:3101/api/driver/run/token_1/stops/stop_1/arrive", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lat: 148.45,
          lng: -68.52,
          accuracyMeters: 8,
          recordedAt: "2026-04-23T10:08:00.000Z",
        }),
      }),
      { params: Promise.resolve({ token: "token_1", stopId: "stop_1" }) },
    );
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid stop arrival payload");
    expect(arriveDriverStopMock).not.toHaveBeenCalled();
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

  it("televerse une preuve photo chauffeur valide", async () => {
    uploadDriverStopProofMock.mockResolvedValueOnce({
      id: "run_1",
      stops: [{ id: "stop_1", hasProofPhoto: true }],
    });
    const { POST } = await import("@/app/api/driver/run/[token]/stops/[stopId]/proof/route");
    const formData = new FormData();
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    formData.append("image", new File([pngBytes], "proof.png", { type: "image/png" }));
    formData.append("lat", "48.45");
    formData.append("lng", "-68.52");
    formData.append("accuracyMeters", "8");
    formData.append("recordedAt", "2026-04-23T10:10:00.000Z");

    const response = await POST(
      { formData: async () => formData } as Request,
      { params: Promise.resolve({ token: "token_1", stopId: "stop_1" }) },
    );
    const payload = (await response.json()) as { proof?: { uploaded: boolean } };

    expect(response.status).toBe(200);
    expect(payload.proof?.uploaded).toBe(true);
    expect(uploadDriverStopProofMock).toHaveBeenCalledWith(
      "token_1",
      expect.objectContaining({
        stopId: "stop_1",
        mimeType: "image/png",
        sizeBytes: pngBytes.length,
        lat: 48.45,
        lng: -68.52,
        accuracyMeters: 8,
        recordedAt: "2026-04-23T10:10:00.000Z",
      }),
    );
  });

  it("refuse une preuve photo au mauvais type MIME", async () => {
    const { POST } = await import("@/app/api/driver/run/[token]/stops/[stopId]/proof/route");
    const formData = new FormData();
    formData.append("image", new File([new Uint8Array([1, 2, 3])], "proof.txt", { type: "text/plain" }));

    const response = await POST(
      { formData: async () => formData } as Request,
      { params: Promise.resolve({ token: "token_1", stopId: "stop_1" }) },
    );
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid proof image type");
    expect(uploadDriverStopProofMock).not.toHaveBeenCalled();
  });
});
