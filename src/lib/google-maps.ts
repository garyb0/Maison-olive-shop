import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

export type DeliveryAddressInput = {
  shippingLine1: string;
  shippingCity: string;
  shippingRegion: string;
  shippingPostal: string;
  shippingCountry: string;
};

export type LatLng = {
  lat: number;
  lng: number;
};

export type GeocodedAddress = DeliveryAddressInput & {
  addressKey: string;
  formattedAddress: string;
  placeId: string | null;
  lat: number;
  lng: number;
};

export type GoogleRouteLeg = {
  distanceKm: number;
  durationSec: number;
};

export type GoogleRoutePlan = {
  waypointOrder: number[];
  legs: GoogleRouteLeg[];
  totalDistanceKm: number;
  totalDurationSec: number;
};

type GoogleGeocodeResponse = {
  status?: string;
  results?: Array<{
    formatted_address?: string;
    place_id?: string;
    geometry?: {
      location?: {
        lat?: number;
        lng?: number;
      };
    };
  }>;
  error_message?: string;
};

type GoogleComputeRoutesResponse = {
  routes?: Array<{
    distanceMeters?: number;
    duration?: string;
    optimizedIntermediateWaypointIndex?: number[];
    legs?: Array<{
      distanceMeters?: number;
      duration?: string;
    }>;
  }>;
};

export function normalizeDeliveryAddressPart(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function buildDeliveryAddressKey(input: DeliveryAddressInput) {
  return [
    normalizeDeliveryAddressPart(input.shippingLine1).toUpperCase(),
    normalizeDeliveryAddressPart(input.shippingCity).toUpperCase(),
    normalizeDeliveryAddressPart(input.shippingRegion).toUpperCase(),
    normalizeDeliveryAddressPart(input.shippingPostal).replace(/\s+/g, "").toUpperCase(),
    normalizeDeliveryAddressPart(input.shippingCountry).toUpperCase(),
  ].join("|");
}

export function buildDeliveryAddressLabel(input: DeliveryAddressInput) {
  return [
    normalizeDeliveryAddressPart(input.shippingLine1),
    normalizeDeliveryAddressPart(input.shippingCity),
    normalizeDeliveryAddressPart(input.shippingRegion),
    normalizeDeliveryAddressPart(input.shippingPostal).toUpperCase(),
    normalizeDeliveryAddressPart(input.shippingCountry).toUpperCase(),
  ]
    .filter(Boolean)
    .join(", ");
}

export function hasGoogleMapsApiKey() {
  return Boolean(env.googleMapsApiKey.trim());
}

export function getDeliveryDepotAddress() {
  if (
    !env.deliveryDepotLine1 ||
    !env.deliveryDepotCity ||
    !env.deliveryDepotRegion ||
    !env.deliveryDepotPostal ||
    !env.deliveryDepotCountry
  ) {
    return null;
  }

  return {
    shippingLine1: env.deliveryDepotLine1,
    shippingCity: env.deliveryDepotCity,
    shippingRegion: env.deliveryDepotRegion,
    shippingPostal: env.deliveryDepotPostal,
    shippingCountry: env.deliveryDepotCountry,
  } satisfies DeliveryAddressInput;
}

function parseGoogleDurationSeconds(value?: string) {
  if (!value) return 0;
  const parsed = Number.parseFloat(value.replace(/s$/, ""));
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

function latLngToGooglePoint(value: LatLng) {
  return {
    location: {
      latLng: {
        latitude: value.lat,
        longitude: value.lng,
      },
    },
  };
}

async function fetchGoogleGeocode(
  input: DeliveryAddressInput,
): Promise<{ formattedAddress: string; placeId: string | null; lat: number; lng: number }> {
  const addressLabel = buildDeliveryAddressLabel(input);
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", addressLabel);
  url.searchParams.set("key", env.googleMapsApiKey);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("GOOGLE_GEOCODE_HTTP_ERROR");
  }

  const payload = (await response.json()) as GoogleGeocodeResponse;
  if (payload.status !== "OK" || !payload.results?.[0]?.geometry?.location) {
    throw new Error(payload.error_message || payload.status || "GOOGLE_GEOCODE_FAILED");
  }

  const result = payload.results[0];
  const location = result.geometry?.location;
  const lat = location?.lat;
  const lng = location?.lng;

  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error("GOOGLE_GEOCODE_INVALID_COORDINATES");
  }

  return {
    formattedAddress: result.formatted_address ?? addressLabel,
    placeId: result.place_id ?? null,
    lat,
    lng,
  };
}

