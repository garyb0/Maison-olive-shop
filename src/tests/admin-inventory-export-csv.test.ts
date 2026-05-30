import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

describe("admin inventory CSV exports", () => {
  it("exports the inventory snapshot columns needed for Excel", async () => {
    const { inventorySnapshotToCsv } = await import("@/lib/admin");

    const csv = inventorySnapshotToCsv([
      {
        id: "prod_1",
        variantId: "",
        sku: "FOOD-CROQ-BULL",
        barcode: "123456789012",
        slug: "croquettes-premium-bulldog",
        productSku: "FOOD-CROQ-BULL",
        variantSku: "",
        productSlug: "croquettes-premium-bulldog",
        variantSlug: "",
        nameFr: "Croquettes Premium Bulldog",
        nameEn: "Premium Bulldog Kibble",
        variantNameFr: "",
        variantNameEn: "",
        colorNameFr: "",
        colorNameEn: "",
        colorHex: "",
        sizeNameFr: "",
        sizeNameEn: "",
        sizeCode: "",
        sizeSortOrder: "",
        category: "Food",
        subcategoryFr: "Croquettes",
        subcategoryEn: "Kibble",
        stock: 4,
        priceCents: 6999,
        costCents: 4200,
        currency: "CAD",
        isActive: true,
        quantityAdded: 10,
        quantitySold: 6,
        quantityAdjusted: 0,
        grossRevenueCents: 41994,
        estimatedCostOfGoodsCents: 25200,
        estimatedGrossProfitCents: 16794,
        stockValueAtCostCents: 16800,
        stockValueAtRetailCents: 27996,
      },
    ]);

    expect(csv.split("\n")[0]).toBe(
      '"sku","barcode","slug","product_sku","variant_sku","product_slug","variant_slug","name_fr","name_en","variant_fr","variant_en","color_fr","color_en","color_hex","size_fr","size_en","size_code","size_sort_order","category","subcategory_fr","subcategory_en","stock","price_cents","cost_cents","currency","is_active","quantity_added","quantity_sold","quantity_adjusted","gross_revenue_cents","estimated_cost_of_goods_cents","estimated_gross_profit_cents","stock_value_at_cost_cents","stock_value_at_retail_cents"',
    );
    expect(csv).toContain('"FOOD-CROQ-BULL","123456789012","croquettes-premium-bulldog"');
  });

  it("exports movement history with product SKU and linked order", async () => {
    const { inventoryMovementsToCsv } = await import("@/lib/admin");

    const csv = inventoryMovementsToCsv([
      {
        id: "move_1",
        productId: "prod_1",
        variantId: null,
        orderId: "ord_1",
        quantityChange: -2,
        reason: "ORDER_PAID",
        createdAt: new Date("2026-05-08T12:00:00.000Z"),
        variant: null,
        product: {
          id: "prod_1",
          sku: "FOOD-CROQ-BULL",
          slug: "croquettes-premium-bulldog",
          nameFr: "Croquettes Premium Bulldog",
          nameEn: "Premium Bulldog Kibble",
        },
        order: {
          orderNumber: "CO-1001",
        },
      },
    ]);

    expect(csv.split("\n")[0]).toBe(
      '"created_at","sku","slug","product_sku","variant_sku","product_slug","variant_slug","product_name_fr","product_name_en","variant_fr","variant_en","quantity_change","reason","order_number"',
    );
    expect(csv).toContain('"2026-05-08T12:00:00.000Z","FOOD-CROQ-BULL"');
    expect(csv).toContain('"CO-1001"');
  });
});
