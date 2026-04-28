import { env } from "@/lib/env";

export const GST_RATE = 0.05;
export const QST_RATE = Math.max(0, env.taxRate - GST_RATE);

export const computeShipping = (subtotalCents: number) => {
  if (subtotalCents >= env.shippingFreeThresholdCents) {
    return 0;
  }
  return env.shippingFlatCents;
};

export const computeTaxBreakdown = (taxableCents: number) => {
  const gstCents = Math.round(taxableCents * GST_RATE);
  const qstCents = Math.round(taxableCents * QST_RATE);
  const taxCents = gstCents + qstCents;

  return {
    taxableCents,
    gstCents,
    qstCents,
    taxCents,
  };
};

export const computeTaxes = (taxableCents: number) => {
  return computeTaxBreakdown(taxableCents).taxCents;
};

export const computeStoredOrderTaxBreakdown = (
  subtotalCents: number,
  discountCents: number,
  shippingCents: number,
) => {
  const discountedSubtotal = Math.max(0, subtotalCents - discountCents);
  const taxableCents = discountedSubtotal + shippingCents;

  return {
    discountedSubtotal,
    ...computeTaxBreakdown(taxableCents),
  };
};

export const computeOrderAmounts = (subtotalCents: number, discountCents = 0) => {
  const discountedSubtotal = Math.max(0, subtotalCents - discountCents);
  const shippingCents = computeShipping(discountedSubtotal);
  const taxableCents = discountedSubtotal + shippingCents;
  const taxBreakdown = computeTaxBreakdown(taxableCents);
  const taxCents = taxBreakdown.taxCents;
  const totalCents = discountedSubtotal + shippingCents + taxCents;

  return {
    subtotalCents,
    discountCents,
    shippingCents,
    taxableCents,
    gstCents: taxBreakdown.gstCents,
    qstCents: taxBreakdown.qstCents,
    taxCents,
    totalCents,
  };
};
