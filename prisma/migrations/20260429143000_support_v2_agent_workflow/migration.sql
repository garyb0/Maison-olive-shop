-- Support V2 agent workflow: internal notes, closure metadata, SLA, and shared quick replies.

ALTER TABLE "SupportConversation" ADD COLUMN "closedReason" TEXT;
ALTER TABLE "SupportConversation" ADD COLUMN "closedNote" TEXT;
ALTER TABLE "SupportConversation" ADD COLUMN "reopenedAt" DATETIME;
ALTER TABLE "SupportConversation" ADD COLUMN "priorityUpdatedAt" DATETIME;
ALTER TABLE "SupportConversation" ADD COLUMN "slaDueAt" DATETIME;

CREATE TABLE "SupportInternalNote" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "conversationId" TEXT NOT NULL,
  "adminUserId" TEXT,
  "content" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportInternalNote_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "SupportConversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SupportInternalNote_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "SupportQuickReply" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'general',
  "language" TEXT NOT NULL DEFAULT 'fr',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdByAdminId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "SupportQuickReply_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "SupportConversation_slaDueAt_status_idx" ON "SupportConversation"("slaDueAt", "status");
CREATE INDEX "SupportInternalNote_conversationId_createdAt_idx" ON "SupportInternalNote"("conversationId", "createdAt");
CREATE INDEX "SupportInternalNote_adminUserId_createdAt_idx" ON "SupportInternalNote"("adminUserId", "createdAt");
CREATE INDEX "SupportQuickReply_language_isActive_sortOrder_idx" ON "SupportQuickReply"("language", "isActive", "sortOrder");
CREATE INDEX "SupportQuickReply_category_isActive_idx" ON "SupportQuickReply"("category", "isActive");
CREATE INDEX "SupportQuickReply_createdByAdminId_createdAt_idx" ON "SupportQuickReply"("createdByAdminId", "createdAt");
