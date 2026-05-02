import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { motion } from 'motion/react';
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Globe,
  Loader2,
  Lock,
  LogIn,
  Mail,
  MessageSquare,
  Minus,
  Sparkles,
  Shield,
  Users,
  Zap,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import {
  formatComparisonValue,
  formatLimitValue,
  getPlanPrice,
  PLAN_ORDER,
  PLANS,
  PRICING_COMPARISON_GROUPS,
  PRICING_FAQ,
  PRICING_TRUST_SIGNALS,
  PRICING_VALUE_STATEMENT,
  type BillingCycle,
} from '../constants/plans';

const FEATURE_ITEMS = [
  {
    id: 'sharedInbox',
    title: 'One shared WhatsApp inbox for your team',
    desc: 'Manage every WhatsApp conversation, handoff, and follow-up from one workspace instead of juggling personal phones and scattered chats.',
    icon: Globe,
  },
  {
    id: 'aiWarm',
    title: 'AI that keeps WhatsApp leads warm after hours',
    desc: 'Let Tawasel answer FAQs, qualify WhatsApp leads, and support customers while your team is offline.',
    icon: Zap,
  },
  {
    id: 'kpiDashboard',
    title: 'KPI dashboard built for operations',
    desc: 'Track WhatsApp unread messages, SLA risk, pipeline health, broadcast performance, and AI spend in one dashboard.',
    icon: BarChart3,
  },
  {
    id: 'teamCollaboration',
    title: 'Real team collaboration',
    desc: 'Assign chats, add internal notes, track ownership, and see exactly who replied to each customer.',
    icon: Users,
  },
  {
    id: 'secureDesign',
    title: 'Secure by design',
    desc: 'Use verified workspaces, role-based permissions, and a controlled onboarding flow for every account.',
    icon: Shield,
  },
  {
    id: 'broadcasts',
    title: 'WhatsApp broadcasts with targeting and review',
    desc: 'Segment WhatsApp contacts by pipeline or list, preview campaigns, send tests, and review delivery performance after launch.',
    icon: MessageSquare,
  },
];

const COMPARISON_PREVIEW_ROWS = 4;
const FOOTER_TRUST_POINTS = [
  'Arabic & English support',
  'Meta Cloud API ready',
  'Shared WhatsApp inbox and AI automation',
  'Built for UAE and GCC operations',
];
const TRIAL_PROMISES = ['30 days', 'No card required', 'Growth workspace included'];

