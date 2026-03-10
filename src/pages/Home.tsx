import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import axios from 'axios';
import { PLANS, PlanType } from '../constants/plans';
import { motion } from 'motion/react';
import { 
  Check, 
  MessageSquare, 
  Zap, 
  Shield, 
  ArrowRight, 
  LogIn, 
  Mail, 
  Lock, 
  Loader2,
  Globe,
  BarChart3,
  Users
} from 'lucide-react';

const translations = {
  en: {
    nav: {
      features: 'Features',
      pricing: 'Pricing',
      signIn: 'Sign In'
    },
    hero: {
      badge: 'Next-Gen WhatsApp CRM',
      title: 'Automate your ',
      titleAccent: 'WhatsApp',
      titleEnd: ' operations.',
      desc: 'Connect with customers, automate support with AI, and scale your business using the world\'s most popular messaging platform.',
      cta: 'View Pricing',
      trusted: 'Trusted by 2,000+ teams'
    },
    login: {
      title: 'Sign in to Hub',
      desc: 'Access your dashboard and conversations',
      email: 'Email Address',
      password: 'Password',
      button: 'Sign In'
    },
    features: {
      title: 'Everything you need to scale',
      desc: 'Powerful tools designed to help you manage thousands of conversations without breaking a sweat.',
      items: [
        { title: 'Multi-Channel', desc: 'Manage WhatsApp, Instagram, and Web Chat in one unified inbox.' },
        { title: 'AI Automation', desc: 'Deploy smart chatbots that handle 80% of routine inquiries automatically.' },
        { title: 'Deep Analytics', desc: 'Track response times, agent performance, and customer satisfaction.' },
        { title: 'Team Collaboration', desc: 'Assign conversations, add internal notes, and work together seamlessly.' },
        { title: 'Enterprise Secure', desc: 'Bank-grade encryption and full compliance with data regulations.' },
        { title: 'Broadcasts', desc: 'Send personalized bulk messages to your customers with high open rates.' }
      ]
    },
    pricing: {
      title: 'Simple, transparent pricing',
      desc: 'Choose the plan that\'s right for your business growth.',
      popular: 'Most Popular',
      month: '/mo'
    },
    footer: {
      desc: 'The ultimate platform for WhatsApp Business automation and customer engagement.',
      product: 'Product',
      company: 'Company',
      created: 'Created by'
    }
  },
  ar: {
    nav: {
      features: 'المميزات',
      pricing: 'الأسعار',
      signIn: 'تسجيل الدخول'
    },
    hero: {
      badge: 'الجيل القادم من CRM واتساب',
      title: 'أتمتة عمليات ',
      titleAccent: 'الواتساب',
      titleEnd: ' الخاصة بك.',
      desc: 'تواصل مع عملائك، وأتمت الدعم باستخدام الذكاء الاصطناعي، ووسع نطاق عملك باستخدام أشهر منصة مراسلة في العالم.',
      cta: 'عرض الأسعار',
      trusted: 'موثوق به من قبل أكثر من 2000 فريق'
    },
    login: {
      title: 'تسجيل الدخول إلى المركز',
      desc: 'الوصول إلى لوحة التحكم والمحادثات الخاصة بك',
      email: 'البريد الإلكتروني',
      password: 'كلمة المرور',
      button: 'تسجيل الدخول'
    },
    features: {
      title: 'كل ما تحتاجه للتوسع',
      desc: 'أدوات قوية مصممة لمساعدتك في إدارة آلاف المحادثات دون عناء.',
      items: [
        { title: 'متعدد القنوات', desc: 'إدارة واتساب وإنستغرام والدردشة عبر الويب في صندوق وارد واحد موحد.' },
        { title: 'أتمتة الذكاء الاصطناعي', desc: 'نشر روبوتات دردشة ذكية تتعامل مع 80٪ من الاستفسارات الروتينية تلقائيًا.' },
        { title: 'تحليلات عميقة', desc: 'تتبع أوقات الاستجابة وأداء الوكلاء ورضا العملاء.' },
        { title: 'تعاون الفريق', desc: 'تعيين المحادثات وإضافة ملاحظات داخلية والعمل معًا بسلاسة.' },
        { title: 'أمان المؤسسات', desc: 'تشفير بمستوى بنكي وامتثال كامل للوائح البيانات.' },
        { title: 'البث', desc: 'إرسال رسائل جماعية مخصصة لعملائك بمعدلات فتح عالية.' }
      ]
    },
    pricing: {
      title: 'أسعار بسيطة وشفافة',
      desc: 'اختر الخطة المناسبة لنمو عملك.',
      popular: 'الأكثر شعبية',
      month: '/شهرياً'
    },
    footer: {
      desc: 'المنصة المثالية لأتمتة واتساب للأعمال وتفاعل العملاء.',
      product: 'المنتج',
      company: 'الشركة',
      created: 'تم التطوير بواسطة'
    }
  }
};

