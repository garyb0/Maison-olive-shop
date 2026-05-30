import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { OrderStatus } from "@/lib/types";
import { calculateAdminInventoryMetrics } from "@/lib/inventory-metrics";
import { computeStoredOrderTaxBreakdown } from "@/lib/taxes";
import { getSubcategoryDefinition } from "@/lib/product-subcategories";
import { toProductSku } from "@/lib/product-sku";
import { toProductSlug } from "@/lib/product-slug";

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
  supportConversations: {
    orderBy: { lastMessageAt: "desc" },
    take: 3,
    select: {
      id: true,
      status: true,
      priority: true,
      lastMessageAt: true,
    },
  },
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
      supportConversations: [],
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
  sku: true,
  barcode: true,
  nameFr: true,
  nameEn: true,
  descriptionFr: true,
  descriptionEn: true,
  imageUrl: true,
  priceCents: true,
  costCents: true,
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
      id: true,
      name: true,
    },
  },
  subcategory: {
    select: {
      slug: true,
      nameFr: true,
      nameEn: true,
    },
  },
  variants: {
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      slug: true,
      sku: true,
      barcode: true,
      colorNameFr: true,
      colorNameEn: true,
      colorHex: true,
      sizeNameFr: true,
      sizeNameEn: true,
      sizeCode: true,
      sizeSortOrder: true,
      imageUrl: true,
      stock: true,
      priceCents: true,
      costCents: true,
      isActive: true,
      sortOrder: true,
    },
  },
  _count: {
    select: {
      orderItems: true,
    },
  },
} satisfies Prisma.ProductSelect;

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
          sku: true,
          nameFr: true,
          nameEn: true,
        },
      },
      variant: {
        select: {
          id: true,
          sku: true,
          slug: true,
          colorNameFr: true,
          colorNameEn: true,
          sizeNameFr: true,
          sizeNameEn: true,
          sizeCode: true,
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
  sku: string;
  barcode?: string | null;
  category: string;
  subcategorySlug?: string | null;
  nameFr: string;
  nameEn: string;
  descriptionFr: string;
  descriptionEn: string;
  imageUrl?: string | null;
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
  sku?: string;
  barcode?: string | null;
  category?: string;
  subcategorySlug?: string | null;
  nameFr?: string;
  nameEn?: string;
  descriptionFr?: string;
  descriptionEn?: string;
  imageUrl?: string | null;
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

    const subcategoryDefinition = getSubcategoryDefinition(category.name, input.subcategorySlug);
    const subcategory = subcategoryDefinition
      ? await tx.productSubcategory.upsert({
          where: {
            categoryId_slug: {
              categoryId: category.id,
              slug: subcategoryDefinition.slug,
            },
          },
          update: {
            nameFr: subcategoryDefinition.nameFr,
            nameEn: subcategoryDefinition.nameEn,
          },
          create: {
            categoryId: category.id,
            slug: subcategoryDefinition.slug,
            nameFr: subcategoryDefinition.nameFr,
            nameEn: subcategoryDefinition.nameEn,
          },
        })
      : null;

    if (input.subcategorySlug && !subcategory) {
      throw new Error("INVALID_SUBCATEGORY");
    }

    const product = await tx.product.create({
      data: {
        slug: input.slug,
        sku: input.sku,
        barcode: input.barcode ?? null,
        categoryId: category.id,
        subcategoryId: subcategory?.id,
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
        metadata: JSON.stringify({ slug: product.slug, sku: product.sku, stock: product.stock }),
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
    let nextCategoryId = existing.categoryId ?? undefined;
    let nextCategoryName = "";
    let categoryChanged = false;
    if (input.category != null && input.category !== '') {
      const category = await tx.category.upsert({
        where: { name: input.category },
        update: {},
        create: { name: input.category },
      });
      categoryId = category.id;
      nextCategoryId = category.id;
      nextCategoryName = category.name;
      categoryChanged = category.id !== existing.categoryId;
    }

    if (!nextCategoryName && nextCategoryId) {
      const existingCategory = await tx.category.findUnique({ where: { id: nextCategoryId } });
      nextCategoryName = existingCategory?.name ?? "";
    }

    let subcategoryId: string | null | undefined;
    if (input.subcategorySlug !== undefined) {
      if (!input.subcategorySlug) {
        subcategoryId = null;
      } else {
        const subcategoryDefinition = getSubcategoryDefinition(nextCategoryName, input.subcategorySlug);
        const subcategory = subcategoryDefinition && nextCategoryId
          ? await tx.productSubcategory.upsert({
              where: {
                categoryId_slug: {
                  categoryId: nextCategoryId,
                  slug: subcategoryDefinition.slug,
                },
              },
              update: {
                nameFr: subcategoryDefinition.nameFr,
                nameEn: subcategoryDefinition.nameEn,
              },
              create: {
                categoryId: nextCategoryId,
                slug: subcategoryDefinition.slug,
                nameFr: subcategoryDefinition.nameFr,
                nameEn: subcategoryDefinition.nameEn,
              },
            })
          : null;

        if (!subcategory) {
          throw new Error("INVALID_SUBCATEGORY");
        }

        subcategoryId = subcategory.id;
      }
    } else if (categoryChanged) {
      subcategoryId = null;
    }

    const product = await tx.product.update({
      where: { id: productId },
      data: {
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.sku !== undefined ? { sku: input.sku } : {}),
        ...(input.barcode !== undefined ? { barcode: input.barcode ?? null } : {}),
        ...(categoryId !== undefined ? { categoryId } : {}),
        ...(subcategoryId !== undefined ? { subcategoryId } : {}),
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
            sku: existing.sku,
            barcode: existing.barcode,
            priceCents: existing.priceCents,
            costCents: existing.costCents,
            isActive: existing.isActive,
          },
          after: {
            slug: product.slug,
            sku: product.sku,
            barcode: product.barcode,
            priceCents: product.priceCents,
            costCents: product.costCents,
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
  variantId?: string | null,
) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) throw new Error("PRODUCT_NOT_FOUND");

    if (variantId) {
      const variant = await tx.productVariant.findFirst({
        where: { id: variantId, productId },
      });
      if (!variant) throw new Error("PRODUCT_VARIANT_NOT_FOUND");

      const nextVariantStock = variant.stock + quantityChange;
      if (nextVariantStock < 0) throw new Error("INSUFFICIENT_STOCK");

      const updatedVariant = await tx.productVariant.update({
        where: { id: variant.id },
        data: { stock: nextVariantStock },
        select: {
          id: true,
          slug: true,
          sku: true,
          barcode: true,
          colorNameFr: true,
          colorNameEn: true,
          colorHex: true,
          sizeNameFr: true,
          sizeNameEn: true,
          sizeCode: true,
          sizeSortOrder: true,
          imageUrl: true,
          stock: true,
          priceCents: true,
          costCents: true,
          isActive: true,
          sortOrder: true,
        },
      });

      const activeVariantStock = await tx.productVariant.aggregate({
        where: { productId, isActive: true },
        _sum: { stock: true },
      });

      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: { stock: activeVariantStock._sum.stock ?? 0 },
        select: adminProductsPageSelect,
      });

      const movement = await tx.inventoryMovement.create({
        data: {
          productId,
          variantId: variant.id,
          quantityChange,
          reason,
        },
        include: {
          product: {
            select: {
              id: true,
              sku: true,
              nameFr: true,
              nameEn: true,
            },
          },
          variant: {
            select: {
              id: true,
              sku: true,
              slug: true,
              colorNameFr: true,
              colorNameEn: true,
              sizeNameFr: true,
              sizeNameEn: true,
              sizeCode: true,
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
          action: "ADMIN_PRODUCT_VARIANT_STOCK_ADJUSTED",
          entity: "ProductVariant",
          entityId: variant.id,
          metadata: JSON.stringify({
            productId,
            previousStock: variant.stock,
            quantityChange,
            nextStock: nextVariantStock,
            reason,
          }),
        },
      });

      return {
        product: updatedProduct,
        movement,
        previousStock: product.stock,
        previousVariantStock: variant.stock,
        variant: updatedVariant,
      };
    }

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
            sku: true,
            nameFr: true,
            nameEn: true,
          },
        },
        order: {
          select: {
            orderNumber: true,
          },
        },
        variant: {
          select: {
            id: true,
            sku: true,
            slug: true,
            colorNameFr: true,
            colorNameEn: true,
            sizeNameFr: true,
            sizeNameEn: true,
            sizeCode: true,
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

    return { product: updatedProduct, movement, previousStock: product.stock };
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
      sku: true,
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

const csvRowsToString = (rows: string[][]) =>
  rows
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\n");

const normalizeCsvHeader = (value: string) =>
  value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const parseCsvText = (csvText: string) => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const nextChar = csvText[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) {
        rows.push(row);
      }
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((value) => value.trim() !== "")) {
    rows.push(row);
  }

  return rows;
};

type CsvRecord = {
  rowNumber: number;
  values: Map<string, string>;
};

const getCsvValue = (record: CsvRecord, aliases: string[]) => {
  for (const alias of aliases) {
    const value = record.values.get(normalizeCsvHeader(alias));
    if (value != null && value.trim() !== "") {
      return value.trim();
    }
  }

  return "";
};

const parseCsvInteger = (record: CsvRecord, aliases: string[], fallback: number | null = null) => {
  const raw = getCsvValue(record, aliases);
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
};

const parseCsvBoolean = (record: CsvRecord, aliases: string[], fallback = true) => {
  const raw = getCsvValue(record, aliases).toLowerCase();
  if (!raw) return fallback;
  if (["true", "1", "yes", "oui", "y"].includes(raw)) return true;
  if (["false", "0", "no", "non", "n"].includes(raw)) return false;
  return fallback;
};

type NormalizedProductVariantImportRow = {
  rowNumber: number;
  productSlug: string;
  productSku: string;
  productBarcode: string | null;
  category: string;
  subcategorySlug: string | null;
  nameFr: string;
  nameEn: string;
  descriptionFr: string;
  descriptionEn: string;
  productImageUrl: string | null;
  productPriceCents: number;
  productCostCents: number;
  currency: string;
  productIsActive: boolean;
  variantSku: string | null;
  variantSlug: string | null;
  variantBarcode: string | null;
  colorNameFr: string | null;
  colorNameEn: string | null;
  colorHex: string | null;
  sizeNameFr: string | null;
  sizeNameEn: string | null;
  sizeCode: string | null;
  sizeSortOrder: number | null;
  variantImageUrl: string | null;
  stock: number;
  variantPriceCents: number | null;
  variantCostCents: number | null;
  variantIsActive: boolean;
  sortOrder: number;
};

const normalizeImportRows = (csvText: string) => {
  const parsedRows = parseCsvText(csvText);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (parsedRows.length < 2) {
    return { rows: [] as NormalizedProductVariantImportRow[], errors: ["CSV must include a header and at least one data row."], warnings };
  }

  const headers = parsedRows[0].map(normalizeCsvHeader);
  const records: CsvRecord[] = parsedRows.slice(1).map((row, rowIndex) => {
    const values = new Map<string, string>();
    headers.forEach((header, columnIndex) => {
      if (header) values.set(header, row[columnIndex] ?? "");
    });
    return { rowNumber: rowIndex + 2, values };
  });

  const normalizedRows = records.map((record) => {
    const rawNameFr = getCsvValue(record, ["productNameFr", "nameFr", "name_fr"]);
    const rawNameEn = getCsvValue(record, ["productNameEn", "nameEn", "name_en"]) || rawNameFr;
    const rawProductSlug = getCsvValue(record, ["productSlug", "product_slug", "slug"]);
    const productSlug = toProductSlug(rawProductSlug || rawNameFr || rawNameEn);
    const productSku = toProductSku(getCsvValue(record, ["productSku", "parentSku", "product_sku"]) || `${productSlug}-PARENT`);
    const colorNameFr = getCsvValue(record, ["colorNameFr", "color_fr", "couleur", "couleurFr"]) || null;
    const colorNameEn = getCsvValue(record, ["colorNameEn", "color_en", "color"]) || colorNameFr;
    const sizeCode = getCsvValue(record, ["sizeCode", "size_code", "grandeurCode"]) || null;
    const variantSkuSeed = [productSku, colorNameFr ?? colorNameEn, sizeCode].filter(Boolean).join("-");
    const explicitVariantSku = getCsvValue(record, ["variantSku", "sku", "variant_sku"]);
    const variantSku = toProductSku(explicitVariantSku || variantSkuSeed);
    const explicitVariantSlug = getCsvValue(record, ["variantSlug", "variant_slug"]);
    const variantSlug = toProductSlug(explicitVariantSlug || [colorNameFr ?? colorNameEn ?? variantSku, sizeCode].filter(Boolean).join(" "));
    const stock = parseCsvInteger(record, ["variantStock", "stock", "quantity", "qty"], 0);
    const productPriceCents = parseCsvInteger(record, ["productPriceCents", "product_price_cents", "priceCents", "price_cents"], 0);
    const productCostCents = parseCsvInteger(record, ["productCostCents", "product_cost_cents", "costCents", "cost_cents"], 0);
    const variantPriceCents = parseCsvInteger(record, ["variantPriceCents", "variant_price_cents"], null);
    const variantCostCents = parseCsvInteger(record, ["variantCostCents", "variant_cost_cents"], null);
    const sizeSortOrder = parseCsvInteger(record, ["sizeSortOrder", "size_sort_order"], null);
    const sortOrder = parseCsvInteger(record, ["sortOrder", "sort_order"], record.rowNumber - 2);

    return {
      rowNumber: record.rowNumber,
      productSlug,
      productSku,
      productBarcode: getCsvValue(record, ["productBarcode", "parentBarcode", "product_barcode"]) || null,
      category: getCsvValue(record, ["category", "categorie"]) || "Beds",
      subcategorySlug: getCsvValue(record, ["subcategorySlug", "subcategory", "subcategory_slug"]) || null,
      nameFr: rawNameFr,
      nameEn: rawNameEn,
      descriptionFr: getCsvValue(record, ["productDescriptionFr", "descriptionFr", "description_fr"]) || rawNameFr,
      descriptionEn: getCsvValue(record, ["productDescriptionEn", "descriptionEn", "description_en"]) || rawNameEn || rawNameFr,
      productImageUrl: getCsvValue(record, ["productImageUrl", "product_image_url"]) || null,
      productPriceCents: productPriceCents ?? 0,
      productCostCents: productCostCents ?? 0,
      currency: (getCsvValue(record, ["currency", "devise"]) || "CAD").toUpperCase(),
      productIsActive: parseCsvBoolean(record, ["productIsActive", "isActive", "product_is_active"], true),
      variantSku: variantSku || null,
      variantSlug: variantSlug || null,
      variantBarcode: getCsvValue(record, ["variantBarcode", "barcode", "variant_barcode"]) || null,
      colorNameFr,
      colorNameEn,
      colorHex: getCsvValue(record, ["colorHex", "color_hex", "hex"]) || null,
      sizeNameFr: getCsvValue(record, ["sizeNameFr", "size_fr", "grandeur", "grandeurFr"]) || null,
      sizeNameEn: getCsvValue(record, ["sizeNameEn", "size_en", "size"]) || null,
      sizeCode,
      sizeSortOrder: Number.isNaN(sizeSortOrder) ? null : sizeSortOrder,
      variantImageUrl: getCsvValue(record, ["variantImageUrl", "imageUrl", "image_url", "photo"]) || null,
      stock: Number.isNaN(stock) ? Number.NaN : stock ?? 0,
      variantPriceCents: Number.isNaN(variantPriceCents) ? Number.NaN : variantPriceCents,
      variantCostCents: Number.isNaN(variantCostCents) ? Number.NaN : variantCostCents,
      variantIsActive: parseCsvBoolean(record, ["variantIsActive", "variant_is_active"], true),
      sortOrder: Number.isNaN(sortOrder) ? record.rowNumber - 2 : sortOrder ?? record.rowNumber - 2,
    };
  });

  for (const row of normalizedRows) {
    if (!row.productSlug) errors.push(`Row ${row.rowNumber}: productSlug or product name is required.`);
    if (!row.productSku) errors.push(`Row ${row.rowNumber}: productSku could not be generated.`);
    if (!row.nameFr) errors.push(`Row ${row.rowNumber}: nameFr/productNameFr is required.`);
    if (!row.nameEn) errors.push(`Row ${row.rowNumber}: nameEn/productNameEn is required.`);
    if (!Number.isInteger(row.productPriceCents) || row.productPriceCents < 0) errors.push(`Row ${row.rowNumber}: priceCents must be a positive integer.`);
    if (!Number.isInteger(row.productCostCents) || row.productCostCents < 0) errors.push(`Row ${row.rowNumber}: costCents must be a positive integer.`);
    if (!Number.isInteger(row.stock) || row.stock < 0) errors.push(`Row ${row.rowNumber}: stock must be a positive integer.`);
    if (row.variantPriceCents != null && (!Number.isInteger(row.variantPriceCents) || row.variantPriceCents < 0)) errors.push(`Row ${row.rowNumber}: variantPriceCents must be a positive integer.`);
    if (row.variantCostCents != null && (!Number.isInteger(row.variantCostCents) || row.variantCostCents < 0)) errors.push(`Row ${row.rowNumber}: variantCostCents must be a positive integer.`);
    if (!row.variantSku) warnings.push(`Row ${row.rowNumber}: no variant SKU; row will update the simple product stock only.`);
  }

  return { rows: normalizedRows, errors, warnings };
};

export async function importAdminProductVariantCsv(csvText: string, actorUserId: string, options: { dryRun?: boolean } = {}) {
  const normalized = normalizeImportRows(csvText);
  const result = {
    dryRun: Boolean(options.dryRun),
    rows: normalized.rows.length,
    createdProducts: 0,
    updatedProducts: 0,
    createdVariants: 0,
    updatedVariants: 0,
    stockMovements: 0,
    errors: normalized.errors,
    warnings: normalized.warnings,
  };

  if (result.errors.length > 0 || options.dryRun) {
    return result;
  }

  await prisma.$transaction(async (tx) => {
    const touchedProductIds = new Set<string>();

    for (const row of normalized.rows) {
      const category = await tx.category.upsert({
        where: { name: row.category },
        update: {},
        create: { name: row.category },
      });

      const subcategoryDefinition = getSubcategoryDefinition(category.name, row.subcategorySlug);
      const subcategory = subcategoryDefinition
        ? await tx.productSubcategory.upsert({
            where: {
              categoryId_slug: {
                categoryId: category.id,
                slug: subcategoryDefinition.slug,
              },
            },
            update: {
              nameFr: subcategoryDefinition.nameFr,
              nameEn: subcategoryDefinition.nameEn,
            },
            create: {
              categoryId: category.id,
              slug: subcategoryDefinition.slug,
              nameFr: subcategoryDefinition.nameFr,
              nameEn: subcategoryDefinition.nameEn,
            },
          })
        : null;

      if (row.subcategorySlug && !subcategory) {
        throw new Error(`INVALID_SUBCATEGORY_ROW_${row.rowNumber}`);
      }

      const existingProduct = await tx.product.findUnique({ where: { slug: row.productSlug } });
      const product = await tx.product.upsert({
        where: { slug: row.productSlug },
        update: {
          sku: row.productSku,
          barcode: row.productBarcode,
          categoryId: category.id,
          subcategoryId: subcategory?.id,
          nameFr: row.nameFr,
          nameEn: row.nameEn,
          descriptionFr: row.descriptionFr,
          descriptionEn: row.descriptionEn,
          ...(row.productImageUrl ? { imageUrl: row.productImageUrl } : {}),
          priceCents: row.productPriceCents,
          costCents: row.productCostCents,
          currency: row.currency,
          isActive: row.productIsActive,
        },
        create: {
          slug: row.productSlug,
          sku: row.productSku,
          barcode: row.productBarcode,
          categoryId: category.id,
          subcategoryId: subcategory?.id,
          nameFr: row.nameFr,
          nameEn: row.nameEn,
          descriptionFr: row.descriptionFr,
          descriptionEn: row.descriptionEn,
          imageUrl: row.productImageUrl,
          priceCents: row.productPriceCents,
          costCents: row.productCostCents,
          currency: row.currency,
          stock: row.variantSku ? 0 : row.stock,
          isActive: row.productIsActive,
        },
      });

      touchedProductIds.add(product.id);
      if (existingProduct) result.updatedProducts += 1;
      else result.createdProducts += 1;

      if (!row.variantSku || !row.variantSlug) {
        const previousStock = existingProduct?.stock ?? 0;
        if (existingProduct && previousStock !== row.stock) {
          await tx.product.update({
            where: { id: product.id },
            data: { stock: row.stock },
          });
          await tx.inventoryMovement.create({
            data: {
              productId: product.id,
              quantityChange: row.stock - previousStock,
              reason: "CSV_IMPORT_STOCK",
            },
          });
          result.stockMovements += 1;
        }
        continue;
      }

      const existingVariant = await tx.productVariant.findUnique({ where: { sku: row.variantSku } });
      if (existingVariant && existingVariant.productId !== product.id) {
        throw new Error(`VARIANT_SKU_PRODUCT_MISMATCH_ROW_${row.rowNumber}`);
      }

      const variant = await tx.productVariant.upsert({
        where: { sku: row.variantSku },
        update: {
          productId: product.id,
          slug: row.variantSlug,
          barcode: row.variantBarcode,
          colorNameFr: row.colorNameFr,
          colorNameEn: row.colorNameEn,
          colorHex: row.colorHex,
          sizeNameFr: row.sizeNameFr,
          sizeNameEn: row.sizeNameEn,
          sizeCode: row.sizeCode,
          sizeSortOrder: row.sizeSortOrder,
          imageUrl: row.variantImageUrl,
          stock: row.stock,
          priceCents: row.variantPriceCents,
          costCents: row.variantCostCents,
          isActive: row.variantIsActive,
          sortOrder: row.sortOrder,
        },
        create: {
          productId: product.id,
          slug: row.variantSlug,
          sku: row.variantSku,
          barcode: row.variantBarcode,
          colorNameFr: row.colorNameFr,
          colorNameEn: row.colorNameEn,
          colorHex: row.colorHex,
          sizeNameFr: row.sizeNameFr,
          sizeNameEn: row.sizeNameEn,
          sizeCode: row.sizeCode,
          sizeSortOrder: row.sizeSortOrder,
          imageUrl: row.variantImageUrl,
          stock: row.stock,
          priceCents: row.variantPriceCents,
          costCents: row.variantCostCents,
          isActive: row.variantIsActive,
          sortOrder: row.sortOrder,
        },
      });

      if (existingVariant) result.updatedVariants += 1;
      else result.createdVariants += 1;

      const previousVariantStock = existingVariant?.stock ?? 0;
      const stockDelta = row.stock - previousVariantStock;
      if (stockDelta !== 0) {
        await tx.inventoryMovement.create({
          data: {
            productId: product.id,
            variantId: variant.id,
            quantityChange: stockDelta,
            reason: existingVariant ? "CSV_IMPORT_STOCK_UPDATE" : "CSV_IMPORT_INITIAL_STOCK",
          },
        });
        result.stockMovements += 1;
      }
    }

    for (const productId of touchedProductIds) {
      const variantCount = await tx.productVariant.count({ where: { productId } });
      if (variantCount === 0) continue;
      const activeVariantStock = await tx.productVariant.aggregate({
        where: { productId, isActive: true },
        _sum: { stock: true },
      });
      await tx.product.update({
        where: { id: productId },
        data: { stock: activeVariantStock._sum.stock ?? 0 },
      });
    }

    await tx.auditLog.create({
      data: {
        actorUserId,
        action: "ADMIN_PRODUCT_VARIANT_CSV_IMPORTED",
        entity: "Product",
        entityId: "bulk",
        metadata: JSON.stringify({
          rows: result.rows,
          createdProducts: result.createdProducts,
          updatedProducts: result.updatedProducts,
          createdVariants: result.createdVariants,
          updatedVariants: result.updatedVariants,
          stockMovements: result.stockMovements,
        }),
      },
    });
  });

  return result;
}

export async function getAdminInventorySnapshotExport() {
  const products = await prisma.product.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      slug: true,
      sku: true,
      barcode: true,
      nameFr: true,
      nameEn: true,
      stock: true,
      priceCents: true,
      costCents: true,
      currency: true,
      isActive: true,
      category: {
        select: {
          name: true,
        },
      },
      subcategory: {
        select: {
          nameFr: true,
          nameEn: true,
        },
      },
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
      variants: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          slug: true,
          sku: true,
          barcode: true,
          colorNameFr: true,
          colorNameEn: true,
          colorHex: true,
          sizeNameFr: true,
          sizeNameEn: true,
          sizeCode: true,
          sizeSortOrder: true,
          stock: true,
          priceCents: true,
          costCents: true,
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
      },
    },
  });

  const metricsById = new Map(calculateAdminInventoryMetrics(products).rows.map((row) => [row.id, row]));

  return products.flatMap((product) => {
    const metrics = metricsById.get(product.id);

    if (product.variants.length > 0) {
      return product.variants.map((variant) => {
        const variantPriceCents = variant.priceCents ?? product.priceCents;
        const variantCostCents = variant.costCents ?? product.costCents;
        const quantityAdded = variant.inventoryMovements.reduce((sum, movement) => {
          if (movement.orderId) return sum;
          return movement.quantityChange > 0 ? sum + movement.quantityChange : sum;
        }, 0);
        const quantityAdjusted = variant.inventoryMovements.reduce((sum, movement) => {
          if (movement.orderId) return sum;
          return movement.quantityChange < 0 ? sum + Math.abs(movement.quantityChange) : sum;
        }, 0);
        const quantitySold = variant.orderItems.reduce((sum, item) => sum + item.quantity, 0);
        const grossRevenueCents = variant.orderItems.reduce((sum, item) => sum + item.lineTotalCents, 0);
        const estimatedCostOfGoodsCents = quantitySold * variantCostCents;
        const colorFr = variant.colorNameFr ?? variant.colorNameEn ?? "";
        const colorEn = variant.colorNameEn ?? variant.colorNameFr ?? "";
        const sizeFr = variant.sizeNameFr ?? variant.sizeNameEn ?? variant.sizeCode ?? "";
        const sizeEn = variant.sizeNameEn ?? variant.sizeNameFr ?? variant.sizeCode ?? "";
        const variantNameFr = [colorFr, sizeFr].filter(Boolean).join(" / ");
        const variantNameEn = [colorEn, sizeEn].filter(Boolean).join(" / ");

        return {
          id: product.id,
          variantId: variant.id,
          sku: variant.sku,
          barcode: variant.barcode ?? "",
          slug: `${product.slug}/${variant.slug}`,
          productSku: product.sku ?? "",
          variantSku: variant.sku,
          productSlug: product.slug,
          variantSlug: variant.slug,
          nameFr: product.nameFr,
          nameEn: product.nameEn,
          variantNameFr,
          variantNameEn,
          colorNameFr: colorFr,
          colorNameEn: colorEn,
          colorHex: variant.colorHex ?? "",
          sizeNameFr: sizeFr,
          sizeNameEn: sizeEn,
          sizeCode: variant.sizeCode ?? "",
          sizeSortOrder: variant.sizeSortOrder ?? "",
          category: product.category?.name ?? "",
          subcategoryFr: product.subcategory?.nameFr ?? "",
          subcategoryEn: product.subcategory?.nameEn ?? "",
          stock: variant.stock,
          priceCents: variantPriceCents,
          costCents: variantCostCents,
          currency: product.currency,
          isActive: product.isActive && variant.isActive,
          quantityAdded,
          quantitySold,
          quantityAdjusted,
          grossRevenueCents,
          estimatedCostOfGoodsCents,
          estimatedGrossProfitCents: grossRevenueCents - estimatedCostOfGoodsCents,
          stockValueAtCostCents: variant.stock * variantCostCents,
          stockValueAtRetailCents: variant.stock * variantPriceCents,
        };
      });
    }

    return [{
      id: product.id,
      variantId: "",
      sku: product.sku ?? "",
      barcode: product.barcode ?? "",
      slug: product.slug,
      productSku: product.sku ?? "",
      variantSku: "",
      productSlug: product.slug,
      variantSlug: "",
      nameFr: product.nameFr,
      nameEn: product.nameEn,
      variantNameFr: "",
      variantNameEn: "",
      colorNameFr: "",
      colorNameEn: "",
      colorHex: "",
      sizeNameFr: "",
      sizeNameEn: "",
      sizeCode: "",
      sizeSortOrder: "",
      category: product.category?.name ?? "",
      subcategoryFr: product.subcategory?.nameFr ?? "",
      subcategoryEn: product.subcategory?.nameEn ?? "",
      stock: product.stock,
      priceCents: product.priceCents,
      costCents: product.costCents,
      currency: product.currency,
      isActive: product.isActive,
      quantityAdded: metrics?.quantityAdded ?? 0,
      quantitySold: metrics?.quantitySold ?? 0,
      quantityAdjusted: metrics?.quantityAdjusted ?? 0,
      grossRevenueCents: metrics?.grossRevenueCents ?? 0,
      estimatedCostOfGoodsCents: metrics?.estimatedCostOfGoodsCents ?? 0,
      estimatedGrossProfitCents: metrics?.estimatedGrossProfitCents ?? 0,
      stockValueAtCostCents: metrics?.stockValueAtCostCents ?? 0,
      stockValueAtRetailCents: metrics?.stockValueAtRetailCents ?? 0,
    }];
  });
}

