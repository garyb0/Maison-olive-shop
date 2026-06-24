import {
  AccountOrdersClient,
  type AccountOrderListItem,
} from "@/app/account/orders/account-orders-client";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentLanguage } from "@/lib/language";
import { prisma } from "@/lib/prisma";

export default async function AccountOrdersPage() {
  const user = await getCurrentUser();
  const language = await getCurrentLanguage();

  if (!user) {
    return null;
  }

  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      items: {
        orderBy: { createdAt: "asc" },
        include: {
          product: {
            select: {
              slug: true,
            },
          },
        },
      },
    },
  });

  const orderItems: AccountOrderListItem[] = orders.map((order) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    createdAt: order.createdAt.toISOString(),
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    deliveryStatus: order.deliveryStatus,
    deliveryWindowStartAt: order.deliveryWindowStartAt?.toISOString() ?? null,
    deliveryWindowEndAt: order.deliveryWindowEndAt?.toISOString() ?? null,
    items: order.items.map((item) => ({
      id: item.id,
      slug: item.product.slug,
      productNameFr: item.productNameSnapshotFr,
      productNameEn: item.productNameSnapshotEn,
      quantity: item.quantity,
    })),
  }));

  return <AccountOrdersClient language={language} orders={orderItems} />;
}
