import React, { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { ArrowLeft, KeyRound, Loader2, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [resetUrl, setResetUrl] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setMessage('');
    setEmailSent(false);
    setResetUrl('');

    try {
      const res = await axios.post('/api/auth/forgot-password', { email });
      setMessage(res.data?.message || t('auth.resetDefaultMessage'));
      setEmailSent(Boolean(res.data?.emailSent));
      setResetUrl(res.data?.resetUrl || '');
    } catch (err: any) {
      setError(err.response?.data?.error || t('auth.resetFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-slate-950 flex items-center justify-center p-4 transition-colors">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-colors">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#25D366]/10">
            <KeyRound className="h-6 w-6 text-[#25D366]" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{t('auth.forgotPasswordTitle')}</h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            {t('auth.forgotPasswordDesc')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('auth.emailAddress')}</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-gray-900 outline-none transition-all placeholder:text-gray-400 focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-gray-600"
                placeholder="name@company.com"
                required
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          {message && (
            <div className="space-y-3 rounded-lg border border-[#25D366]/20 bg-[#25D366]/5 p-3 text-sm text-slate-700 dark:border-[#25D366]/10 dark:bg-[#25D366]/10 dark:text-gray-200">
              <p>{message}</p>
              {resetUrl && (
                <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Reset Link
                  </p>
                  <a
                    href={resetUrl}
                    className="block break-all text-sm font-medium text-[#25D366] hover:text-[#128C7E]"
                  >
                    {resetUrl}
                  </a>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(resetUrl)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-[#25D366] hover:text-[#25D366] dark:border-slate-700 dark:text-slate-300"
                  >
                    Copy link
                  </button>
                </div>
              )}
              {message && emailSent && !resetUrl ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Check your inbox and spam folder for the reset email.
                </p>
              ) : null}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] py-2.5 font-medium text-white transition-colors hover:bg-[#128C7E] disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Send reset link
          </button>
        </form>

        <div className="mt-8 border-t border-gray-200 pt-6 text-center dark:border-slate-800">
          <Link to="/login" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-[#25D366] dark:text-slate-400">
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