const PRICING_PLANS = [
  {
    id: 'starter',
    name: { en: 'Starter', ar: 'البداية' },
    price: { en: 'AED 99', ar: '99 درهم' },
    description: { en: 'Essential tools for small businesses.', ar: 'أدوات أساسية للشركات الصغيرة.' },
    features: {
      en: ['1 WhatsApp Number', '1 Instagram Account', '1 AI Chatbot', '1 User', 'Standard Support'],
      ar: ['رقم واتساب واحد', 'حساب إنستغرام واحد', 'روبوت ذكاء اصطناعي واحد', 'مستخدم واحد', 'دعم قياسي']
    },
    buttonText: { en: 'Get Started', ar: 'ابدأ الآن' },
    highlight: false
  },
  {
    id: 'growth',
    name: { en: 'Growth', ar: 'النمو' },
    price: { en: 'AED 299', ar: '299 درهم' },
    description: { en: 'Perfect for growing teams and automation.', ar: 'مثالي للفرق المتنامية والأتمتة.' },
    features: {
      en: ['2 WhatsApp Numbers', '1 Instagram Account', '3 AI Chatbots', '3 Users', 'Priority Support'],
      ar: ['رقمان واتساب', 'حساب إنستغرام واحد', '3 روبوتات ذكاء اصطناعي', '3 مستخدمين', 'دعم ذو أولوية']
    },
    buttonText: { en: 'Get Started', ar: 'ابدأ الآن' },
    highlight: true
  },
  {
    id: 'pro',
    name: { en: 'Pro', ar: 'المحترف' },
    price: { en: 'AED 599', ar: '599 درهم' },
    description: { en: 'Advanced features for high-volume operations.', ar: 'ميزات متقدمة للعمليات ذات الحجم الكبير.' },
    features: {
      en: ['5 WhatsApp Numbers', '2 Instagram Accounts', '10 AI Chatbots', '5 Users', '24/7 Priority Support'],
      ar: ['5 أرقام واتساب', 'حسابان إنستغرام', '10 روبوتات ذكاء اصطناعي', '5 مستخدمين', 'دعم ذو أولوية على مدار الساعة']
    },
    buttonText: { en: 'Get Started', ar: 'ابدأ الآن' },
    highlight: false
  },
  {
    id: 'enterprise',
    name: { en: 'Enterprise', ar: 'المؤسسات' },
    price: { en: 'Custom', ar: 'مخصص' },
    description: { en: 'Tailored solutions for large scale needs.', ar: 'حلول مخصصة للاحتياجات واسعة النطاق.' },
    features: {
      en: ['Custom Channels', 'Custom Bots', '10+ Users', 'Advanced Integrations', 'Dedicated Manager'],
      ar: ['قنوات مخصصة', 'روبوتات مخصصة', 'أكثر من 10 مستخدمين', 'تكاملات متقدمة', 'مدير حساب مخصص']
    },
    buttonText: { en: 'Contact Sales', ar: 'اتصل بالمبيعات' },
    highlight: false
  }
];

