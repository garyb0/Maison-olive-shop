-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DeliveryRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deliverySlotId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "dateKey" TEXT NOT NULL,
    "includeReturnToDepot" BOOLEAN NOT NULL DEFAULT true,
    "plannedKm" REAL,
    "plannedDurationSec" INTEGER,
    "actualKmGps" REAL,
    "actualKmOdometer" REAL,
    "actualKmFinal" REAL,
    "actualKmSource" TEXT,
    "odometerStartKm" REAL,
    "odometerEndKm" REAL,
    "note" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DeliveryRun_deliverySlotId_fkey" FOREIGN KEY ("deliverySlotId") REFERENCES "DeliverySlot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DeliveryRun_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeliveryStop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "plannedSequence" INTEGER NOT NULL,
    "manualSequence" INTEGER,
    "finalSequence" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "plannedLegKm" REAL,
    "plannedCumulativeKm" REAL,
    "plannedLegDurationSec" INTEGER,
    "plannedEta" DATETIME,
    "actualCumulativeKmAtStop" REAL,
    "arrivedAt" DATETIME,
    "completedAt" DATETIME,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DeliveryStop_runId_fkey" FOREIGN KEY ("runId") REFERENCES "DeliveryRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DeliveryStop_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeliveryRunAccessToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "lastAccessAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DeliveryRunAccessToken_runId_fkey" FOREIGN KEY ("runId") REFERENCES "DeliveryRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeliveryGpsSample" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "recordedAt" DATETIME NOT NULL,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "accuracyMeters" REAL NOT NULL,
    "speedMps" REAL,
    "heading" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeliveryGpsSample_runId_fkey" FOREIGN KEY ("runId") REFERENCES "DeliveryRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GeocodedAddressCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "addressKey" TEXT NOT NULL,
    "shippingLine1" TEXT NOT NULL,
    "shippingCity" TEXT NOT NULL,
    "shippingRegion" TEXT NOT NULL,
    "shippingPostal" TEXT NOT NULL,
    "shippingCountry" TEXT NOT NULL,
    "formattedAddress" TEXT NOT NULL,
    "placeId" TEXT,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "lastUsedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Driver_isActive_name_idx" ON "Driver"("isActive", "name");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryRun_deliverySlotId_key" ON "DeliveryRun"("deliverySlotId");

-- CreateIndex
CREATE INDEX "DeliveryRun_driverId_dateKey_idx" ON "DeliveryRun"("driverId", "dateKey");

-- CreateIndex
CREATE INDEX "DeliveryRun_status_dateKey_idx" ON "DeliveryRun"("status", "dateKey");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryStop_runId_orderId_key" ON "DeliveryStop"("runId", "orderId");

-- CreateIndex
CREATE INDEX "DeliveryStop_runId_finalSequence_idx" ON "DeliveryStop"("runId", "finalSequence");

-- CreateIndex
CREATE INDEX "DeliveryStop_orderId_idx" ON "DeliveryStop"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryRunAccessToken_tokenHash_key" ON "DeliveryRunAccessToken"("tokenHash");

-- CreateIndex
CREATE INDEX "DeliveryRunAccessToken_runId_expiresAt_idx" ON "DeliveryRunAccessToken"("runId", "expiresAt");

-- CreateIndex
CREATE INDEX "DeliveryGpsSample_runId_recordedAt_idx" ON "DeliveryGpsSample"("runId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "GeocodedAddressCache_addressKey_key" ON "GeocodedAddressCache"("addressKey");

-- CreateIndex
CREATE INDEX "GeocodedAddressCache_shippingPostal_idx" ON "GeocodedAddressCache"("shippingPostal");

-- CreateIndex
CREATE INDEX "GeocodedAddressCache_updatedAt_idx" ON "GeocodedAddressCache"("updatedAt");
