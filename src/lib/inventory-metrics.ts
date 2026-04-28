export type AdminInventoryMetricInput = {
  id: string;
  slug: string;
  nameFr: string;
  nameEn: string;
  stock: number;
  priceCents: number;
  costCents: number;
  currency: string;
  isActive: boolean;
  orderItems: Array<{
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
  }>;
  inventoryMovements: Array<{
    quantityChange: number;
    reason: string;
    orderId?: string | null;
  }>;
};

export type AdminInventoryMetricRow = {
  id: string;
  slug: string;
  nameFr: string;
  nameEn: string;
  stock: number;
  priceCents: number;
  costCents: number;
  currency: string;
  isActive: boolean;
  marginUnitCents: number;
  quantityAdded: number;
  quantitySold: number;
  quantityAdjusted: number;
  grossRevenueCents: number;
  estimatedCostOfGoodsCents: number;
  estimatedGrossProfitCents: number;
  stockValueAtCostCents: number;
  stockValueAtRetailCents: number;
};

export type AdminInventoryMetricSummary = {
  stockValueAtCostCents: number;
  stockValueAtRetailCents: number;
  grossRevenueCents: number;
  estimatedGrossProfitCents: number;
};

export function calculateAdminInventoryMetrics(products: AdminInventoryMetricInput[]) {
  const rows: AdminInventoryMetricRow[] = products.map((product) => {
    const quantityAdded = product.inventoryMovements.reduce((sum, movement) => {
      if (movement.orderId) return sum;
      return movement.quantityChange > 0 ? sum + movement.quantityChange : sum;
    }, 0);

    const quantityAdjusted = product.inventoryMovements.reduce((sum, movement) => {
      if (movement.orderId) return sum;
      return movement.quantityChange < 0 ? sum + Math.abs(movement.quantityChange) : sum;
    }, 0);

    const quantitySold = product.orderItems.reduce((sum, item) => sum + item.quantity, 0);
    const grossRevenueCents = product.orderItems.reduce((sum, item) => sum + item.lineTotalCents, 0);
    const estimatedCostOfGoodsCents = quantitySold * product.costCents;
    const estimatedGrossProfitCents = grossRevenueCents - estimatedCostOfGoodsCents;
    const marginUnitCents = product.priceCents - product.costCents;
    const stockValueAtCostCents = product.stock * product.costCents;
    const stockValueAtRetailCents = product.stock * product.priceCents;

    return {
      id: product.id,
      slug: product.slug,
      nameFr: product.nameFr,
      nameEn: product.nameEn,
      stock: product.stock,
      priceCents: product.priceCents,
      costCents: product.costCents,
      currency: product.currency,
      isActive: product.isActive,
      marginUnitCents,
      quantityAdded,
      quantitySold,
      quantityAdjusted,
      grossRevenueCents,
      estimatedCostOfGoodsCents,
      estimatedGrossProfitCents,
      stockValueAtCostCents,
      stockValueAtRetailCents,
    };
  });

  const summary = rows.reduce<AdminInventoryMetricSummary>(
    (acc, row) => {
      acc.stockValueAtCostCents += row.stockValueAtCostCents;
      acc.stockValueAtRetailCents += row.stockValueAtRetailCents;
      acc.grossRevenueCents += row.grossRevenueCents;
      acc.estimatedGrossProfitCents += row.estimatedGrossProfitCents;
      return acc;
    },
    {
      stockValueAtCostCents: 0,
      stockValueAtRetailCents: 0,
      grossRevenueCents: 0,
      estimatedGrossProfitCents: 0,
    },
  );

  return { rows, summary };
}