export async function geocodeAddressCached(input: DeliveryAddressInput): Promise<GeocodedAddress> {
  if (!hasGoogleMapsApiKey()) {
    throw new Error("GOOGLE_MAPS_NOT_CONFIGURED");
  }

  const addressKey = buildDeliveryAddressKey(input);
  const cached = await prisma.geocodedAddressCache.findUnique({
    where: { addressKey },
  });

  if (cached) {
    await prisma.geocodedAddressCache.update({
      where: { id: cached.id },
      data: {
        lastUsedAt: new Date(),
      },
    });

    return {
      addressKey,
      shippingLine1: cached.shippingLine1,
      shippingCity: cached.shippingCity,
      shippingRegion: cached.shippingRegion,
      shippingPostal: cached.shippingPostal,
      shippingCountry: cached.shippingCountry,
      formattedAddress: cached.formattedAddress,
      placeId: cached.placeId,
      lat: cached.lat,
      lng: cached.lng,
    };
  }

  const geocoded = await fetchGoogleGeocode(input);
  const created = await prisma.geocodedAddressCache.create({
    data: {
      addressKey,
      shippingLine1: normalizeDeliveryAddressPart(input.shippingLine1),
      shippingCity: normalizeDeliveryAddressPart(input.shippingCity),
      shippingRegion: normalizeDeliveryAddressPart(input.shippingRegion),
      shippingPostal: normalizeDeliveryAddressPart(input.shippingPostal).toUpperCase(),
      shippingCountry: normalizeDeliveryAddressPart(input.shippingCountry).toUpperCase(),
      formattedAddress: geocoded.formattedAddress,
      placeId: geocoded.placeId,
      lat: geocoded.lat,
      lng: geocoded.lng,
      lastUsedAt: new Date(),
    },
  });

  return {
    addressKey,
    shippingLine1: created.shippingLine1,
    shippingCity: created.shippingCity,
    shippingRegion: created.shippingRegion,
    shippingPostal: created.shippingPostal,
    shippingCountry: created.shippingCountry,
    formattedAddress: created.formattedAddress,
    placeId: created.placeId,
    lat: created.lat,
    lng: created.lng,
  };
}

export async function computeGoogleDeliveryRoute(input: {
  origin: LatLng;
  destination?: LatLng;
  stops: LatLng[];
  includeReturnToDepot: boolean;
  optimizeWaypointOrder: boolean;
}) {
  if (!hasGoogleMapsApiKey()) {
    throw new Error("GOOGLE_MAPS_NOT_CONFIGURED");
  }

  if (!input.stops.length) {
    return {
      waypointOrder: [],
      legs: [],
      totalDistanceKm: 0,
      totalDurationSec: 0,
    } satisfies GoogleRoutePlan;
  }

  const destination = input.destination ?? input.origin;

  const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": env.googleMapsApiKey,
      "X-Goog-FieldMask":
        "routes.distanceMeters,routes.duration,routes.optimizedIntermediateWaypointIndex,routes.legs.distanceMeters,routes.legs.duration",
    },
    body: JSON.stringify({
      origin: latLngToGooglePoint(input.origin),
      destination: latLngToGooglePoint(destination),
      intermediates: input.stops.map((stop) => latLngToGooglePoint(stop)),
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      languageCode: "fr-CA",
      units: "METRIC",
      optimizeWaypointOrder: input.optimizeWaypointOrder,
    }),
  });

  if (!response.ok) {
    throw new Error("GOOGLE_ROUTES_HTTP_ERROR");
  }

  const payload = (await response.json()) as GoogleComputeRoutesResponse;
  const route = payload.routes?.[0];
  if (!route?.legs?.length) {
    throw new Error("GOOGLE_ROUTES_EMPTY");
  }

  const waypointOrder =
    input.optimizeWaypointOrder && route.optimizedIntermediateWaypointIndex?.length
      ? route.optimizedIntermediateWaypointIndex
      : input.stops.map((_, index) => index);

  const stopLegs = route.legs.slice(0, input.stops.length).map((leg) => ({
    distanceKm: Number(((leg.distanceMeters ?? 0) / 1000).toFixed(3)),
    durationSec: parseGoogleDurationSeconds(leg.duration),
  }));

  const returnLeg = route.legs[input.stops.length];
  const totalDistanceMeters = route.distanceMeters ?? 0;
  const totalDurationSec = parseGoogleDurationSeconds(route.duration);

  if (input.includeReturnToDepot) {
    return {
      waypointOrder,
      legs: stopLegs,
      totalDistanceKm: Number((totalDistanceMeters / 1000).toFixed(3)),
      totalDurationSec,
    } satisfies GoogleRoutePlan;
  }

  return {
    waypointOrder,
    legs: stopLegs,
    totalDistanceKm: Number(
      (((totalDistanceMeters - (returnLeg?.distanceMeters ?? 0)) as number) / 1000).toFixed(3),
    ),
    totalDurationSec: Math.max(0, totalDurationSec - parseGoogleDurationSeconds(returnLeg?.duration)),
  } satisfies GoogleRoutePlan;
}
