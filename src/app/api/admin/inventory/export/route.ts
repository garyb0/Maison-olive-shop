import {
  getAdminInventoryMovementExport,
  getAdminInventorySnapshotExport,
  inventoryMovementsToCsv,
  inventorySnapshotToCsv,
} from "@/lib/admin";
import { jsonError } from "@/lib/http";
import { logApiEvent } from "@/lib/observability";
import { requireAdmin } from "@/lib/permissions";

const csvResponse = (csv: string, filename: string) =>
  new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") ?? "snapshot";

    if (view === "snapshot") {
      const rows = await getAdminInventorySnapshotExport();
      const csv = inventorySnapshotToCsv(rows);

      logApiEvent({
        level: "INFO",
        route: "/api/admin/inventory/export",
        event: "ADMIN_INVENTORY_SNAPSHOT_EXPORT_CSV",
        status: 200,
        details: { rows: rows.length },
      });

      return csvResponse(csv, "inventory-snapshot.csv");
    }

    if (view === "movements") {
      const rows = await getAdminInventoryMovementExport();
      const csv = inventoryMovementsToCsv(rows);

      logApiEvent({
        level: "INFO",
        route: "/api/admin/inventory/export",
        event: "ADMIN_INVENTORY_MOVEMENTS_EXPORT_CSV",
        status: 200,
        details: { rows: rows.length },
      });

      return csvResponse(csv, "inventory-movements.csv");
    }

    return jsonError("Invalid inventory export view", 400);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }

    logApiEvent({
      level: "WARN",
      route: "/api/admin/inventory/export",
      event: "ADMIN_INVENTORY_EXPORT_FORBIDDEN",
      status: 403,
      details: { error },
    });

    return jsonError("Forbidden", 403);
  }
}
