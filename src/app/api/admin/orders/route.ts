import { getAdminOrders } from '@/lib/admin';
import { resolveDeliverySelectionForOrder, toDateKey } from '@/lib/delivery';
import { jsonError, jsonOk } from '@/lib/http';
import { logApiEvent } from '@/lib/observability';
import { requireAdmin } from '@/lib/permissions';
import { adminOrderUpdateSchema, adminOrdersQuerySchema } from '@/lib/validators';
import { prisma } from '@/lib/prisma';

function datesMatch(a: Date | null, b: Date | null) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.getTime() === b.getTime();
}

function mapDeliveryRouteOrder(order: {
  id: string;
  deliverySlotId: string | null;
  deliveryWindowStartAt: Date | null;
  deliveryWindowEndAt: Date | null;
  deliveryStatus: string;
}) {
  return {
    id: order.id,
    deliverySlotId: order.deliverySlotId,
    deliveryWindowStartAt: order.deliveryWindowStartAt?.toISOString() ?? null,
    deliveryWindowEndAt: order.deliveryWindowEndAt?.toISOString() ?? null,
    deliveryStatus: order.deliveryStatus,
    dateKey: order.deliveryWindowStartAt ? toDateKey(order.deliveryWindowStartAt) : null,
  };
}

function mapAdminOrderForResponse(order: {
  id: string;
  status: string;
  paymentStatus: string;
  deliveryStatus: string;
  deliverySlotId: string | null;
  deliveryWindowStartAt: Date | null;
  deliveryWindowEndAt: Date | null;
  deliveryPhone: string | null;
  deliveryInstructions: string | null;
}) {
  return {
    id: order.id,
    status: order.status,
    paymentStatus: order.paymentStatus,
    deliveryStatus: order.deliveryStatus,
    deliverySlotId: order.deliverySlotId,
    deliveryWindowStartAt: order.deliveryWindowStartAt?.toISOString() ?? null,
    deliveryWindowEndAt: order.deliveryWindowEndAt?.toISOString() ?? null,
    deliveryPhone: order.deliveryPhone,
    deliveryInstructions: order.deliveryInstructions,
    dateKey: order.deliveryWindowStartAt ? toDateKey(order.deliveryWindowStartAt) : null,
  };
}

