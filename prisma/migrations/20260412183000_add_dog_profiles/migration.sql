CREATE TABLE "DogProfile" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT,
  "publicToken" TEXT NOT NULL,
  "name" TEXT,
  "photoUrl" TEXT,
  "ageLabel" TEXT,
  "ownerPhone" TEXT,
  "importantNotes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "claimedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "DogProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "DogProfile_publicToken_key" ON "DogProfile"("publicToken");
CREATE INDEX "DogProfile_userId_createdAt_idx" ON "DogProfile"("userId", "createdAt");
CREATE INDEX "DogProfile_publicToken_isActive_idx" ON "DogProfile"("publicToken", "isActive");
