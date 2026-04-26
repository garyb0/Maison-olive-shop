import { env } from "@/lib/env";

export type DeliveryCheckoutMode = "legacy" | "dynamic";

const DYNAMIC_SLOT_PREFIX = "dynamic:";

export function isExperimentalDeliveryRoutingEnabled() {
  return env.deliveryExperimentalRoutingEnabled;
}

export function getDefaultDeliveryCheckoutMode(): DeliveryCheckoutMode {
  return isExperimentalDeliveryRoutingEnabled() ? "dynamic" : "legacy";
}

export function resolveDeliveryCheckoutMode(
  requestedMode?: DeliveryCheckoutMode | null,
): DeliveryCheckoutMode {
  if (!requestedMode) {
    return getDefaultDeliveryCheckoutMode();
  }

  if (requestedMode === "dynamic" && isExperimentalDeliveryRoutingEnabled()) {
    return "dynamic";
  }

  return "legacy";
}

export function buildDynamicDeliverySlotId(startAt: string, endAt: string) {
  return `${DYNAMIC_SLOT_PREFIX}${startAt}|${endAt}`;
}

export function isDynamicDeliverySlotId(value?: string | null): value is string {
  return typeof value === "string" && value.startsWith(DYNAMIC_SLOT_PREFIX);
}

export function parseDynamicDeliverySlotId(value?: string | null) {
  if (!isDynamicDeliverySlotId(value)) {
    return null;
  }

  const payload = value.slice(DYNAMIC_SLOT_PREFIX.length);
  const [startRaw, endRaw] = payload.split("|");
  if (!startRaw || !endRaw) {
    return null;
  }

  const startAt = new Date(startRaw);
  const endAt = new Date(endRaw);
  if (
    Number.isNaN(startAt.getTime()) ||
    Number.isNaN(endAt.getTime()) ||
    endAt <= startAt
  ) {
    return null;
  }

  return { startAt, endAt };
}
