export type UserRole = "CUSTOMER" | "ADMIN";
export type PaymentMethod = "MANUAL" | "STRIPE";
export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";
export type DeliveryStatus =
  | "UNSCHEDULED"
  | "SCHEDULED"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "FAILED"
  | "RESCHEDULED";
export type DeliveryRunStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";
export type DeliveryStopStatus = "PENDING" | "DELIVERED" | "FAILED";
export type ActualKmSource = "GPS" | "ODOMETER" | "MANUAL_ADMIN";
export type OrderStatus =
  | "PENDING"
  | "PAID"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED";

export type SupportConversationStatus = "WAITING" | "OPEN" | "ASSIGNED" | "CLOSED";
export type SupportSenderType = "CUSTOMER" | "ADMIN" | "SYSTEM";

export type CurrentUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  language: "fr" | "en";
  twoFactorEnabled?: boolean;
};

export type DeliveryAddress = {
  id: string;
  label: string;
  shippingLine1: string;
  shippingCity: string;
  shippingRegion: string;
  shippingPostal: string;
  shippingCountry: string;
  deliveryPhone?: string;
  deliveryInstructions?: string;
  lastUsedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DeliveryDriver = {
  id: string;
  name: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DeliveryRunStop = {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  deliveryPhone: string | null;
  deliveryInstructions: string | null;
  shippingLine1: string | null;
  shippingCity: string | null;
  shippingRegion: string | null;
  shippingPostal: string | null;
  shippingCountry: string | null;
  plannedSequence: number;
  manualSequence: number | null;
  finalSequence: number;
  status: DeliveryStopStatus;
  plannedLegKm: number | null;
  plannedCumulativeKm: number | null;
  plannedLegDurationSec: number | null;
  plannedEta: string | null;
  actualCumulativeKmAtStop: number | null;
  arrivedAt: string | null;
  completedAt: string | null;
  note: string | null;
  mapsHref: string;
};

export type DeliveryRunSummary = {
  id: string;
  status: DeliveryRunStatus;
  dateKey: string;
  includeReturnToDepot: boolean;
  plannedKm: number | null;
  plannedDurationSec: number | null;
  actualKmGps: number | null;
  actualKmOdometer: number | null;
  actualKmFinal: number | null;
  actualKmSource: ActualKmSource | null;
  odometerStartKm: number | null;
  odometerEndKm: number | null;
  note: string | null;
  startedAt: string | null;
  completedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  driver: DeliveryDriver;
  deliverySlot: {
    id: string;
    startAt: string;
    endAt: string;
    capacity: number;
    note: string | null;
  };
  stops: DeliveryRunStop[];
  stopCounts: {
    total: number;
    pending: number;
    delivered: number;
    failed: number;
  };
  accessToken: {
    hasActiveToken: boolean;
    expiresAt: string | null;
    revokedAt: string | null;
    lastAccessAt: string | null;
  };
  gpsSampleCount: number;
};

export type DeliveryKmReferenceRow = {
  runId: string;
  dateKey: string;
  orderNumber: string;
  customerName: string;
  shippingPostal: string | null;
  finalSequence: number;
  stopStatus: DeliveryStopStatus;
  plannedLegKm: number | null;
  plannedCumulativeKm: number | null;
  actualCumulativeKmAtStop: number | null;
  actualKmFinal: number | null;
  actualKmSource: ActualKmSource | null;
};

export type DogProfilePublic = {
  id: string;
  publicToken: string;
  name: string | null;
  photoUrl: string | null;
  ageLabel: string | null;
  ownerPhone: string | null;
  importantNotes: string | null;
  publicProfileEnabled: boolean;
  showPhotoPublic: boolean;
  showAgePublic: boolean;
  showPhonePublic: boolean;
  showNotesPublic: boolean;
  isActive: boolean;
  claimedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DogProfileAccount = DogProfilePublic & {
  userId: string | null;
};

export type CartItemInput = {
  productId: string;
  quantity: number;
};

export type CheckoutPayload = {
  items: CartItemInput[];
  paymentMethod: PaymentMethod;
  customerEmail?: string;
  customerName?: string;
  customerLanguage?: "fr" | "en";
  promoCode?: string;
  deliveryAddressId?: string;
  deliveryAddressLabel?: string;
  saveDeliveryAddress?: boolean;
  shippingLine1?: string;
  shippingCity?: string;
  shippingRegion?: string;
  shippingPostal?: string;
  shippingCountry?: string;
  deliverySlotId?: string;
  deliveryWindowStartAt?: string;
  deliveryWindowEndAt?: string;
  deliveryInstructions?: string;
  deliveryPhone?: string;
};

export type DeliveryPeriodKey = "AM" | "PM";

export type DeliveryScheduleSettings = {
  id: string;
  averageDeliveryMinutes: number;
  blockMinutes: number;
  amEnabled: boolean;
  amStartMinute: number;
  amEndMinute: number;
  pmEnabled: boolean;
  pmStartMinute: number;
  pmEndMinute: number;
  capacityMode: "ACTIVE_DRIVERS";
  createdAt: string | null;
  updatedAt: string | null;
};

export type CheckoutUiMode = "custom";

export type CheckoutConfirmationItem = {
  id: string;
  nameFr: string;
  nameEn: string;
  quantity: number;
  lineTotalCents: number;
};

export type CheckoutConfirmation = {
  orderId: string;
  orderNumber: string;
  registerEmail: string;
  paymentMode: "manual" | "stripe";
  orderCreatedAt: string;
  currency: string;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  gstCents: number;
  qstCents: number;
  taxCents: number;
  totalCents: number;
  items: CheckoutConfirmationItem[];
};

export type StripeInlineCheckoutSession = {
  uiMode: CheckoutUiMode;
  clientSecret: string;
  sessionId: string;
  returnUrl: string;
};

export type OrderCheckoutResponse = {
  order: {
    id: string;
    orderNumber: string;
    customerEmail: string;
  };
  confirmation: CheckoutConfirmation;
  stripeCheckout: StripeInlineCheckoutSession | null;
};

export type SubscriptionCheckoutResponse = StripeInlineCheckoutSession;

export type StripeInlinePaymentState =
  | "idle"
  | "creating-session"
  | "payment-ready"
  | "confirming"
  | "success"
  | "error";

export type TaxReportRow = {
  orderNumber: string;
  createdAt: string;
  customerEmail: string;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  shippingCents: number;
  refundedCents: number;
  totalCents: number;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
};
