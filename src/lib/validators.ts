import { z } from "zod";
import { isValidPromoCtaLink } from "@/lib/promo-links";

const emptyToUndefined = (value: unknown) => {
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
};

const normalizeDeliveryPhone = (value: string) => value.replace(/\D/g, "");

const isValidDeliveryPhone = (value: string) => {
  if (!value.trim()) return false;
  const digits = normalizeDeliveryPhone(value);
  return digits.length === 10 || (digits.length === 11 && digits.startsWith("1"));
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

export const twoFactorCodeSchema = z.object({
  code: z.string().trim().min(6).max(32),
});

export const twoFactorSetupConfirmSchema = z.object({
  currentPassword: z.string().min(1),
  code: z.string().trim().min(6).max(32),
});

export const twoFactorDisableSchema = z.object({
  currentPassword: z.string().min(1),
  code: z.string().trim().min(6).max(32),
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
  customerEmail: z.preprocess(emptyToUndefined, z.string().trim().email().max(160).optional()),
  customerName: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(160).optional()),
  customerLanguage: z.enum(["fr", "en"]).optional(),
  promoCode: z.preprocess(emptyToUndefined, z.string().trim().max(40).optional()),
  deliveryAddressId: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(191).optional()),
  deliveryAddressLabel: z.preprocess(emptyToUndefined, z.string().trim().max(80).optional()),
  saveDeliveryAddress: z.boolean().optional(),
  shippingLine1: z.string().max(160).optional(),
  shippingCity: z.string().max(120).optional(),
  shippingRegion: z.string().max(120).optional(),
  shippingPostal: z.string().max(40).optional(),
  shippingCountry: z.string().max(80).optional(),
  deliverySlotId: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(191).optional()),
  deliveryWindowStartAt: z.preprocess(emptyToUndefined, z.string().datetime().optional()),
  deliveryWindowEndAt: z.preprocess(emptyToUndefined, z.string().datetime().optional()),
  deliveryInstructions: z.preprocess(emptyToUndefined, z.string().trim().max(500).optional()),
  deliveryPhone: z
    .preprocess(
      emptyToUndefined,
      z
        .string()
        .trim()
        .max(40)
        .refine((value) => !value || isValidDeliveryPhone(value), "INVALID_DELIVERY_PHONE"),
    )
    .optional(),
});

export const deliveryAddressUpsertSchema = z.object({
  label: z.preprocess(emptyToUndefined, z.string().trim().max(80).optional()),
  shippingLine1: z.string().trim().min(1).max(160),
  shippingCity: z.string().trim().min(1).max(120),
  shippingRegion: z.string().trim().min(1).max(120),
  shippingPostal: z.string().trim().min(1).max(40),
  shippingCountry: z.string().trim().min(1).max(80),
  deliveryPhone: z
    .preprocess(
      emptyToUndefined,
      z
        .string()
        .trim()
        .max(40)
        .refine((value) => !value || isValidDeliveryPhone(value), "INVALID_DELIVERY_PHONE"),
    )
    .optional(),
  deliveryInstructions: z.preprocess(emptyToUndefined, z.string().trim().max(500).optional()),
});

export const deliveryAddressPatchSchema = deliveryAddressUpsertSchema.partial().refine(
  (input) => Object.keys(input).length > 0,
  {
    message: "DELIVERY_ADDRESS_UPDATE_REQUIRED",
    path: ["label"],
  },
);

const publicTokenSchema = z
  .string()
  .trim()
  .min(8)
  .max(120)
  .regex(/^[A-Za-z0-9_-]+$/, "INVALID_PUBLIC_TOKEN");

const dogPhotoUrlSchema = z.preprocess(
  (value) => {
    if (value === null) return null;
    if (typeof value === "string" && value.trim() === "") return null;
    return value;
  },
  z
    .string()
    .trim()
    .max(500)
    .refine(
      (val) => val.startsWith("/") || val.startsWith("http://") || val.startsWith("https://"),
      { message: "INVALID_URL" },
    )
    .nullable()
    .optional(),
);

