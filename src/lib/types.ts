export type UserRole = "CUSTOMER" | "ADMIN";
export type PaymentMethod = "MANUAL" | "STRIPE";
export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";
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
};

export type CartItemInput = {
  productId: string;
  quantity: number;
};

export type CheckoutPayload = {
  items: CartItemInput[];
  paymentMethod: PaymentMethod;
  promoCode?: string;
  shippingLine1?: string;
  shippingCity?: string;
  shippingRegion?: string;
  shippingPostal?: string;
  shippingCountry?: string;
};

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
