CREATE TABLE "WebPushSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "driverRunId" TEXT,
    "driverTokenHash" TEXT,
    "endpointHash" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "audience" TEXT NOT NULL DEFAULT 'CUSTOMER',
    "userAgent" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WebPushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WebPushSubscription_driverRunId_fkey" FOREIGN KEY ("driverRunId") REFERENCES "DeliveryRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT false,
    "orderUpdates" BOOLEAN NOT NULL DEFAULT true,
    "deliveryUpdates" BOOLEAN NOT NULL DEFAULT true,
    "supportUpdates" BOOLEAN NOT NULL DEFAULT true,
    "dogQrUpdates" BOOLEAN NOT NULL DEFAULT true,
    "adminAlerts" BOOLEAN NOT NULL DEFAULT true,
    "driverRunUpdates" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "AppNotification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "driverRunId" TEXT,
    "audience" TEXT NOT NULL DEFAULT 'CUSTOMER',
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "metadataJson" TEXT,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AppNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AppNotification_driverRunId_fkey" FOREIGN KEY ("driverRunId") REFERENCES "DeliveryRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "WebPushSubscription_endpointHash_key" ON "WebPushSubscription"("endpointHash");
CREATE INDEX "WebPushSubscription_userId_enabled_idx" ON "WebPushSubscription"("userId", "enabled");
CREATE INDEX "WebPushSubscription_driverRunId_enabled_idx" ON "WebPushSubscription"("driverRunId", "enabled");
CREATE INDEX "WebPushSubscription_audience_enabled_idx" ON "WebPushSubscription"("audience", "enabled");

CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");

CREATE INDEX "AppNotification_userId_readAt_createdAt_idx" ON "AppNotification"("userId", "readAt", "createdAt");
CREATE INDEX "AppNotification_driverRunId_readAt_createdAt_idx" ON "AppNotification"("driverRunId", "readAt", "createdAt");
CREATE INDEX "AppNotification_audience_createdAt_idx" ON "AppNotification"("audience", "createdAt");
CREATE INDEX "AppNotification_type_createdAt_idx" ON "AppNotification"("type", "createdAt");
