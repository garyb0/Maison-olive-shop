import { describe, expect, it } from "vitest";
import { calculateAdminInventoryMetrics } from "@/lib/inventory-metrics";
import { adminProductCreateSchema, adminProductUpdateSchema } from "@/lib/validators";

describe("calculateAdminInventoryMetrics", () => {
  it("calculates added, sold, adjusted, revenue and gross profit", () => {
    const result = calculateAdminInventoryMetrics([
      {
        id: "prod_1",
        slug: "collier-qr",
        nameFr: "Collier QR",
        nameEn: "QR Collar",
        stock: 8,
        priceCents: 1500,
        costCents: 600,
        currency: "CAD",
        isActive: true,
        orderItems: [
          { quantity: 2, unitPriceCents: 1500, lineTotalCents: 3000 },
          { quantity: 1, unitPriceCents: 1200, lineTotalCents: 1200 },
        ],
        inventoryMovements: [
          { quantityChange: 10, reason: "INITIAL_STOCK", orderId: null },
          { quantityChange: 3, reason: "RESTOCK", orderId: null },
          { quantityChange: -2, reason: "ORDER_PAID", orderId: "ord_1" },
          { quantityChange: -1, reason: "DAMAGED", orderId: null },
          { quantityChange: -2, reason: "ORDER_PAID", orderId: "ord_2" },
        ],
      },
    ]);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      quantityAdded: 13,
      quantitySold: 3,
      quantityAdjusted: 1,
      grossRevenueCents: 4200,
      estimatedCostOfGoodsCents: 1800,
      estimatedGrossProfitCents: 2400,
      stockValueAtCostCents: 4800,
      stockValueAtRetailCents: 12000,
    });
    expect(result.summary).toMatchObject({
      stockValueAtCostCents: 4800,
      stockValueAtRetailCents: 12000,
      grossRevenueCents: 4200,
      estimatedGrossProfitCents: 2400,
    });
  });

  it("returns zero profit when a product has no sales", () => {
    const result = calculateAdminInventoryMetrics([
      {
        id: "prod_2",
        slug: "medaille",
        nameFr: "Medaille",
        nameEn: "Tag",
        stock: 5,
        priceCents: 999,
        costCents: 300,
        currency: "CAD",
        isActive: true,
        orderItems: [],
        inventoryMovements: [{ quantityChange: 5, reason: "INITIAL_STOCK", orderId: null }],
      },
    ]);

    expect(result.rows[0].quantitySold).toBe(0);
    expect(result.rows[0].grossRevenueCents).toBe(0);
    expect(result.rows[0].estimatedGrossProfitCents).toBe(0);
  });
});

describe("admin product cost validation", () => {
  it("accepts costCents on create and update", () => {
    expect(
      adminProductCreateSchema.safeParse({
        slug: "collier-qr",
        category: "Accessories",
        nameFr: "Collier QR",
        nameEn: "QR Collar",
        descriptionFr: "Description FR",
        descriptionEn: "Description EN",
        priceCents: 1500,
        costCents: 600,
        stock: 10,
      }).success,
    ).toBe(true);

    expect(
      adminProductUpdateSchema.safeParse({
        id: "prod_1",
        costCents: 700,
      }).success,
    ).toBe(true);
  });

  it("rejects negative costCents", () => {
    expect(
      adminProductCreateSchema.safeParse({
        slug: "collier-qr",
        category: "Accessories",
        nameFr: "Collier QR",
        nameEn: "QR Collar",
        descriptionFr: "Description FR",
        descriptionEn: "Description EN",
        priceCents: 1500,
        costCents: -1,
        stock: 10,
      }).success,
    ).toBe(false);

    expect(
      adminProductUpdateSchema.safeParse({
        id: "prod_1",
        costCents: -50,
      }).success,
    ).toBe(false);
  });
});
