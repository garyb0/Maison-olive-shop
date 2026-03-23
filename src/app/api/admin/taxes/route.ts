import { getTaxReport, taxReportToCsv } from "@/lib/admin";
import { jsonError, jsonOk } from "@/lib/http";
import { requireAdmin } from "@/lib/permissions";

const parseDate = (value: string | null) => {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
};

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const start = parseDate(searchParams.get("start"));
    const end = parseDate(searchParams.get("end"));
    const format = searchParams.get("format") ?? "json";

    const report = await getTaxReport(start, end);

    if (format === "csv") {
      const csv = taxReportToCsv(report.orders);
      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": "attachment; filename=tax-report.csv",
        },
      });
    }

    return jsonOk(report);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }
    return jsonError("Forbidden", 403);
  }
}
