import {
  AccountOrdersClient,
  type AccountFavoriteProduct,
  type AccountOrderListItem,
} from "@/app/account/orders/account-orders-client";
import { getCurrentUser } from "@/lib/auth";
import { getFavoriteProductsForUser } from "@/lib/favorites";
import { formatCurrency } from "@/lib/format";
import { getCurrentLanguage } from "@/lib/language";
import { prisma } from "@/lib/prisma";

export default async function AccountOrdersPage() {
  const user = await getCurrentUser();
  const language = await getCurrentLanguage();

  if (!user) {
    return null;
  }

  const [orders, favorites] = await Promise.all([
    prisma.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        items: {
          orderBy: { createdAt: "asc" },
          include: {
            product: {
              select: {
                id: true,
                slug: true,
                imageUrl: true,
                stock: true,
                isActive: true,
              },
            },
            variant: {
              select: {
                id: true,
                imageUrl: true,
                stock: true,
                isActive: true,
              },
            },
          },
        },
      },
    }),
    getFavoriteProductsForUser(user.id),
  ]);
  const locale = language === "fr" ? "fr-CA" : "en-CA";

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
    totalCents: order.totalCents,
    currency: order.currency,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      slug: item.product.slug,
      imageUrl: item.variant?.imageUrl ?? item.product.imageUrl,
      currentStock: item.variant?.stock ?? item.product.stock,
      isActive: item.product.isActive && (item.variant?.isActive ?? true),
      productNameFr: item.productNameSnapshotFr,
      productNameEn: item.productNameSnapshotEn,
      quantity: item.quantity,
    })),
  }));

  const favoriteProducts: AccountFavoriteProduct[] = favorites.map(({ product }) => ({
    id: product.id,
    slug: product.slug,
    nameFr: product.nameFr,
    nameEn: product.nameEn,
    imageUrl: product.imageUrl,
    priceLabel: formatCurrency(product.priceCents, product.currency, locale),
    stock: product.stock,
    isActive: product.isActive,
  }));

  return <AccountOrdersClient language={language} orders={orderItems} favoriteProducts={favoriteProducts} />;
}
