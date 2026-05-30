ALTER TABLE "DogProfile" ADD COLUMN "lostModeEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "DogProfile" ADD COLUMN "lostModeMessage" TEXT;
ALTER TABLE "DogProfile" ADD COLUMN "lostModeActivatedAt" DATETIME;

CREATE TABLE "DogQrScan" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "dogId" TEXT NOT NULL,
  "viewerUserId" TEXT,
  "eventType" TEXT NOT NULL DEFAULT 'VIEW',
  "lostModeAtScan" BOOLEAN NOT NULL DEFAULT false,
  "latitude" REAL,
  "longitude" REAL,
  "accuracyMeters" REAL,
  "locationSharedAt" DATETIME,
  "userAgent" TEXT,
  "ipHash" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DogQrScan_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "DogProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DogQrScan_viewerUserId_fkey" FOREIGN KEY ("viewerUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "DogQrScan_dogId_createdAt_idx" ON "DogQrScan"("dogId", "createdAt");
CREATE INDEX "DogQrScan_eventType_createdAt_idx" ON "DogQrScan"("eventType", "createdAt");
CREATE INDEX "DogQrScan_viewerUserId_createdAt_idx" ON "DogQrScan"("viewerUserId", "createdAt");
