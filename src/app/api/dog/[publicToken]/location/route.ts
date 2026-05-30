import { createDogQrScanNotification } from "@/lib/app-notifications";
import { getCurrentUser } from "@/lib/auth";
import { recordDogQrScan } from "@/lib/dog-scans";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { applyRateLimit } from "@/lib/rate-limit";
import { dogLocationShareSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ publicToken: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const rate = await applyRateLimit(request, { namespace: "dog-qr:location", windowMs: 60_000, max: 10 });
  if (!rate.ok) return jsonError("Too many requests", 429);

  try {
    const body = await request.json().catch(() => null);
    const parsed = dogLocationShareSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid location payload", 400);
    }

    const { publicToken } = await context.params;
    const [viewer, dog] = await Promise.all([
      getCurrentUser().catch(() => null),
      prisma.dogProfile.findUnique({
        where: { publicToken },
        select: {
          id: true,
          userId: true,
          name: true,
          isActive: true,
          claimedAt: true,
          lostModeEnabled: true,
        },
      }),
    ]);

    if (!dog?.userId || !dog.claimedAt || !dog.isActive || viewer?.id === dog.userId) {
      return jsonOk({ ok: true, shared: false });
    }

    if (!dog.lostModeEnabled) {
      return jsonOk({ ok: true, shared: false, reason: "LOST_MODE_INACTIVE" });
    }

    await recordDogQrScan({
      dogId: dog.id,
      viewerUserId: viewer?.id ?? null,
      eventType: "LOCATION_SHARED",
      lostModeAtScan: true,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      accuracyMeters: parsed.data.accuracyMeters ?? null,
      locationSharedAt: new Date(),
      request,
    });

    await createDogQrScanNotification({
      userId: dog.userId,
      dogId: dog.id,
      dogName: dog.name,
      lostMode: true,
      locationShared: true,
    });

    return jsonOk({ ok: true, shared: true });
  } catch {
    return jsonError("Unable to share dog QR location", 500);
  }
}
