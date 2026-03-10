export const PLANS = {
  STARTER: {
    name: 'Starter',
    whatsappLimit: 1,
    instagramLimit: 1,
    chatbotLimit: 1,
    userLimit: 1,
    price: 99,
  },
  GROWTH: {
    name: 'Growth',
    whatsappLimit: 2,
    instagramLimit: 1,
    chatbotLimit: 3,
    userLimit: 3,
    price: 299,
  },
  PRO: {
    name: 'Pro',
    whatsappLimit: 5,
    instagramLimit: 2,
    chatbotLimit: 10,
    userLimit: 5,
    price: 599,
  },
};

export type PlanType = keyof typeof PLANS;
