CREATE TABLE IF NOT EXISTS "ProductFavorite" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProductFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ProductFavorite_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductFavorite_userId_productId_key" ON "ProductFavorite"("userId", "productId");
CREATE INDEX IF NOT EXISTS "ProductFavorite_userId_createdAt_idx" ON "ProductFavorite"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "ProductFavorite_productId_idx" ON "ProductFavorite"("productId");
