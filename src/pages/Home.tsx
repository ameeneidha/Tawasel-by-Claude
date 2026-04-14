import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
    title: 'One shared WhatsApp inbox for your team',
    desc: 'Manage every WhatsApp conversation, handoff, and follow-up from one workspace instead of juggling personal phones and scattered chats.',
    icon: Globe,
  },
  {
    title: 'AI that keeps WhatsApp leads warm after hours',
    desc: 'Let Tawasel answer FAQs, qualify WhatsApp leads, and support customers while your team is offline.',
    icon: Zap,
  },
  {
    title: 'KPI dashboard built for operations',
    desc: 'Track WhatsApp unread messages, SLA risk, pipeline health, broadcast performance, and AI spend in one dashboard.',
    icon: BarChart3,
  },
  {
    title: 'Real team collaboration',
    desc: 'Assign chats, add internal notes, track ownership, and see exactly who replied to each customer.',
    icon: Users,
  },
  {
    title: 'Secure by design',
    desc: 'Use verified workspaces, role-based permissions, and a controlled onboarding flow for every account.',
    icon: Shield,
  },
  {
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
  included: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  excluded: 'border-slate-200 bg-slate-100 text-slate-500',
  addon: 'border-amber-200 bg-amber-50 text-amber-700',
  custom: 'border-sky-200 bg-sky-50 text-sky-700',
  neutral: 'border-slate-200 bg-white text-slate-700',
};

