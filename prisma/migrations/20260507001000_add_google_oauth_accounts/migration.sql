ALTER TABLE "User" ADD COLUMN "passwordHash_new" TEXT;

UPDATE "User" SET "passwordHash_new" = "passwordHash";

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'CUSTOMER',
    "language" TEXT NOT NULL DEFAULT 'fr',
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecretCiphertext" TEXT,
    "twoFactorBackupCodesJson" TEXT,
    "twoFactorEnabledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "new_User" (
    "id",
    "email",
    "passwordHash",
    "firstName",
    "lastName",
    "role",
    "language",
    "twoFactorEnabled",
    "twoFactorSecretCiphertext",
    "twoFactorBackupCodesJson",
    "twoFactorEnabledAt",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "email",
    "passwordHash_new",
    "firstName",
    "lastName",
    "role",
    "language",
    "twoFactorEnabled",
    "twoFactorSecretCiphertext",
    "twoFactorBackupCodesJson",
    "twoFactorEnabledAt",
    "createdAt",
    "updatedAt"
FROM "User";

DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

CREATE TABLE "OAuthAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OAuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "OAuthAccount_provider_providerAccountId_key" ON "OAuthAccount"("provider", "providerAccountId");
CREATE INDEX "OAuthAccount_userId_idx" ON "OAuthAccount"("userId");
CREATE INDEX "OAuthAccount_email_idx" ON "OAuthAccount"("email");