const dogNotesSchema = z.preprocess(emptyToUndefined, z.string().trim().max(500).optional());
const dogVisibilitySchema = {
  publicProfileEnabled: z.boolean().optional(),
  showPhotoPublic: z.boolean().optional(),
  showAgePublic: z.boolean().optional(),
  showPhonePublic: z.boolean().optional(),
  showNotesPublic: z.boolean().optional(),
} as const;

export const dogClaimSchema = z.object({
  publicToken: publicTokenSchema,
  name: z.string().trim().min(1).max(80),
  photoUrl: dogPhotoUrlSchema,
  ageLabel: z.preprocess(emptyToUndefined, z.string().trim().max(80).optional()),
  ownerPhone: z.string().trim().min(1).max(40),
  importantNotes: dogNotesSchema,
  ...dogVisibilitySchema,
}).refine((input) => !input.showPhonePublic || Boolean(input.ownerPhone?.trim()), {
  message: "DOG_PUBLIC_PHONE_REQUIRED",
  path: ["ownerPhone"],
});

export const dogProfilePatchSchema = z
  .object({
    name: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(80).optional()),
    photoUrl: dogPhotoUrlSchema,
    ageLabel: z.preprocess(emptyToUndefined, z.string().trim().max(80).optional()),
    ownerPhone: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(40).optional()),
    importantNotes: dogNotesSchema,
    ...dogVisibilitySchema,
    isActive: z.boolean().optional(),
  })
  .refine(
    (input) =>
      input.name !== undefined ||
      input.photoUrl !== undefined ||
      input.ageLabel !== undefined ||
      input.ownerPhone !== undefined ||
      input.importantNotes !== undefined ||
      input.publicProfileEnabled !== undefined ||
      input.showPhotoPublic !== undefined ||
      input.showAgePublic !== undefined ||
      input.showPhonePublic !== undefined ||
      input.showNotesPublic !== undefined ||
      input.isActive !== undefined,
    {
      message: "DOG_PROFILE_UPDATE_REQUIRED",
      path: ["name"],
    },
  );

export const adminDogProfileUpdateSchema = z
  .object({
    dogId: z.string().trim().min(1).max(191),
    isActive: z.boolean().optional(),
    releaseClaim: z.boolean().optional(),
  })
  .refine((input) => input.isActive !== undefined || input.releaseClaim === true, {
    message: "ADMIN_DOG_UPDATE_REQUIRED",
    path: ["dogId"],
  });

export const adminDogBatchCreateSchema = z.object({
  count: z.coerce.number().int().min(1).max(500),
});

export const deliverySlotsQuerySchema = z.object({
  postalCode: z.preprocess(emptyToUndefined, z.string().trim().max(40).optional()),
  country: z.preprocess(emptyToUndefined, z.string().trim().max(80).optional()),
  from: z.preprocess(emptyToUndefined, z.string().datetime().optional()),
  to: z.preprocess(emptyToUndefined, z.string().datetime().optional()),
  mode: z.enum(["legacy", "dynamic"]).optional(),
});

export const adminDeliverySlotCreateSchema = z.object({
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  capacity: z.coerce.number().int().min(1).max(500).default(8),
  isOpen: z.boolean().optional(),
  note: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
}).refine((input) => input.endAt > input.startAt, {
  message: "INVALID_SLOT_RANGE",
  path: ["endAt"],
});

export const adminDeliverySlotUpdateSchema = z.object({
  id: z.string().min(1).max(191),
  startAt: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  endAt: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  capacity: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(500).optional()),
  isOpen: z.boolean().optional(),
  note: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
});

export const adminDeliverySlotDeleteSchema = z.object({
  id: z.string().min(1).max(191),
});

export const adminDeliveryExceptionUpsertSchema = z.object({
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  isClosed: z.boolean().optional(),
  capacityOverride: z.preprocess(
    emptyToUndefined,
    z.union([z.coerce.number().int().min(1).max(500), z.null()]).optional(),
  ),
  reason: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
});

