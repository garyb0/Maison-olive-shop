import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { OrderStatus } from "@/lib/types";
import { calculateAdminInventoryMetrics } from "@/lib/inventory-metrics";
import { computeStoredOrderTaxBreakdown } from "@/lib/taxes";

const DEFAULT_STOCK_ADJUSTMENT_REASON = "ADMIN_STOCK_ADJUSTMENT";

type OrdersFilter = {
  status?: OrderStatus;
  customer?: string;
  limit?: number;
  offset?: number;
};

const adminOrderSelect = {
  id: true,
  userId: true,
  orderNumber: true,
  customerEmail: true,
  customerName: true,
  promoCode: true,
  status: true,
  paymentStatus: true,
  totalCents: true,
  currency: true,
  createdAt: true,
  deliveryWindowStartAt: true,
  deliveryWindowEndAt: true,
  deliveryStatus: true,
  deliveryPhone: true,
  deliveryInstructions: true,
} satisfies Prisma.OrderSelect;

const adminOrderSelectLegacy = {
  id: true,
  orderNumber: true,
  customerEmail: true,
  customerName: true,
  promoCode: true,
  status: true,
  paymentStatus: true,
  totalCents: true,
  currency: true,
  createdAt: true,
} satisfies Prisma.OrderSelect;

function isMissingOrderDeliveryColumnsError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2022") {
    return true;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("deliverywindowstartat") ||
      message.includes("deliverywindowendat") ||
      message.includes("deliverystatus") ||
      message.includes("deliveryphone") ||
      message.includes("deliveryinstructions") ||
      message.includes("no such column")
    );
  }

  return false;
}

export async function getAdminOrders(filter: OrdersFilter) {
  const where: Prisma.OrderWhereInput = {
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.customer
      ? {
          OR: [
            { customerEmail: { contains: filter.customer } },
            { customerName: { contains: filter.customer } },
          ],
        }
      : {}),
  };
  const take = filter.limit ?? 50;
  const skip = filter.offset ?? 0;

  try {
    return await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: adminOrderSelect,
      take,
      skip,
    });
  } catch (error) {
    if (!isMissingOrderDeliveryColumnsError(error)) {
      throw error;
    }

    const legacyOrders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: adminOrderSelectLegacy,
      take,
      skip,
    });

    return legacyOrders.map((order) => ({
      ...order,
      userId: null,
      deliveryWindowStartAt: null,
      deliveryWindowEndAt: null,
      deliveryStatus: "UNSCHEDULED" as const,
      deliveryPhone: null,
      deliveryInstructions: null,
    }));
  }
}

export async function getAdminOrderDetail(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      customerEmail: true,
      customerName: true,
      promoCode: true,
      status: true,
      paymentStatus: true,
      paymentMethod: true,
      paymentProvider: true,
      subtotalCents: true,
      discountCents: true,
      taxCents: true,
      shippingCents: true,
      refundedCents: true,
      totalCents: true,
      currency: true,
      shippingLine1: true,
      shippingCity: true,
      shippingRegion: true,
      shippingPostal: true,
      shippingCountry: true,
      deliveryWindowStartAt: true,
      deliveryWindowEndAt: true,
      deliveryStatus: true,
      deliveryPhone: true,
      deliveryInstructions: true,
      createdAt: true,
      updatedAt: true,
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      },
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          quantity: true,
          unitPriceCents: true,
          lineTotalCents: true,
          productNameSnapshotFr: true,
          productNameSnapshotEn: true,
          product: {
            select: {
              id: true,
              slug: true,
            },
          },
        },
      },
    },
  });
}

