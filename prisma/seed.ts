import prisma from '../src/lib/prisma';

async function main() {
  console.log('Seeding database...');

  // Cleanup
  await prisma.message.deleteMany();
  await prisma.conversationNote.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.contactCustomAttributeValue.deleteMany();
  await prisma.customAttributeDefinition.deleteMany();
  await prisma.contactListMember.deleteMany();
  await prisma.contactList.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.chatbotTool.deleteMany();
  await prisma.whatsAppNumber.deleteMany();
  await prisma.chatbot.deleteMany();
  await prisma.whatsAppTemplate.deleteMany();
  await prisma.sessionTemplate.deleteMany();
  await prisma.broadcastRecipient.deleteMany();
  await prisma.broadcastCampaign.deleteMany();
  await prisma.billingLedgerEntry.deleteMany();
  await prisma.usageLog.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.workspaceMembership.deleteMany();
  await prisma.workspaceInvite.deleteMany();
  await prisma.businessSetting.deleteMany();
  await prisma.personalSetting.deleteMany();
  await prisma.widgetSetting.deleteMany();
  await prisma.featureRequest.deleteMany();
  await prisma.issueReport.deleteMany();
  await prisma.instagramAccount.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();

  // Create Users
  const user1 = await prisma.user.upsert({
    where: { email: 'ameeneidha@gmail.com' },
    update: {},
    create: {
      email: 'ameeneidha@gmail.com',
      name: 'Ameen Eidha',
      password: 'password123', // In real app, hash this
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: 'team@example.com' },
    update: {},
    create: {
      email: 'team@example.com',
      name: 'Team Member',
      password: 'password123',
    },
  });

  // Create Workspaces
  const ws1 = await prisma.workspace.upsert({
    where: { slug: 'main-business' },
    update: {},
    create: {
      name: 'Main Business',
      slug: 'main-business',
      plan: 'PRO',
      businessSettings: { create: { timezone: 'Asia/Dubai' } },
      members: {
        create: {
          userId: user1.id,
          role: 'OWNER',
        },
      },
    },
  });

  const ws2 = await prisma.workspace.upsert({
    where: { slug: 'marketing-agency' },
    update: {},
    create: {
      name: 'Marketing Agency',
      slug: 'marketing-agency',
      businessSettings: { create: { timezone: 'Asia/Dubai' } },
      members: {
        create: {
          userId: user1.id,
          role: 'OWNER',
        },
      },
    },
  });

  // Add team member to ws1
  await prisma.workspaceMembership.create({
    data: {
      userId: user2.id,
      workspaceId: ws1.id,
      role: 'USER',
    },
  });

  // Create WhatsApp Numbers
  const num1 = await prisma.whatsAppNumber.create({
    data: {
      name: 'Support Line',
      phoneNumber: '+971501234567',
      workspaceId: ws1.id,
    },
  });

  const num2 = await prisma.whatsAppNumber.create({
    data: {
      name: 'Sales Line',
      phoneNumber: '+971507654321',
      workspaceId: ws1.id,
    },
  });

  // Create Instagram Accounts
  const insta1 = await prisma.instagramAccount.create({
    data: {
      name: 'Business Instagram',
      instagramId: 'insta_123456',
      username: 'business_uae',
      workspaceId: ws1.id,
    },
  });

  // Create AI Chatbot
  const bot1 = await prisma.chatbot.create({
    data: {
      name: 'Assistant Bot',
      instructions: 'You are a helpful assistant for a UAE-based business. Answer questions about services and escalate if needed.',
      workspaceId: ws1.id,
      tools: {
        create: [
          { name: 'Escalate to Human Agent', description: 'Transfer the conversation to a human support agent.' },
        ],
      },
      instagramAccounts: {
        connect: { id: insta1.id },
      },
    },
  });

  // Assign bot to number
  await prisma.whatsAppNumber.update({
    where: { id: num1.id },
    data: { chatbotId: bot1.id, autoReply: true },
  });

  // Create Contacts
  const contact1 = await prisma.contact.create({
    data: {
      name: 'Ahmed Hassan',
      phoneNumber: '+971551112222',
      workspaceId: ws1.id,
      pipelineStage: 'QUALIFIED',
    },
  });

  const contact2 = await prisma.contact.create({
    data: {
      name: 'Sarah Miller',
      phoneNumber: '+971553334444',
      workspaceId: ws1.id,
      pipelineStage: 'NEW_LEAD',
    },
  });

  // Create Conversations
  const conv1 = await prisma.conversation.create({
    data: {
      contactId: contact1.id,
      workspaceId: ws1.id,
      numberId: num1.id,
      channelType: 'WHATSAPP',
      priority: 'HIGH',
      assignedToId: user1.id,
      tags: 'registration,high-value',
      messages: {
        create: [
          { content: 'Hello, I need help with my vehicle registration.', direction: 'INCOMING', senderType: 'USER' },
          { content: 'Sure, I can help with that. Which vehicle type?', direction: 'OUTGOING', senderType: 'AI_BOT' },
          { content: 'This customer is a high-value lead. Please handle with care.', direction: 'OUTGOING', senderType: 'USER', isInternal: true, senderName: 'System' },
        ],
      },
    },
  });

  const conv2 = await prisma.conversation.create({
    data: {
      contactId: contact2.id,
      workspaceId: ws1.id,
      numberId: num1.id,
      channelType: 'WHATSAPP',
      priority: 'MEDIUM',
      assignedToId: user2.id,
      tags: 'billing',
      messages: {
        create: [
          { content: 'Hi, what are your payment options?', direction: 'INCOMING', senderType: 'USER' },
        ],
      },
    },
  });

  // Create Instagram Conversation
  const contact3 = await prisma.contact.create({
    data: {
      name: 'Instagram User',
      instagramId: 'ig_user_789',
      instagramUsername: 'ig_user_789',
      workspaceId: ws1.id,
    },
  });

  const conv3 = await prisma.conversation.create({
    data: {
      contactId: contact3.id,
      workspaceId: ws1.id,
      instagramAccountId: insta1.id,
      channelType: 'INSTAGRAM',
      messages: {
        create: [
          { content: 'Hey! Saw your post about the new services.', direction: 'INCOMING', senderType: 'USER' },
          { content: 'Glad you liked it! How can we help?', direction: 'OUTGOING', senderType: 'USER' },
        ],
      },
    },
  });

  // Create Templates
  await prisma.whatsAppTemplate.createMany({
    data: [
      { name: 'welcome_message', content: 'Welcome to our service! How can we help you today?', category: 'UTILITY', language: 'en', workspaceId: ws1.id },
      { name: 'payment_options', content: 'We accept Credit Card, Bank Transfer, and Apple Pay.', category: 'UTILITY', language: 'en', workspaceId: ws1.id },
      { name: 'location_info', content: 'Our office is located in Business Bay, Dubai.', category: 'UTILITY', language: 'en', workspaceId: ws1.id },
    ],
  });

  // Create Billing Data
  await prisma.billingLedgerEntry.create({
    data: {
      amount: 500,
      type: 'CREDIT',
      description: 'Initial balance',
      workspaceId: ws1.id,
    },
  });

  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
