ALTER TABLE "User" ADD COLUMN "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "twoFactorSecretCiphertext" TEXT;
ALTER TABLE "User" ADD COLUMN "twoFactorBackupCodesJson" TEXT;
ALTER TABLE "User" ADD COLUMN "twoFactorEnabledAt" DATETIME;