export const adminDeliveryExceptionDeleteSchema = z.object({
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const adminDeliveryScheduleSettingsSchema = z
  .object({
    averageDeliveryMinutes: z.coerce.number().int().min(5).max(240),
    blockMinutes: z.coerce.number().int().min(15).max(480),
    amEnabled: z.boolean(),
    amStartMinute: z.coerce.number().int().min(0).max(1439),
    amEndMinute: z.coerce.number().int().min(1).max(1440),
    pmEnabled: z.boolean(),
    pmStartMinute: z.coerce.number().int().min(0).max(1439),
    pmEndMinute: z.coerce.number().int().min(1).max(1440),
  })
  .refine((input) => input.averageDeliveryMinutes <= input.blockMinutes, {
    message: "AVERAGE_DELIVERY_TOO_LONG",
    path: ["averageDeliveryMinutes"],
  })
  .refine((input) => input.amEndMinute > input.amStartMinute, {
    message: "INVALID_AM_PERIOD",
    path: ["amEndMinute"],
  })
  .refine((input) => input.pmEndMinute > input.pmStartMinute, {
    message: "INVALID_PM_PERIOD",
    path: ["pmEndMinute"],
  })
  .refine((input) => input.amEnabled || input.pmEnabled, {
    message: "DELIVERY_PERIOD_REQUIRED",
    path: ["amEnabled"],
  })
  .refine(
    (input) =>
      !input.amEnabled ||
      !input.pmEnabled ||
      input.amEndMinute <= input.pmStartMinute ||
      input.pmEndMinute <= input.amStartMinute,
    {
      message: "DELIVERY_PERIODS_OVERLAP",
      path: ["pmStartMinute"],
    },
  );

export const adminDeliveryRunsQuerySchema = z.object({
  date: z.preprocess(emptyToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
});

export const adminDriverCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z
    .preprocess(
      emptyToUndefined,
      z
        .string()
        .trim()
        .max(40)
        .refine((value) => !value || isValidDeliveryPhone(value), "INVALID_DELIVERY_PHONE"),
    )
    .optional(),
  isActive: z.boolean().optional(),
});

export const adminDriverUpdateSchema = z
  .object({
    driverId: z.string().trim().min(1).max(191),
    name: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(120).optional()),
    phone: z
      .preprocess(
        emptyToUndefined,
        z
          .string()
          .trim()
          .max(40)
          .refine((value) => !value || isValidDeliveryPhone(value), "INVALID_DELIVERY_PHONE"),
      )
      .optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (input) => input.name !== undefined || input.phone !== undefined || input.isActive !== undefined,
    {
      message: "DRIVER_UPDATE_REQUIRED",
      path: ["driverId"],
    },
  );

export const adminDriverDeleteSchema = z.object({
  driverId: z.string().trim().min(1).max(191),
});

export const createDeliveryRunSchema = z.object({
  deliverySlotId: z.string().trim().min(1).max(191),
  driverId: z.string().trim().min(1).max(191),
  includeReturnToDepot: z.boolean().optional(),
});

export const reorderDeliveryRunSchema = z.object({
  stopIds: z.array(z.string().trim().min(1).max(191)).min(1).max(200),
});

export const adminCompleteDeliveryRunSchema = z.object({
  manualActualKmFinal: z.preprocess(emptyToUndefined, z.coerce.number().min(0).max(5000).optional()),
  note: z.preprocess(emptyToUndefined, z.string().trim().max(1000).optional()),
});

export const driverLocationSampleSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracyMeters: z.number().min(0).max(5000),
  speedMps: z.preprocess(emptyToUndefined, z.number().min(0).max(120).optional()),
  heading: z.preprocess(emptyToUndefined, z.number().min(0).max(360).optional()),
  recordedAt: z.string().datetime(),
});

export const driverStopCompleteSchema = z.object({
  result: z.enum(["DELIVERED", "FAILED"]),
  note: z.preprocess(emptyToUndefined, z.string().trim().max(1000).optional()),
});

