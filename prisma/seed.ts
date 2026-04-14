import dotenv from 'dotenv';
import prisma from '../src/lib/prisma';
import bcrypt from 'bcryptjs';

dotenv.config();

const DEFAULT_PASSWORD = 'password123';
const SUPERADMIN_EMAIL = 'ameeneidha@gmail.com';
const SUPERADMIN_NAME = 'Ameen Eidha';

type DemoPlan = 'STARTER' | 'GROWTH' | 'PRO';

type DemoAccount = {
  plan: DemoPlan;
  ownerName: string;
  ownerEmail: string;
  workspaceName: string;
  workspaceSlug: string;
  whatsappNumbers: Array<{ name: string; phoneNumber: string }>;
  instagramAccounts: Array<{ name: string; instagramId: string; username: string }>;
  contacts: Array<{
    name: string;
    phoneNumber?: string;
    instagramId?: string;
    instagramUsername?: string;
    leadSource: string;
    pipelineStage: string;
    city: string;
    initialMessage: string;
    responseMessage: string;
  }>;
  templates: Array<{ name: string; content: string; category: string }>;
  sessionTemplates: Array<{ name: string; content: string }>;
  ledgerCredit: number;
};

const renewalDate = new Date();
renewalDate.setDate(renewalDate.getDate() + 30);

const demoAccounts: DemoAccount[] = [
  {
    plan: 'STARTER',
    ownerName: 'Starter Demo Owner',
    ownerEmail: 'starter@wabahub.local',
    workspaceName: 'Starter Demo',
    workspaceSlug: 'starter-demo',
    whatsappNumbers: [{ name: 'Starter Line', phoneNumber: '+971500000101' }],
    instagramAccounts: [{ name: 'Starter Instagram', instagramId: 'ig_starter_demo', username: 'starter_demo' }],
    contacts: [
      {
        name: 'Noura Ali',
        phoneNumber: '+971500001001',
        leadSource: 'Website',
        pipelineStage: 'NEW_LEAD',
        city: 'Dubai',
        initialMessage: 'Hi, I want more info about your basic package.',
        responseMessage: 'Absolutely. I can walk you through the Starter package and what is included.',
      },
    ],
    templates: [],
    sessionTemplates: [
      { name: 'Starter Greeting', content: 'Hello! Thanks for contacting our Starter team. How can we help?' },
      { name: 'Starter Follow-Up', content: 'Just following up on your Starter package inquiry. Let me know if you have questions.' },
    ],
    ledgerCredit: 120,
  },
  {
    plan: 'GROWTH',
    ownerName: 'Growth Demo Owner',
    ownerEmail: 'growth@wabahub.local',
    workspaceName: 'Growth Demo',
    workspaceSlug: 'growth-demo',
    whatsappNumbers: [
      { name: 'Growth Sales', phoneNumber: '+971500000201' },
      { name: 'Growth Support', phoneNumber: '+971500000202' },
    ],
    instagramAccounts: [{ name: 'Growth Instagram', instagramId: 'ig_growth_demo', username: 'growth_demo' }],
    contacts: [
      {
        name: 'Omar Khan',
        phoneNumber: '+971500002001',
        leadSource: 'Instagram',
        pipelineStage: 'CONTACTED',
        city: 'Sharjah',
        initialMessage: 'Can your team help us manage two branches from one inbox?',
        responseMessage: 'Yes. Growth is designed for small teams with multiple agents and more automation.',
      },
      {
        name: 'Clinic Prospect',
        phoneNumber: '+971500002002',
        leadSource: 'Referral',
        pipelineStage: 'QUALIFIED',
        city: 'Abu Dhabi',
        initialMessage: 'We need reminders and broadcast messages for patients.',
        responseMessage: 'Growth supports campaigns, automation, and shared team workflows for that.',
      },
    ],
    templates: [],
    sessionTemplates: [
      { name: 'Growth Intro', content: 'Hi! You are speaking with our Growth team. What are you trying to improve in your workflow?' },
      { name: 'Growth Quote', content: 'I can prepare a Growth plan recommendation based on your channels and team size.' },
    ],
    ledgerCredit: 350,
  },
  {
    plan: 'PRO',
    ownerName: 'Pro Demo Owner',
    ownerEmail: 'pro@wabahub.local',
    workspaceName: 'Pro Demo',
    workspaceSlug: 'pro-demo',
    whatsappNumbers: [
      { name: 'Pro Main Line', phoneNumber: '+1 555 136 3768' },
      { name: 'Pro Sales East', phoneNumber: '+971500000301' },
      { name: 'Pro Support', phoneNumber: '+971500000302' },
    ],
    instagramAccounts: [
      { name: 'Pro Instagram One', instagramId: 'ig_pro_demo_1', username: 'pro_demo_one' },
      { name: 'Pro Instagram Two', instagramId: 'ig_pro_demo_2', username: 'pro_demo_two' },
    ],
    contacts: [
      {
        name: 'Ahmed Hassan',
        phoneNumber: '+971551112222',
        leadSource: 'Google Ads',
        pipelineStage: 'QUALIFIED',
        city: 'Abu Dhabi',
        initialMessage: 'Hello, I need help with my vehicle registration.',
        responseMessage: 'Sure, I can help with that. Which vehicle type?',
      },
      {
        name: 'Sarah Miller',
        phoneNumber: '+971553334444',
        leadSource: 'Instagram',
        pipelineStage: 'NEW_LEAD',
        city: 'Dubai',
        initialMessage: 'Hi, what are your payment options?',
        responseMessage: 'We accept card, transfer, and invoice-based billing for annual plans.',
      },
      {
        name: 'Instagram User',
        instagramId: 'ig_user_789',
        instagramUsername: 'ig_user_789',
        leadSource: 'Instagram DM',
        pipelineStage: 'CONTACTED',
        city: 'Abu Dhabi',
        initialMessage: 'Hey! Saw your post about the new services.',
        responseMessage: 'Glad you liked it! How can we help?',
      },
    ],
    templates: [],
    sessionTemplates: [
      { name: 'Quick Greeting', content: 'Hi there! How can I help you today?' },
      { name: 'Closing Statement', content: 'Thank you for contacting us. Have a great day!' },
      { name: 'Escalation Reply', content: 'I am escalating this to a senior agent and will update you shortly.' },
    ],
    ledgerCredit: 600,
  },
];

