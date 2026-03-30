import { z } from "zod";

const emptyToUndefined = (value: unknown) => {
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
};

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  language: z.enum(["fr", "en"]).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1).max(99),
      }),
    )
    .min(1),
  paymentMethod: z.enum(["MANUAL", "STRIPE"]),
  promoCode: z.preprocess(emptyToUndefined, z.string().trim().max(40).optional()),
  shippingLine1: z.string().max(160).optional(),
  shippingCity: z.string().max(120).optional(),
  shippingRegion: z.string().max(120).optional(),
  shippingPostal: z.string().max(40).optional(),
  shippingCountry: z.string().max(80).optional(),
});

export const reorderSchema = z.object({
  orderId: z.string().min(1),
});

export const languageSchema = z.object({
  language: z.enum(["fr", "en"]),
});

export const adminOrdersQuerySchema = z
  .object({
    status: z.preprocess(
      emptyToUndefined,
      z.enum(["PENDING", "PAID", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]).optional(),
    ),
    paymentStatus: z.preprocess(emptyToUndefined, z.enum(["PENDING", "PAID", "FAILED", "REFUNDED"]).optional()),
    customer: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(160).optional()),
    from: z.preprocess(emptyToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
    to: z.preprocess(emptyToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
    sortBy: z.preprocess(
      emptyToUndefined,
      z.enum(["createdAt", "totalCents", "orderNumber", "status", "paymentStatus"]).optional(),
    ),
    sortDir: z.preprocess(emptyToUndefined, z.enum(["asc", "desc"]).optional()),
    page: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(100000).optional()),
    pageSize: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(100).optional()),
  })
  .refine((data) => !(data.from && data.to) || data.from <= data.to, {
    message: "INVALID_DATE_RANGE",
    path: ["from"],
  });

export const adminCustomersQuerySchema = z.object({
  search: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(160).optional()),
  role: z.preprocess(emptyToUndefined, z.enum(["CUSTOMER", "ADMIN"]).optional()),
  sortBy: z.preprocess(emptyToUndefined, z.enum(["createdAt", "email", "firstName", "lastName"]).optional()),
  sortDir: z.preprocess(emptyToUndefined, z.enum(["asc", "desc"]).optional()),
  page: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(100000).optional()),
  pageSize: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(100).optional()),
});

const productSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i, "INVALID_SLUG");

const optionalImageUrlSchema = z.preprocess(
  emptyToUndefined,
  z.string().trim().url().max(500).optional(),
);

export const adminProductCreateSchema = z.object({
  slug: productSlugSchema,
  category: z.string().trim().min(1).max(80),
  nameFr: z.string().trim().min(1).max(160),
  nameEn: z.string().trim().min(1).max(160),
  descriptionFr: z.string().trim().min(1).max(4000),
  descriptionEn: z.string().trim().min(1).max(4000),
  imageUrl: optionalImageUrlSchema,
  priceCents: z.coerce.number().int().min(0).max(100000000),
  currency: z.preprocess(emptyToUndefined, z.string().trim().min(3).max(10).optional()),
  stock: z.coerce.number().int().min(0).max(1000000),
  isActive: z.boolean().optional(),
});

export const adminProductUpdateSchema = z.object({
  id: z.string().min(1),
  slug: z.preprocess(emptyToUndefined, productSlugSchema.optional()),
  category: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(80).optional()),
  nameFr: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(160).optional()),
  nameEn: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(160).optional()),
  descriptionFr: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(4000).optional()),
  descriptionEn: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(4000).optional()),
  imageUrl: optionalImageUrlSchema,
  priceCents: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(100000000).optional()),
  currency: z.preprocess(emptyToUndefined, z.string().trim().min(3).max(10).optional()),
  isActive: z.boolean().optional(),
});

export const adminStockAdjustmentSchema = z.object({
  productId: z.string().min(1),
  quantityChange: z.coerce.number().int().min(-1000000).max(1000000).refine((value) => value !== 0, {
    message: "QUANTITY_CHANGE_REQUIRED",
  }),
  reason: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(120).optional()),
});

export const adminProductDeleteSchema = z.object({
  id: z.string().min(1),
});


export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

export const supportConversationCreateSchema = z.object({
  name: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(120).optional()),
  email: z.preprocess(emptyToUndefined, z.string().trim().email().max(160).optional()),
  message: z.string().trim().min(1).max(2000),
});

export const supportMessageCreateSchema = z.object({
  content: z.string().trim().min(1).max(2000),
});

export const supportGuestMessageCreateSchema = z.object({
  content: z.string().trim().min(1).max(2000),
  guestEmail: z.string().trim().email().max(160),
});

export const supportPromoLeadSchema = z.object({
  email: z.string().trim().email().max(160),
  language: z.enum(["fr", "en"]).optional(),
});
