export type PlanType = 'STARTER' | 'GROWTH' | 'PRO';
export type WorkspacePlan = PlanType | 'NONE';
export type BillingCycle = 'monthly' | 'annual';

export type ComparisonValue = boolean | number | string;

export interface PlanConfig {
  name: string;
  shortLabel: string;
  audience: string;
  description: string;
  price: number;
  annualPrice: number;
  annualBilledPrice: number;
  stripePriceId: string;
  annualStripePriceId?: string | null;
  whatsappLimit: number;
  instagramLimit: number;
  chatbotLimit: number;
  userLimit: number;
  contactsLimit: number;
  broadcastLimit: number;
  automationLimit: number;
  aiMessagesPerMonth: number;
  serviceLimit: number;
  staffLimit: number;
  appointmentLimit: number;
  historyMonths: number;
  pipelineLimit: number;
  pipelineStageLimit: number;
  customFieldLimit: number;
  fileStorageGb: number;
  supportLabel: string;
  analyticsLabel: string;
  highlight?: boolean;
  cardHighlights: string[];
  billingHighlights: string[];
  valueProps: string[];
  comparison: {
    teamRoles: ComparisonValue;
    autoAssignment: ComparisonValue;
    agentWorkload: ComparisonValue;
    leadScoring: ComparisonValue;
    dealValueTracking: ComparisonValue;
    broadcastScheduling: ComparisonValue;
    quickReplyTemplates: ComparisonValue;
    multiLanguageAi: ComparisonValue;
    revenueReports: ComparisonValue;
    customDateRanges: ComparisonValue;
    exportReports: ComparisonValue;
    contactImportExport: ComparisonValue;
    apiAccess: ComparisonValue;
    webhooks: ComparisonValue;
    whiteLabel: ComparisonValue;
  };
}

export interface ComparisonGroup {
  title: string;
  rows: Array<{
    label: string;
    values: Record<PlanType, ComparisonValue>;
  }>;
}

export const PLAN_ORDER: PlanType[] = ['STARTER', 'GROWTH', 'PRO'];

