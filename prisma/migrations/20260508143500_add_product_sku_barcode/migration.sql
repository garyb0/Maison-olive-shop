ALTER TABLE "Product" ADD COLUMN "sku" TEXT;
ALTER TABLE "Product" ADD COLUMN "barcode" TEXT;

UPDATE "Product"
SET "sku" = upper(replace(trim("slug"), ' ', '-'))
WHERE "sku" IS NULL OR trim("sku") = '';

CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");
CREATE UNIQUE INDEX "Product_barcode_key" ON "Product"("barcode");
