export const PLANS = {
  STARTER: {
    name: 'Starter',
    whatsappLimit: 1,
    instagramLimit: 1,
    chatbotLimit: 1,
    userLimit: 1,
    price: 99,
    stripePriceId: 'price_1T9Wo7I1cBVPBGguaxTuXskN',
  },
  GROWTH: {
    name: 'Growth',
    whatsappLimit: 2,
    instagramLimit: 1,
    chatbotLimit: 3,
    userLimit: 3,
    price: 299,
    stripePriceId: 'price_1T9WoUI1cBVPBGgu1kSpUzUa',
  },
  PRO: {
    name: 'Pro',
    whatsappLimit: 5,
    instagramLimit: 2,
    chatbotLimit: 10,
    userLimit: 5,
    price: 599,
    stripePriceId: 'price_1T9WorI1cBVPBGguvOq6RbCO',
  },
};

export type PlanType = keyof typeof PLANS;
export type WorkspacePlan = PlanType | 'NONE';

export function isPaidPlan(plan?: string | null): plan is PlanType {
  return !!plan && plan in PLANS;
}

export function getPlanConfig(plan?: string | null) {
  return isPaidPlan(plan) ? PLANS[plan] : null;
}