export async function getAdminOrderAuditLogs(orderId: string, limit = 50) {
  return prisma.auditLog.findMany({
    where: {
      entity: "Order",
      entityId: orderId,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      action: true,
      metadata: true,
      createdAt: true,
      actor: {
        select: {
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });
}

export async function getAdminCustomers(search?: string) {
  return prisma.user.findMany({
    where: {
      ...(search
        ? {
            OR: [
              { email: { contains: search } },
              { firstName: { contains: search } },
              { lastName: { contains: search } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      createdAt: true,
      orders: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
        },
      },
    },
  });
}

export async function getAdminCustomerDetail(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      language: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          orders: true,
          deliveryAddresses: true,
          customerSupportConversations: true,
          subscriptions: true,
        },
      },
      orders: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          deliveryStatus: true,
          totalCents: true,
          currency: true,
          createdAt: true,
        },
      },
      customerSupportConversations: {
        orderBy: { lastMessageAt: "desc" },
        take: 5,
        select: {
          id: true,
          status: true,
          lastMessageAt: true,
          createdAt: true,
          assignedAdmin: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
      subscriptions: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          status: true,
          quantity: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
          product: {
            select: {
              nameFr: true,
              nameEn: true,
            },
          },
        },
      },
    },
  });
}

const adminProductsPageSelect = {
  id: true,
  slug: true,
  nameFr: true,
  nameEn: true,
  descriptionFr: true,
  descriptionEn: true,
  imageUrl: true,
  priceCents: true,
  currency: true,
  stock: true,
  isActive: true,
  isSubscription: true,
  priceWeekly: true,
  priceBiweekly: true,
  priceMonthly: true,
  priceQuarterly: true,
  createdAt: true,
  category: {
    select: {
      name: true,
    },
  },
  _count: {
    select: {
      orderItems: true,
    },
  },
} as const;

export async function getAdminProducts() {
  return prisma.product.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    select: adminProductsPageSelect,
  });
}

export async function getRecentInventoryMovements(limit = 50) {
  return prisma.inventoryMovement.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      product: {
        select: {
          id: true,
          nameFr: true,
          nameEn: true,
        },
      },
      order: {
        select: {
          orderNumber: true,
        },
      },
    },
  });
}

type AdminProductCreateInput = {
  slug: string;
  category: string;
  nameFr: string;
  nameEn: string;
  descriptionFr: string;
  descriptionEn: string;
  imageUrl?: string;
  priceCents: number;
  costCents: number;
  currency?: string;
  stock: number;
  isActive?: boolean;
  isSubscription?: boolean;
  priceWeekly?: number | null;
  priceBiweekly?: number | null;
  priceMonthly?: number | null;
  priceQuarterly?: number | null;
};

type AdminProductUpdateInput = {
  slug?: string;
  category?: string;
  nameFr?: string;
  nameEn?: string;
  descriptionFr?: string;
  descriptionEn?: string;
  imageUrl?: string;
  priceCents?: number;
  costCents?: number;
  currency?: string;
  isActive?: boolean;
  isSubscription?: boolean;
  priceWeekly?: number | null;
  priceBiweekly?: number | null;
  priceMonthly?: number | null;
  priceQuarterly?: number | null;
};

export async function createAdminProduct(input: AdminProductCreateInput, actorUserId: string) {
  return prisma.$transaction(async (tx) => {
    const category = await tx.category.upsert({
      where: { name: input.category },
      update: {},
      create: { name: input.category },
    });

    const product = await tx.product.create({
      data: {
        slug: input.slug,
        categoryId: category.id,
        nameFr: input.nameFr,
        nameEn: input.nameEn,
        descriptionFr: input.descriptionFr,
        descriptionEn: input.descriptionEn,
        imageUrl: input.imageUrl ?? null,
        priceCents: input.priceCents,
        costCents: input.costCents,
        currency: input.currency ?? "CAD",
        stock: input.stock,
        isActive: input.isActive ?? true,
        isSubscription: input.isSubscription ?? false,
        priceWeekly: input.priceWeekly,
        priceBiweekly: input.priceBiweekly,
        priceMonthly: input.priceMonthly,
        priceQuarterly: input.priceQuarterly,
      },
      select: adminProductsPageSelect,
    });

    await tx.auditLog.create({
      data: {
        actorUserId,
        action: "ADMIN_PRODUCT_CREATED",
        entity: "Product",
        entityId: product.id,
        metadata: JSON.stringify({ slug: product.slug, stock: product.stock }),
      },
    });

    if (product.stock > 0) {
      await tx.inventoryMovement.create({
        data: {
          productId: product.id,
          quantityChange: product.stock,
          reason: "INITIAL_STOCK",
        },
      });
    }

    return product;
  });
}

