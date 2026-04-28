import {
  computeAcceptedGpsDistanceKm,
  filterGpsSamples,
  haversineDistanceMeters,
  resolveDeliveryRunKm,
} from "@/lib/delivery-run-km";

describe("delivery-run-km", () => {
  it("ignore les points GPS trop imprecis", () => {
    const accepted = filterGpsSamples([
      {
        recordedAt: "2026-04-23T10:00:00.000Z",
        lat: 48.4501,
        lng: -68.5239,
        accuracyMeters: 120,
      },
      {
        recordedAt: "2026-04-23T10:00:20.000Z",
        lat: 48.4503,
        lng: -68.5237,
        accuracyMeters: 12,
      },
    ]);

    expect(accepted).toHaveLength(1);
  });

  it("cumule la distance GPS sur les echantillons acceptes", () => {
    const accepted = filterGpsSamples([
      {
        recordedAt: "2026-04-23T10:00:00.000Z",
        lat: 48.4501,
        lng: -68.5239,
        accuracyMeters: 10,
      },
      {
        recordedAt: "2026-04-23T10:00:20.000Z",
        lat: 48.4511,
        lng: -68.5239,
        accuracyMeters: 12,
      },
      {
        recordedAt: "2026-04-23T10:00:40.000Z",
        lat: 48.4521,
        lng: -68.5239,
        accuracyMeters: 12,
      },
    ]);

    expect(accepted).toHaveLength(3);
    expect(haversineDistanceMeters(accepted[0], accepted[1])).toBeGreaterThan(50);
    expect(computeAcceptedGpsDistanceKm(accepted)).toBeGreaterThan(0.15);
  });

  it("priorise GPS quand la trace est suffisante", () => {
    const samples = Array.from({ length: 10 }, (_, index) => ({
      recordedAt: new Date(Date.UTC(2026, 3, 23, 10, index, 0)).toISOString(),
      lat: 48.45 + index * 0.001,
      lng: -68.52,
      accuracyMeters: 8,
    }));

    const result = resolveDeliveryRunKm({
      samples,
      odometerStartKm: 10,
      odometerEndKm: 14,
    });

    expect(result.actualKmSource).toBe("GPS");
    expect(result.actualKmFinal).toBe(result.actualKmGps);
  });

  it("bascule sur odometre si la trace GPS n'est pas qualifiee", () => {
    const result = resolveDeliveryRunKm({
      samples: [
        {
          recordedAt: "2026-04-23T10:00:00.000Z",
          lat: 48.45,
          lng: -68.52,
          accuracyMeters: 10,
        },
      ],
      odometerStartKm: 120.2,
      odometerEndKm: 126.5,
    });

    expect(result.actualKmSource).toBe("ODOMETER");
    expect(result.actualKmFinal).toBeCloseTo(6.3, 3);
  });
});
