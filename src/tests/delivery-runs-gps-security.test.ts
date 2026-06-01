export {};

describe("driver GPS sample security", () => {
  it("refuse les echantillons GPS trop vieux, futurs, imprecis, non monotones ou trop rapides", async () => {
    const { assertDriverGpsSample } = await import("@/lib/delivery-runs");
    const now = new Date();
    const base = {
      lat: 48.45,
      lng: -68.52,
      accuracyMeters: 8,
      recordedAt: now,
    };

    expect(() => assertDriverGpsSample({
      ...base,
      recordedAt: new Date(Date.now() - 6 * 60 * 1000),
    })).toThrow("DELIVERY_GPS_SAMPLE_STALE");

    expect(() => assertDriverGpsSample({
      ...base,
      recordedAt: new Date(Date.now() + 61 * 1000),
    })).toThrow("DELIVERY_GPS_SAMPLE_FUTURE");

    expect(() => assertDriverGpsSample({
      ...base,
      accuracyMeters: 101,
    })).toThrow("DELIVERY_GPS_SAMPLE_INACCURATE");

    expect(() => assertDriverGpsSample(base, {
      recordedAt: new Date(now.getTime()),
      lat: 48.45,
      lng: -68.52,
    })).toThrow("DELIVERY_GPS_SAMPLE_NON_MONOTONIC");

    expect(() => assertDriverGpsSample({
      ...base,
      recordedAt: new Date(now.getTime() + 10_000),
      lat: 49.45,
    }, {
      recordedAt: now,
      lat: 48.45,
      lng: -68.52,
    })).toThrow("DELIVERY_GPS_SAMPLE_TOO_FAST");
  });
});