export async function updateAdminProduct(productId: string, input: AdminProductUpdateInput, actorUserId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.product.findUnique({ where: { id: productId } });
    if (!existing) throw new Error("PRODUCT_NOT_FOUND");

    let categoryId: string | undefined;
    if (input.category != null && input.category !== '') {
      const category = await tx.category.upsert({
        where: { name: input.category },
        update: {},
        create: { name: input.category },
      });
      // Si la catégorie n'existe pas, on ignore simplement ce champ
      categoryId = category.id;
    }

    const product = await tx.product.update({
      where: { id: productId },
      data: {
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(categoryId !== undefined ? { categoryId } : {}),
        ...(input.nameFr !== undefined ? { nameFr: input.nameFr } : {}),
        ...(input.nameEn !== undefined ? { nameEn: input.nameEn } : {}),
        ...(input.descriptionFr !== undefined ? { descriptionFr: input.descriptionFr } : {}),
        ...(input.descriptionEn !== undefined ? { descriptionEn: input.descriptionEn } : {}),
        ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl ?? null } : {}),
        ...(input.priceCents !== undefined ? { priceCents: input.priceCents } : {}),
        ...(input.costCents !== undefined ? { costCents: input.costCents } : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.isSubscription !== undefined ? { isSubscription: input.isSubscription } : {}),
        ...(input.priceWeekly !== undefined ? { priceWeekly: input.priceWeekly } : {}),
        ...(input.priceBiweekly !== undefined ? { priceBiweekly: input.priceBiweekly } : {}),
        ...(input.priceMonthly !== undefined ? { priceMonthly: input.priceMonthly } : {}),
        ...(input.priceQuarterly !== undefined ? { priceQuarterly: input.priceQuarterly } : {}),
      },
      select: adminProductsPageSelect,
    });

    await tx.auditLog.create({
      data: {
        actorUserId,
        action: "ADMIN_PRODUCT_UPDATED",
        entity: "Product",
        entityId: product.id,
        metadata: JSON.stringify({
          before: {
            slug: existing.slug,
            priceCents: existing.priceCents,
            costCents: existing.costCents,
            isActive: existing.isActive,
          },
          after: {
            slug: product.slug,
            priceCents: product.priceCents,
            isActive: product.isActive,
          },
        }),
      },
    });

    return product;
  });
}

export async function adjustAdminProductStock(
  productId: string,
  quantityChange: number,
  actorUserId: string,
  reason = DEFAULT_STOCK_ADJUSTMENT_REASON,
) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) throw new Error("PRODUCT_NOT_FOUND");

    const nextStock = product.stock + quantityChange;
    if (nextStock < 0) throw new Error("INSUFFICIENT_STOCK");

    const updatedProduct = await tx.product.update({
      where: { id: productId },
      data: { stock: nextStock },
      select: adminProductsPageSelect,
    });

    const movement = await tx.inventoryMovement.create({
      data: {
        productId,
        quantityChange,
        reason,
      },
      include: {
        product: {
          select: {
            id: true,
            nameFr: true,
            nameEn: true,
          },
        },
        order: {
          select: {
            orderNumber: true,
          },
        },
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId,
        action: "ADMIN_PRODUCT_STOCK_ADJUSTED",
        entity: "Product",
        entityId: productId,
        metadata: JSON.stringify({
          previousStock: product.stock,
          quantityChange,
          nextStock,
          reason,
        }),
      },
    });

    return { product: updatedProduct, movement };
  });
}

export async function deleteAdminProduct(productId: string, actorUserId: string) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { id: productId },
      include: {
        _count: {
          select: {
            orderItems: true,
            inventoryMovements: true,
          },
        },
      },
    });

    if (!product) throw new Error("PRODUCT_NOT_FOUND");
    if (product._count.orderItems > 0) throw new Error("PRODUCT_DELETE_BLOCKED");

    if (product._count.inventoryMovements > 0) {
      await tx.inventoryMovement.deleteMany({ where: { productId } });
    }

    await tx.product.delete({ where: { id: productId } });

    await tx.auditLog.create({
      data: {
        actorUserId,
        action: "ADMIN_PRODUCT_DELETED",
        entity: "Product",
        entityId: productId,
        metadata: JSON.stringify({
          slug: product.slug,
          nameFr: product.nameFr,
          nameEn: product.nameEn,
        }),
      },
    });

    return {
      id: product.id,
      slug: product.slug,
      deletedInventoryMovements: product._count.inventoryMovements,
    };
  });
}

