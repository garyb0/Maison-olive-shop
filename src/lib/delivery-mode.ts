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

export function isDynamicDeliverySlotId(value?: string | null) {
  return typeof value === "string" && value.startsWith(DYNAMIC_SLOT_PREFIX);
}