export const driverRunStartSchema = z
  .object({
    lat: z.preprocess(emptyToUndefined, z.number().min(-90).max(90).optional()),
    lng: z.preprocess(emptyToUndefined, z.number().min(-180).max(180).optional()),
    accuracyMeters: z.preprocess(emptyToUndefined, z.number().min(0).max(5000).optional()),
    speedMps: z.preprocess(emptyToUndefined, z.number().min(0).max(120).optional()),
    heading: z.preprocess(emptyToUndefined, z.number().min(0).max(360).optional()),
    recordedAt: z.preprocess(emptyToUndefined, z.string().datetime().optional()),
  })
  .refine(
    (input) =>
      (input.lat === undefined && input.lng === undefined) ||
      (input.lat !== undefined && input.lng !== undefined),
    {
      message: "INVALID_START_LOCATION",
      path: ["lat"],
    },
  );

export const driverFinishRunSchema = z
  .object({
    odometerStartKm: z.preprocess(emptyToUndefined, z.coerce.number().min(0).max(500000).optional()),
    odometerEndKm: z.preprocess(emptyToUndefined, z.coerce.number().min(0).max(500000).optional()),
    note: z.preprocess(emptyToUndefined, z.string().trim().max(1000).optional()),
  })
  .refine(
    (input) =>
      input.odometerStartKm === undefined ||
      input.odometerEndKm === undefined ||
      input.odometerEndKm >= input.odometerStartKm,
    {
      message: "INVALID_ODOMETER_RANGE",
      path: ["odometerEndKm"],
    },
  );

export const adminOrderUpdateSchema = z
  .object({
    orderId: z.string().min(1).max(191),
    status: z
      .enum(["PENDING", "PAID", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"])
      .optional(),
    paymentStatus: z.enum(["PENDING", "PAID", "FAILED", "REFUNDED"]).optional(),
    deliveryStatus: z
      .enum([
        "UNSCHEDULED",
        "SCHEDULED",
        "OUT_FOR_DELIVERY",
        "DELIVERED",
        "FAILED",
        "RESCHEDULED",
      ])
      .optional(),
    deliverySlotId: z.preprocess(
      (value) => {
        if (value === null) return null;
        if (typeof value === "string" && value.trim() === "") return null;
        return value;
      },
      z.string().trim().min(1).max(191).nullable().optional(),
    ),
  })
  .refine(
    (data) =>
      data.status !== undefined ||
      data.paymentStatus !== undefined ||
      data.deliveryStatus !== undefined ||
      data.deliverySlotId !== undefined,
    {
      message: "ORDER_UPDATE_REQUIRED",
      path: ["orderId"],
    },
  );

export const subscriptionIntervalSchema = z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY"]);

export const subscriptionCheckoutSchema = z.object({
  productId: z.string().min(1),
  interval: subscriptionIntervalSchema,
  quantity: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(20).optional()).default(1),
});

export const subscriptionCancelSchema = z.object({
  subscriptionId: z.string().min(1).max(191),
});

export const maintenanceSettingsSchema = z.object({
  enabled: z.boolean(),
  message: z.union([z.string().max(500), z.null()]).optional(),
  openAt: z.union([z.string().max(80), z.null()]).optional(),
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
  z.string()
    .trim()
    .max(500)
    .refine(
      (val) => !val || val.startsWith("/") || val.startsWith("http://") || val.startsWith("https://"),
      { message: "INVALID_URL" }
    )
    .optional(),
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
  costCents: z.coerce.number().int().min(0).max(100000000).default(0),
  currency: z.preprocess(emptyToUndefined, z.string().trim().min(3).max(10).optional()),
  stock: z.coerce.number().int().min(0).max(1000000),
  isActive: z.boolean().optional(),
  isSubscription: z.boolean().optional(),
  priceWeekly: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(100000000).optional()),
  priceBiweekly: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(100000000).optional()),
  priceMonthly: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(100000000).optional()),
  priceQuarterly: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(100000000).optional()),
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
  costCents: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(100000000).optional()),
  currency: z.preprocess(emptyToUndefined, z.string().trim().min(3).max(10).optional()),
  isActive: z.boolean().optional(),
  isSubscription: z.boolean().optional(),
  priceWeekly: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(100000000).optional()),
  priceBiweekly: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(100000000).optional()),
  priceMonthly: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(100000000).optional()),
  priceQuarterly: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(100000000).optional()),
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

