import { getCurrentUser } from "@/lib/auth";
import { createConversionEvent } from "@/lib/conversion-analytics";
import { jsonError, jsonOk } from "@/lib/http";
import { logApiEvent } from "@/lib/observability";
import { applyRateLimit } from "@/lib/rate-limit";
import { conversionEventSchema, hasSensitiveConversionKey } from "@/lib/validators";

const ALLOWED_KEYS = new Set([
  "type",
  "sessionKey",
  "productId",
  "productSlug",
  "orderId",
  "orderNumber",
  "currency",
  "cartTotalCents",
  "itemCount",
  "quantity",
  "paymentMethod",
  "deliveryMode",
  "language",
  "path",
  "referrerPath",
  "metadata",
]);

function containsSensitiveTopLevelKey(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;

  return Object.keys(body).some((key) => !ALLOWED_KEYS.has(key) && hasSensitiveConversionKey(key));
}

export async function POST(request: Request) {
  const rate = await applyRateLimit(request, { namespace: "conversion:event", windowMs: 60_000, max: 80 });
  if (!rate.ok) {
    return jsonError("Too many requests", 429);
  }

  try {
    const body = await request.json();
    if (containsSensitiveTopLevelKey(body)) {
      return jsonError("Sensitive fields are not accepted", 400);
    }

    const parsed = conversionEventSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError("Invalid conversion event", 400);
    }

    const user = await getCurrentUser().catch(() => null);
    await createConversionEvent(parsed.data, {
      userId: user?.id ?? null,
      userAgent: request.headers.get("user-agent"),
    });

    return jsonOk({ ok: true });
  } catch (error) {
    logApiEvent({
      level: "WARN",
      route: "/api/conversion-events",
      event: "CONVERSION_EVENT_REJECTED",
      status: 400,
      details: { error },
    });
    return jsonError("Invalid conversion event", 400);
  }
}
