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