const promoBannerTextField = z.string().trim().min(1).max(191);
const promoBannerOptionalTextField = z.preprocess(
  emptyToUndefined,
  z.string().trim().min(1).max(191).optional(),
);
const promoBannerCtaLinkSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine((value) => isValidPromoCtaLink(value), {
    message: "INVALID_PROMO_CTA_LINK",
  });

export const adminPromoBannerCreateSchema = z.object({
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(100000).optional(),
  badgeFr: promoBannerOptionalTextField,
  badgeEn: promoBannerOptionalTextField,
  titleFr: promoBannerTextField,
  titleEn: promoBannerOptionalTextField,
  price1Fr: promoBannerOptionalTextField,
  price1En: promoBannerOptionalTextField,
  price2Fr: promoBannerOptionalTextField,
  price2En: promoBannerOptionalTextField,
  point1Fr: promoBannerOptionalTextField,
  point1En: promoBannerOptionalTextField,
  point2Fr: promoBannerOptionalTextField,
  point2En: promoBannerOptionalTextField,
  point3Fr: promoBannerOptionalTextField,
  point3En: promoBannerOptionalTextField,
  ctaTextFr: promoBannerOptionalTextField,
  ctaTextEn: promoBannerOptionalTextField,
  ctaLink: promoBannerCtaLinkSchema.optional(),
});

export const adminPromoBannerUpdateSchema = z
  .object({
    isActive: z.boolean().optional(),
    sortOrder: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(100000).optional()),
    badgeFr: promoBannerOptionalTextField,
    badgeEn: promoBannerOptionalTextField,
    titleFr: promoBannerOptionalTextField,
    titleEn: promoBannerOptionalTextField,
    price1Fr: promoBannerOptionalTextField,
    price1En: promoBannerOptionalTextField,
    price2Fr: promoBannerOptionalTextField,
    price2En: promoBannerOptionalTextField,
    point1Fr: promoBannerOptionalTextField,
    point1En: promoBannerOptionalTextField,
    point2Fr: promoBannerOptionalTextField,
    point2En: promoBannerOptionalTextField,
    point3Fr: promoBannerOptionalTextField,
    point3En: promoBannerOptionalTextField,
    ctaTextFr: promoBannerOptionalTextField,
    ctaTextEn: promoBannerOptionalTextField,
    ctaLink: z.preprocess(emptyToUndefined, promoBannerCtaLinkSchema.optional()),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "PROMO_UPDATE_REQUIRED",
    path: ["titleFr"],
  });

const promoCodeValueSchema = z
  .string()
  .trim()
  .min(3)
  .max(40)
  .regex(/^[A-Za-z0-9_-]+$/, "INVALID_PROMO_CODE");

export const adminPromoCodeCreateSchema = z.object({
  code: promoCodeValueSchema,
  description: z.preprocess(emptyToUndefined, z.string().trim().max(160).optional()),
  discountPercent: z.coerce.number().int().min(1).max(100),
  isActive: z.boolean().optional(),
});

export const adminPromoCodeUpdateSchema = z
  .object({
    code: z.preprocess(emptyToUndefined, promoCodeValueSchema.optional()),
    description: z.preprocess(emptyToUndefined, z.string().trim().max(160).optional()),
    discountPercent: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(100).optional()),
    isActive: z.boolean().optional(),
  })
  .refine((input) => Object.keys(input).length > 0, {
    message: "PROMO_CODE_UPDATE_REQUIRED",
    path: ["code"],
  });


export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

export const accountPasswordChangeSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(10),
    confirmPassword: z.string().min(1),
  })
  .refine((input) => input.newPassword === input.confirmPassword, {
    message: "PASSWORD_CONFIRMATION_MISMATCH",
    path: ["confirmPassword"],
  })
  .refine((input) => input.currentPassword !== input.newPassword, {
    message: "PASSWORD_UNCHANGED",
    path: ["newPassword"],
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
  guestToken: z.string().trim().min(1).max(2000),
});

export const supportPromoLeadSchema = z.object({
  email: z.string().trim().email().max(160),
  language: z.enum(["fr", "en"]).optional(),
});
