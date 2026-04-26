import { createAdminProduct, deleteAdminProduct, getAdminProducts, updateAdminProduct } from "@/lib/admin";
import { jsonError, jsonOk } from "@/lib/http";
import { logApiEvent } from "@/lib/observability";
import { requireAdmin } from "@/lib/permissions";
import { adminProductCreateSchema, adminProductDeleteSchema, adminProductUpdateSchema } from "@/lib/validators";

const isPrismaUniqueError = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error && error.code === "P2002";

const getInvalidProductPayloadMessage = (issues: Array<{ path: PropertyKey[] }>) => {
  if (issues.some((issue) => issue.path[0] === "slug")) {
    return "Invalid product slug. Use only letters, numbers, and hyphens.";
  }

  return "Invalid product payload";
};

export async function GET() {
  try {
    await requireAdmin();
    const products = await getAdminProducts();
    return jsonOk({ products });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }
    return jsonError("Forbidden", 403);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = await request.json();
    const parsed = adminProductCreateSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError(getInvalidProductPayloadMessage(parsed.error.issues), 400);
    }

    const product = await createAdminProduct(parsed.data, admin.id);

    logApiEvent({
      level: "INFO",
      route: "/api/admin/products",
      event: "ADMIN_PRODUCT_CREATED",
      status: 200,
      details: { productId: product.id, slug: product.slug },
    });

    return jsonOk({ product });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return jsonError("Forbidden", 403);
    }
    if (isPrismaUniqueError(error)) {
      return jsonError("A product with this slug already exists", 409);
    }

    logApiEvent({
      level: "ERROR",
      route: "/api/admin/products",
      event: "ADMIN_PRODUCT_CREATE_FAILED",
      status: 500,
      details: { error },
    });

    return jsonError("Failed to create product", 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = await request.json();
    const parsed = adminProductUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError(getInvalidProductPayloadMessage(parsed.error.issues), 400);
    }

    const { id, ...changes } = parsed.data;
    const product = await updateAdminProduct(id, changes, admin.id);

    logApiEvent({
      level: "INFO",
      route: "/api/admin/products",
      event: "ADMIN_PRODUCT_UPDATED",
      status: 200,
      details: { productId: product.id, slug: product.slug },
    });

    return jsonOk({ product });
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
    if (isPrismaUniqueError(error)) {
      return jsonError("A product with this slug already exists", 409);
    }

    logApiEvent({
      level: "ERROR",
      route: "/api/admin/products",
      event: "ADMIN_PRODUCT_UPDATE_FAILED",
      status: 500,
      details: { error },
    });

    return jsonError("Failed to update product", 500);
  }
}

export async function DELETE(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = await request.json().catch(() => null);
    const parsed = adminProductDeleteSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError("Invalid delete payload", 400);
    }

    const result = await deleteAdminProduct(parsed.data.id, admin.id);

    logApiEvent({
      level: "INFO",
      route: "/api/admin/products",
      event: "ADMIN_PRODUCT_DELETED",
      status: 200,
      details: { productId: result.id, slug: result.slug },
    });

    return jsonOk({ deleted: true, ...result });
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
    if (error instanceof Error && error.message === "PRODUCT_DELETE_BLOCKED") {
      return jsonError("Product cannot be deleted because it is linked to order history", 409);
    }

    logApiEvent({
      level: "ERROR",
      route: "/api/admin/products",
      event: "ADMIN_PRODUCT_DELETE_FAILED",
      status: 500,
      details: { error },
    });

    return jsonError("Failed to delete product", 500);
  }
}
