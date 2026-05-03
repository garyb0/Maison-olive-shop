-- CreateTable
CREATE TABLE "SupportNotificationPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adminUserId" TEXT NOT NULL,
    "emailNewConversation" BOOLEAN NOT NULL DEFAULT true,
    "emailNewMessage" BOOLEAN NOT NULL DEFAULT true,
    "emailConversationAssigned" BOOLEAN NOT NULL DEFAULT true,
    "emailDigest" TEXT NOT NULL DEFAULT 'none',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SupportNotificationPreference_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SupportNotificationPreference_adminUserId_key" ON "SupportNotificationPreference"("adminUserId");

-- CreateIndex
CREATE INDEX "SupportNotificationPreference_emailNewConversation_idx" ON "SupportNotificationPreference"("emailNewConversation");

-- CreateIndex
CREATE INDEX "SupportNotificationPreference_emailNewMessage_idx" ON "SupportNotificationPreference"("emailNewMessage");

-- CreateIndex
CREATE INDEX "SupportNotificationPreference_emailConversationAssigned_idx" ON "SupportNotificationPreference"("emailConversationAssigned");
