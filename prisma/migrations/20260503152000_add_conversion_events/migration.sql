CREATE TABLE "ConversionEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "sessionKey" TEXT NOT NULL,
    "userId" TEXT,
    "productId" TEXT,
    "productSlug" TEXT,
    "orderId" TEXT,
    "orderNumber" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "cartTotalCents" INTEGER,
    "itemCount" INTEGER,
    "quantity" INTEGER,
    "paymentMethod" TEXT,
    "deliveryMode" TEXT,
    "language" TEXT,
    "device" TEXT,
    "path" TEXT,
    "referrerPath" TEXT,
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "ConversionEvent_type_createdAt_idx" ON "ConversionEvent"("type", "createdAt");
CREATE INDEX "ConversionEvent_sessionKey_createdAt_idx" ON "ConversionEvent"("sessionKey", "createdAt");
CREATE INDEX "ConversionEvent_userId_createdAt_idx" ON "ConversionEvent"("userId", "createdAt");
CREATE INDEX "ConversionEvent_productId_createdAt_idx" ON "ConversionEvent"("productId", "createdAt");
CREATE INDEX "ConversionEvent_orderId_idx" ON "ConversionEvent"("orderId");
CREATE INDEX "ConversionEvent_createdAt_idx" ON "ConversionEvent"("createdAt");
