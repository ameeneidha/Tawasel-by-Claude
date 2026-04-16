import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Check, Eye, EyeOff, Loader2, Lock, Mail, User } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { formatLimitValue, getPlanPrice, PLANS, PlanType, type BillingCycle } from '../constants/plans';
import { useTranslation } from 'react-i18next';

export default function Register() {
  const { t } = useTranslation();
  const { user, setUser } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [skipAutoRedirect, setSkipAutoRedirect] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [billingCycle] = useState<BillingCycle>(() => {
    const stored = sessionStorage.getItem('pendingBillingCycle');
    return stored === 'annual' ? 'annual' : 'monthly';
  });

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
    if (user && !skipAutoRedirect) {
      navigate(user.emailVerified ? '/app/dashboard' : '/verify-email-sent', { replace: true });
    }
  }, [navigate, skipAutoRedirect, user]);

  const passwordChecks = [
    { label: t('auth.passwordStrengthMin'), valid: password.length >= 8 },
    { label: t('auth.passwordStrengthUpper'), valid: /[A-Z]/.test(password) },
    { label: t('auth.passwordStrengthLower'), valid: /[a-z]/.test(password) },
    { label: t('auth.passwordStrengthNumber'), valid: /\d/.test(password) },
  ];

  const isPasswordValid = passwordChecks.every((item) => item.valid) && password.length <= 72;
  const doPasswordsMatch = password.length > 0 && password === confirmPassword;
  const isNameValid = name.trim().length >= 2 && name.trim().length <= 80;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(email.trim());
  const canSubmit = isNameValid && isEmailValid && isPasswordValid && doPasswordsMatch && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isNameValid) {
      setError(t('auth.nameValidation'));
      return;
    }

    if (!isEmailValid) {
      setError(t('auth.emailValidation'));
      return;
    }

    if (!isPasswordValid) {
      setError(t('auth.passwordValidation'));
      return;
    }

    if (!doPasswordsMatch) {
      setError(t('auth.passwordMismatch'));
      return;
    }

    setIsSubmitting(true);

    try {
      setSkipAutoRedirect(true);
      const res = await axios.post('/api/auth/register', {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      setUser(res.data.user, res.data.token);
      navigate('/verify-email-sent', {
        replace: true,
        state: {
          email: res.data?.user?.email,
          message: res.data?.verification?.message,
          emailSent: res.data?.verification?.emailSent,
          verificationUrl: res.data?.verification?.verificationUrl,
        },
      });
    } catch (err: any) {
      setError(err.response?.data?.error || t('auth.registrationFailed'));
    }
    setIsSubmitting(false);
  };

  if (!plan) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-[#25D366]/10 px-4 py-10">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[2rem] bg-slate-900 p-8 text-white lg:p-12">
          <div className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#86efac]">
            {t('auth.selectedPlan')}
          </div>
          <h1 className="mt-6 text-4xl font-bold tracking-tight">{plan.name}</h1>
          <p className="mt-3 max-w-xl text-base text-slate-300">{plan.description}</p>
          <div className="mt-8 flex items-end gap-2">
            <span className="text-5xl font-bold">AED {getPlanPrice(plan, billingCycle)}</span>
            <span className="pb-2 text-slate-400">{t('auth.perMonth')}</span>
          </div>
          <p className="mt-2 text-sm text-[#86efac]">
            {billingCycle === 'annual'
              ? t('auth.annualPricing', { amount: plan.annualBilledPrice.toLocaleString() })
              : t('auth.monthlyPricing')}
          </p>

          <div className="mt-10 space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between text-sm text-slate-300">
              <span>{t('auth.audience')}</span>
              <span className="max-w-[220px] text-right text-xs text-slate-400">{plan.shortLabel}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-300">
              <span>{t('auth.contactsIncluded')}</span>
              <span>{formatLimitValue(plan.contactsLimit)}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-300">
              <span>{t('auth.broadcastsPerMonth')}</span>
              <span>{formatLimitValue(plan.broadcastLimit)}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-300">
              <span>{t('auth.teamMembers')}</span>
              <span>{formatLimitValue(plan.userLimit)}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-300">
              <span>{t('auth.whatsappNumbers')}</span>
              <span>{formatLimitValue(plan.whatsappLimit)}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-300">
              <span>{t('auth.aiAssistants')}</span>
              <span>{formatLimitValue(plan.chatbotLimit)}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-300">
              <span>{t('auth.conversationHistory')}</span>
              <span>{plan.historyMonths} {t('auth.months')}</span>
            </div>
          </div>

          <ul className="mt-10 space-y-4">
            {plan.valueProps.map((item) => (
              <li key={item} className="flex items-center gap-3 text-sm text-slate-200">
                <Check className="h-4 w-4 text-[#86efac]" />
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm lg:p-10">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">{t('auth.registerTitle')}</h2>
            <p className="mt-2 text-sm text-slate-500">
              {t('auth.createAccountDesc', { plan: plan.name })}
            </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">{t('auth.fullName')}</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 outline-none transition focus:border-[#25D366] focus:bg-white"
                  placeholder={t('auth.fullNamePlaceholder')}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">{t('auth.emailAddress')}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 outline-none transition focus:border-[#25D366] focus:bg-white"
                  placeholder={t('auth.emailPlaceholderShort')}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">{t('common.password')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-12 outline-none transition focus:border-[#25D366] focus:bg-white"
                  placeholder={t('auth.passwordCreatePlaceholder')}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                  aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
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
                <p className="text-[11px] text-slate-500">{t('auth.passwordMaxChars')}</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">{t('auth.confirmPassword')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-12 outline-none transition focus:border-[#25D366] focus:bg-white"
                  placeholder={t('auth.repeatPasswordPlaceholder')}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                  aria-label={showConfirmPassword ? t('auth.hidePasswordConfirmation') : t('auth.showPasswordConfirmation')}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmPassword ? (
                <p className={`text-xs ${doPasswordsMatch ? 'text-[#128C7E]' : 'text-red-500'}`}>
                  {doPasswordsMatch ? t('auth.passwordsMatch') : t('auth.passwordsMustMatch')}
                </p>
              ) : null}
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 font-semibold text-white transition hover:bg-[#128C7E] disabled:opacity-60"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t('auth.createAccount')}
            </button>
          </form>

          <p className="mt-6 text-sm text-slate-500">
            {t('auth.hasAccount')}{' '}
            <Link to="/login" className="font-medium text-[#25D366] hover:text-[#128C7E]">
              {t('auth.signIn')}
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
