PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderNumber" TEXT NOT NULL,
    "userId" TEXT,
    "customerEmail" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "promoCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentMethod" TEXT NOT NULL DEFAULT 'MANUAL',
    "paymentProvider" TEXT,
    "stripeSessionId" TEXT,
    "subtotalCents" INTEGER NOT NULL,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "taxCents" INTEGER NOT NULL,
    "shippingCents" INTEGER NOT NULL,
    "refundedCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "shippingLine1" TEXT,
    "shippingCity" TEXT,
    "shippingRegion" TEXT,
    "shippingPostal" TEXT,
    "shippingCountry" TEXT,
    "deliverySlotId" TEXT,
    "deliveryWindowStartAt" DATETIME,
    "deliveryWindowEndAt" DATETIME,
    "deliveryStatus" TEXT NOT NULL DEFAULT 'UNSCHEDULED',
    "deliveryInstructions" TEXT,
    "deliveryPhone" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_deliverySlotId_fkey" FOREIGN KEY ("deliverySlotId") REFERENCES "DeliverySlot" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_Order" (
    "id",
    "orderNumber",
    "userId",
    "customerEmail",
    "customerName",
    "promoCode",
    "status",
    "paymentStatus",
    "paymentMethod",
    "paymentProvider",
    "stripeSessionId",
    "subtotalCents",
    "discountCents",
    "taxCents",
    "shippingCents",
    "refundedCents",
    "totalCents",
    "currency",
    "shippingLine1",
    "shippingCity",
    "shippingRegion",
    "shippingPostal",
    "shippingCountry",
    "deliverySlotId",
    "deliveryWindowStartAt",
    "deliveryWindowEndAt",
    "deliveryStatus",
    "deliveryInstructions",
    "deliveryPhone",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "orderNumber",
    "userId",
    "customerEmail",
    "customerName",
    "promoCode",
    "status",
    "paymentStatus",
    "paymentMethod",
    "paymentProvider",
    "stripeSessionId",
    "subtotalCents",
    "discountCents",
    "taxCents",
    "shippingCents",
    "refundedCents",
    "totalCents",
    "currency",
    "shippingLine1",
    "shippingCity",
    "shippingRegion",
    "shippingPostal",
    "shippingCountry",
    "deliverySlotId",
    "deliveryWindowStartAt",
    "deliveryWindowEndAt",
    "deliveryStatus",
    "deliveryInstructions",
    "deliveryPhone",
    "createdAt",
    "updatedAt"
FROM "Order";

DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";

CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
CREATE UNIQUE INDEX "Order_stripeSessionId_key" ON "Order"("stripeSessionId");
CREATE INDEX "Order_userId_createdAt_idx" ON "Order"("userId", "createdAt");
CREATE INDEX "Order_status_idx" ON "Order"("status");
CREATE INDEX "Order_paymentStatus_idx" ON "Order"("paymentStatus");
CREATE INDEX "Order_deliverySlotId_idx" ON "Order"("deliverySlotId");
CREATE INDEX "Order_deliveryStatus_idx" ON "Order"("deliveryStatus");
CREATE INDEX "Order_promoCode_idx" ON "Order"("promoCode");

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
