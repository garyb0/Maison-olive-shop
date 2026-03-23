import { getAdminOrders } from '@/lib/admin';
import { jsonError, jsonOk } from '@/lib/http';
import { requireAdmin } from '@/lib/permissions';
import { adminOrdersQuerySchema } from '@/lib/validators';

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);

    const parsed = adminOrdersQuerySchema.safeParse({
      status: searchParams.get('status') ?? undefined,
      paymentStatus: searchParams.get('paymentStatus') ?? undefined,
      customer: searchParams.get('customer') ?? undefined,
      from: searchParams.get('from') ?? undefined,
      to: searchParams.get('to') ?? undefined,
      sortBy: searchParams.get('sortBy') ?? undefined,
      sortDir: searchParams.get('sortDir') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      pageSize: searchParams.get('pageSize') ?? undefined,
    });

    if (!parsed.success) return jsonError('Invalid query', 400);

    const q = parsed.data;
    let orders = await getAdminOrders({ status: q.status, customer: q.customer });

    if (q.paymentStatus) orders = orders.filter((o) => o.paymentStatus === q.paymentStatus);
    if (q.from) {
      const from = new Date(q.from + 'T00:00:00');
      orders = orders.filter((o) => o.createdAt >= from);
    }
    if (q.to) {
      const to = new Date(q.to + 'T23:59:59.999');
      orders = orders.filter((o) => o.createdAt <= to);
    }

    const sortBy = q.sortBy ?? 'createdAt';
    const sortDir = q.sortDir ?? 'desc';
    orders.sort((a, b) => {
      if (sortBy === 'totalCents') return sortDir === 'asc' ? a.totalCents - b.totalCents : b.totalCents - a.totalCents;
      if (sortBy === 'orderNumber') return sortDir === 'asc' ? a.orderNumber.localeCompare(b.orderNumber) : b.orderNumber.localeCompare(a.orderNumber);
      if (sortBy === 'status') return sortDir === 'asc' ? a.status.localeCompare(b.status) : b.status.localeCompare(a.status);
      if (sortBy === 'paymentStatus') return sortDir === 'asc' ? a.paymentStatus.localeCompare(b.paymentStatus) : b.paymentStatus.localeCompare(a.paymentStatus);
      return sortDir === 'asc' ? a.createdAt.getTime() - b.createdAt.getTime() : b.createdAt.getTime() - a.createdAt.getTime();
    });

    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const total = orders.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const start = (page - 1) * pageSize;
    const rows = orders.slice(start, start + pageSize);

    return jsonOk({ orders: rows, pagination: { total, page, pageSize, totalPages } });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return jsonError('Unauthorized', 401);
    return jsonError('Forbidden', 403);
  }
}
