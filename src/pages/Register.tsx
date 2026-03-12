import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Check, Loader2, Lock, Mail, User } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { PLANS, PlanType } from '../constants/plans';

const planDescriptions: Record<PlanType, string> = {
  STARTER: 'Best for getting started with one WhatsApp number and one AI bot.',
  GROWTH: 'Built for growing teams that need more automation and seats.',
  PRO: 'Made for larger operations that need advanced capacity and support.',
};

export default function Register() {
  const { user, setUser } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedPlan = (searchParams.get('plan') || sessionStorage.getItem('pendingPlan') || 'starter').toUpperCase() as PlanType;
  const plan = PLANS[selectedPlan];

  useEffect(() => {
    if (!plan) {
      navigate('/', { replace: true });
      return;
    }

    sessionStorage.setItem('pendingPlan', selectedPlan.toLowerCase());
  }, [navigate, plan, selectedPlan]);

  useEffect(() => {
    if (user) {
      navigate('/app/inbox', { replace: true });
    }
  }, [navigate, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const res = await axios.post('/api/auth/register', { name, email, password });
      setUser(res.data.user, res.data.token);
      navigate('/app/inbox');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
    }
    setIsSubmitting(false);
  };

  if (!plan) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-[#25D366]/10 px-4 py-10">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[2rem] bg-slate-900 p-8 text-white lg:p-12">
          <div className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#86efac]">
            Selected plan
          </div>
          <h1 className="mt-6 text-4xl font-bold tracking-tight">{plan.name}</h1>
          <p className="mt-3 max-w-xl text-base text-slate-300">{planDescriptions[selectedPlan]}</p>
          <div className="mt-8 flex items-end gap-2">
            <span className="text-5xl font-bold">AED {plan.price}</span>
            <span className="pb-2 text-slate-400">/ month</span>
          </div>

          <div className="mt-10 space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between text-sm text-slate-300">
              <span>WhatsApp numbers</span>
              <span>{plan.whatsappLimit}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-300">
              <span>Instagram accounts</span>
              <span>{plan.instagramLimit}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-300">
              <span>AI chatbots</span>
              <span>{plan.chatbotLimit}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-300">
              <span>Team members</span>
              <span>{plan.userLimit}</span>
            </div>
          </div>

          <ul className="mt-10 space-y-4">
            <li className="flex items-center gap-3 text-sm text-slate-200">
              <Check className="h-4 w-4 text-[#86efac]" />
              Account and workspace are created automatically
            </li>
            <li className="flex items-center gap-3 text-sm text-slate-200">
              <Check className="h-4 w-4 text-[#86efac]" />
              Verify your email first, then unlock billing and choose this plan
            </li>
            <li className="flex items-center gap-3 text-sm text-slate-200">
              <Check className="h-4 w-4 text-[#86efac]" />
              Dashboard opens in restricted mode until payment is completed
            </li>
          </ul>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm lg:p-10">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Create your account</h2>
          <p className="mt-2 text-sm text-slate-500">Create your account, verify your email, then choose and pay for your {plan.name} plan from billing.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Full name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 outline-none transition focus:border-[#25D366] focus:bg-white"
                  placeholder="John Doe"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 outline-none transition focus:border-[#25D366] focus:bg-white"
                  placeholder="name@company.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 outline-none transition focus:border-[#25D366] focus:bg-white"
                  placeholder="Create a password"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 font-semibold text-white transition hover:bg-[#128C7E] disabled:opacity-60"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Create account
            </button>
          </form>

          <p className="mt-6 text-sm text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-[#25D366] hover:text-[#128C7E]">
              Sign in
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
