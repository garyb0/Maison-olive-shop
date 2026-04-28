-- CreateTable
CREATE TABLE "UserDeliveryAddress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "shippingLine1" TEXT NOT NULL,
    "shippingCity" TEXT NOT NULL,
    "shippingRegion" TEXT NOT NULL,
    "shippingPostal" TEXT NOT NULL,
    "shippingCountry" TEXT NOT NULL,
    "deliveryPhone" TEXT,
    "deliveryInstructions" TEXT,
    "lastUsedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserDeliveryAddress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "UserDeliveryAddress_userId_createdAt_idx" ON "UserDeliveryAddress"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UserDeliveryAddress_userId_lastUsedAt_idx" ON "UserDeliveryAddress"("userId", "lastUsedAt");
