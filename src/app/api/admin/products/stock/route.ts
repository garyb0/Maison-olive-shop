import { adjustAdminProductStock } from "@/lib/admin";
import { jsonError, jsonOk } from "@/lib/http";
import { logApiEvent } from "@/lib/observability";
import { requireAdmin } from "@/lib/permissions";
import { adminStockAdjustmentSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = await request.json();
    const parsed = adminStockAdjustmentSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("Invalid stock adjustment payload", 400);
    }

    const { productId, quantityChange, reason } = parsed.data;
    const result = await adjustAdminProductStock(productId, quantityChange, admin.id, reason);

    logApiEvent({
      level: "INFO",
      route: "/api/admin/products/stock",
      event: "ADMIN_PRODUCT_STOCK_UPDATED",
      status: 200,
      details: { productId, quantityChange, reason: reason ?? "ADMIN_STOCK_ADJUSTMENT" },
    });

    return jsonOk(result);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return jsonError("Forbidden", 403);
    }
    if (error instanceof Error && error.message === "PRODUCT_NOT_FOUND") {
      return jsonError("Product not found", 404);
    }
    if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") {
      return jsonError("Insufficient stock", 409);
    }

    logApiEvent({
      level: "ERROR",
      route: "/api/admin/products/stock",
      event: "ADMIN_PRODUCT_STOCK_UPDATE_FAILED",
      status: 500,
      details: { error },
    });

    return jsonError("Failed to adjust stock", 500);
  }
}