export default function Home() {
  const { user, setUser } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState('ameeneidha@gmail.com');
  const [password, setPassword] = useState('password123');
  const [isLoading, setIsLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState('');
  const [lang, setLang] = useState<'en' | 'ar'>('en');
  const [isSignUp, setIsSignUp] = useState(true);
  const [name, setName] = useState('');

  const t = translations[lang];
  const isRtl = lang === 'ar';
  const { activeWorkspace } = useApp();

  const handlePlanSelect = async (planId: string) => {
    if (!user) {
      sessionStorage.setItem('pendingPlan', planId);
      setIsSignUp(true); // Switch to Sign Up mode
      const loginSection = document.getElementById('login');
      if (loginSection) {
        loginSection.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }

    if (!activeWorkspace) {
      navigate('/app');
      return;
    }

    try {
      const planKey = planId.toUpperCase() as PlanType;
      const stripePriceId = PLANS[planKey]?.stripePriceId;

      if (!stripePriceId || stripePriceId.includes('placeholder')) {
        alert('Stripe is not fully configured for this plan yet. Please update the Price ID in src/constants/plans.ts');
        return;
      }

      const res = await axios.post('/api/billing/create-checkout-session', {
        planId: stripePriceId,
        planKey: planKey,
        workspaceId: activeWorkspace.id,
        successUrl: `${window.location.origin}/app/settings/billing?success=true`,
        cancelUrl: `${window.location.origin}/?canceled=true`
      });
      window.location.href = res.data.url;
    } catch (err: any) {
      console.error('Checkout error:', err);
      alert(err.response?.data?.error || 'Failed to start checkout');
    }
  };

  // Handle pending plan redirect for logged-in users
  useEffect(() => {
    const storedPlan = sessionStorage.getItem('pendingPlan');
    if (user && activeWorkspace && storedPlan) {
      const planKey = storedPlan.toUpperCase() as PlanType;
      const stripePriceId = PLANS[planKey]?.stripePriceId;
      
      if (stripePriceId && !stripePriceId.includes('placeholder')) {
        setIsRedirecting(true);
        sessionStorage.removeItem('pendingPlan');
        axios.post('/api/billing/create-checkout-session', {
          planId: stripePriceId,
          planKey: planKey,
          workspaceId: activeWorkspace.id,
          successUrl: `${window.location.origin}/app/settings/billing?success=true`,
          cancelUrl: `${window.location.origin}/?canceled=true`
        }).then(res => {
          window.location.href = res.data.url;
        }).catch(err => {
          console.error('Auto-checkout error:', err);
          setIsRedirecting(false);
        });
      }
    }
  }, [user, activeWorkspace]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const endpoint = isSignUp ? '/api/auth/register' : '/api/auth/login';
      const payload = isSignUp ? { name, email, password } : { email, password };
      
      const res = await axios.post(endpoint, payload);
      setUser(res.data.user, res.data.token);
      
      // If there's no pending plan, go to app
      if (!sessionStorage.getItem('pendingPlan')) {
        navigate('/app');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || (isSignUp ? 'Registration failed' : 'Login failed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen bg-white text-slate-900 font-sans selection:bg-[#25D366]/30 ${isRtl ? 'text-right' : 'text-left'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      {isRedirecting && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[100] flex flex-col items-center justify-center">
          <Loader2 className="w-12 h-12 text-[#25D366] animate-spin mb-4" />
          <h2 className="text-xl font-bold text-slate-900">Redirecting to checkout...</h2>
          <p className="text-slate-500 mt-2">Please wait while we prepare your secure payment session.</p>
        </div>
      )}

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#25D366] rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">WABA Hub</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-[#25D366] transition-colors">{t.nav.features}</a>
            <a href="#pricing" className="hover:text-[#25D366] transition-colors">{t.nav.pricing}</a>
            <button 
              onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
              className="px-3 py-1 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              {lang === 'en' ? 'العربية' : 'English'}
            </button>
            <a href="#login" className="px-4 py-2 bg-slate-900 text-white rounded-full hover:bg-slate-800 transition-colors">{t.nav.signIn}</a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: isRtl ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#25D366]/10 text-[#25D366] text-xs font-bold uppercase tracking-wider mb-6">
              <Zap className="w-3 h-3" />
              {t.hero.badge}
            </div>
            <h1 className="text-5xl lg:text-7xl font-bold leading-[1.1] tracking-tight mb-6">
              {t.hero.title}<span className="text-[#25D366]">{t.hero.titleAccent}</span>{t.hero.titleEnd}
            </h1>
            <p className="text-xl text-slate-600 mb-8 max-w-lg leading-relaxed">
              {t.hero.desc}
            </p>
            <div className="flex flex-wrap gap-4">
              <a href="#pricing" className="px-8 py-4 bg-[#25D366] text-white font-bold rounded-xl hover:bg-[#128C7E] transition-all shadow-lg shadow-[#25D366]/20 flex items-center gap-2">
                {t.hero.cta} <ArrowRight className={`w-5 h-5 ${isRtl ? 'rotate-180' : ''}`} />
              </a>
              <div className={`flex ${isRtl ? 'flex-row-reverse' : 'flex-row'} -space-x-2 items-center`}>
                {[1, 2, 3, 4].map(i => (
                  <img 
                    key={i}
                    src={`https://picsum.photos/seed/user${i}/100/100`} 
                    className={`w-10 h-10 rounded-full border-2 border-white ${isRtl ? 'ml-[-8px]' : 'mr-[-8px]'}`}
                    alt="User"
                    referrerPolicy="no-referrer"
                  />
                ))}
                <span className={`${isRtl ? 'mr-4' : 'ml-4'} text-sm font-medium text-slate-500`}>{t.hero.trusted}</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            id="login"
            className="bg-slate-50 rounded-3xl p-8 lg:p-12 border border-slate-200"
          >
            <div className="mb-8">
              <h2 className="text-2xl font-bold mb-2">{isSignUp ? (isRtl ? 'إنشاء حساب' : 'Create Account') : t.login.title}</h2>
              <p className="text-slate-500">{isSignUp ? (isRtl ? 'ابدأ رحلتك مع WABA Hub اليوم' : 'Start your journey with WABA Hub today') : t.login.desc}</p>
            </div>

            <div className="flex p-1 bg-slate-200 rounded-xl mb-8">
              <button
                onClick={() => setIsSignUp(false)}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${!isSignUp ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {isRtl ? 'تسجيل الدخول' : 'Sign In'}
              </button>
              <button
                onClick={() => setIsSignUp(true)}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${isSignUp ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {isRtl ? 'إنشاء حساب' : 'Sign Up'}
              </button>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              {isSignUp && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">{isRtl ? 'الاسم الكامل' : 'Full Name'}</label>
                  <div className="relative">
                    <Users className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={`w-full ${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366] outline-none transition-all`}
                      placeholder={isRtl ? 'جون دو' : 'John Doe'}
                      required={isSignUp}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">{t.login.email}</label>
                <div className="relative">
                  <Mail className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`w-full ${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366] outline-none transition-all`}
                    placeholder="name@company.com"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">{t.login.password}</label>
                <div className="relative">
                  <Lock className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`w-full ${isRtl ? 'pr-10 pl-4' : 'pl-10 pr-4'} py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#25D366]/20 focus:border-[#25D366] outline-none transition-all`}
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  <>
                    {isSignUp ? (isRtl ? 'إنشاء حساب مجاني' : 'Create Free Account') : t.login.button} 
                    {isSignUp ? <Zap className="w-5 h-5 text-[#25D366]" /> : <LogIn className={`w-5 h-5 ${isRtl ? 'rotate-180' : ''}`} />}
                  </>
                )}
              </button>
            </form>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">{t.features.title}</h2>
            <p className="text-slate-600 max-w-2xl mx-auto">{t.features.desc}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {t.features.items.map((feature, i) => {
              const icons = [Globe, Zap, BarChart3, Users, Shield, MessageSquare];
              const Icon = icons[i];
              return (
                <div key={i} className="bg-white p-8 rounded-2xl border border-slate-200 hover:shadow-xl hover:-translate-y-1 transition-all">
                  <div className={`w-12 h-12 bg-[#25D366]/10 rounded-xl flex items-center justify-center mb-6 ${isRtl ? 'mr-0' : 'ml-0'}`}>
                    <Icon className="w-6 h-6 text-[#25D366]" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                  <p className="text-slate-600 leading-relaxed">{feature.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">{t.pricing.title}</h2>
            <p className="text-slate-600">{t.pricing.desc}</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PRICING_PLANS.map((plan) => (
              <div 
                key={plan.id}
                className={`relative p-8 rounded-3xl border transition-all ${
                  plan.highlight 
                    ? 'border-[#25D366] bg-white shadow-2xl scale-105 z-10' 
                    : 'border-slate-200 bg-slate-50 hover:bg-white hover:shadow-xl'
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#25D366] text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                    {t.pricing.popular}
                  </div>
                )}
                <div className="mb-8">
                  <h3 className="text-xl font-bold mb-2">{plan.name[lang]}</h3>
                  <div className={`flex items-baseline gap-1 mb-4 ${isRtl ? 'flex-row-reverse justify-end' : ''}`}>
                    <span className="text-4xl font-bold">{plan.price[lang]}</span>
                    {plan.price[lang] !== 'Custom' && plan.price[lang] !== 'مخصص' && <span className="text-slate-500 font-medium">{t.pricing.month}</span>}
                  </div>
                  <p className="text-slate-600 text-sm leading-relaxed">{plan.description[lang]}</p>
                </div>

                <ul className="space-y-4 mb-8">
                  {plan.features[lang].map((feature, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm font-medium text-slate-700">
                      <div className="w-5 h-5 rounded-full bg-[#25D366]/10 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-[#25D366]" />
                      </div>
                      {feature}
                    </li>
                  ))}
                </ul>

                <button 
                  onClick={() => handlePlanSelect(plan.id)}
                  className={`w-full py-4 rounded-xl font-bold transition-all ${
                  plan.highlight
                    ? 'bg-[#25D366] text-white hover:bg-[#128C7E] shadow-lg shadow-[#25D366]/20'
                    : 'bg-slate-200 text-slate-900 hover:bg-slate-300'
                }`}>
                  {plan.buttonText[lang]}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-4 gap-12">
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 bg-[#25D366] rounded-lg flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold">WABA Hub</span>
            </div>
            <p className="text-slate-400 max-w-sm mb-8">
              {t.footer.desc}
            </p>
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center hover:bg-[#25D366] transition-colors cursor-pointer">
                <Globe className="w-5 h-5" />
              </div>
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center hover:bg-[#25D366] transition-colors cursor-pointer">
                <Users className="w-5 h-5" />
              </div>
            </div>
          </div>
          <div>
            <h4 className="font-bold mb-6">{t.footer.product}</h4>
            <ul className="space-y-4 text-slate-400 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">{t.nav.features}</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Integrations</a></li>
              <li><a href="#" className="hover:text-white transition-colors">{t.nav.pricing}</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Changelog</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-6">{t.footer.company}</h4>
            <ul className="space-y-4 text-slate-400 text-sm">
              <li><a href="#" className="hover:text-white transition-colors">About Us</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 mt-20 pt-8 border-t border-slate-800 text-center text-slate-500 text-sm">
          <p className="mb-2">© {new Date().getFullYear()} WABA Hub. All rights reserved.</p>
          <p>{t.footer.created} <a href="https://quantops.ae" target="_blank" rel="noopener noreferrer" className="text-[#25D366] hover:underline font-medium">Quantops.ae</a></p>
        </div>
      </footer>
    </div>
  );
}
