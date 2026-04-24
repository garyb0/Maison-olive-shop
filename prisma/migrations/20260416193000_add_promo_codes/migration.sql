-- Add promo code support for checkout/admin management.
ALTER TABLE "Order" ADD COLUMN "promoCode" TEXT;

CREATE INDEX "Order_promoCode_idx" ON "Order"("promoCode");

CREATE TABLE "PromoCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "discountPercent" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");
CREATE INDEX "PromoCode_isActive_code_idx" ON "PromoCode"("isActive", "code");
