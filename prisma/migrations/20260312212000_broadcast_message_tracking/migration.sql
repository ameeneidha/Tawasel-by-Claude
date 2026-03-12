ALTER TABLE "BroadcastRecipient" ADD COLUMN "metaMessageId" TEXT;

CREATE UNIQUE INDEX "BroadcastRecipient_metaMessageId_key" ON "BroadcastRecipient"("metaMessageId");
