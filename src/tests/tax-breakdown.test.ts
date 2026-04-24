/// <reference types="vitest/globals" />

vi.mock("@/lib/env", () => ({
  env: {
    taxRate: 0.14975,
    shippingFlatCents: 899,
    shippingFreeThresholdCents: 7500,
  },
}));

import { computeOrderAmounts, computeTaxBreakdown } from "@/lib/taxes";

describe("computeTaxBreakdown", () => {
  it("separe la TPS et la TVQ avec un arrondi individuel", () => {
    const result = computeTaxBreakdown(7899);

    expect(result.taxableCents).toBe(7899);
    expect(result.gstCents).toBe(395);
    expect(result.qstCents).toBe(788);
    expect(result.taxCents).toBe(1183);
  });

  it("retourne zero partout pour un montant nul", () => {
    expect(computeTaxBreakdown(0)).toEqual({
      taxableCents: 0,
      gstCents: 0,
      qstCents: 0,
      taxCents: 0,
    });
  });
});

describe("computeOrderAmounts", () => {
  it("inclut les composantes detaillees de taxes dans le quote", () => {
    const result = computeOrderAmounts(8000, 1000);

    expect(result.subtotalCents).toBe(8000);
    expect(result.discountCents).toBe(1000);
    expect(result.shippingCents).toBe(899);
    expect(result.taxableCents).toBe(7899);
    expect(result.gstCents).toBe(395);
    expect(result.qstCents).toBe(788);
    expect(result.taxCents).toBe(1183);
    expect(result.totalCents).toBe(9082);
  });
});