async function resetDatabase() {
  const tables: Array<{ name: string }> = await prisma.$queryRaw`
    SELECT tablename AS name FROM pg_tables
    WHERE schemaname = 'public' AND tablename != '_prisma_migrations'`;
  await prisma.$executeRawUnsafe('SET session_replication_role = replica');
  for (const { name } of tables) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${name}" CASCADE`);
  }
  await prisma.$executeRawUnsafe('SET session_replication_role = DEFAULT');
}

async function createSuperadminUser(hashedPassword: string) {
  await prisma.user.create({
    data: {
      email: SUPERADMIN_EMAIL,
      name: SUPERADMIN_NAME,
      password: hashedPassword,
      emailVerified: true,
      personalSettings: {
        create: {
          theme: 'light',
        },
      },
    },
  });
}

async function createDemoWorkspace(account: DemoAccount, hashedPassword: string) {
  const owner = await prisma.user.create({
    data: {
      email: account.ownerEmail,
      name: account.ownerName,
      password: hashedPassword,
      emailVerified: true,
      personalSettings: {
        create: {
          theme: 'light',
        },
      },
    },
  });

  const workspace = await prisma.workspace.create({
    data: {
      name: account.workspaceName,
      slug: account.workspaceSlug,
      plan: account.plan,
      subscriptionStatus: 'active',
      subscriptionCurrentPeriodEnd: renewalDate,
      members: {
        create: {
          userId: owner.id,
          role: 'OWNER',
        },
      },
      businessSettings: {
        create: {
          timezone: 'Asia/Dubai',
        },
      },
      widgetSetting: {
        create: {
          enabled: false,
        },
      },
    },
  });

  const numbers = [];
  for (const numberConfig of account.whatsappNumbers) {
    const number = await prisma.whatsAppNumber.create({
      data: {
        ...numberConfig,
        workspaceId: workspace.id,
      },
    });
    numbers.push(number);
  }

  const instagramAccounts = [];
  for (const instagramConfig of account.instagramAccounts) {
    const instagram = await prisma.instagramAccount.create({
      data: {
        ...instagramConfig,
        accessToken: process.env.INSTAGRAM_ACCESS_TOKEN || undefined,
        workspaceId: workspace.id,
      },
    });
    instagramAccounts.push(instagram);
  }

  const chatbot = await prisma.chatbot.create({
    data: {
      name: `${account.plan} Assistant`,
      instructions: `You are the ${account.plan} demo assistant. Help prospects, answer package questions, and escalate billing or onboarding issues clearly.`,
      workspaceId: workspace.id,
      tools: {
        create: [
          { name: 'Escalate to Human Agent', description: 'Transfer the conversation to a human support agent.' },
        ],
      },
      instagramAccounts: instagramAccounts.length > 0
        ? {
            connect: instagramAccounts.map((instagram) => ({ id: instagram.id })),
          }
        : undefined,
    },
  });

  if (numbers[0]) {
    await prisma.whatsAppNumber.update({
      where: { id: numbers[0].id },
      data: {
        chatbotId: chatbot.id,
        autoReply: true,
      },
    });
  }

  for (const template of account.templates) {
    await prisma.whatsAppTemplate.create({
      data: {
        ...template,
        language: 'en',
        workspaceId: workspace.id,
      },
    });
  }

  for (const sessionTemplate of account.sessionTemplates) {
    await prisma.sessionTemplate.create({
      data: {
        ...sessionTemplate,
        workspaceId: workspace.id,
      },
    });
  }

  for (const [index, contactConfig] of account.contacts.entries()) {
    const contact = await prisma.contact.create({
      data: {
        name: contactConfig.name,
        phoneNumber: contactConfig.phoneNumber,
        instagramId: contactConfig.instagramId,
        instagramUsername: contactConfig.instagramUsername,
        city: contactConfig.city,
        workspaceId: workspace.id,
        pipelineStage: contactConfig.pipelineStage,
        leadSource: contactConfig.leadSource,
      },
    });

    const conversation = await prisma.conversation.create({
      data: {
        contactId: contact.id,
        workspaceId: workspace.id,
        numberId: contactConfig.phoneNumber ? numbers[index % Math.max(numbers.length, 1)]?.id : undefined,
        instagramAccountId: contactConfig.instagramId ? instagramAccounts[0]?.id : undefined,
        channelType: contactConfig.instagramId ? 'INSTAGRAM' : 'WHATSAPP',
        priority: account.plan === 'PRO' && index === 0 ? 'HIGH' : 'MEDIUM',
        internalStatus: index === 0 ? 'WAITING_FOR_INTERNAL' : 'OPEN',
        assignedToId: owner.id,
        tags: `${account.plan.toLowerCase()},demo`,
      },
    });

    await prisma.message.createMany({
      data: [
        {
          conversationId: conversation.id,
          content: contactConfig.initialMessage,
          direction: 'INCOMING',
          senderType: 'USER',
        },
        {
          conversationId: conversation.id,
          content: contactConfig.responseMessage,
          direction: 'OUTGOING',
          senderType: 'USER',
          senderName: owner.name || account.ownerName,
        },
      ],
    });

    await prisma.task.create({
      data: {
        title: `Follow up with ${contactConfig.name}`,
        priority: index === 0 ? 'HIGH' : 'MEDIUM',
        contactId: contact.id,
        conversationId: conversation.id,
        workspaceId: workspace.id,
      },
    });

    await prisma.activityLog.create({
      data: {
        type: 'TASK_CREATED',
        content: `Seeded follow-up task for ${contactConfig.name}`,
        contactId: contact.id,
        conversationId: conversation.id,
        workspaceId: workspace.id,
      },
    });
  }

  await prisma.automationRule.create({
    data: {
      name: `${account.plan} New Lead Routing`,
      trigger: 'NEW_LEAD',
      conditions: JSON.stringify({ source: 'any' }),
      actions: JSON.stringify([{ type: 'AUTO_ASSIGN', value: owner.id }]),
      enabled: true,
      workspaceId: workspace.id,
    },
  });

  await prisma.billingLedgerEntry.create({
    data: {
      amount: account.ledgerCredit,
      type: 'CREDIT',
      description: `${account.plan} demo balance`,
      workspaceId: workspace.id,
    },
  });
}

async function main() {
  console.log('Seeding database with package demo accounts...');
  await resetDatabase();

  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  await createSuperadminUser(hashedPassword);

  for (const account of demoAccounts) {
    await createDemoWorkspace(account, hashedPassword);
  }

  console.log('');
  console.log('Demo accounts ready:');
  console.log(`- SUPERADMIN: ${SUPERADMIN_EMAIL} / ${DEFAULT_PASSWORD}`);
  for (const account of demoAccounts) {
    console.log(`- ${account.plan}: ${account.ownerEmail} / ${DEFAULT_PASSWORD}`);
  }
  console.log('');
  console.log(`All demo workspaces are verified and active until ${renewalDate.toISOString().slice(0, 10)}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
