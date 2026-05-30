import { getAdminOrders, getAdminProductInventoryMetrics, getAdminProducts, getRecentInventoryMovements } from "@/lib/admin";
import { jsonError, jsonOk } from "@/lib/http";
import { logApiEvent } from "@/lib/observability";

const STORE_ID = "maison-olive-shop";
const STORE_NAME = "Maison Olive Shop";
const LOW_STOCK_THRESHOLD = 3;

function getExpectedToken() {
  return process.env.HOMECORE_INTERNAL_TOKEN?.trim() ?? "";
}

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return "";
  }

  return token.trim();
}

function isAuthorized(request: Request) {
  const expectedToken = getExpectedToken();
  const receivedToken = getBearerToken(request);

  return Boolean(expectedToken && receivedToken && receivedToken === expectedToken);
}

function productName(product: { nameFr: string; nameEn: string }) {
  return {
    nameFr: product.nameFr,
    nameEn: product.nameEn,
  };
}

export async function GET(request: Request) {
  const expectedToken = getExpectedToken();

  if (!expectedToken) {
    return jsonError("HomeCore internal token is not configured", 503);
  }

  if (!isAuthorized(request)) {
    return jsonError("Unauthorized", 401);
  }

  try {
    const [products, inventoryMetrics, recentMovements, orders] = await Promise.all([
      getAdminProducts(),
      getAdminProductInventoryMetrics(),
      getRecentInventoryMovements(10),
      getAdminOrders({ limit: 100 }),
    ]);

    const activeProducts = products.filter((product) => product.isActive);
    const lowStockProducts = activeProducts
      .filter((product) => product.stock > 0 && product.stock <= LOW_STOCK_THRESHOLD)
      .map((product) => ({
        id: product.id,
        sku: product.sku ?? null,
        slug: product.slug,
        ...productName(product),
        stock: product.stock,
      }));
    const outOfStockProducts = activeProducts
      .filter((product) => product.stock <= 0)
      .map((product) => ({
        id: product.id,
        sku: product.sku ?? null,
        slug: product.slug,
        ...productName(product),
        stock: product.stock,
      }));
    const ordersToPrepareCount = orders.filter(
      (order) => order.paymentStatus === "PAID" && ["PAID", "PROCESSING"].includes(order.status),
    ).length;

    logApiEvent({
      level: "INFO",
      route: "/api/internal/homecore/summary",
      event: "HOMECORE_SUMMARY_READ",
      status: 200,
      details: {
        products: products.length,
        lowStock: lowStockProducts.length,
        outOfStock: outOfStockProducts.length,
      },
    });

    return jsonOk({
      storeId: STORE_ID,
      storeName: STORE_NAME,
      generatedAt: new Date().toISOString(),
      inventorySummary: {
        totalProducts: products.length,
        activeProducts: activeProducts.length,
        lowStockCount: lowStockProducts.length,
        outOfStockCount: outOfStockProducts.length,
        stockValueAtCostCents: inventoryMetrics.summary.stockValueAtCostCents,
        stockValueAtRetailCents: inventoryMetrics.summary.stockValueAtRetailCents,
      },
      financialSummary: {
        grossRevenueCents: inventoryMetrics.summary.grossRevenueCents,
        estimatedGrossProfitCents: inventoryMetrics.summary.estimatedGrossProfitCents,
      },
      lowStockProducts,
      outOfStockProducts,
      ordersSummary: {
        pendingOrders: orders.filter((order) => order.status === "PENDING").length,
        ordersToPrepareCount,
      },
      recentMovements: recentMovements.map((movement) => ({
        createdAt: movement.createdAt.toISOString(),
        sku: movement.product.sku ?? null,
        productNameFr: movement.product.nameFr,
        productNameEn: movement.product.nameEn,
        quantityChange: movement.quantityChange,
        reason: movement.reason,
      })),
    });
  } catch (error) {
    logApiEvent({
      level: "ERROR",
      route: "/api/internal/homecore/summary",
      event: "HOMECORE_SUMMARY_FAILED",
      status: 500,
      details: { error },
    });

    return jsonError("Failed to build HomeCore summary", 500);
  }
}
