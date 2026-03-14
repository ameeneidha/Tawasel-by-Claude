import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Copy, Loader2, MailCheck } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';

type VerificationPageState = {
  email?: string;
  message?: string;
  emailSent?: boolean;
  verificationUrl?: string;
};

export default function VerifyEmailSent() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, hasVerifiedEmail, requestEmailVerification } = useApp();
  const state = (location.state || {}) as VerificationPageState;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState(state.message || 'We prepared your email verification step.');
  const [emailSent, setEmailSent] = useState(Boolean(state.emailSent));
  const [verificationUrl, setVerificationUrl] = useState(state.verificationUrl || '');

  const email = useMemo(() => state.email || user?.email || '', [state.email, user?.email]);

  useEffect(() => {
    if (hasVerifiedEmail) {
      navigate('/app/dashboard', { replace: true });
    }
  }, [hasVerifiedEmail, navigate]);

  const handleResend = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      const result = await requestEmailVerification();
      setMessage(result.message || 'Verification email is ready.');
      setEmailSent(Boolean(result.emailSent));
      setVerificationUrl(result.verificationUrl || '');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not resend verification email.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-slate-950 flex items-center justify-center p-4 transition-colors">
      <div className="w-full max-w-md rounded-2xl border border-black/5 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-colors">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#25D366]/10">
            <MailCheck className="h-6 w-6 text-[#25D366]" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Verify your email</h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            We use email verification before billing and full workspace access are unlocked.
          </p>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-[#25D366]/20 bg-[#25D366]/5 p-4 text-sm text-slate-700 dark:border-[#25D366]/10 dark:bg-[#25D366]/10 dark:text-gray-200">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#25D366]" />
              <div>
                <p className="font-medium text-slate-900 dark:text-white">{message}</p>
                {email ? (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Destination: {email}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {!emailSent && verificationUrl ? (
            <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Verification Link Preview
              </p>
              <a
                href={verificationUrl}
                className="block break-all text-sm font-medium text-[#25D366] hover:text-[#128C7E]"
              >
                {verificationUrl}
              </a>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(verificationUrl)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-[#25D366] hover:text-[#25D366] dark:border-slate-700 dark:text-slate-300"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy link
              </button>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleResend}
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] py-2.5 font-medium text-white transition-colors hover:bg-[#128C7E] disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {emailSent ? 'Resend verification email' : 'Prepare verification link again'}
          </button>
        </div>

        <div className="mt-8 border-t border-gray-100 pt-6 text-center dark:border-slate-800">
          <Link to={user ? '/app/inbox' : '/login'} className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-[#25D366] dark:text-slate-400">
            <ArrowLeft className="h-4 w-4" />
            {user ? 'Back to app' : 'Back to sign in'}
          </Link>
        </div>
      </div>
    </div>
  );
}
