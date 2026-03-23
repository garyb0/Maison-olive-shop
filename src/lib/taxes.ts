import { env } from "@/lib/env";

export const computeShipping = (subtotalCents: number) => {
  if (subtotalCents >= env.shippingFreeThresholdCents) {
    return 0;
  }
  return env.shippingFlatCents;
};

export const computeTaxes = (taxableCents: number) => {
  return Math.round(taxableCents * env.taxRate);
};

export const computeOrderAmounts = (subtotalCents: number, discountCents = 0) => {
  const discountedSubtotal = Math.max(0, subtotalCents - discountCents);
  const shippingCents = computeShipping(discountedSubtotal);
  const taxCents = computeTaxes(discountedSubtotal + shippingCents);
  const totalCents = discountedSubtotal + shippingCents + taxCents;

  return {
    subtotalCents,
    discountCents,
    shippingCents,
    taxCents,
    totalCents,
  };
};
