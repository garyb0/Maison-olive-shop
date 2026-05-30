import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

type DogQrScanEventType = "VIEW" | "LOCATION_SHARED";

type DogQrScanInput = {
  dogId: string;
  viewerUserId?: string | null;
  eventType: DogQrScanEventType;
  lostModeAtScan: boolean;
  latitude?: number | null;
  longitude?: number | null;
  accuracyMeters?: number | null;
  locationSharedAt?: Date | null;
  request: Request;
};

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

function hashIpAddress(ip: string | null) {
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex");
}

export function getDogQrScanRequestMeta(request: Request) {
  const forwardedFor = firstHeaderValue(request.headers.get("x-forwarded-for"));
  const realIp = firstHeaderValue(request.headers.get("x-real-ip"));
  const userAgent = request.headers.get("user-agent")?.slice(0, 300) ?? null;

  return {
    ipHash: hashIpAddress(forwardedFor ?? realIp),
    userAgent,
  };
}

export async function recordDogQrScan(input: DogQrScanInput) {
  const meta = getDogQrScanRequestMeta(input.request);

  return prisma.dogQrScan.create({
    data: {
      dogId: input.dogId,
      viewerUserId: input.viewerUserId ?? null,
      eventType: input.eventType,
      lostModeAtScan: input.lostModeAtScan,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      accuracyMeters: input.accuracyMeters ?? null,
      locationSharedAt: input.locationSharedAt ?? null,
      userAgent: meta.userAgent,
      ipHash: meta.ipHash,
    },
  });
}