export const PLANS: Record<PlanType, PlanConfig> = {
  STARTER: {
    name: 'Starter',
    shortLabel: 'For solo operators',
    audience: 'Ideal for solo founders, clinics, and service businesses that need a clean WhatsApp workflow without hiring a full team yet.',
    description: 'Run WhatsApp sales, support, and follow-up from one place without missing leads or relying on personal phones.',
    price: 99,
    annualPrice: 79,
    annualBilledPrice: 948,
    stripePriceId: 'price_1TBIEVIbjBok0V2YBoDL0iLw',
    annualStripePriceId: 'price_1TObBwIbjBok0V2YLWMFohZW',
    whatsappLimit: 1,
    instagramLimit: 1,
    chatbotLimit: 1,
    userLimit: 1,
    contactsLimit: 1000,
    broadcastLimit: 500,
    automationLimit: 3,
    aiMessagesPerMonth: 1000,
    serviceLimit: 5,
    staffLimit: 1,
    appointmentLimit: 100,
    historyMonths: 6,
    pipelineLimit: 1,
    pipelineStageLimit: 5,
    customFieldLimit: 0,
    fileStorageGb: 1,
    supportLabel: 'Email support (48-hour response)',
    analyticsLabel: 'Basic dashboard',
    cardHighlights: [
      '1 WhatsApp number connection',
      'Shared WhatsApp team inbox',
      'Up to 1,000 WhatsApp CRM contacts',
      '500 WhatsApp broadcast messages per month',
      '1 AI assistant with 1,000 AI messages per month',
      'Appointment booking with 5 services and 100 bookings per month',
    ],
    billingHighlights: [
      '1 user',
      '1 WhatsApp number',
      '1,000 WhatsApp CRM contacts',
      '500 WhatsApp broadcasts per month',
      '3 automations',
      'Basic analytics and 6-month conversation history',
    ],
    valueProps: [
      'Shared WhatsApp inbox for one operator or desk',
      'Basic WhatsApp CRM pipeline to track leads',
      'After-hours AI WhatsApp auto-replies',
      'Essential visibility on response time and follow-up',
    ],
    comparison: {
      teamRoles: false,
      autoAssignment: false,
      agentWorkload: false,
      leadScoring: false,
      dealValueTracking: false,
      broadcastScheduling: false,
      quickReplyTemplates: 10,
      multiLanguageAi: false,
      revenueReports: false,
      customDateRanges: false,
      exportReports: false,
      contactImportExport: false,
      apiAccess: false,
      webhooks: false,
      whiteLabel: false,
    },
  },
  GROWTH: {
    name: 'Growth',
    shortLabel: 'For small teams ready to scale',
    audience: 'Best for clinics, academies, sales teams, and service businesses that need a stronger shared WhatsApp workflow.',
    description: 'Give your whole team one WhatsApp operating system with automation, lead routing, and clearer follow-up ownership.',
    price: 279,
    annualPrice: 219,
    annualBilledPrice: 2628,
    stripePriceId: 'price_1TBIEVIbjBok0V2YmOxYng2g',
    annualStripePriceId: 'price_1TObBYIbjBok0V2Yy11xeMEG',
    whatsappLimit: 3,
    instagramLimit: 1,
    chatbotLimit: 3,
    userLimit: 5,
    contactsLimit: 5000,
    broadcastLimit: 3000,
    automationLimit: 15,
    aiMessagesPerMonth: 5000,
    serviceLimit: 20,
    staffLimit: 5,
    appointmentLimit: 500,
    historyMonths: 12,
    pipelineLimit: 1,
    pipelineStageLimit: 999,
    customFieldLimit: 5,
    fileStorageGb: 5,
    supportLabel: 'Priority email and WhatsApp support (12-hour response)',
    analyticsLabel: 'Full dashboard',
    highlight: true,
    cardHighlights: [
      'Up to 3 WhatsApp number connections',
      'Shared WhatsApp inbox for up to 5 users',
      '5,000 WhatsApp CRM contacts',
      '3,000 WhatsApp broadcast messages per month',
      '3 AI assistants with 5,000 AI messages per month',
      'Appointment booking with 20 services, 5 staff, and 500 bookings per month',
    ],
    billingHighlights: [
      'Up to 5 users',
      'Up to 3 WhatsApp numbers',
      '5,000 WhatsApp CRM contacts',
      '3,000 WhatsApp broadcasts per month',
      '15 automations',
      'Full analytics, team roles, and 12-month conversation history',
    ],
    valueProps: [
      'WhatsApp lead capture, assignment, and priority tags',
      'Notes, reminders, and clearer lead tracking',
      'WhatsApp broadcast reporting and team workload visibility',
      'Import contacts and schedule WhatsApp campaigns',
    ],
    comparison: {
      teamRoles: true,
      autoAssignment: true,
      agentWorkload: true,
      leadScoring: true,
      dealValueTracking: true,
      broadcastScheduling: true,
      quickReplyTemplates: 50,
      multiLanguageAi: false,
      revenueReports: false,
      customDateRanges: true,
      exportReports: false,
      contactImportExport: true,
      apiAccess: false,
      webhooks: false,
      whiteLabel: false,
    },
  },
  PRO: {
    name: 'Pro',
    shortLabel: 'For established multi-branch teams',
    audience: 'Built for larger teams and branch-based operations that need serious WhatsApp throughput, structure, and reporting.',
    description: 'Run high-volume WhatsApp operations with advanced automation, API access, and reporting for multi-team execution.',
    price: 549,
    annualPrice: 439,
    annualBilledPrice: 5268,
    stripePriceId: 'price_1TBIEVIbjBok0V2YKql2KZ9U',
    annualStripePriceId: 'price_1TObB2IbjBok0V2YvxmF8J8y',
    whatsappLimit: 5,
    instagramLimit: 2,
    chatbotLimit: 10,
    userLimit: 10,
    contactsLimit: 25000,
    broadcastLimit: 10000,
    automationLimit: 999999,
    aiMessagesPerMonth: 25000,
    serviceLimit: 999999,
    staffLimit: 10,
    appointmentLimit: 999999,
    historyMonths: 24,
    pipelineLimit: 3,
    pipelineStageLimit: 999,
    customFieldLimit: 999999,
    fileStorageGb: 20,
    supportLabel: 'Dedicated account manager plus WhatsApp support (4-hour response)',
    analyticsLabel: 'Advanced analytics and revenue reporting',
    cardHighlights: [
      'Up to 5 WhatsApp number connections',
      'Multi-team and branch-ready operations',
      '25,000 WhatsApp CRM contacts',
      '10,000 WhatsApp broadcast messages per month',
      '10 AI assistants with 25,000 AI messages per month',
      'Unlimited appointment booking with 10 staff members',
    ],
    billingHighlights: [
      'Up to 10 users',
      'Up to 5 WhatsApp numbers',
      '25,000 WhatsApp CRM contacts',
      '10,000 WhatsApp broadcasts per month',
      'Unlimited automations and custom fields',
      'Advanced analytics, API access, and 24-month conversation history',
    ],
    valueProps: [
      'Multi-team WhatsApp operations with forecasting',
      'Revenue reports, conversion funnels, and exports',
      'API and webhook access for custom workflows',
      'Dedicated account management for serious operations',
    ],
    comparison: {
      teamRoles: true,
      autoAssignment: true,
      agentWorkload: true,
      leadScoring: true,
      dealValueTracking: true,
      broadcastScheduling: true,
      quickReplyTemplates: 'Unlimited',
      multiLanguageAi: true,
      revenueReports: true,
      customDateRanges: true,
      exportReports: true,
      contactImportExport: true,
      apiAccess: true,
      webhooks: true,
      whiteLabel: 'Add-on',
    },
  },
};

