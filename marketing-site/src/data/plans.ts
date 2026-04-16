// Pricing data mirrored from main app's src/constants/plans.ts
// Kept as a snapshot so the marketing site can deploy independently.

export interface MarketingPlan {
  id: 'STARTER' | 'GROWTH' | 'PRO';
  name: string;
  tagline: string;
  priceAED: number;
  annualAED: number;
  highlight?: boolean;
  bullets: string[];
  cta: string;
}

export const MARKETING_PLANS: MarketingPlan[] = [
  {
    id: 'STARTER',
    name: 'Starter',
    tagline: 'For solo operators and service businesses',
    priceAED: 99,
    annualAED: 79,
    bullets: [
      '1 WhatsApp number',
      'Shared team inbox (1 user)',
      '1,000 CRM contacts',
      '500 broadcasts per month',
      '1 AI assistant · 1,000 AI messages',
      'Appointment booking (100/month)',
    ],
    cta: 'Start free trial',
  },
  {
    id: 'GROWTH',
    name: 'Growth',
    tagline: 'For small teams ready to scale',
    priceAED: 279,
    annualAED: 219,
    highlight: true,
    bullets: [
      '3 WhatsApp numbers',
      'Up to 5 team members',
      '5,000 CRM contacts',
      '3,000 broadcasts per month',
      '3 AI assistants · 5,000 AI messages',
      'Lead routing, roles & lead scoring',
    ],
    cta: 'Start free trial',
  },
  {
    id: 'PRO',
    name: 'Pro',
    tagline: 'For multi-branch and high-volume teams',
    priceAED: 549,
    annualAED: 439,
    bullets: [
      '5 WhatsApp numbers',
      'Up to 10 team members',
      '25,000 CRM contacts',
      '10,000 broadcasts per month',
      '10 AI assistants · 25,000 AI messages',
      'API access, webhooks & revenue reports',
    ],
    cta: 'Start free trial',
  },
];

export const TRUST_SIGNALS = [
  'No hidden fees',
  'Cancel anytime',
  'Arabic and English ready',
  'UAE-focused support',
];

export const FAQ = [
  {
    question: 'Can I switch plans anytime?',
    answer:
      'Yes. Upgrade or downgrade from your billing page whenever you need to.',
  },
  {
    question: 'Can I keep my current WhatsApp number?',
    answer:
      'Yes. Tawasel connects to your existing WhatsApp Business setup, so you keep the customer-facing number you already use.',
  },
  {
    question: 'How long does setup take?',
    answer:
      'Most teams connect their WhatsApp number, import contacts, and start replying in under 30 minutes.',
  },
  {
    question: 'Do you support Arabic?',
    answer:
      'Yes. Tawasel supports Arabic and English with full RTL interfaces and bilingual team workflows.',
  },
];
