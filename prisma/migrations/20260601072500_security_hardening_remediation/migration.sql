PRAGMA foreign_keys=OFF;

-- Invalidate replayable session tokens during the tokenHash migration.
DELETE FROM "Session";

CREATE TABLE "new_Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

DROP TABLE "Session";
ALTER TABLE "new_Session" RENAME TO "Session";
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

ALTER TABLE "Order" ADD COLUMN "inventoryReservedAt" DATETIME;
ALTER TABLE "Order" ADD COLUMN "deliveryCapacityReservedAt" DATETIME;

UPDATE "Order"
SET "inventoryReservedAt" = "createdAt"
WHERE "inventoryReservedAt" IS NULL
  AND "paymentStatus" != 'FAILED'
  AND "status" != 'CANCELLED';

UPDATE "Order"
SET "deliveryCapacityReservedAt" = "createdAt"
WHERE "deliveryCapacityReservedAt" IS NULL
  AND "paymentStatus" != 'FAILED'
  AND "status" != 'CANCELLED'
  AND ("deliverySlotId" IS NOT NULL OR "deliveryWindowStartAt" IS NOT NULL);

CREATE TABLE "SubscriptionCheckoutIntent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "priceId" TEXT NOT NULL,
    "interval" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "stripeSessionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SubscriptionCheckoutIntent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SubscriptionCheckoutIntent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SubscriptionCheckoutIntent_stripeSessionId_key" ON "SubscriptionCheckoutIntent"("stripeSessionId");
CREATE INDEX "SubscriptionCheckoutIntent_userId_idx" ON "SubscriptionCheckoutIntent"("userId");
CREATE INDEX "SubscriptionCheckoutIntent_productId_idx" ON "SubscriptionCheckoutIntent"("productId");
CREATE INDEX "SubscriptionCheckoutIntent_status_idx" ON "SubscriptionCheckoutIntent"("status");

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
