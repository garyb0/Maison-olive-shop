import { importAdminProductVariantCsv } from "@/lib/admin";
import { jsonError, jsonOk } from "@/lib/http";
import { logApiEvent } from "@/lib/observability";
import { requireAdmin } from "@/lib/permissions";
import { adminProductVariantImportSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = await request.json();
    const parsed = adminProductVariantImportSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("Invalid product import payload", 400);
    }

    const result = await importAdminProductVariantCsv(parsed.data.csvText, admin.id, {
      dryRun: parsed.data.dryRun,
    });

    if (!parsed.data.dryRun && result.errors.length > 0) {
      return Response.json({ import: result }, { status: 400 });
    }

    logApiEvent({
      level: "INFO",
      route: "/api/admin/products/import",
      event: parsed.data.dryRun ? "ADMIN_PRODUCT_IMPORT_PREVIEW" : "ADMIN_PRODUCT_IMPORT_APPLIED",
      status: 200,
      details: {
        rows: result.rows,
        createdProducts: result.createdProducts,
        updatedProducts: result.updatedProducts,
        createdVariants: result.createdVariants,
        updatedVariants: result.updatedVariants,
        errors: result.errors.length,
      },
    });

    return jsonOk({ import: result });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return jsonError("Forbidden", 403);
    }
    if (error instanceof Error && error.message.startsWith("INVALID_SUBCATEGORY_ROW_")) {
      return jsonError("Product subcategory must belong to the selected category", 400);
    }
    if (error instanceof Error && error.message.startsWith("VARIANT_SKU_PRODUCT_MISMATCH_ROW_")) {
      return jsonError("Variant SKU already belongs to another product", 409);
    }

    logApiEvent({
      level: "ERROR",
      route: "/api/admin/products/import",
      event: "ADMIN_PRODUCT_IMPORT_FAILED",
      status: 500,
      details: { error },
    });

    return jsonError("Failed to import products", 500);
  }
}