function mapDeliverySelectionError(error: unknown) {
  if (!(error instanceof Error)) {
    return { message: 'Failed to update delivery details', status: 500 };
  }

  switch (error.message) {
    case 'ORDER_NOT_FOUND':
      return { message: 'Order not found', status: 404 };
    case 'DELIVERY_SLOT_NOT_FOUND':
      return { message: 'Delivery slot not found', status: 404 };
    case 'DELIVERY_SLOT_CLOSED':
      return { message: 'Selected delivery slot is closed', status: 400 };
    case 'DELIVERY_SLOT_FULL':
      return { message: 'Selected delivery slot is full', status: 400 };
    case 'DELIVERY_SLOT_OUTSIDE_BOOKING_WINDOW':
      return { message: 'Selected delivery slot is outside the booking window', status: 400 };
    case 'DELIVERY_WINDOW_PAST':
      return { message: 'Selected delivery window is in the past', status: 400 };
    case 'DELIVERY_WINDOW_INCOMPLETE':
      return { message: 'Selected delivery window is incomplete', status: 400 };
    case 'DELIVERY_WINDOW_INVALID_DURATION':
      return { message: 'Selected delivery window has an invalid duration', status: 400 };
    case 'DELIVERY_WINDOW_INVALID_PERIOD':
      return { message: 'Selected delivery window has an invalid period', status: 400 };
    case 'DELIVERY_WINDOW_FULL':
      return { message: 'Selected delivery window is full', status: 400 };
    case 'DELIVERY_DYNAMIC_DISABLED':
      return { message: 'Experimental delivery mode is disabled', status: 409 };
    default:
      return { message: 'Failed to update delivery details', status: 500 };
  }
}

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

    if (!parsed.success) {
      logApiEvent({
        level: 'WARN',
        route: '/api/admin/orders',
        event: 'ADMIN_ORDERS_INVALID_QUERY',
        status: 400,
      });
      return jsonError('Invalid query', 400);
    }

    const q = parsed.data;
    // Pagination et filtrage côté base de données
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const orders = await getAdminOrders({
      status: q.status,
      customer: q.customer,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    // Pour le total, on refait la requête sans pagination
    const total = await prisma.order.count({
      where: {
        ...(q.status ? { status: q.status } : {}),
        ...(q.customer
          ? {
              OR: [
                { customerEmail: { contains: q.customer } },
                { customerName: { contains: q.customer } },
              ],
            }
          : {}),
      },
    });
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    logApiEvent({
      level: 'INFO',
      route: '/api/admin/orders',
      event: 'ADMIN_ORDERS_FETCH_SUCCESS',
      status: 200,
      details: { total, page, pageSize, rows: orders.length },
    });

    return jsonOk({ orders, pagination: { total, page, pageSize, totalPages } });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      logApiEvent({
        level: 'WARN',
        route: '/api/admin/orders',
        event: 'ADMIN_ORDERS_UNAUTHORIZED',
        status: 401,
        details: { error },
      });
      return jsonError('Unauthorized', 401);
    }

    logApiEvent({
      level: 'WARN',
      route: '/api/admin/orders',
      event: 'ADMIN_ORDERS_FORBIDDEN',
      status: 403,
      details: { error },
    });

    return jsonError('Forbidden', 403);
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = await request.json().catch(() => null);

    const parsed = adminOrderUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError('Invalid payload', 400);
    }

    const { orderId, status, paymentStatus, deliveryStatus, deliverySlotId } = parsed.data;
    const isScheduleUpdate = body && typeof body === 'object' && 'deliverySlotId' in body;

    if (isScheduleUpdate) {
      const updated = await prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({
          where: { id: orderId },
          select: {
            id: true,
            deliverySlotId: true,
            deliveryWindowStartAt: true,
            deliveryWindowEndAt: true,
            deliveryStatus: true,
          },
        });
        if (!order) {
          throw new Error('ORDER_NOT_FOUND');
        }

        const selection = await resolveDeliverySelectionForOrder(tx, {
          deliverySlotId: deliverySlotId ?? undefined,
          excludeOrderId: orderId,
        });

        const scheduleChanged =
          order.deliverySlotId !== selection.deliverySlotId ||
          !datesMatch(order.deliveryWindowStartAt, selection.deliveryWindowStartAt) ||
          !datesMatch(order.deliveryWindowEndAt, selection.deliveryWindowEndAt);

        const nextDeliveryStatus =
          selection.deliveryStatus === 'UNSCHEDULED'
            ? 'UNSCHEDULED'
            : scheduleChanged && (order.deliverySlotId || order.deliveryWindowStartAt)
              ? 'RESCHEDULED'
              : 'SCHEDULED';

        const nextOrder = await tx.order.update({
          where: { id: orderId },
          data: {
            deliverySlotId: selection.deliverySlotId,
            deliveryWindowStartAt: selection.deliveryWindowStartAt,
            deliveryWindowEndAt: selection.deliveryWindowEndAt,
            deliveryStatus: nextDeliveryStatus,
          },
          select: {
            id: true,
            deliverySlotId: true,
            deliveryWindowStartAt: true,
            deliveryWindowEndAt: true,
            deliveryStatus: true,
          },
        });

        await tx.auditLog.create({
          data: {
            actorUserId: admin.id,
            action: 'DELIVERY_SLOT_RESCHEDULED',
            entity: 'Order',
            entityId: orderId,
            metadata: JSON.stringify({
              from: {
                deliverySlotId: order.deliverySlotId,
                deliveryWindowStartAt: order.deliveryWindowStartAt?.toISOString() ?? null,
                deliveryWindowEndAt: order.deliveryWindowEndAt?.toISOString() ?? null,
                deliveryStatus: order.deliveryStatus,
              },
              to: {
                deliverySlotId: nextOrder.deliverySlotId,
                deliveryWindowStartAt: nextOrder.deliveryWindowStartAt?.toISOString() ?? null,
                deliveryWindowEndAt: nextOrder.deliveryWindowEndAt?.toISOString() ?? null,
                deliveryStatus: nextOrder.deliveryStatus,
              },
            }),
          },
        });

        return { order, nextOrder };
      });

      logApiEvent({
        level: 'INFO',
        route: '/api/admin/orders',
        event: 'ADMIN_DELIVERY_SLOT_RESCHEDULED',
        status: 200,
        details: {
          orderId,
          fromSlotId: updated.order.deliverySlotId,
          toSlotId: updated.nextOrder.deliverySlotId,
          toStatus: updated.nextOrder.deliveryStatus,
        },
      });

      return jsonOk({ order: mapDeliveryRouteOrder(updated.nextOrder) });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          status: true,
          paymentStatus: true,
          deliveryStatus: true,
          deliverySlotId: true,
          deliveryWindowStartAt: true,
          deliveryWindowEndAt: true,
          deliveryPhone: true,
          deliveryInstructions: true,
        },
      });

      if (!order) {
        throw new Error('ORDER_NOT_FOUND');
      }

      const patch: {
        status?: typeof order.status;
        paymentStatus?: typeof order.paymentStatus;
        deliveryStatus?: typeof order.deliveryStatus;
      } = {};

      if (status !== undefined) {
        patch.status = status;
      }

      if (paymentStatus !== undefined) {
        patch.paymentStatus = paymentStatus;
      }

      if (deliveryStatus !== undefined) {
        patch.deliveryStatus = deliveryStatus;
      }

      const nextOrder = await tx.order.update({
        where: { id: orderId },
        data: patch,
        select: {
          id: true,
          status: true,
          paymentStatus: true,
          deliveryStatus: true,
          deliverySlotId: true,
          deliveryWindowStartAt: true,
          deliveryWindowEndAt: true,
          deliveryPhone: true,
          deliveryInstructions: true,
        },
      });

      const auditEntries = [];

      if (status !== undefined && status !== order.status) {
        auditEntries.push(
          tx.auditLog.create({
            data: {
              actorUserId: admin.id,
              action: 'ORDER_STATUS_UPDATED',
              entity: 'Order',
              entityId: orderId,
              metadata: JSON.stringify({
                from: order.status,
                to: status,
              }),
            },
          }),
        );
      }

      if (paymentStatus !== undefined && paymentStatus !== order.paymentStatus) {
        auditEntries.push(
          tx.auditLog.create({
            data: {
              actorUserId: admin.id,
              action: 'PAYMENT_STATUS_UPDATED',
              entity: 'Order',
              entityId: orderId,
              metadata: JSON.stringify({
                from: order.paymentStatus,
                to: paymentStatus,
              }),
            },
          }),
        );
      }

      if (deliveryStatus !== undefined && deliveryStatus !== order.deliveryStatus) {
        auditEntries.push(
          tx.auditLog.create({
            data: {
              actorUserId: admin.id,
              action: 'DELIVERY_STATUS_UPDATED',
              entity: 'Order',
              entityId: orderId,
              metadata: JSON.stringify({
                from: order.deliveryStatus,
                to: deliveryStatus,
              }),
            },
          }),
        );
      }

      await Promise.all(auditEntries);

      return { order, nextOrder };
    });

    if (status !== undefined && status !== updated.order.status) {
      logApiEvent({
        level: 'INFO',
        route: '/api/admin/orders',
        event: 'ADMIN_ORDER_STATUS_UPDATED',
        status: 200,
        details: { orderId, from: updated.order.status, to: status },
      });
    }

    if (paymentStatus !== undefined && paymentStatus !== updated.order.paymentStatus) {
      logApiEvent({
        level: 'INFO',
        route: '/api/admin/orders',
        event: 'ADMIN_PAYMENT_STATUS_UPDATED',
        status: 200,
        details: { orderId, from: updated.order.paymentStatus, to: paymentStatus },
      });
    }

    if (deliveryStatus !== undefined && deliveryStatus !== updated.order.deliveryStatus) {
      logApiEvent({
        level: 'INFO',
        route: '/api/admin/orders',
        event: 'ADMIN_DELIVERY_STATUS_UPDATED',
        status: 200,
        details: { orderId, from: updated.order.deliveryStatus, to: deliveryStatus },
      });
    }

    return jsonOk({ order: mapAdminOrderForResponse(updated.nextOrder) });
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return jsonError('Unauthorized', 401);
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return jsonError('Forbidden', 403);
    }
    if (error instanceof Error && error.message === 'ORDER_NOT_FOUND') {
      return jsonError('Order not found', 404);
    }

    const mapped = mapDeliverySelectionError(error);
    return jsonError(mapped.message, mapped.status);
  }
}
