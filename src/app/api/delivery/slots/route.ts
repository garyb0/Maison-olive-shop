import { jsonError, jsonOk } from "@/lib/http";
import { getCheckoutDeliverySlots } from "@/lib/delivery";
import { deliverySlotsQuerySchema } from "@/lib/validators";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = deliverySlotsQuerySchema.safeParse({
      postalCode: searchParams.get("postalCode") ?? undefined,
      country: searchParams.get("country") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      mode: searchParams.get("mode") ?? undefined,
    });

    if (!parsed.success) {
      return jsonError("Invalid query", 400);
    }

    const q = parsed.data;

    const delivery = await getCheckoutDeliverySlots({
      postalCode: q.postalCode,
      country: q.country,
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
      mode: q.mode,
    });

    return jsonOk(delivery);
  } catch {
    return jsonError("Unable to fetch delivery slots", 500);
  }
}
