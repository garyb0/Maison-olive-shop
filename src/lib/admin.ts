import { prisma } from "@/lib/prisma";
import type { OrderStatus } from "@/lib/types";

const DEFAULT_STOCK_ADJUSTMENT_REASON = "ADMIN_STOCK_ADJUSTMENT";

type OrdersFilter = {
  status?: OrderStatus;
  customer?: string;
};

export async function getAdminOrders(filter: OrdersFilter) {
  return prisma.order.findMany({
    where: {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.customer
        ? {
            OR: [
              { customerEmail: { contains: filter.customer } },
              { customerName: { contains: filter.customer } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      user: true,
      items: {
        include: { product: true },
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
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });
}

export async function getAdminProducts() {
  return prisma.product.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    include: { category: true },
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
  currency?: string;
  stock: number;
  isActive?: boolean;
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
  currency?: string;
  isActive?: boolean;
};

export async function createAdminProduct(input: AdminProductCreateInput, actorUserId: string) {
  return prisma.$transaction(async (tx) => {
    const category = await tx.category.findUnique({
      where: { name: input.category },
    });

    if (!category) {
      throw new Error(`Category ${input.category} not found`);
    }

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
        currency: input.currency ?? "CAD",
        stock: input.stock,
        isActive: input.isActive ?? true,
      },
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
    if (input.category !== undefined) {
      const category = await tx.category.findUnique({
        where: { name: input.category },
      });
      if (!category) {
        throw new Error(`Category ${input.category} not found`);
      }
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
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
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
    taxCents: number;
    shippingCents: number;
    refundedCents: number;
    totalCents: number;
  };

  const summary = orders.reduce<Totals>(
    (acc: Totals, order: TaxOrder) => {
      acc.subtotalCents += order.subtotalCents;
      acc.discountCents += order.discountCents;
      acc.taxCents += order.taxCents;
      acc.shippingCents += order.shippingCents;
      acc.refundedCents += order.refundedCents;
      acc.totalCents += order.totalCents;
      return acc;
    },
    {
      subtotalCents: 0,
      discountCents: 0,
      taxCents: 0,
      shippingCents: 0,
      refundedCents: 0,
      totalCents: 0,
    },
  );

  return { summary, orders };
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
    "tax_cents",
    "shipping_cents",
    "refunded_cents",
    "total_cents",
    "payment_status",
    "order_status",
  ];

  const rows = orders.map((order) => [
    order.orderNumber,
    order.createdAt.toISOString(),
    order.customerEmail,
    String(order.subtotalCents),
    String(order.discountCents),
    String(order.taxCents),
    String(order.shippingCents),
    String(order.refundedCents),
    String(order.totalCents),
    order.paymentStatus,
    order.status,
  ]);

  return [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");
}
