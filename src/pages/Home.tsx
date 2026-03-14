import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'motion/react';
import {
  ArrowRight,
  BarChart3,
  Check,
  Globe,
  Loader2,
  Lock,
  LogIn,
  Mail,
  MessageSquare,
  Shield,
  Users,
  Zap,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import {
  ENTERPRISE_PLAN,
  formatComparisonValue,
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
    title: 'One inbox for every customer conversation',
    desc: 'Handle WhatsApp, Instagram, and future channels from one shared workspace instead of switching between apps.',
    icon: Globe,
  },
  {
    title: 'AI that keeps leads warm after hours',
    desc: 'Let Tawasel answer FAQs, qualify leads, and support customers while your team is offline.',
    icon: Zap,
  },
  {
    title: 'KPI dashboard built for operations',
    desc: 'Track unread messages, SLA risk, pipeline health, campaigns, and AI spend in one dashboard.',
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
    title: 'Broadcasts with targeting and review',
    desc: 'Segment by pipeline or contact list, preview content, send tests, and review delivery performance after launch.',
    icon: MessageSquare,
  },
];

export default function Home() {
  const { user, setUser } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSignUp, setIsSignUp] = useState(true);
  const [name, setName] = useState('');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const trustedTeamMarkers = ['MK', 'SA', 'LR', 'NH'];
  const getPostLoginPath = (nextUser?: { email?: string | null }) =>
    (nextUser?.email || '').toLowerCase() === 'ameeneidha@gmail.com' ? '/app/superadmin' : '/app/dashboard';

  const handlePlanSelect = (planId: string) => {
    sessionStorage.setItem('pendingPlan', planId);
    sessionStorage.setItem('pendingBillingCycle', billingCycle);
    navigate(user ? `/app/settings/billing/plans?plan=${planId}` : `/register?plan=${planId}`);
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const endpoint = isSignUp ? '/api/auth/register' : '/api/auth/login';
      const payload = isSignUp ? { name, email, password } : { email, password };
      const response = await axios.post(endpoint, payload);
      setUser(response.data.user, response.data.token);
      navigate(getPostLoginPath(response.data.user));
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
              Tawasel gives your team one inbox, one CRM workflow, and one performance dashboard so no lead gets lost between chats, follow-ups, and campaigns.
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
                  ? 'Create your workspace now, then unlock channels, CRM, and automation from billing.'
                  : 'Access your dashboard, inbox, and team workflows.'}
              </p>
            </div>

            <div className="mb-8 flex rounded-xl bg-slate-200 p-1">
              <button
                onClick={() => setIsSignUp(false)}
                className={`flex-1 rounded-lg py-2 text-sm font-bold transition-all ${
                  !isSignUp ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => setIsSignUp(true)}
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
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 outline-none transition-all focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20"
                    placeholder="........"
                    required
                  />
                </div>
              </div>

              {error ? <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-600">{error}</div> : null}

              <button
                type="submit"
                disabled={isLoading}
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
            <h2 className="mb-4 text-3xl font-bold">Everything you need to run conversations like a real revenue channel</h2>
            <p className="mx-auto max-w-2xl text-slate-600">
              Tawasel is not just a shared inbox. It combines CRM, AI, campaigns, and accountability so your team can move faster without losing context.
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

      <section id="pricing" className="py-24">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-bold">Simple pricing. Clear upgrade paths.</h2>
            <p className="mx-auto max-w-3xl text-slate-600">
              Pick the package that matches your team now, then unlock more automation, analytics, and collaboration as your customer volume grows.
            </p>
            <div className="mt-8 inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`rounded-full px-5 py-2 text-sm font-semibold transition-all ${
                  billingCycle === 'monthly' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('annual')}
                className={`rounded-full px-5 py-2 text-sm font-semibold transition-all ${
                  billingCycle === 'annual' ? 'bg-[#25D366] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Annual - Save 20%
              </button>
            </div>
            <p className="mt-3 text-sm text-slate-500">
              Annual pricing is already defined and can be enabled in checkout when deployment billing goes live.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {PLAN_ORDER.map((planKey) => {
              const plan = PLANS[planKey];
              return (
                <div
                  key={planKey}
                  className={`relative rounded-3xl border p-8 transition-all ${
                    plan.highlight
                      ? 'z-10 scale-[1.02] border-[#25D366] bg-white shadow-2xl'
                      : 'border-slate-200 bg-slate-50 hover:bg-white hover:shadow-xl'
                  }`}
                >
                  {plan.highlight ? (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-[#25D366] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
                      Most Popular
                    </div>
                  ) : null}

                  <div className="mb-8">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="mb-1 text-xl font-bold">{plan.name}</h3>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{plan.shortLabel}</p>
                      </div>
                      {plan.highlight ? (
                        <span className="rounded-full bg-[#25D366]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#25D366]">
                          Best Value
                        </span>
                      ) : null}
                    </div>
                    <div className="mb-3 mt-5 flex items-baseline gap-1">
                      <span className="text-4xl font-bold">AED {getPlanPrice(plan, billingCycle)}</span>
                      <span className="font-medium text-slate-500">/month</span>
                    </div>
                    {billingCycle === 'annual' ? (
                      <p className="text-xs font-medium text-[#128C7E]">Billed yearly at AED {plan.annualBilledPrice.toLocaleString()}</p>
                    ) : (
                      <p className="text-xs font-medium text-slate-500">Save 20% with annual billing</p>
                    )}
                    <p className="mt-4 text-sm leading-relaxed text-slate-600">{plan.description}</p>
                  </div>

                  <ul className="mb-8 space-y-4">
                    {plan.cardHighlights.map((feature) => (
                      <li key={feature} className="flex items-center gap-3 text-sm font-medium text-slate-700">
                        <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#25D366]/10">
                          <Check className="h-3 w-3 text-[#25D366]" />
                        </div>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handlePlanSelect(planKey.toLowerCase())}
                    className={`w-full rounded-xl py-4 font-bold transition-all ${
                      plan.highlight
                        ? 'bg-[#25D366] text-white shadow-lg shadow-[#25D366]/20 hover:bg-[#128C7E]'
                        : 'bg-slate-200 text-slate-900 hover:bg-slate-300'
                    }`}
                  >
                    {user ? 'Choose Plan' : 'Get Started'}
                  </button>
                </div>
              );
            })}

            <div className="rounded-3xl border border-slate-900/10 bg-slate-900 p-8 text-white shadow-xl">
              <div className="mb-8">
                <h3 className="mb-1 text-xl font-bold">{ENTERPRISE_PLAN.name}</h3>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">{ENTERPRISE_PLAN.shortLabel}</p>
                <div className="mt-5 flex items-baseline gap-2">
                  <span className="text-4xl font-bold">Let's Talk</span>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-white/75">{ENTERPRISE_PLAN.description}</p>
              </div>

              <ul className="mb-8 space-y-4">
                {ENTERPRISE_PLAN.cardHighlights.map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-sm font-medium text-white/90">
                    <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white/10">
                      <Check className="h-3 w-3 text-[#86efac]" />
                    </div>
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => window.open('https://tawasel.io', '_blank', 'noopener,noreferrer')}
                className="w-full rounded-xl bg-white py-4 font-bold text-slate-900 transition-all hover:bg-slate-100"
              >
                {ENTERPRISE_PLAN.ctaLabel}
              </button>
            </div>
          </div>

          <div className="mt-14 rounded-[2rem] border border-slate-200 bg-slate-50 px-8 py-10 text-center">
            <p className="text-xl font-semibold text-slate-900">{PRICING_VALUE_STATEMENT}</p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-sm text-slate-500">
              {PRICING_TRUST_SIGNALS.map((signal) => (
                <span key={signal} className="rounded-full bg-white px-4 py-2 font-medium shadow-sm">
                  {signal}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-16 rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
            <div className="max-w-3xl">
              <h3 className="text-2xl font-bold text-slate-900">Compare every plan at a glance</h3>
              <p className="mt-2 text-slate-500">
                Review the features that actually change how your team works: channels, CRM depth, automation, analytics, and support.
              </p>
            </div>

            <div className="mt-8 space-y-8">
              {PRICING_COMPARISON_GROUPS.map((group) => (
                <div key={group.title}>
                  <h4 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">{group.title}</h4>
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full border-separate border-spacing-y-2">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-[0.2em] text-slate-400">
                          <th className="px-4 py-2">Feature</th>
                          <th className="px-4 py-2">Starter</th>
                          <th className="px-4 py-2">Growth</th>
                          <th className="px-4 py-2">Pro</th>
                          <th className="px-4 py-2">Enterprise</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.rows.map((row) => (
                          <tr key={row.label} className="bg-slate-50 text-sm text-slate-700">
                            <td className="rounded-l-2xl px-4 py-3 font-semibold text-slate-900">{row.label}</td>
                            <td className="px-4 py-3">{formatComparisonValue(row.values.STARTER)}</td>
                            <td className="px-4 py-3">{formatComparisonValue(row.values.GROWTH)}</td>
                            <td className="px-4 py-3">{formatComparisonValue(row.values.PRO)}</td>
                            <td className="rounded-r-2xl px-4 py-3">{formatComparisonValue(row.values.ENTERPRISE)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-16">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
              <h3 className="text-2xl font-bold text-slate-900">Pricing FAQ</h3>
              <div className="mt-6 space-y-5">
                {PRICING_FAQ.map((item) => (
                  <div key={item.question} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <p className="font-semibold text-slate-900">{item.question}</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-500">{item.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-slate-900 py-20 text-white">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 md:grid-cols-4">
          <div className="col-span-2">
            <div className="mb-6 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#25D366]">
                <MessageSquare className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold">Tawasel App</span>
            </div>
            <p className="mb-8 max-w-sm text-slate-400">
              The all-in-one platform for WhatsApp-driven sales, support, CRM workflows, and performance reporting.
            </p>
            <div className="flex gap-4">
              <a
                href="https://tawasel.io"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 transition-colors hover:bg-[#25D366]"
              >
                <Globe className="h-5 w-5" />
              </a>
              <Link
                to="/about"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 transition-colors hover:bg-[#25D366]"
              >
                <Users className="h-5 w-5" />
              </Link>
            </div>
          </div>

          <div>
            <h4 className="mb-6 font-bold">Product</h4>
            <ul className="space-y-4 text-sm text-slate-400">
              <li>
                <a href="/#features" className="transition-colors hover:text-white">
                  Features
                </a>
              </li>
              <li>
                <Link to="/register" className="transition-colors hover:text-white">
                  Integrations
                </Link>
              </li>
              <li>
                <a href="/#pricing" className="transition-colors hover:text-white">
                  Pricing
                </a>
              </li>
              <li>
                <Link to="/changelog" className="transition-colors hover:text-white">
                  Changelog
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-6 font-bold">Company</h4>
            <ul className="space-y-4 text-sm text-slate-400">
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
            </ul>
          </div>
        </div>

        <div className="mx-auto mt-20 max-w-7xl border-t border-slate-800 px-4 pt-8 text-center text-sm text-slate-500">
          <p className="mb-2">(c) {new Date().getFullYear()} Tawasel App. All rights reserved.</p>
          <p>
            Created by{' '}
            <a href="https://tawasel.io" target="_blank" rel="noopener noreferrer" className="font-medium text-[#25D366] hover:underline">
              tawasel.io
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