export const PRICING_VALUE_STATEMENT =
  'Tawasel helps teams reply faster on WhatsApp, convert more leads, and save hours every week on manual follow-ups.';

export const PRICING_TRUST_SIGNALS = [
  'No hidden fees',
  'Cancel anytime',
  'Arabic and English ready',
  'UAE-focused support',
];

export const PRICING_FAQ = [
  {
    question: 'Can I switch plans anytime?',
    answer:
      'Yes. Upgrade or downgrade from billing whenever you need to. Upgrades can apply immediately, while downgrades can follow your billing cycle.',
  },
  {
    question: 'What happens if I reach a contact or broadcast limit?',
    answer:
      'You will get warned before the limit is reached. You can upgrade the workspace or add more capacity later without interrupting active conversations.',
  },
  {
    question: 'Can I keep my current WhatsApp number?',
    answer:
      'Yes. The platform is designed to connect your existing WhatsApp Business setup, so you keep the customer-facing number you already use.',
  },
  {
    question: 'How long does setup take?',
    answer:
      'Most teams can connect their WhatsApp number, import contacts, and start replying in less than 30 minutes once the hosted deployment is ready.',
  },
  {
    question: 'Do you support Arabic?',
    answer:
      'Yes. The app supports Arabic and English, including RTL interfaces and bilingual team workflows.',
  },
  {
    question: 'Will annual billing be available?',
    answer:
      'Yes. The pricing model already includes annual discounts, and those checkout options can be enabled when deployment billing is finalized.',
  },
];

export const PRICING_ADD_ONS = [
  { name: 'Extra user', price: 'AED 39/user/month', description: 'Add seats beyond your included team limit.' },
  { name: 'Extra WhatsApp number', price: 'AED 49/number/month', description: 'Connect another branch or department line.' },
  { name: 'Broadcast pack', price: 'AED 79 / 2,000 messages', description: 'Top up campaign capacity without changing plans.' },
  { name: 'Onboarding session', price: 'AED 499 one-time', description: 'Get hands-on help with setup, CRM stages, and automation.' },
];

