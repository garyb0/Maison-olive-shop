-- Support V1 professional fields and IA-ready metadata.

ALTER TABLE "SupportConversation" ADD COLUMN "orderId" TEXT;
ALTER TABLE "SupportConversation" ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "SupportConversation" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'WIDGET';
ALTER TABLE "SupportConversation" ADD COLUMN "tagsJson" TEXT;
ALTER TABLE "SupportConversation" ADD COLUMN "aiSummary" TEXT;
ALTER TABLE "SupportConversation" ADD COLUMN "aiIntent" TEXT;

ALTER TABLE "SupportMessage" ADD COLUMN "metadataJson" TEXT;

ALTER TABLE "SupportNotificationPreference" ADD COLUMN "displayName" TEXT;
ALTER TABLE "SupportNotificationPreference" ADD COLUMN "quickRepliesJson" TEXT;

CREATE INDEX "SupportConversation_orderId_idx" ON "SupportConversation"("orderId");
CREATE INDEX "SupportConversation_priority_status_idx" ON "SupportConversation"("priority", "status");
CREATE INDEX "SupportConversation_source_createdAt_idx" ON "SupportConversation"("source", "createdAt");
