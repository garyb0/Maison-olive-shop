const MAX_ACCEPTED_ACCURACY_METERS = 50;
const MIN_DISTANCE_BETWEEN_SAMPLES_METERS = 25;
const MIN_TIME_BETWEEN_SAMPLES_MS = 15_000;
const MIN_GPS_TRACE_DURATION_MS = 5 * 60_000;
const MIN_GPS_SAMPLE_COUNT = 10;
const EARTH_RADIUS_METERS = 6_371_000;

export type GpsSampleInput = {
  recordedAt: Date | string;
  lat: number;
  lng: number;
  accuracyMeters: number;
};

export type AcceptedGpsSample = {
  recordedAt: Date;
  lat: number;
  lng: number;
  accuracyMeters: number;
};

export type DeliveryKmResolution = {
  acceptedSamples: AcceptedGpsSample[];
  actualKmGps: number | null;
  actualKmOdometer: number | null;
  actualKmFinal: number | null;
  actualKmSource: "GPS" | "ODOMETER" | "MANUAL_ADMIN" | null;
  traceDurationMs: number;
};

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function toAcceptedSample(sample: GpsSampleInput): AcceptedGpsSample | null {
  const recordedAt = sample.recordedAt instanceof Date ? sample.recordedAt : new Date(sample.recordedAt);
  if (
    !Number.isFinite(sample.lat) ||
    !Number.isFinite(sample.lng) ||
    !Number.isFinite(sample.accuracyMeters) ||
    Number.isNaN(recordedAt.getTime())
  ) {
    return null;
  }

  return {
    recordedAt,
    lat: sample.lat,
    lng: sample.lng,
    accuracyMeters: sample.accuracyMeters,
  };
}

export function haversineDistanceMeters(
  left: Pick<AcceptedGpsSample, "lat" | "lng">,
  right: Pick<AcceptedGpsSample, "lat" | "lng">,
) {
  const dLat = toRadians(right.lat - left.lat);
  const dLng = toRadians(right.lng - left.lng);
  const lat1 = toRadians(left.lat);
  const lat2 = toRadians(right.lat);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function filterGpsSamples(samples: GpsSampleInput[]) {
  const accepted: AcceptedGpsSample[] = [];

  const normalized = samples
    .map((sample) => toAcceptedSample(sample))
    .filter((sample): sample is AcceptedGpsSample => Boolean(sample))
    .sort((left, right) => left.recordedAt.getTime() - right.recordedAt.getTime());

  for (const sample of normalized) {
    if (sample.accuracyMeters > MAX_ACCEPTED_ACCURACY_METERS) {
      continue;
    }

    const previous = accepted.at(-1);
    if (!previous) {
      accepted.push(sample);
      continue;
    }

    const elapsedMs = sample.recordedAt.getTime() - previous.recordedAt.getTime();
    const movedMeters = haversineDistanceMeters(previous, sample);

    if (
      movedMeters >= MIN_DISTANCE_BETWEEN_SAMPLES_METERS ||
      elapsedMs >= MIN_TIME_BETWEEN_SAMPLES_MS
    ) {
      accepted.push(sample);
    }
  }

  return accepted;
}

export function computeAcceptedGpsDistanceKm(samples: AcceptedGpsSample[]) {
  if (samples.length < 2) {
    return 0;
  }

  let totalMeters = 0;
  for (let index = 1; index < samples.length; index += 1) {
    totalMeters += haversineDistanceMeters(samples[index - 1], samples[index]);
  }

  return Number((totalMeters / 1000).toFixed(3));
}

export function computeAcceptedGpsTraceDurationMs(samples: AcceptedGpsSample[]) {
  if (samples.length < 2) {
    return 0;
  }

  return samples[samples.length - 1].recordedAt.getTime() - samples[0].recordedAt.getTime();
}

export function deriveOdometerKm(
  odometerStartKm?: number | null,
  odometerEndKm?: number | null,
) {
  if (
    typeof odometerStartKm !== "number" ||
    typeof odometerEndKm !== "number" ||
    !Number.isFinite(odometerStartKm) ||
    !Number.isFinite(odometerEndKm)
  ) {
    return null;
  }

  if (odometerEndKm < odometerStartKm) {
    return null;
  }

  return Number((odometerEndKm - odometerStartKm).toFixed(3));
}

export function resolveDeliveryRunKm(input: {
  samples: GpsSampleInput[];
  odometerStartKm?: number | null;
  odometerEndKm?: number | null;
  manualActualKmFinal?: number | null;
}) {
  const acceptedSamples = filterGpsSamples(input.samples);
  const actualKmGps =
    acceptedSamples.length >= 2 ? computeAcceptedGpsDistanceKm(acceptedSamples) : null;
  const traceDurationMs = computeAcceptedGpsTraceDurationMs(acceptedSamples);
  const actualKmOdometer = deriveOdometerKm(input.odometerStartKm, input.odometerEndKm);

  const gpsQualified =
    acceptedSamples.length >= MIN_GPS_SAMPLE_COUNT &&
    traceDurationMs >= MIN_GPS_TRACE_DURATION_MS &&
    actualKmGps !== null;

  if (gpsQualified) {
    return {
      acceptedSamples,
      actualKmGps,
      actualKmOdometer,
      actualKmFinal: actualKmGps,
      actualKmSource: "GPS",
      traceDurationMs,
    } satisfies DeliveryKmResolution;
  }

  if (actualKmOdometer !== null) {
    return {
      acceptedSamples,
      actualKmGps,
      actualKmOdometer,
      actualKmFinal: actualKmOdometer,
      actualKmSource: "ODOMETER",
      traceDurationMs,
    } satisfies DeliveryKmResolution;
  }

  if (
    typeof input.manualActualKmFinal === "number" &&
    Number.isFinite(input.manualActualKmFinal)
  ) {
    return {
      acceptedSamples,
      actualKmGps,
      actualKmOdometer,
      actualKmFinal: Number(input.manualActualKmFinal.toFixed(3)),
      actualKmSource: "MANUAL_ADMIN",
      traceDurationMs,
    } satisfies DeliveryKmResolution;
  }

  return {
    acceptedSamples,
    actualKmGps,
    actualKmOdometer,
    actualKmFinal: null,
    actualKmSource: null,
    traceDurationMs,
  } satisfies DeliveryKmResolution;
}

export function getGpsTrackingThresholds() {
  return {
    maxAcceptedAccuracyMeters: MAX_ACCEPTED_ACCURACY_METERS,
    minDistanceBetweenSamplesMeters: MIN_DISTANCE_BETWEEN_SAMPLES_METERS,
    minTimeBetweenSamplesMs: MIN_TIME_BETWEEN_SAMPLES_MS,
    minGpsTraceDurationMs: MIN_GPS_TRACE_DURATION_MS,
    minGpsSampleCount: MIN_GPS_SAMPLE_COUNT,
  };
}
