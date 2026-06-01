import { jsonError, jsonOk } from "@/lib/http";
import { getCheckoutDeliverySlots } from "@/lib/delivery";
import { deliverySlotsQuerySchema } from "@/lib/validators";

const PUBLIC_SLOT_LOOKAHEAD_DAYS = 60;

function startOfLocalDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfLocalDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function isWithinPublicSlotRange(from?: Date, to?: Date) {
  const now = new Date();
  const min = startOfLocalDay(now);
  const max = endOfLocalDay(new Date(min.getTime() + PUBLIC_SLOT_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000));
  const fromTime = from?.getTime();
  const toTime = to?.getTime();

  if (fromTime !== undefined && (Number.isNaN(fromTime) || fromTime < min.getTime() || fromTime > max.getTime())) {
    return false;
  }
  if (toTime !== undefined && (Number.isNaN(toTime) || toTime < min.getTime() || toTime > max.getTime())) {
    return false;
  }
  if (fromTime !== undefined && toTime !== undefined && toTime < fromTime) {
    return false;
  }
  return true;
}

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
    const from = q.from ? new Date(q.from) : undefined;
    const to = q.to ? new Date(q.to) : undefined;

    if (!isWithinPublicSlotRange(from, to)) {
      return jsonError("Delivery slot range is outside the allowed public window", 400);
    }

    const delivery = await getCheckoutDeliverySlots({
      postalCode: q.postalCode,
      country: q.country,
      from,
      to,
      mode: q.mode,
    });

    return jsonOk(delivery);
  } catch {
    return jsonError("Unable to fetch delivery slots", 500);
  }
}