export async function getAdminInventoryMovementExport() {
  return prisma.inventoryMovement.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      product: {
        select: {
          id: true,
          sku: true,
          slug: true,
          nameFr: true,
          nameEn: true,
        },
      },
      variant: {
        select: {
          id: true,
          sku: true,
          slug: true,
          colorNameFr: true,
          colorNameEn: true,
          sizeNameFr: true,
          sizeNameEn: true,
          sizeCode: true,
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

export function inventorySnapshotToCsv(rows: Awaited<ReturnType<typeof getAdminInventorySnapshotExport>>) {
  const header = [
    "sku",
    "barcode",
    "slug",
    "product_sku",
    "variant_sku",
    "product_slug",
    "variant_slug",
    "name_fr",
    "name_en",
    "variant_fr",
    "variant_en",
    "color_fr",
    "color_en",
    "color_hex",
    "size_fr",
    "size_en",
    "size_code",
    "size_sort_order",
    "category",
    "subcategory_fr",
    "subcategory_en",
    "stock",
    "price_cents",
    "cost_cents",
    "currency",
    "is_active",
    "quantity_added",
    "quantity_sold",
    "quantity_adjusted",
    "gross_revenue_cents",
    "estimated_cost_of_goods_cents",
    "estimated_gross_profit_cents",
    "stock_value_at_cost_cents",
    "stock_value_at_retail_cents",
  ];

  return csvRowsToString([
    header,
    ...rows.map((row) => [
      row.sku,
      row.barcode,
      row.slug,
      row.productSku,
      row.variantSku,
      row.productSlug,
      row.variantSlug,
      row.nameFr,
      row.nameEn,
      row.variantNameFr,
      row.variantNameEn,
      row.colorNameFr,
      row.colorNameEn,
      row.colorHex,
      row.sizeNameFr,
      row.sizeNameEn,
      row.sizeCode,
      String(row.sizeSortOrder),
      row.category,
      row.subcategoryFr,
      row.subcategoryEn,
      String(row.stock),
      String(row.priceCents),
      String(row.costCents),
      row.currency,
      String(row.isActive),
      String(row.quantityAdded),
      String(row.quantitySold),
      String(row.quantityAdjusted),
      String(row.grossRevenueCents),
      String(row.estimatedCostOfGoodsCents),
      String(row.estimatedGrossProfitCents),
      String(row.stockValueAtCostCents),
      String(row.stockValueAtRetailCents),
    ]),
  ]);
}

export function inventoryMovementsToCsv(rows: Awaited<ReturnType<typeof getAdminInventoryMovementExport>>) {
  const header = [
    "created_at",
    "sku",
    "slug",
    "product_sku",
    "variant_sku",
    "product_slug",
    "variant_slug",
    "product_name_fr",
    "product_name_en",
    "variant_fr",
    "variant_en",
    "quantity_change",
    "reason",
    "order_number",
  ];

  return csvRowsToString([
    header,
    ...rows.map((row) => [
      row.createdAt.toISOString(),
      row.variant?.sku ?? row.product.sku ?? "",
      row.variant ? `${row.product.slug}/${row.variant.slug}` : row.product.slug,
      row.product.sku ?? "",
      row.variant?.sku ?? "",
      row.product.slug,
      row.variant?.slug ?? "",
      row.product.nameFr,
      row.product.nameEn,
      [
        row.variant?.colorNameFr ?? row.variant?.colorNameEn ?? "",
        row.variant?.sizeNameFr ?? row.variant?.sizeNameEn ?? row.variant?.sizeCode ?? "",
      ].filter(Boolean).join(" / "),
      [
        row.variant?.colorNameEn ?? row.variant?.colorNameFr ?? "",
        row.variant?.sizeNameEn ?? row.variant?.sizeNameFr ?? row.variant?.sizeCode ?? "",
      ].filter(Boolean).join(" / "),
      String(row.quantityChange),
      row.reason,
      row.order?.orderNumber ?? "",
    ]),
  ]);
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

  return csvRowsToString([header, ...rows]);
}
