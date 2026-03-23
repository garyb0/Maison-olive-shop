import { getAdminCustomers } from "@/lib/admin";
import { jsonError, jsonOk } from "@/lib/http";
import { requireAdmin } from "@/lib/permissions";
import { adminCustomersQuerySchema } from "@/lib/validators";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);

    const parsed = adminCustomersQuerySchema.safeParse({
      search: searchParams.get("search") ?? undefined,
      role: searchParams.get("role") ?? undefined,
      sortBy: searchParams.get("sortBy") ?? undefined,
      sortDir: searchParams.get("sortDir") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
    });

    if (!parsed.success) return jsonError("Invalid query", 400);

    const q = parsed.data;
    let customers = await getAdminCustomers(q.search);

    if (q.role) customers = customers.filter((c) => c.role === q.role);

    const sortBy = q.sortBy ?? "createdAt";
    const sortDir = q.sortDir ?? "desc";

    customers.sort((a, b) => {
      if (sortBy === "email") return sortDir === "asc" ? a.email.localeCompare(b.email) : b.email.localeCompare(a.email);
      if (sortBy === "firstName") return sortDir === "asc" ? a.firstName.localeCompare(b.firstName) : b.firstName.localeCompare(a.firstName);
      if (sortBy === "lastName") return sortDir === "asc" ? a.lastName.localeCompare(b.lastName) : b.lastName.localeCompare(a.lastName);
      return sortDir === "asc" ? a.createdAt.getTime() - b.createdAt.getTime() : b.createdAt.getTime() - a.createdAt.getTime();
    });

    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const total = customers.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const start = (page - 1) * pageSize;
    const rows = customers.slice(start, start + pageSize);

    return jsonOk({
      customers: rows,
      pagination: { total, page, pageSize, totalPages },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return jsonError("Unauthorized", 401);
    }
    return jsonError("Forbidden", 403);
  }
}