export const PRICING_COMPARISON_GROUPS: ComparisonGroup[] = [
  {
    title: 'WhatsApp Operations and Team',
    rows: [
      {
        label: 'WhatsApp number connections',
        values: { STARTER: 1, GROWTH: 3, PRO: 5 },
      },
      {
        label: 'Users included',
        values: { STARTER: 1, GROWTH: 5, PRO: 10 },
      },
      {
        label: 'Team roles and permissions',
        values: { STARTER: false, GROWTH: true, PRO: true },
      },
      {
        label: 'WhatsApp lead routing',
        values: { STARTER: false, GROWTH: true, PRO: true },
      },
      {
        label: 'Agent workload view',
        values: { STARTER: false, GROWTH: true, PRO: true },
      },
    ],
  },
  {
    title: 'WhatsApp CRM and Messaging',
    rows: [
      {
        label: 'WhatsApp CRM contacts',
        values: { STARTER: '1,000', GROWTH: '5,000', PRO: '25,000' },
      },
      {
        label: 'Sales pipelines',
        values: { STARTER: 1, GROWTH: 1, PRO: 3 },
      },
      {
        label: 'Pipeline stages',
        values: { STARTER: 5, GROWTH: 'Unlimited', PRO: 'Unlimited' },
      },
      {
        label: 'Lead scoring',
        values: { STARTER: false, GROWTH: true, PRO: true },
      },
      {
        label: 'Deal value tracking',
        values: { STARTER: false, GROWTH: true, PRO: true },
      },
      {
        label: 'WhatsApp broadcast messages / month',
        values: { STARTER: '500', GROWTH: '3,000', PRO: '10,000' },
      },
      {
        label: 'WhatsApp broadcast scheduling',
        values: { STARTER: false, GROWTH: true, PRO: true },
      },
      {
        label: 'WhatsApp quick replies',
        values: { STARTER: 10, GROWTH: 50, PRO: 'Unlimited' },
      },
    ],
  },
  {
    title: 'AI, Analytics, and Support',
    rows: [
      {
        label: 'AI assistants',
        values: { STARTER: 1, GROWTH: 3, PRO: 10 },
      },
      {
        label: 'AI messages per month',
        values: { STARTER: '1,000', GROWTH: '5,000', PRO: '25,000' },
      },
      {
        label: 'Workflow automations',
        values: { STARTER: 3, GROWTH: 15, PRO: 'Unlimited' },
      },
      {
        label: 'Multi-language AI',
        values: { STARTER: false, GROWTH: false, PRO: true },
      },
      {
        label: 'WhatsApp conversation history',
        values: { STARTER: '6 months', GROWTH: '12 months', PRO: '24 months' },
      },
      {
        label: 'Revenue and conversion reports',
        values: { STARTER: false, GROWTH: false, PRO: true },
      },
      {
        label: 'Custom date ranges',
        values: { STARTER: false, GROWTH: true, PRO: true },
      },
      {
        label: 'Report exports',
        values: { STARTER: false, GROWTH: false, PRO: true },
      },
      {
        label: 'Contact import/export',
        values: { STARTER: false, GROWTH: true, PRO: true },
      },
      {
        label: 'API access',
        values: { STARTER: false, GROWTH: false, PRO: true },
      },
      {
        label: 'Webhooks',
        values: { STARTER: false, GROWTH: false, PRO: true },
      },
      {
        label: 'White-label widget',
        values: { STARTER: false, GROWTH: false, PRO: 'Add-on' },
      },
    ],
  },
  {
    title: 'Appointment Booking',
    rows: [
      {
        label: 'Services',
        values: { STARTER: 5, GROWTH: 20, PRO: 'Unlimited' },
      },
      {
        label: 'Staff members',
        values: { STARTER: 1, GROWTH: 5, PRO: 10 },
      },
      {
        label: 'Appointments per month',
        values: { STARTER: 100, GROWTH: 500, PRO: 'Unlimited' },
      },
    ],
  },
];

export function isPaidPlan(plan?: string | null): plan is PlanType {
  return !!plan && plan in PLANS;
}

export function getPlanConfig(plan?: string | null) {
  return isPaidPlan(plan) ? PLANS[plan] : null;
}

export function getPlanPrice(plan: PlanConfig, cycle: BillingCycle) {
  return cycle === 'annual' ? plan.annualPrice : plan.price;
}

export function getPlanCycleLabel(plan: PlanConfig, cycle: BillingCycle) {
  if (cycle === 'annual') {
    return `AED ${plan.annualPrice}/mo billed AED ${plan.annualBilledPrice}/year`;
  }

  return `AED ${plan.price}/month`;
}

export function formatLimitValue(value: number) {
  return value >= 999999 ? 'Unlimited' : value.toLocaleString();
}

export function formatComparisonValue(value: ComparisonValue) {
  if (typeof value === 'boolean') {
    return value ? 'Included' : '-';
  }
  if (typeof value === 'number') {
    return value.toLocaleString();
  }
  return value;
}