const HOME_COPY = {
  en: {
    languageToggle: 'العربية',
    features: 'Features',
    pricing: 'Pricing',
    openDashboard: 'Open Dashboard',
    signIn: 'Sign In',
    signUp: 'Sign Up',
    eyebrow: '30-day no-card trial for UAE WhatsApp teams',
    heroTitle: 'Use Tawasel in your real business',
    heroHighlight: ' for 30 days.',
    heroSubtitle: 'Connect WhatsApp, share your booking link, send reminders, and handle real customers. If it creates value after a month, keep it. If not, walk away.',
    startTrial: 'Start 30-Day Trial',
    viewPricing: 'View Pricing',
    trialPromises: TRIAL_PROMISES,
    signupTitle: 'Start your 30-day trial',
    signinTitle: 'Sign in to Tawasel',
    signupSubtitle: 'Create your workspace and start a Growth trial immediately. No card required.',
    signinSubtitle: 'Access your dashboard, WhatsApp inbox, and team workflows.',
    fullName: 'Full Name',
    emailAddress: 'Email Address',
    password: 'Password',
    forgotPassword: 'Forgot password?',
    confirmPassword: 'Confirm Password',
    alreadyHaveAccount: 'Already have an account?',
    newToTawasel: 'New to Tawasel?',
    createAccount: 'Create Account',
    signingIn: 'Signing in...',
    creatingAccount: 'Creating account...',
    footerTrust: FOOTER_TRUST_POINTS,
    ready: 'Ready to centralize operations?',
    finalTitle: 'Prove the WhatsApp booking workflow in your real business.',
    finalSubtitle: 'Start with a Growth workspace, connect WhatsApp, send reminders, and decide after 30 days using real customer activity.',
    talkToSales: 'Talk to Sales',
    footerDesc: 'The premium operating layer for WhatsApp-driven sales, support, CRM workflows, and performance reporting for UAE and GCC businesses.',
    platform: 'Platform',
    company: 'Company',
    startTrialLink: 'Start 30-Day Trial',
    allRights: 'All rights reserved.',
    featureSectionTitle: 'Everything you need to run WhatsApp like a real revenue channel',
    featureSectionDesc: 'Tawasel is not just a shared WhatsApp inbox. It combines WhatsApp CRM, AI automation, broadcasts, and accountability so your team can move faster without losing context.',
    featureItems: {
      sharedInbox: {
        title: 'One shared WhatsApp inbox for your team',
        desc: 'Manage every WhatsApp conversation, handoff, and follow-up from one workspace instead of juggling personal phones and scattered chats.',
      },
      aiWarm: {
        title: 'AI that keeps WhatsApp leads warm after hours',
        desc: 'Let Tawasel answer FAQs, qualify WhatsApp leads, and support customers while your team is offline.',
      },
      kpiDashboard: {
        title: 'KPI dashboard built for operations',
        desc: 'Track WhatsApp unread messages, SLA risk, pipeline health, broadcast performance, and AI spend in one dashboard.',
      },
      teamCollaboration: {
        title: 'Real team collaboration',
        desc: 'Assign chats, add internal notes, track ownership, and see exactly who replied to each customer.',
      },
      secureDesign: {
        title: 'Secure by design',
        desc: 'Use verified workspaces, role-based permissions, and a controlled onboarding flow for every account.',
      },
      broadcasts: {
        title: 'WhatsApp broadcasts with targeting and review',
        desc: 'Segment WhatsApp contacts by pipeline or list, preview campaigns, send tests, and review delivery performance after launch.',
      },
    },
    pricingSectionDesc: 'Tawasel keeps your WhatsApp inbox, CRM, broadcasts, and AI in one operational system, so every upgrade unlocks clearer execution, not just more seats.',
    whyMove: 'Why teams move to Tawasel',
    pricingValueStatement: PRICING_VALUE_STATEMENT,
    comparison: 'Comparison',
    comparisonTitle: 'Compare the features that change operations day to day.',
    comparisonDesc: 'We surface the highest-impact differences first so teams can scan quickly, then expand into the full matrix when they need detail.',
    showCondensed: 'Show condensed comparison',
    expandComparison: 'Expand full comparison',
    fullFeatureBreakdown: 'Full feature breakdown',
    topItemsShown: 'Top items shown first for faster scanning',
    feature: 'Feature',
    faq: 'FAQ',
    faqTitle: 'Answers for teams comparing tools and rollout effort.',
    faqDesc: 'The questions below cover the common blockers before a team moves customer operations into one platform.',
    whyGrowth: 'Why teams choose Growth',
    growthTitle: 'The fastest path from missed chats to structured operations.',
    growthDesc: 'Most SMEs in clinics, academies, sales teams, and service businesses start here because it unlocks the WhatsApp workflows that make shared inbox operations usable in real life.',
    startWithGrowth: 'Start with Growth',
    builtForTeams: 'Built for teams that need',
    teamNeeds: [
      'Faster lead response across every WhatsApp inquiry',
      'One shared WhatsApp inbox with clear ownership',
      'Arabic and English customer operations',
      'Broadcasts, CRM, and AI in one workspace',
    ],
    passwordMax: 'Maximum 72 characters.',
    contacts: 'Contacts',
    broadcastsPerMonth: 'Broadcasts / month',
    aiAssistants: 'AI assistants',
    teamMembers: 'Team members',
    pricingBadge: 'Pricing built for operators, not vanity metrics',
    pricingTitle: 'Pick the plan that matches your team today.',
    monthly: 'Monthly',
    annual: 'Annual - Save 20%',
    pricingTrialNote: 'Start with a no-card Growth trial, then keep the plan that fits your team.',
    mostPopular: 'Most Popular',
    month: 'month',
    annualBilled: 'Billed yearly at AED {{amount}}',
    switchAnnual: 'Switch to annual to save 20%',
    included: 'Included',
    notIncluded: 'Not included',
    addOn: 'Add-on',
    unlimited: 'Unlimited',
    trustSignals: PRICING_TRUST_SIGNALS,
    plans: {
      STARTER: {
        name: 'Starter',
        shortLabel: 'For solo operators',
        audience: PLANS.STARTER.audience,
        description: PLANS.STARTER.description,
        cardHighlights: PLANS.STARTER.cardHighlights,
        valueProps: PLANS.STARTER.valueProps,
      },
      GROWTH: {
        name: 'Growth',
        shortLabel: 'For small teams ready to scale',
        audience: PLANS.GROWTH.audience,
        description: PLANS.GROWTH.description,
        cardHighlights: PLANS.GROWTH.cardHighlights,
        valueProps: PLANS.GROWTH.valueProps,
      },
      PRO: {
        name: 'Pro',
        shortLabel: 'For established multi-branch teams',
        audience: PLANS.PRO.audience,
        description: PLANS.PRO.description,
        cardHighlights: PLANS.PRO.cardHighlights,
        valueProps: PLANS.PRO.valueProps,
      },
    },
    comparisonGroups: {
      'WhatsApp Operations and Team': 'WhatsApp Operations and Team',
      'WhatsApp CRM and Messaging': 'WhatsApp CRM and Messaging',
      'AI, Analytics, and Support': 'AI, Analytics, and Support',
      'Appointment Booking': 'Appointment Booking',
    },
    comparisonRows: {
      'WhatsApp number connections': 'WhatsApp number connections',
      'Users included': 'Users included',
      'Team roles and permissions': 'Team roles and permissions',
      'WhatsApp lead routing': 'WhatsApp lead routing',
      'Agent workload view': 'Agent workload view',
      'WhatsApp CRM contacts': 'WhatsApp CRM contacts',
      'Sales pipelines': 'Sales pipelines',
      'Pipeline stages': 'Pipeline stages',
      'Lead scoring': 'Lead scoring',
      'Deal value tracking': 'Deal value tracking',
      'WhatsApp broadcast messages / month': 'WhatsApp broadcast messages / month',
      'WhatsApp broadcast scheduling': 'WhatsApp broadcast scheduling',
      'WhatsApp quick replies': 'WhatsApp quick replies',
      'AI assistants': 'AI assistants',
      'AI messages per month': 'AI messages per month',
      'Workflow automations': 'Workflow automations',
      'Multi-language AI': 'Multi-language AI',
      'WhatsApp conversation history': 'WhatsApp conversation history',
      'Revenue and conversion reports': 'Revenue and conversion reports',
      'Custom date ranges': 'Custom date ranges',
      'Report exports': 'Report exports',
      'Contact import/export': 'Contact import/export',
      'API access': 'API access',
      Webhooks: 'Webhooks',
      'White-label widget': 'White-label widget',
      Services: 'Services',
      'Staff members': 'Staff members',
      'Appointments per month': 'Appointments per month',
    },
    faqItems: PRICING_FAQ,
  },
  ar: {
    languageToggle: 'English',
    features: 'المزايا',
    pricing: 'الأسعار',
    openDashboard: 'فتح لوحة التحكم',
    signIn: 'تسجيل الدخول',
    signUp: 'إنشاء حساب',
    eyebrow: 'تجربة 30 يوماً بدون بطاقة لفرق واتساب في الإمارات',
    heroTitle: 'استخدم تواصل داخل عملك الحقيقي',
    heroHighlight: ' لمدة 30 يوماً.',
    heroSubtitle: 'اربط واتساب، شارك رابط الحجز، أرسل التذكيرات، وتعامل مع عملاء حقيقيين. إذا صنع قيمة بعد شهر، استمر. وإذا لم يناسبك، غادر بدون التزام.',
    startTrial: 'ابدأ تجربة 30 يوماً',
    viewPricing: 'عرض الأسعار',
    trialPromises: ['30 يوماً', 'بدون بطاقة', 'مساحة Growth مشمولة'],
    signupTitle: 'ابدأ تجربتك لمدة 30 يوماً',
    signinTitle: 'تسجيل الدخول إلى تواصل',
    signupSubtitle: 'أنشئ مساحة عمل وابدأ تجربة Growth مباشرة. لا تحتاج إلى بطاقة.',
    signinSubtitle: 'ادخل إلى لوحة التحكم وصندوق واتساب وسير عمل الفريق.',
    fullName: 'الاسم الكامل',
    emailAddress: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    forgotPassword: 'نسيت كلمة المرور؟',
    confirmPassword: 'تأكيد كلمة المرور',
    alreadyHaveAccount: 'لديك حساب بالفعل؟',
    newToTawasel: 'جديد في تواصل؟',
    createAccount: 'إنشاء الحساب',
    signingIn: 'جارٍ تسجيل الدخول...',
    creatingAccount: 'جارٍ إنشاء الحساب...',
    footerTrust: ['دعم عربي وإنجليزي', 'جاهز لـ Meta Cloud API', 'صندوق واتساب مشترك وأتمتة بالذكاء الاصطناعي', 'مصمم لعمليات الإمارات والخليج'],
    ready: 'جاهز لتوحيد العمليات؟',
    finalTitle: 'اختبر سير عمل حجوزات واتساب داخل عملك الحقيقي.',
    finalSubtitle: 'ابدأ بمساحة Growth، اربط واتساب، أرسل التذكيرات، وقرر بعد 30 يوماً بناءً على نشاط عملائك الحقيقي.',
    talkToSales: 'تحدث مع المبيعات',
    footerDesc: 'طبقة تشغيل متقدمة للمبيعات والدعم وإدارة العملاء والتقارير للشركات التي تعتمد على واتساب في الإمارات والخليج.',
    platform: 'المنصة',
    company: 'الشركة',
    startTrialLink: 'ابدأ تجربة 30 يوماً',
    allRights: 'جميع الحقوق محفوظة.',
    featureSectionTitle: 'كل ما تحتاجه لتشغيل واتساب كقناة إيرادات حقيقية',
    featureSectionDesc: 'تواصل ليس مجرد صندوق واتساب مشترك. يجمع بين CRM واتساب، والأتمتة بالذكاء الاصطناعي، والبث الجماعي، والمساءلة حتى يتحرك فريقك بسرعة بدون فقدان السياق.',
    featureItems: {
      sharedInbox: {
        title: 'صندوق واتساب مشترك لفريقك',
        desc: 'أدر كل محادثات واتساب والتحويلات والمتابعات من مساحة واحدة بدلاً من الهواتف الشخصية والمحادثات المتفرقة.',
      },
      aiWarm: {
        title: 'ذكاء اصطناعي يحافظ على تفاعل عملاء واتساب خارج الدوام',
        desc: 'دع تواصل يجيب عن الأسئلة، يؤهل العملاء المحتملين، ويدعم العملاء عندما يكون فريقك غير متصل.',
      },
      kpiDashboard: {
        title: 'لوحة مؤشرات مصممة للتشغيل',
        desc: 'تابع رسائل واتساب غير المقروءة، ومخاطر SLA، وصحة مسار المبيعات، وأداء البث، وتكلفة الذكاء الاصطناعي في لوحة واحدة.',
      },
      teamCollaboration: {
        title: 'تعاون حقيقي بين الفريق',
        desc: 'أسند المحادثات، أضف ملاحظات داخلية، تابع الملكية، واعرف بالضبط من رد على كل عميل.',
      },
      secureDesign: {
        title: 'مصمم بأمان من البداية',
        desc: 'استخدم مساحات عمل موثقة، وصلاحيات حسب الدور، وتدفق إعداد مضبوط لكل حساب.',
      },
      broadcasts: {
        title: 'بث واتساب مع استهداف ومراجعة',
        desc: 'قسّم جهات واتساب حسب المسار أو القوائم، عاين الحملات، أرسل اختبارات، وراجع أداء التسليم بعد الإطلاق.',
      },
    },
    pricingSectionDesc: 'يجمع تواصل صندوق واتساب، وCRM، والبث الجماعي، والذكاء الاصطناعي في نظام تشغيل واحد، لذلك كل ترقية تمنحك تنفيذ أوضح وليس مجرد مقاعد أكثر.',
    whyMove: 'لماذا تنتقل الفرق إلى تواصل',
    pricingValueStatement: 'ابدأ من صندوق واتساب مشترك، ثم أضف CRM، الأتمتة، الحجوزات، والتقارير عندما يحتاجها فريقك.',
    comparison: 'المقارنة',
    comparisonTitle: 'قارن المزايا التي تغيّر التشغيل اليومي.',
    comparisonDesc: 'نعرض الفروقات الأعلى تأثيراً أولاً حتى تتمكن الفرق من الفحص بسرعة، ثم يمكن توسيع الجدول الكامل عند الحاجة للتفاصيل.',
    showCondensed: 'عرض المقارنة المختصرة',
    expandComparison: 'توسيع المقارنة الكاملة',
    fullFeatureBreakdown: 'تفصيل كامل للمزايا',
    topItemsShown: 'أهم العناصر معروضة أولاً للفحص السريع',
    feature: 'الميزة',
    faq: 'الأسئلة الشائعة',
    faqTitle: 'إجابات للفرق التي تقارن الأدوات وجهد الإطلاق.',
    faqDesc: 'الأسئلة أدناه تغطي العوائق الشائعة قبل نقل عمليات العملاء إلى منصة واحدة.',
    whyGrowth: 'لماذا تختار الفرق Growth',
    growthTitle: 'أسرع طريق من المحادثات الفائتة إلى عمليات منظمة.',
    growthDesc: 'معظم الشركات الصغيرة والمتوسطة في العيادات والأكاديميات وفرق المبيعات والخدمات تبدأ هنا لأن هذه الباقة تفتح سير عمل واتساب الذي يجعل الصندوق المشترك عملياً في الواقع.',
    startWithGrowth: 'ابدأ مع Growth',
    builtForTeams: 'مصمم للفرق التي تحتاج إلى',
    teamNeeds: [
      'استجابة أسرع لكل استفسار عبر واتساب',
      'صندوق واتساب مشترك مع ملكية واضحة',
      'عمليات عملاء بالعربية والإنجليزية',
      'بث جماعي وCRM وذكاء اصطناعي في مساحة واحدة',
    ],
    passwordMax: 'الحد الأقصى 72 حرفاً.',
    contacts: 'جهات الاتصال',
    broadcastsPerMonth: 'البث الشهري',
    aiAssistants: 'مساعدو الذكاء الاصطناعي',
    teamMembers: 'أعضاء الفريق',
    pricingBadge: 'أسعار مبنية للتشغيل، لا للأرقام الشكلية',
    pricingTitle: 'اختر الباقة التي تناسب فريقك اليوم.',
    monthly: 'شهري',
    annual: 'سنوي - وفر 20%',
    pricingTrialNote: 'ابدأ بتجربة Growth بدون بطاقة، ثم اختر الباقة التي تناسب فريقك.',
    mostPopular: 'الأكثر شيوعاً',
    month: 'شهر',
    annualBilled: 'تُدفع سنوياً بقيمة {{amount}} درهم',
    switchAnnual: 'انتقل إلى السنوي لتوفير 20%',
    included: 'مشمول',
    notIncluded: 'غير مشمول',
    addOn: 'إضافة مدفوعة',
    unlimited: 'غير محدود',
    trustSignals: ['بدون رسوم مخفية', 'إلغاء في أي وقت', 'جاهز للعربية والإنجليزية', 'دعم مخصص للإمارات'],
    plans: {
      STARTER: {
        name: 'Starter',
        shortLabel: 'للمشغلين الفرديين',
        audience: 'مناسب للمؤسسين الفرديين والعيادات والأنشطة الخدمية التي تحتاج سير عمل واتساب واضحاً بدون فريق كامل بعد.',
        description: 'شغّل مبيعات ودعم ومتابعة واتساب من مكان واحد بدون فقدان العملاء أو الاعتماد على الهواتف الشخصية.',
        cardHighlights: [
          'ربط رقم واتساب واحد',
          'صندوق واتساب مشترك للفريق',
          'حتى 1,000 جهة اتصال في CRM واتساب',
          '500 رسالة بث واتساب شهرياً',
          'مساعد ذكاء اصطناعي واحد مع 1,000 رسالة شهرياً',
          'حجوزات مواعيد مع 5 خدمات و100 حجز شهرياً',
        ],
        valueProps: [
          'صندوق واتساب مشترك لمشغل واحد أو مكتب واحد',
          'مسار CRM أساسي لتتبع العملاء المحتملين',
          'ردود واتساب آلية خارج أوقات العمل',
          'رؤية أساسية لوقت الرد والمتابعة',
        ],
      },
      GROWTH: {
        name: 'Growth',
        shortLabel: 'للفرق الصغيرة الجاهزة للنمو',
        audience: 'الأفضل للعيادات والأكاديميات وفرق المبيعات والأنشطة الخدمية التي تحتاج سير عمل واتساب مشترك أقوى.',
        description: 'امنح فريقك نظام تشغيل واتساب واحداً مع الأتمتة، وتوجيه العملاء، وملكية متابعة أوضح.',
        cardHighlights: [
          'حتى 3 أرقام واتساب متصلة',
          'صندوق واتساب مشترك حتى 5 مستخدمين',
          '5,000 جهة اتصال في CRM واتساب',
          '3,000 رسالة بث واتساب شهرياً',
          '3 مساعدين ذكاء اصطناعي مع 5,000 رسالة شهرياً',
          'حجوزات مواعيد مع 20 خدمة و5 موظفين و500 حجز شهرياً',
        ],
        valueProps: [
          'التقاط عملاء واتساب وإسنادهم مع وسوم الأولوية',
          'ملاحظات وتذكيرات وتتبع أوضح للعملاء',
          'تقارير بث واتساب ورؤية لعبء عمل الفريق',
          'استيراد جهات الاتصال وجدولة حملات واتساب',
        ],
      },
      PRO: {
        name: 'Pro',
        shortLabel: 'للفرق متعددة الفروع الراسخة',
        audience: 'مصمم للفرق الأكبر والعمليات متعددة الفروع التي تحتاج حجم واتساب جاداً وهيكلة وتقارير.',
        description: 'شغّل عمليات واتساب عالية الحجم مع أتمتة متقدمة، ووصول API، وتقارير للفرق المتعددة.',
        cardHighlights: [
          'حتى 5 أرقام واتساب متصلة',
          'عمليات جاهزة للفرق والفروع المتعددة',
          '25,000 جهة اتصال في CRM واتساب',
          '10,000 رسالة بث واتساب شهرياً',
          '10 مساعدين ذكاء اصطناعي مع 25,000 رسالة شهرياً',
          'حجوزات مواعيد غير محدودة مع 10 موظفين',
        ],
        valueProps: [
          'عمليات واتساب متعددة الفرق مع توقعات',
          'تقارير إيرادات ومسارات تحويل وتصدير',
          'وصول API وwebhooks لسير عمل مخصص',
          'إدارة حساب مخصصة للعمليات الجادة',
        ],
      },
    },
    comparisonGroups: {
      'WhatsApp Operations and Team': 'عمليات واتساب والفريق',
      'WhatsApp CRM and Messaging': 'CRM واتساب والمراسلة',
      'AI, Analytics, and Support': 'الذكاء الاصطناعي والتحليلات والدعم',
      'Appointment Booking': 'حجوزات المواعيد',
    },
    comparisonRows: {
      'WhatsApp number connections': 'أرقام واتساب المتصلة',
      'Users included': 'المستخدمون المشمولون',
      'Team roles and permissions': 'أدوار الفريق والصلاحيات',
      'WhatsApp lead routing': 'توجيه عملاء واتساب',
      'Agent workload view': 'عرض عبء عمل الموظفين',
      'WhatsApp CRM contacts': 'جهات CRM واتساب',
      'Sales pipelines': 'مسارات المبيعات',
      'Pipeline stages': 'مراحل المسار',
      'Lead scoring': 'تقييم العملاء المحتملين',
      'Deal value tracking': 'تتبع قيمة الصفقات',
      'WhatsApp broadcast messages / month': 'رسائل بث واتساب شهرياً',
      'WhatsApp broadcast scheduling': 'جدولة بث واتساب',
      'WhatsApp quick replies': 'ردود واتساب السريعة',
      'AI assistants': 'مساعدو الذكاء الاصطناعي',
      'AI messages per month': 'رسائل الذكاء الاصطناعي شهرياً',
      'Workflow automations': 'أتمتة سير العمل',
      'Multi-language AI': 'ذكاء اصطناعي متعدد اللغات',
      'WhatsApp conversation history': 'سجل محادثات واتساب',
      'Revenue and conversion reports': 'تقارير الإيرادات والتحويل',
      'Custom date ranges': 'نطاقات تاريخ مخصصة',
      'Report exports': 'تصدير التقارير',
      'Contact import/export': 'استيراد وتصدير جهات الاتصال',
      'API access': 'وصول API',
      Webhooks: 'Webhooks',
      'White-label widget': 'ودجت بدون علامة تجارية',
      Services: 'الخدمات',
      'Staff members': 'أعضاء الفريق',
      'Appointments per month': 'المواعيد شهرياً',
    },
    faqItems: [
      {
        question: 'هل يمكنني تغيير الباقة في أي وقت؟',
        answer: 'نعم. يمكنك الترقية أو التخفيض من صفحة الفوترة متى احتجت. يمكن تطبيق الترقيات فوراً، بينما قد تتبع التخفيضات دورة الفوترة.',
      },
      {
        question: 'ماذا يحدث إذا وصلت إلى حد جهات الاتصال أو البث؟',
        answer: 'سيظهر لك تنبيه قبل الوصول إلى الحد. يمكنك ترقية مساحة العمل أو إضافة سعة لاحقاً بدون إيقاف المحادثات النشطة.',
      },
      {
        question: 'هل يمكنني الاحتفاظ برقم واتساب الحالي؟',
        answer: 'نعم. المنصة مصممة لربط إعداد واتساب بزنس الحالي، لذلك تحتفظ بالرقم الذي يعرفه عملاؤك.',
      },
      {
        question: 'كم يستغرق الإعداد؟',
        answer: 'معظم الفرق تستطيع ربط رقم واتساب، واستيراد جهات الاتصال، وبدء الرد خلال أقل من 30 دقيقة بعد جاهزية النشر.',
      },
      {
        question: 'هل تدعمون العربية؟',
        answer: 'نعم. التطبيق يدعم العربية والإنجليزية، بما في ذلك واجهات RTL وسير عمل ثنائي اللغة للفريق.',
      },
      {
        question: 'هل الفوترة السنوية متاحة؟',
        answer: 'نعم. نموذج الأسعار يتضمن خصومات سنوية، ويمكن تفعيل خيارات الدفع السنوي عند اكتمال إعداد الفوترة.',
      },
    ],
  },
} as const;