export async function getTaxReport(start?: Date, end?: Date) {
  const where = {
    ...(start || end
      ? {
          createdAt: {
            ...(start ? { gte: start } : {}),
            ...(end ? { lte: end } : {}),
          },
        }
      : {}),
  };

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      orderNumber: true,
      createdAt: true,
      customerEmail: true,
      subtotalCents: true,
      discountCents: true,
      taxCents: true,
      shippingCents: true,
      refundedCents: true,
      totalCents: true,
      paymentStatus: true,
      status: true,
    },
  });

  type TaxOrder = (typeof orders)[number];

  type Totals = {
    subtotalCents: number;
    discountCents: number;
    gstCents: number;
    qstCents: number;
    taxCents: number;
    shippingCents: number;
    refundedCents: number;
    totalCents: number;
  };

  const summary = orders.reduce<Totals>(
    (acc: Totals, order: TaxOrder) => {
      const taxSummary = computeStoredOrderTaxBreakdown(
        order.subtotalCents,
        order.discountCents,
        order.shippingCents,
      );
      acc.subtotalCents += order.subtotalCents;
      acc.discountCents += order.discountCents;
      acc.gstCents += taxSummary.gstCents;
      acc.qstCents += taxSummary.qstCents;
      acc.taxCents += order.taxCents;
      acc.shippingCents += order.shippingCents;
      acc.refundedCents += order.refundedCents;
      acc.totalCents += order.totalCents;
      return acc;
    },
    {
      subtotalCents: 0,
      discountCents: 0,
      gstCents: 0,
      qstCents: 0,
      taxCents: 0,
      shippingCents: 0,
      refundedCents: 0,
      totalCents: 0,
    },
  );

  return { summary, orders };
}

export async function getAdminProductInventoryMetrics() {
  const products = await prisma.product.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      slug: true,
      nameFr: true,
      nameEn: true,
      stock: true,
      priceCents: true,
      costCents: true,
      currency: true,
      isActive: true,
      orderItems: {
        select: {
          quantity: true,
          unitPriceCents: true,
          lineTotalCents: true,
        },
      },
      inventoryMovements: {
        select: {
          quantityChange: true,
          reason: true,
          orderId: true,
        },
      },
    },
  });

  return calculateAdminInventoryMetrics(products);
}

export function taxReportToCsv(
  orders: Array<{
    orderNumber: string;
    createdAt: Date;
    customerEmail: string;
    subtotalCents: number;
    discountCents: number;
    taxCents: number;
    shippingCents: number;
    refundedCents: number;
    totalCents: number;
    paymentStatus: string;
    status: string;
  }>,
) {
  const header = [
    "order_number",
    "created_at",
    "customer_email",
    "subtotal_cents",
    "discount_cents",
    "taxable_cents",
    "gst_cents",
    "qst_cents",
    "tax_cents",
    "shipping_cents",
    "refunded_cents",
    "total_cents",
    "payment_status",
    "order_status",
  ];

  const rows = orders.map((order) => {
    const taxSummary = computeStoredOrderTaxBreakdown(
      order.subtotalCents,
      order.discountCents,
      order.shippingCents,
    );

    return [
      order.orderNumber,
      order.createdAt.toISOString(),
      order.customerEmail,
      String(order.subtotalCents),
      String(order.discountCents),
      String(taxSummary.taxableCents),
      String(taxSummary.gstCents),
      String(taxSummary.qstCents),
      String(order.taxCents),
      String(order.shippingCents),
      String(order.refundedCents),
      String(order.totalCents),
      order.paymentStatus,
      order.status,
    ];
  });

  return [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
}
