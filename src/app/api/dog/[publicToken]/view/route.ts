import { createDogQrScanNotification } from "@/lib/app-notifications";
import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { applyRateLimit } from "@/lib/rate-limit";

type RouteContext = {
  params: Promise<{ publicToken: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const rate = await applyRateLimit(request, { namespace: "dog-qr:view", windowMs: 60_000, max: 30 });
  if (!rate.ok) return jsonError("Too many requests", 429);

  try {
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
        },
      }),
    ]);

    if (!dog?.userId || !dog.claimedAt || !dog.isActive || viewer?.id === dog.userId) {
      return jsonOk({ ok: true, tracked: false });
    }

    const notification = await createDogQrScanNotification({
      userId: dog.userId,
      dogId: dog.id,
      dogName: dog.name,
    });

    return jsonOk({ ok: true, tracked: Boolean(notification) });
  } catch {
    return jsonError("Unable to record dog QR view", 500);
  }
}