const getComparisonCellMeta = (value: boolean | number | string) => {
  if (typeof value === 'boolean') {
    return value
      ? {
          label: 'Included',
          tone: 'included' as const,
        }
      : {
          label: 'Not included',
          tone: 'excluded' as const,
        };
  }

  if (typeof value === 'number') {
    return {
      label: value.toLocaleString(),
      tone: 'neutral' as const,
    };
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'add-on' || normalized === 'addon') {
    return {
      label: value,
      tone: 'addon' as const,
    };
  }

  if (normalized.includes('unlimited') || normalized === 'included') {
    return {
      label: value,
      tone: 'included' as const,
    };
  }

  if (normalized.includes('custom')) {
    return {
      label: value,
      tone: 'custom' as const,
    };
  }

  return {
    label: value,
    tone: 'neutral' as const,
  };
};

const comparisonToneClasses = {
  included: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400',
  excluded: 'border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',
  addon: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400',
  custom: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-400',
  neutral: 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

export default function Home() {
  const { user, setUser } = useApp();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isArabic = i18n.language?.startsWith('ar');
  const copy = isArabic ? HOME_COPY.ar : HOME_COPY.en;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSignUp, setIsSignUp] = useState(true);
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [comparisonExpanded, setComparisonExpanded] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const getPostLoginPath = (nextUser?: { email?: string | null }) =>
    (nextUser?.email || '').toLowerCase() === (import.meta.env.VITE_SUPERADMIN_EMAIL || '').toLowerCase() ? '/app/superadmin' : '/app/dashboard';

  const handlePlanSelect = (planId: string) => {
    sessionStorage.setItem('pendingPlan', planId);
    sessionStorage.setItem('pendingBillingCycle', billingCycle);
    navigate(user ? `/app/settings/billing/plans?plan=${planId}` : `/register?plan=${planId}`);
  };

  const passwordChecks = [
    { label: 'At least 8 characters', valid: password.length >= 8 },
    { label: 'One uppercase letter', valid: /[A-Z]/.test(password) },
    { label: 'One lowercase letter', valid: /[a-z]/.test(password) },
    { label: 'One number', valid: /\d/.test(password) },
  ];

  const isNameValid = !isSignUp || (name.trim().length >= 2 && name.trim().length <= 80);
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(email.trim());
  const isPasswordValid = passwordChecks.every((item) => item.valid) && password.length <= 72;
  const doPasswordsMatch = !isSignUp || (password.length > 0 && password === confirmPassword);
  const canSubmit = isSignUp
    ? isNameValid && isEmailValid && isPasswordValid && doPasswordsMatch && !isLoading
    : isEmailValid && password.length > 0 && !isLoading;
  const hasExpandableComparisonRows = PRICING_COMPARISON_GROUPS.some(
    (group) => group.rows.length > COMPARISON_PREVIEW_ROWS
  );
  const localizeLimit = (value: number) => (value >= 999999 ? copy.unlimited : value.toLocaleString());
  const localizeComparisonValue = (label: string) => {
    if (label === 'Included') return copy.included;
    if (label === 'Not included') return copy.notIncluded;
    if (label === 'Add-on') return copy.addOn;
    if (label === 'Unlimited') return copy.unlimited;
    return label.replace('Unlimited', copy.unlimited).replace('months', isArabic ? 'شهراً' : 'months');
  };
  const localizeComparisonGroup = (title: string) =>
    copy.comparisonGroups[title as keyof typeof copy.comparisonGroups] || title;
  const localizeComparisonRow = (label: string) =>
    copy.comparisonRows[label as keyof typeof copy.comparisonRows] || label;

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (isSignUp) {
      if (!isNameValid) {
        setError('Full name must be between 2 and 80 characters.');
        return;
      }

      if (!isEmailValid) {
        setError('Please enter a valid email address.');
        return;
      }

      if (!isPasswordValid) {
        setError('Password must be at least 8 characters and include uppercase, lowercase, and a number.');
        return;
      }

      if (!doPasswordsMatch) {
        setError('Passwords do not match.');
        return;
      }
    }

    setIsLoading(true);
    try {
      const endpoint = isSignUp ? '/api/auth/register' : '/api/auth/login';
      const payload = isSignUp
        ? { name: name.trim(), email: email.trim().toLowerCase(), password }
        : { email: email.trim().toLowerCase(), password };
      const response = await axios.post(endpoint, payload);
      setUser(response.data.user, response.data.token);
      if (isSignUp) {
        navigate('/verify-email-sent', {
          state: {
            email: response.data?.user?.email,
            message: response.data?.verification?.message,
            emailSent: response.data?.verification?.emailSent,
            verificationUrl: response.data?.verification?.verificationUrl,
          },
        });
      } else {
        navigate(getPostLoginPath(response.data.user));
      }
    } catch (err: any) {
      setError(err.response?.data?.error || (isSignUp ? 'Registration failed' : 'Login failed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-[#25D366]/30" dir={isArabic ? 'rtl' : 'ltr'}>
      <nav className="fixed top-0 z-50 w-full border-b border-slate-100 dark:border-slate-800 bg-white/85 dark:bg-slate-950/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#25D366]">
              <MessageSquare className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight dark:text-white">Tawasel</span>
          </div>

          <button
            type="button"
            onClick={() => i18n.changeLanguage(isArabic ? 'en' : 'ar')}
            className="rounded-full border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-[#25D366] hover:text-[#128C7E] dark:border-slate-700 dark:text-slate-300 md:hidden"
          >
            {copy.languageToggle}
          </button>

          <div className="hidden items-center gap-8 text-sm font-medium text-slate-600 dark:text-slate-400 md:flex">
            <a href="#features" className="transition-colors hover:text-[#25D366]">
              {copy.features}
            </a>
            <a href="#pricing" className="transition-colors hover:text-[#25D366]">
              {copy.pricing}
            </a>
            {user ? (
              <button
                type="button"
                onClick={() => navigate(getPostLoginPath(user))}
                className="rounded-full bg-slate-900 dark:bg-white dark:text-slate-900 px-4 py-2 text-white transition-colors hover:bg-slate-800 dark:hover:bg-slate-200"
              >
                {copy.openDashboard}
              </button>
            ) : (
              <a href="#login" className="rounded-full bg-slate-900 dark:bg-white dark:text-slate-900 px-4 py-2 text-white transition-colors hover:bg-slate-800 dark:hover:bg-slate-200">
                {copy.signIn}
              </a>
            )}
            <button
              type="button"
              onClick={() => i18n.changeLanguage(isArabic ? 'en' : 'ar')}
              className="rounded-full border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:border-[#25D366] hover:text-[#128C7E] dark:border-slate-700 dark:text-slate-300"
            >
              {copy.languageToggle}
            </button>
          </div>
        </div>
      </nav>

      <section className="px-4 pb-20 pt-32">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-[#25D366]/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#25D366]">
              <Zap className="h-3 w-3" />
              {copy.eyebrow}
            </div>
            <h1 className="mb-6 text-5xl font-bold leading-[1.05] tracking-tight lg:text-7xl">
              {copy.heroTitle}
              <span className="text-[#25D366]">{copy.heroHighlight}</span>
            </h1>
            <p className="mb-8 max-w-xl text-xl leading-relaxed text-slate-600 dark:text-slate-400">
              {copy.heroSubtitle}
            </p>
            <div className="flex flex-wrap gap-4">
              <a
                href="#login"
                className="flex items-center gap-2 rounded-xl bg-[#25D366] px-8 py-4 font-bold text-white shadow-lg shadow-[#25D366]/20 transition-all hover:bg-[#128C7E]"
              >
                {copy.startTrial} <ArrowRight className="h-5 w-5" />
              </a>
              <a
                href="#pricing"
                className="flex items-center gap-2 rounded-xl border border-slate-300 px-8 py-4 font-bold text-slate-700 transition-all hover:border-slate-900 hover:text-slate-950 dark:border-slate-700 dark:text-slate-300 dark:hover:border-white dark:hover:text-white"
              >
                {copy.viewPricing}
              </a>
              <div className="flex w-full flex-wrap gap-2 pt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
                {copy.trialPromises.map((item) => (
                  <span key={item} className="rounded-full border border-slate-200 bg-white px-3 py-1 dark:border-slate-800 dark:bg-slate-900">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div
            id="login"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-8 lg:p-12"
          >
            <div className="mb-8">
              <h2 className="mb-2 text-2xl font-bold">{isSignUp ? copy.signupTitle : copy.signinTitle}</h2>
              <p className="text-slate-500 dark:text-slate-400">
                {isSignUp
                  ? copy.signupSubtitle
                  : copy.signinSubtitle}
              </p>
            </div>

            <div className="mb-8 flex rounded-xl bg-slate-200 dark:bg-slate-800 p-1">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(false);
                  setError('');
                }}
                className={`flex-1 rounded-lg py-2 text-sm font-bold transition-all ${
                  !isSignUp ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {copy.signIn}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(true);
                  setError('');
                }}
                className={`flex-1 rounded-lg py-2 text-sm font-bold transition-all ${
                  isSignUp ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {copy.signUp}
              </button>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              {isSignUp ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{copy.fullName}</label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      autoComplete="name"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white py-3 pl-10 pr-4 outline-none transition-all focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20"
                      placeholder="John Doe"
                      required
                    />
                  </div>
                </div>
              ) : null}

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">{copy.emailAddress}</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white py-3 pl-10 pr-4 outline-none transition-all focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20"
                    placeholder="name@company.com"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{copy.password}</label>

                  {!isSignUp ? (
                    <button
                      type="button"
                      onClick={() => navigate('/forgot-password')}
                      className="text-[11px] font-semibold text-[#25D366] transition-colors hover:text-[#128C7E]"
                    >
                      {copy.forgotPassword}
                    </button>
                  ) : null}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete={isSignUp ? 'new-password' : 'current-password'}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white py-3 pl-10 pr-12 outline-none transition-all focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20"
                    placeholder="........"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 transition hover:text-slate-600 dark:hover:text-slate-300"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {isSignUp ? (
                <>
                  <div className="grid gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 text-xs text-slate-600 dark:text-slate-400">
                    {passwordChecks.map((item) => (
                      <div key={item.label} className="flex items-center gap-2">
                        <span
                          className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                            item.valid ? 'bg-[#25D366] text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          <Check className="h-3 w-3" />
                        </span>
                        <span className={item.valid ? 'text-slate-800 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400'}>{item.label}</span>
                      </div>
                    ))}
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{copy.passwordMax}</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{copy.confirmPassword}</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        autoComplete="new-password"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white py-3 pl-10 pr-12 outline-none transition-all focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20"
                        placeholder="Repeat your password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((value) => !value)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 transition hover:text-slate-600 dark:hover:text-slate-300"
                        aria-label={showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {confirmPassword ? (
                      <p className={`text-xs ${doPasswordsMatch ? 'text-[#128C7E]' : 'text-red-500'}`}>
                        {doPasswordsMatch ? 'Passwords match.' : 'Passwords must match exactly.'}
                      </p>
                    ) : null}
                  </div>
                </>
              ) : null}

              {error ? <div className="rounded-lg border border-red-100 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-600 dark:text-red-400">{error}</div> : null}

              <button
                type="submit"
                disabled={!canSubmit}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-white dark:text-slate-900 py-4 font-bold text-white transition-all hover:bg-slate-800 dark:hover:bg-slate-200 disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    {isSignUp ? copy.createAccount : copy.signIn}
                    {isSignUp ? <Zap className="h-5 w-5 text-[#25D366]" /> : <LogIn className="h-5 w-5" />}
                  </>
                )}
              </button>
            </form>

            {isSignUp ? (
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                {copy.heroSubtitle}
              </p>
            ) : null}
          </motion.div>
        </div>
      </section>

      <section id="features" className="bg-slate-50 dark:bg-slate-900 py-24">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold dark:text-white">{copy.featureSectionTitle}</h2>
            <p className="mx-auto max-w-2xl text-slate-600 dark:text-slate-400">
              {copy.featureSectionDesc}
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {FEATURE_ITEMS.map((feature) => {
              const featureCopy = copy.featureItems[feature.id as keyof typeof copy.featureItems];
              return (
              <div
                key={feature.title}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-8 transition-all hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-[#25D366]/10">
                  <feature.icon className="h-6 w-6 text-[#25D366]" />
                </div>
                <h3 className="mb-3 text-xl font-bold dark:text-white">{featureCopy.title}</h3>
                <p className="leading-relaxed text-slate-600 dark:text-slate-400">{featureCopy.desc}</p>
              </div>
            )})}
          </div>
        </div>
      </section>

      <section id="pricing" className="bg-gradient-to-b from-white via-slate-50/70 to-white dark:from-slate-950 dark:via-slate-900/70 dark:to-slate-950 py-24">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-14 text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#25D366]/15 bg-[#25D366]/8 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-[#128C7E]">
              <Sparkles className="h-3.5 w-3.5" />
              {copy.pricingBadge}
            </div>
            <h2 className="mb-4 text-4xl font-bold tracking-tight text-slate-950 dark:text-white lg:text-5xl">
              {copy.pricingTitle}
            </h2>
            <p className="mx-auto max-w-3xl text-base leading-8 text-slate-600 dark:text-slate-400 lg:text-lg">
              {copy.pricingSectionDesc}
            </p>
            <div className="mt-8 inline-flex rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-1.5 shadow-sm shadow-slate-200/70">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-all ${
                  billingCycle === 'monthly'
                    ? 'bg-slate-950 dark:bg-white dark:text-slate-900 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {copy.monthly}
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('annual')}
                className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-all ${
                  billingCycle === 'annual'
                    ? 'bg-[#25D366] text-white shadow-sm shadow-[#25D366]/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {copy.annual}
              </button>
            </div>
            <p className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">
              {copy.pricingTrialNote}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {PLAN_ORDER.map((planKey) => {
                const plan = PLANS[planKey];
                const planCopy = copy.plans[planKey];
                return (
                  <div
                    key={planKey}
                    className={`relative flex h-full flex-col overflow-hidden rounded-[2rem] border p-8 transition-all ${
                      plan.highlight
                        ? 'border-[#25D366]/50 bg-white dark:bg-slate-900 shadow-[0_28px_70px_-28px_rgba(37,211,102,0.42)] ring-1 ring-[#25D366]/20'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.28)] hover:-translate-y-1 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-[0_26px_70px_-36px_rgba(15,23,42,0.32)]'
                    }`}
                  >
                    {plan.highlight ? (
                      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#128C7E] via-[#25D366] to-[#86efac]" />
                    ) : null}

                    <div className="mb-8">
                      <div className="flex items-start justify-between gap-3">
                        <p
                          className={`max-w-[13rem] text-xs font-bold uppercase tracking-[0.22em] ${
                            plan.highlight ? 'text-[#128C7E]' : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {planCopy.shortLabel}
                        </p>
                        {plan.highlight ? (
                          <div className="shrink-0 rounded-full border border-[#25D366]/20 bg-[#25D366]/12 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-[#128C7E]">
                            {copy.mostPopular}
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-4">
                        <h3 className="text-2xl font-bold text-slate-950 dark:text-white">{planCopy.name}</h3>
                        <p className="mt-2 max-w-xs text-sm leading-6 text-slate-600 dark:text-slate-400">{planCopy.description}</p>
                      </div>
                      <div className="mt-6 flex items-end gap-2">
                        <span className="text-5xl font-bold tracking-tight text-slate-950 dark:text-white">AED {getPlanPrice(plan, billingCycle)}</span>
                        <span className="pb-2 text-sm font-semibold text-slate-500 dark:text-slate-400">/ {copy.month}</span>
                      </div>
                      <p className="mt-2 text-sm font-medium text-[#128C7E]">
                        {billingCycle === 'annual'
                          ? copy.annualBilled.replace('{{amount}}', plan.annualBilledPrice.toLocaleString())
                          : copy.switchAnnual}
                      </p>
                    </div>

                    <div className="mb-8 grid gap-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-4">
                      <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
                        <span>{copy.contacts}</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{localizeLimit(plan.contactsLimit)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
                        <span>{copy.broadcastsPerMonth}</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{localizeLimit(plan.broadcastLimit)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
                        <span>{copy.aiAssistants}</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{localizeLimit(plan.chatbotLimit)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
                        <span>{copy.teamMembers}</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{localizeLimit(plan.userLimit)}</span>
                      </div>
                    </div>

                    <ul className="mb-8 space-y-3">
                      {planCopy.cardHighlights.map((feature) => (
                        <li key={feature} className="flex items-start gap-3 text-sm leading-6 text-slate-700 dark:text-slate-300">
                          <span className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#25D366]/10 text-[#128C7E]">
                            <Check className="h-3.5 w-3.5" />
                          </span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-auto space-y-4">
                      <button
                        type="button"
                        onClick={() => handlePlanSelect(planKey.toLowerCase())}
                        className={`w-full rounded-2xl py-4 text-sm font-bold transition-all ${
                          plan.highlight
                            ? 'bg-[#25D366] text-white shadow-lg shadow-[#25D366]/20 hover:bg-[#128C7E]'
                            : 'border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white hover:border-slate-900 dark:hover:border-white hover:bg-slate-900 dark:hover:bg-white hover:text-white dark:hover:text-slate-900'
                        }`}
                      >
                        {user ? copy.viewPricing : copy.startTrial}
                      </button>
                      <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">{planCopy.audience}</p>
                    </div>
                  </div>
                );
              })}
          </div>

          <div className="mt-12 rounded-[2rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-6 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.28)] sm:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#128C7E]">{copy.whyMove}</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{copy.pricingValueStatement}</p>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-slate-600 dark:text-slate-400">
                {copy.trustSignals.map((signal) => (
                  <span key={signal} className="rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2 font-semibold text-slate-700 dark:text-slate-300">
                    {signal}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-16 rounded-[2rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.28)] sm:p-8 lg:p-10">
            <div className="flex flex-col gap-4 border-b border-slate-200 dark:border-slate-800 pb-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#128C7E]">{copy.comparison}</p>
                <h3 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{copy.comparisonTitle}</h3>
                <p className="mt-3 text-base leading-7 text-slate-600">
                  {copy.comparisonDesc}
                </p>
              </div>
              {hasExpandableComparisonRows ? (
                <button
                  type="button"
                  onClick={() => setComparisonExpanded((value) => !value)}
                  className="inline-flex items-center gap-2 self-start rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
                  aria-expanded={comparisonExpanded}
                  aria-controls="pricing-comparison-groups"
                >
                  {comparisonExpanded ? copy.showCondensed : copy.expandComparison}
                  {comparisonExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              ) : null}
            </div>

            <div id="pricing-comparison-groups" className="mt-8 space-y-8">
              {PRICING_COMPARISON_GROUPS.map((group) => {
                const rows = comparisonExpanded ? group.rows : group.rows.slice(0, COMPARISON_PREVIEW_ROWS);
                return (
                  <section key={group.title} className="rounded-[1.75rem] border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                    <div className="mb-4">
                      <h4 className="text-sm font-bold uppercase tracking-[0.22em] text-slate-500">{localizeComparisonGroup(group.title)}</h4>
                      <p className="mt-1 text-sm text-slate-500">
                        {comparisonExpanded ? copy.fullFeatureBreakdown : copy.topItemsShown}
                      </p>
                    </div>
                    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                      <table className="w-full min-w-[820px] border-collapse">
                        <thead>
                          <tr className="text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                            <th className="sticky left-0 z-20 bg-white px-5 py-4 font-bold text-slate-700 shadow-[10px_0_24px_-22px_rgba(15,23,42,0.55)]">
                              {copy.feature}
                            </th>
                            <th className="px-4 py-4 font-bold">{copy.plans.STARTER.name}</th>
                            <th className="bg-[#25D366]/8 px-4 py-4 font-bold text-[#128C7E]">{copy.plans.GROWTH.name}</th>
                            <th className="px-4 py-4 font-bold">{copy.plans.PRO.name}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row) => (
                            <tr key={row.label} className="group border-t border-slate-200 text-sm transition-colors hover:bg-slate-50">
                              <td className="sticky left-0 z-10 bg-white px-5 py-4 font-semibold text-slate-900 shadow-[10px_0_24px_-22px_rgba(15,23,42,0.45)] group-hover:bg-slate-50">
                                {localizeComparisonRow(row.label)}
                              </td>
                              {PLAN_ORDER.map((planKey) => {
                                const meta = getComparisonCellMeta(row.values[planKey]);
                                return (
                                  <td
                                    key={`${row.label}-${planKey}`}
                                    className={`px-4 py-4 ${planKey === 'GROWTH' ? 'bg-[#25D366]/4' : ''}`}
                                  >
                                    <span
                                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${comparisonToneClasses[meta.tone]}`}
                                    >
                                      {meta.tone === 'included' ? (
                                        <Check className="h-3.5 w-3.5" />
                                      ) : meta.tone === 'excluded' ? (
                                        <Minus className="h-3.5 w-3.5" />
                                      ) : null}
                                      {localizeComparisonValue(meta.label)}
                                    </span>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                );
              })}
            </div>
          </div>

          <div className="mt-16 grid gap-10 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.28)]">
              <div className="max-w-2xl">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#128C7E]">{copy.faq}</p>
                <h3 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{copy.faqTitle}</h3>
                <p className="mt-3 text-base leading-7 text-slate-600">
                  {copy.faqDesc}
                </p>
              </div>

              <div className="mt-8 space-y-4">
                {copy.faqItems.map((item, index) => {
                  const isOpen = openFaqIndex === index;
                  const panelId = `pricing-faq-panel-${index}`;
                  const buttonId = `pricing-faq-button-${index}`;
                  return (
                    <div
                      key={item.question}
                      className={`overflow-hidden rounded-2xl border transition-all ${
                        isOpen
                          ? 'border-slate-300 bg-slate-50 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.38)]'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <h4>
                        <button
                          id={buttonId}
                          type="button"
                          className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left"
                          aria-expanded={isOpen}
                          aria-controls={panelId}
                          onClick={() => setOpenFaqIndex((current) => (current === index ? null : index))}
                        >
                          <span className="text-base font-semibold leading-7 text-slate-950">{item.question}</span>
                          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500">
                            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </span>
                        </button>
                      </h4>
                      <div
                        id={panelId}
                        role="region"
                        aria-labelledby={buttonId}
                        className={`grid transition-all duration-300 ease-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-80'}`}
                      >
                        <div className="overflow-hidden">
                          <p className="px-5 pb-5 text-sm leading-7 text-slate-600">{item.answer}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <aside className="rounded-[2rem] border border-slate-200 bg-slate-950 p-8 text-white shadow-[0_28px_70px_-36px_rgba(15,23,42,0.75)]">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#86efac]">{copy.whyGrowth}</p>
              <h3 className="mt-3 text-2xl font-bold tracking-tight">{copy.growthTitle}</h3>
              <p className="mt-4 text-sm leading-7 text-white/75">
                {copy.growthDesc}
              </p>
              <ul className="mt-8 space-y-4">
                {copy.plans.GROWTH.valueProps.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm leading-6 text-white/85">
                    <span className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-[#86efac]">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => handlePlanSelect('growth')}
                className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] py-4 text-sm font-bold text-white transition hover:bg-[#128C7E]"
              >
                {copy.startWithGrowth}
                <ArrowRight className="h-4 w-4" />
              </button>
            </aside>
          </div>
        </div>
      </section>

      <section className="bg-white pb-6 pt-4">
        <div className="mx-auto max-w-7xl px-4">
          <div className="overflow-hidden rounded-[2.25rem] border border-slate-200 bg-slate-950 p-8 text-white shadow-[0_34px_90px_-44px_rgba(15,23,42,0.8)] sm:p-10 lg:p-14">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-[#86efac]">
                  <Sparkles className="h-3.5 w-3.5" />
                  {copy.ready}
                </div>
                <h2 className="mt-6 text-4xl font-bold tracking-tight text-white lg:text-5xl">
                  {copy.finalTitle}
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-8 text-white/70 lg:text-lg">
                  {copy.finalSubtitle}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <button
                  type="button"
                  onClick={() => handlePlanSelect('growth')}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-7 py-4 text-sm font-bold text-white shadow-lg shadow-[#25D366]/20 transition hover:bg-[#128C7E]"
                >
                  {copy.startTrial}
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => window.open('https://tawasel.io', '_blank', 'noopener,noreferrer')}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-7 py-4 text-sm font-bold text-white transition hover:border-white/30 hover:bg-white/10"
                >
                  {copy.talkToSales}
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-slate-950 py-20 text-white">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-12 grid gap-4 rounded-[2rem] border border-white/10 bg-white/5 p-5 sm:grid-cols-2 xl:grid-cols-4">
            {copy.footerTrust.map((point) => (
              <div
                key={point}
                className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-sm font-semibold text-white/85"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#25D366]/15 text-[#86efac]">
                  <Check className="h-4 w-4" />
                </span>
                <span>{point}</span>
              </div>
            ))}
          </div>

          <div className="grid gap-12 border-b border-white/10 pb-12 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
            <div>
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#25D366] shadow-[0_18px_38px_-18px_rgba(37,211,102,0.65)]">
                  <MessageSquare className="h-5 w-5 text-white" />
                </div>
                <span className="text-2xl font-bold tracking-tight">Tawasel</span>
              </div>
              <p className="max-w-md text-sm leading-7 text-white/65">
                {copy.footerDesc}
              </p>
              <div className="mt-6 flex gap-4">
                <a
                  href="https://tawasel.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 transition-colors hover:border-[#25D366]/40 hover:bg-[#25D366]/12"
                >
                  <Globe className="h-5 w-5" />
                </a>
                <Link
                  to="/about"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 transition-colors hover:border-[#25D366]/40 hover:bg-[#25D366]/12"
                >
                  <Users className="h-5 w-5" />
                </Link>
              </div>
            </div>

            <div>
              <h4 className="mb-5 text-sm font-bold uppercase tracking-[0.18em] text-white/45">{copy.platform}</h4>
              <ul className="space-y-4 text-sm text-white/65">
                <li>
                  <a href="/#features" className="transition-colors hover:text-white">
                    {copy.features}
                  </a>
                </li>
                <li>
                  <a href="/#pricing" className="transition-colors hover:text-white">
                    {copy.pricing}
                  </a>
                </li>
                <li>
                  <Link to="/register" className="transition-colors hover:text-white">
                    {copy.startTrialLink}
                  </Link>
                </li>
                <li>
                  <Link to="/changelog" className="transition-colors hover:text-white">
                    Changelog
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-5 text-sm font-bold uppercase tracking-[0.18em] text-white/45">{copy.company}</h4>
              <ul className="space-y-4 text-sm text-white/65">
                <li>
                  <Link to="/about" className="transition-colors hover:text-white">
                    About Us
                  </Link>
                </li>
                <li>
                  <Link to="/careers" className="transition-colors hover:text-white">
                    Careers
                  </Link>
                </li>
                <li>
                  <Link to="/privacy" className="transition-colors hover:text-white">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link to="/terms" className="transition-colors hover:text-white">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link to="/data-deletion" className="transition-colors hover:text-white">
                    Data Deletion
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-5 text-sm font-bold uppercase tracking-[0.18em] text-white/45">{copy.builtForTeams}</h4>
              <ul className="space-y-4 text-sm text-white/65">
                {copy.teamNeeds.map((need) => (
                  <li key={need}>{need}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-8 text-sm text-white/45 md:flex-row md:items-center md:justify-between">
            <p>© {new Date().getFullYear()} Tawasel. {copy.allRights}</p>
            <p>
              By{' '}
              <a href="https://tawasel.io" target="_blank" rel="noopener noreferrer" className="font-medium text-[#86efac] hover:underline">
                tawasel.io
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