export default function Home() {
  const { user, setUser } = useApp();
  const navigate = useNavigate();
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
  const trustedTeamMarkers = ['MK', 'SA', 'LR', 'NH'];
  const getPostLoginPath = (nextUser?: { email?: string | null }) =>
    (nextUser?.email || '').toLowerCase() === (process.env.SUPERADMIN_EMAIL || '').toLowerCase() ? '/app/superadmin' : '/app/dashboard';

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
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-[#25D366]/30">
      <nav className="fixed top-0 z-50 w-full border-b border-slate-100 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#25D366]">
              <MessageSquare className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">Tawasel App</span>
          </div>

          <div className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
            <a href="#features" className="transition-colors hover:text-[#25D366]">
              Features
            </a>
            <a href="#pricing" className="transition-colors hover:text-[#25D366]">
              Pricing
            </a>
            {user ? (
              <button
                type="button"
                onClick={() => navigate(getPostLoginPath(user))}
                className="rounded-full bg-slate-900 px-4 py-2 text-white transition-colors hover:bg-slate-800"
              >
                Open Dashboard
              </button>
            ) : (
              <a href="#login" className="rounded-full bg-slate-900 px-4 py-2 text-white transition-colors hover:bg-slate-800">
                Sign In
              </a>
            )}
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
              Built for UAE teams that run on WhatsApp
            </div>
            <h1 className="mb-6 text-5xl font-bold leading-[1.05] tracking-tight lg:text-7xl">
              Turn WhatsApp into your
              <span className="text-[#25D366]"> sales, support, and follow-up engine.</span>
            </h1>
            <p className="mb-8 max-w-xl text-xl leading-relaxed text-slate-600">
              Tawasel gives your team one shared WhatsApp inbox, one CRM workflow, and one performance dashboard so no lead gets lost between replies, follow-ups, and broadcasts.
            </p>
            <div className="flex flex-wrap gap-4">
              <a
                href="#pricing"
                className="flex items-center gap-2 rounded-xl bg-[#25D366] px-8 py-4 font-bold text-white shadow-lg shadow-[#25D366]/20 transition-all hover:bg-[#128C7E]"
              >
                View Pricing <ArrowRight className="h-5 w-5" />
              </a>
              <div className="ml-0 flex items-center -space-x-2">
                {trustedTeamMarkers.map((initials) => (
                  <div
                    key={initials}
                    className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-xs font-bold text-white"
                  >
                    {initials}
                  </div>
                ))}
                <span className="ml-4 text-sm font-medium text-slate-500">Trusted by 2,000+ teams</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            id="login"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="rounded-3xl border border-slate-200 bg-slate-50 p-8 lg:p-12"
          >
            <div className="mb-8">
              <h2 className="mb-2 text-2xl font-bold">{isSignUp ? 'Create your account' : 'Sign in to Tawasel App'}</h2>
              <p className="text-slate-500">
                {isSignUp
                  ? 'Create your workspace now, then unlock your WhatsApp inbox, CRM, and automation from billing.'
                  : 'Access your dashboard, WhatsApp inbox, and team workflows.'}
              </p>
            </div>

            <div className="mb-8 flex rounded-xl bg-slate-200 p-1">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(false);
                  setError('');
                }}
                className={`flex-1 rounded-lg py-2 text-sm font-bold transition-all ${
                  !isSignUp ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(true);
                  setError('');
                }}
                className={`flex-1 rounded-lg py-2 text-sm font-bold transition-all ${
                  isSignUp ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Sign Up
              </button>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              {isSignUp ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Full Name</label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      autoComplete="name"
                      className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 outline-none transition-all focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20"
                      placeholder="John Doe"
                      required
                    />
                  </div>
                </div>
              ) : null}

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 outline-none transition-all focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20"
                    placeholder="name@company.com"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Password</label>
                  {!isSignUp ? (
                    <button
                      type="button"
                      onClick={() => navigate('/forgot-password')}
                      className="text-[11px] font-semibold text-[#25D366] transition-colors hover:text-[#128C7E]"
                    >
                      Forgot password?
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
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-12 outline-none transition-all focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20"
                    placeholder="........"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {isSignUp ? (
                <>
                  <div className="grid gap-2 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
                    {passwordChecks.map((item) => (
                      <div key={item.label} className="flex items-center gap-2">
                        <span
                          className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                            item.valid ? 'bg-[#25D366] text-white' : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          <Check className="h-3 w-3" />
                        </span>
                        <span className={item.valid ? 'text-slate-800' : 'text-slate-500'}>{item.label}</span>
                      </div>
                    ))}
                    <p className="text-[11px] text-slate-500">Maximum 72 characters.</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Confirm Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        autoComplete="new-password"
                        className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-12 outline-none transition-all focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20"
                        placeholder="Repeat your password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((value) => !value)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
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

              {error ? <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-600">{error}</div> : null}

              <button
                type="submit"
                disabled={!canSubmit}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-4 font-bold text-white transition-all hover:bg-slate-800 disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    {isSignUp ? 'Create Account' : 'Sign In'}
                    {isSignUp ? <Zap className="h-5 w-5 text-[#25D366]" /> : <LogIn className="h-5 w-5" />}
                  </>
                )}
              </button>
            </form>

            {isSignUp ? (
              <p className="mt-4 text-sm text-slate-500">
                Your workspace opens first, then billing unlocks the paid package you choose.
              </p>
            ) : null}
          </motion.div>
        </div>
      </section>

      <section id="features" className="bg-slate-50 py-24">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold">Everything you need to run WhatsApp like a real revenue channel</h2>
            <p className="mx-auto max-w-2xl text-slate-600">
              Tawasel is not just a shared WhatsApp inbox. It combines WhatsApp CRM, AI automation, broadcasts, and accountability so your team can move faster without losing context.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {FEATURE_ITEMS.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-slate-200 bg-white p-8 transition-all hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-[#25D366]/10">
                  <feature.icon className="h-6 w-6 text-[#25D366]" />
                </div>
                <h3 className="mb-3 text-xl font-bold">{feature.title}</h3>
                <p className="leading-relaxed text-slate-600">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="bg-gradient-to-b from-white via-slate-50/70 to-white py-24">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-14 text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#25D366]/15 bg-[#25D366]/8 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-[#128C7E]">
              <Sparkles className="h-3.5 w-3.5" />
              Pricing built for operators, not vanity metrics
            </div>
            <h2 className="mb-4 text-4xl font-bold tracking-tight text-slate-950 lg:text-5xl">
              Pick the plan that matches your team today.
            </h2>
            <p className="mx-auto max-w-3xl text-base leading-8 text-slate-600 lg:text-lg">
              Tawasel keeps your WhatsApp inbox, CRM, broadcasts, and AI in one operational system, so every upgrade unlocks clearer
              execution, not just more seats.
            </p>
            <div className="mt-8 inline-flex rounded-full border border-slate-300 bg-white p-1.5 shadow-sm shadow-slate-200/70">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-all ${
                  billingCycle === 'monthly'
                    ? 'bg-slate-950 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('annual')}
                className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-all ${
                  billingCycle === 'annual'
                    ? 'bg-[#25D366] text-white shadow-sm shadow-[#25D366]/20'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Annual - Save 20%
              </button>
            </div>
            <p className="mt-3 text-sm font-medium text-slate-500">
              Annual pricing is already defined and can be activated in checkout when billing goes live.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {PLAN_ORDER.map((planKey) => {
                const plan = PLANS[planKey];
                return (
                  <div
                    key={planKey}
                    className={`relative flex h-full flex-col overflow-hidden rounded-[2rem] border p-8 transition-all ${
                      plan.highlight
                        ? 'border-[#25D366]/50 bg-white shadow-[0_28px_70px_-28px_rgba(37,211,102,0.42)] ring-1 ring-[#25D366]/20'
                        : 'border-slate-200 bg-white shadow-[0_18px_45px_-30px_rgba(15,23,42,0.28)] hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_26px_70px_-36px_rgba(15,23,42,0.32)]'
                    }`}
                  >
                    {plan.highlight ? (
                      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#128C7E] via-[#25D366] to-[#86efac]" />
                    ) : null}

                    <div className="mb-8">
                      <div className="flex items-start justify-between gap-3">
                        <p
                          className={`max-w-[13rem] text-xs font-bold uppercase tracking-[0.22em] ${
                            plan.highlight ? 'text-[#128C7E]' : 'text-slate-500'
                          }`}
                        >
                          {plan.shortLabel}
                        </p>
                        {plan.highlight ? (
                          <div className="shrink-0 rounded-full border border-[#25D366]/20 bg-[#25D366]/12 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-[#128C7E]">
                            Most Popular
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-4">
                        <h3 className="text-2xl font-bold text-slate-950">{plan.name}</h3>
                        <p className="mt-2 max-w-xs text-sm leading-6 text-slate-600">{plan.description}</p>
                      </div>
                      <div className="mt-6 flex items-end gap-2">
                        <span className="text-5xl font-bold tracking-tight text-slate-950">AED {getPlanPrice(plan, billingCycle)}</span>
                        <span className="pb-2 text-sm font-semibold text-slate-500">/ month</span>
                      </div>
                      <p className="mt-2 text-sm font-medium text-[#128C7E]">
                        {billingCycle === 'annual'
                          ? `Billed yearly at AED ${plan.annualBilledPrice.toLocaleString()}`
                          : 'Switch to annual to save 20%'}
                      </p>
                    </div>

                    <div className="mb-8 grid gap-3 rounded-2xl bg-slate-50 p-4">
                      <div className="flex items-center justify-between text-sm text-slate-600">
                        <span>Contacts</span>
                        <span className="font-semibold text-slate-900">{formatLimitValue(plan.contactsLimit)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-slate-600">
                        <span>Broadcasts / month</span>
                        <span className="font-semibold text-slate-900">{formatLimitValue(plan.broadcastLimit)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-slate-600">
                        <span>AI assistants</span>
                        <span className="font-semibold text-slate-900">{formatLimitValue(plan.chatbotLimit)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-slate-600">
                        <span>Team members</span>
                        <span className="font-semibold text-slate-900">{formatLimitValue(plan.userLimit)}</span>
                      </div>
                    </div>

                    <ul className="mb-8 space-y-3">
                      {plan.cardHighlights.map((feature) => (
                        <li key={feature} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
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
                            : 'border border-slate-300 bg-white text-slate-900 hover:border-slate-900 hover:bg-slate-900 hover:text-white'
                        }`}
                      >
                        {user ? 'Choose Plan' : 'Start With This Plan'}
                      </button>
                      <p className="text-xs leading-5 text-slate-500">{plan.audience}</p>
                    </div>
                  </div>
                );
              })}
          </div>

          <div className="mt-12 rounded-[2rem] border border-slate-200 bg-white px-6 py-6 shadow-[0_18px_45px_-32px_rgba(15,23,42,0.28)] sm:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#128C7E]">Why teams move to Tawasel</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{PRICING_VALUE_STATEMENT}</p>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-slate-600">
                {PRICING_TRUST_SIGNALS.map((signal) => (
                  <span key={signal} className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 font-semibold text-slate-700">
                    {signal}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-16 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.28)] sm:p-8 lg:p-10">
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#128C7E]">Comparison</p>
                <h3 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">Compare the features that change operations day to day.</h3>
                <p className="mt-3 text-base leading-7 text-slate-600">
                  We surface the highest-impact differences first so teams can scan quickly, then expand into the full matrix when they need detail.
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
                  {comparisonExpanded ? 'Show condensed comparison' : 'Expand full comparison'}
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
                      <h4 className="text-sm font-bold uppercase tracking-[0.22em] text-slate-500">{group.title}</h4>
                      <p className="mt-1 text-sm text-slate-500">
                        {comparisonExpanded ? 'Full feature breakdown' : 'Top items shown first for faster scanning'}
                      </p>
                    </div>
                    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                      <table className="w-full min-w-[820px] border-collapse">
                        <thead>
                          <tr className="text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                            <th className="sticky left-0 z-20 bg-white px-5 py-4 font-bold text-slate-700 shadow-[10px_0_24px_-22px_rgba(15,23,42,0.55)]">
                              Feature
                            </th>
                            <th className="px-4 py-4 font-bold">Starter</th>
                            <th className="bg-[#25D366]/8 px-4 py-4 font-bold text-[#128C7E]">Growth</th>
                            <th className="px-4 py-4 font-bold">Pro</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row) => (
                            <tr key={row.label} className="group border-t border-slate-200 text-sm transition-colors hover:bg-slate-50">
                              <td className="sticky left-0 z-10 bg-white px-5 py-4 font-semibold text-slate-900 shadow-[10px_0_24px_-22px_rgba(15,23,42,0.45)] group-hover:bg-slate-50">
                                {row.label}
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
                                      {meta.label}
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
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#128C7E]">FAQ</p>
                <h3 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">Answers for teams comparing tools and rollout effort.</h3>
                <p className="mt-3 text-base leading-7 text-slate-600">
                  The questions below cover the common blockers before a team moves customer operations into one platform.
                </p>
              </div>

              <div className="mt-8 space-y-4">
                {PRICING_FAQ.map((item, index) => {
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
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#86efac]">Why teams choose Growth</p>
              <h3 className="mt-3 text-2xl font-bold tracking-tight">The fastest path from missed chats to structured operations.</h3>
              <p className="mt-4 text-sm leading-7 text-white/75">
                Most SMEs in clinics, academies, sales teams, and service businesses start here because it unlocks the WhatsApp workflows that make shared inbox operations usable in real life.
              </p>
              <ul className="mt-8 space-y-4">
                {PLANS.GROWTH.valueProps.map((item) => (
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
                Start with Growth
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
                  Ready to centralize operations?
                </div>
                <h2 className="mt-6 text-4xl font-bold tracking-tight text-white lg:text-5xl">
                  Run WhatsApp sales, support, broadcasts, and AI from one operating system.
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-8 text-white/70 lg:text-lg">
                  Start with the plan that fits today, bring your current WhatsApp workflows into one inbox, and give your team a
                  clearer path from first message to closed deal.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <button
                  type="button"
                  onClick={() => handlePlanSelect('growth')}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-7 py-4 text-sm font-bold text-white shadow-lg shadow-[#25D366]/20 transition hover:bg-[#128C7E]"
                >
                  Start Free Trial
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => window.open('https://tawasel.io', '_blank', 'noopener,noreferrer')}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-7 py-4 text-sm font-bold text-white transition hover:border-white/30 hover:bg-white/10"
                >
                  Talk to Sales
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
            {FOOTER_TRUST_POINTS.map((point) => (
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
                <span className="text-2xl font-bold tracking-tight">Tawasel App</span>
              </div>
              <p className="max-w-md text-sm leading-7 text-white/65">
                The premium operating layer for WhatsApp-driven sales, support, CRM workflows, and performance reporting
                for UAE and GCC businesses.
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
              <h4 className="mb-5 text-sm font-bold uppercase tracking-[0.18em] text-white/45">Platform</h4>
              <ul className="space-y-4 text-sm text-white/65">
                <li>
                  <a href="/#features" className="transition-colors hover:text-white">
                    Features
                  </a>
                </li>
                <li>
                  <a href="/#pricing" className="transition-colors hover:text-white">
                    Pricing
                  </a>
                </li>
                <li>
                  <Link to="/register" className="transition-colors hover:text-white">
                    Start Free Trial
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
              <h4 className="mb-5 text-sm font-bold uppercase tracking-[0.18em] text-white/45">Company</h4>
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
              <h4 className="mb-5 text-sm font-bold uppercase tracking-[0.18em] text-white/45">Built for teams that need</h4>
              <ul className="space-y-4 text-sm text-white/65">
                <li>Faster lead response across every WhatsApp inquiry</li>
                <li>One shared WhatsApp inbox with clear ownership</li>
                <li>Arabic and English customer operations</li>
                <li>Broadcasts, CRM, and AI in one workspace</li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-8 text-sm text-white/45 md:flex-row md:items-center md:justify-between">
            <p>© {new Date().getFullYear()} Tawasel App. All rights reserved.</p>
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
