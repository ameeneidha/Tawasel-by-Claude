-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT,
    "password" TEXT,
    "image" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WorkspaceMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    CONSTRAINT "WorkspaceMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkspaceMembership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkspaceInvite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "workspaceId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkspaceInvite_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkspaceInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WhatsAppNumber" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONNECTED',
    "autoReply" BOOLEAN NOT NULL DEFAULT false,
    "workspaceId" TEXT NOT NULL,
    "chatbotId" TEXT,
    CONSTRAINT "WhatsAppNumber_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WhatsAppNumber_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "phoneNumber" TEXT NOT NULL,
    "avatar" TEXT,
    "workspaceId" TEXT NOT NULL,
    "permission" TEXT NOT NULL DEFAULT 'ALLOWED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Contact_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastMessageAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contactId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "numberId" TEXT NOT NULL,
    CONSTRAINT "Conversation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Conversation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Conversation_numberId_fkey" FOREIGN KEY ("numberId") REFERENCES "WhatsAppNumber" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'TEXT',
    "direction" TEXT NOT NULL,
    "senderType" TEXT NOT NULL DEFAULT 'USER',
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversationId" TEXT NOT NULL,
    CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConversationNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversationId" TEXT NOT NULL,
    CONSTRAINT "ConversationNote_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WhatsAppTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "workspaceId" TEXT NOT NULL,
    CONSTRAINT "WhatsAppTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SessionTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    CONSTRAINT "SessionTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BroadcastCampaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" DATETIME,
    "templateId" TEXT,
    "numberId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    CONSTRAINT "BroadcastCampaign_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BroadcastCampaign_numberId_fkey" FOREIGN KEY ("numberId") REFERENCES "WhatsAppNumber" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BroadcastRecipient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phoneNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "campaignId" TEXT NOT NULL,
    CONSTRAINT "BroadcastRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "BroadcastCampaign" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Chatbot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "language" TEXT NOT NULL DEFAULT 'en',
    "workspaceId" TEXT NOT NULL,
    CONSTRAINT "Chatbot_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatbotTool" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "chatbotId" TEXT NOT NULL,
    CONSTRAINT "ChatbotTool_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CustomAttributeDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'STRING',
    "workspaceId" TEXT NOT NULL,
    CONSTRAINT "CustomAttributeDefinition_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContactCustomAttributeValue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    CONSTRAINT "ContactCustomAttributeValue_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ContactCustomAttributeValue_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "CustomAttributeDefinition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContactList" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "ContactListMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contactId" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    CONSTRAINT "ContactListMember_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ContactListMember_listId_fkey" FOREIGN KEY ("listId") REFERENCES "ContactList" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "lastUsedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL,
    CONSTRAINT "ApiKey_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BillingLedgerEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "amount" REAL NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL,
    CONSTRAINT "BillingLedgerEntry_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UsageLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "cost" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "workspaceId" TEXT NOT NULL,
    CONSTRAINT "UsageLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BusinessSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "workspaceId" TEXT NOT NULL,
    CONSTRAINT "BusinessSetting_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PersonalSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "theme" TEXT NOT NULL DEFAULT 'light',
    "userId" TEXT NOT NULL,
    CONSTRAINT "PersonalSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WidgetSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "domain" TEXT,
    "themeColor" TEXT NOT NULL DEFAULT '#25D366',
    "welcomeText" TEXT,
    "workspaceId" TEXT NOT NULL,
    CONSTRAINT "WidgetSetting_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FeatureRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "workspaceId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeatureRequest_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IssueReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "workspaceId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IssueReport_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMembership_userId_workspaceId_key" ON "WorkspaceMembership"("userId", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_key_key" ON "ApiKey"("key");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessSetting_workspaceId_key" ON "BusinessSetting"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalSetting_userId_key" ON "PersonalSetting"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WidgetSetting_workspaceId_key" ON "WidgetSetting"("workspaceId");
