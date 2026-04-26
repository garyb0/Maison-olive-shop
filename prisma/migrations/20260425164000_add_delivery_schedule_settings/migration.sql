-- CreateTable
CREATE TABLE "DeliveryScheduleSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "averageDeliveryMinutes" INTEGER NOT NULL DEFAULT 30,
    "blockMinutes" INTEGER NOT NULL DEFAULT 60,
    "amEnabled" BOOLEAN NOT NULL DEFAULT true,
    "amStartMinute" INTEGER NOT NULL DEFAULT 540,
    "amEndMinute" INTEGER NOT NULL DEFAULT 720,
    "pmEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pmStartMinute" INTEGER NOT NULL DEFAULT 780,
    "pmEndMinute" INTEGER NOT NULL DEFAULT 1020,
    "capacityMode" TEXT NOT NULL DEFAULT 'ACTIVE_DRIVERS',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Seed singleton defaults for existing databases.
INSERT INTO "DeliveryScheduleSettings" (
    "id",
    "averageDeliveryMinutes",
    "blockMinutes",
    "amEnabled",
    "amStartMinute",
    "amEndMinute",
    "pmEnabled",
    "pmStartMinute",
    "pmEndMinute",
    "capacityMode",
    "createdAt",
    "updatedAt"
) VALUES (
    'default',
    30,
    60,
    true,
    540,
    720,
    true,
    780,
    1020,
    'ACTIVE_DRIVERS',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);
