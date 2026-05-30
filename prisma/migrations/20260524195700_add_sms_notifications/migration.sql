CREATE TABLE "SmsRecipientPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "orderId" TEXT,
    "phoneE164" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'fr',
    "optedIn" BOOLEAN NOT NULL DEFAULT false,
    "optedOut" BOOLEAN NOT NULL DEFAULT false,
    "optInSource" TEXT NOT NULL,
    "optInAt" DATETIME,
    "optOutAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SmsRecipientPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SmsRecipientPreference_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "SmsNotificationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "orderId" TEXT,
    "userId" TEXT,
    "recipientPreferenceId" TEXT,
    "toPhoneE164" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'fr',
    "bodyPreview" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "dryRun" BOOLEAN NOT NULL DEFAULT false,
    "twilioMessageSid" TEXT,
    "twilioAccountSid" TEXT,
    "twilioMessagingServiceSid" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "attemptedAt" DATETIME,
    "sentAt" DATETIME,
    "deliveredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SmsNotificationLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SmsNotificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SmsNotificationLog_recipientPreferenceId_fkey" FOREIGN KEY ("recipientPreferenceId") REFERENCES "SmsRecipientPreference" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "SmsInboundMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageSid" TEXT NOT NULL,
    "fromPhoneE164" TEXT NOT NULL,
    "toPhoneE164" TEXT,
    "optOutType" TEXT,
    "bodyPreview" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "SmsRecipientPreference_orderId_phoneE164_key" ON "SmsRecipientPreference"("orderId", "phoneE164");
CREATE INDEX "SmsRecipientPreference_userId_idx" ON "SmsRecipientPreference"("userId");
CREATE INDEX "SmsRecipientPreference_orderId_idx" ON "SmsRecipientPreference"("orderId");
CREATE INDEX "SmsRecipientPreference_phoneE164_optedOut_idx" ON "SmsRecipientPreference"("phoneE164", "optedOut");

CREATE UNIQUE INDEX "SmsNotificationLog_eventKey_key" ON "SmsNotificationLog"("eventKey");
CREATE UNIQUE INDEX "SmsNotificationLog_twilioMessageSid_key" ON "SmsNotificationLog"("twilioMessageSid");
CREATE INDEX "SmsNotificationLog_orderId_type_idx" ON "SmsNotificationLog"("orderId", "type");
CREATE INDEX "SmsNotificationLog_userId_createdAt_idx" ON "SmsNotificationLog"("userId", "createdAt");
CREATE INDEX "SmsNotificationLog_toPhoneE164_createdAt_idx" ON "SmsNotificationLog"("toPhoneE164", "createdAt");
CREATE INDEX "SmsNotificationLog_status_createdAt_idx" ON "SmsNotificationLog"("status", "createdAt");

CREATE UNIQUE INDEX "SmsInboundMessage_messageSid_key" ON "SmsInboundMessage"("messageSid");
CREATE INDEX "SmsInboundMessage_fromPhoneE164_createdAt_idx" ON "SmsInboundMessage"("fromPhoneE164", "createdAt");
CREATE INDEX "SmsInboundMessage_optOutType_createdAt_idx" ON "SmsInboundMessage"("optOutType", "createdAt");
