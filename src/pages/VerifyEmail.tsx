import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader2, MailCheck } from 'lucide-react';
import { useApp } from '../contexts/AppContext';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, token: sessionToken, setUser } = useApp();
  const verificationToken = searchParams.get('token') || '';
  const [isProcessing, setIsProcessing] = useState(true);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const completeVerification = async () => {
      if (!verificationToken) {
        setError('This email verification link is missing or invalid.');
        setIsProcessing(false);
        return;
      }

      try {
        const res = await axios.post('/api/auth/verify-email/complete', { token: verificationToken });
        const verifiedUser = res.data?.user;

        if (verifiedUser && sessionToken && user?.id === verifiedUser.id) {
          setUser(verifiedUser, sessionToken);
        }

        setIsComplete(true);
        setTimeout(() => {
          navigate(sessionToken ? '/app/dashboard' : '/login', { replace: true });
        }, 2000);
      } catch (err: any) {
        setError(err.response?.data?.error || 'This email verification link is invalid or has expired.');
      } finally {
        setIsProcessing(false);
      }
    };

    completeVerification();
  }, [navigate, sessionToken, setUser, user?.id, verificationToken]);

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-slate-950 flex items-center justify-center p-4 transition-colors">
      <div className="w-full max-w-md rounded-2xl border border-black/5 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-colors">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#25D366]/10">
            {isComplete ? <CheckCircle2 className="h-6 w-6 text-[#25D366]" /> : <MailCheck className="h-6 w-6 text-[#25D366]" />}
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            {isComplete ? 'Email verified' : 'Verifying your email'}
          </h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            {isComplete
              ? 'Your account is verified. Redirecting you now.'
              : 'We are confirming your email verification link.'}
          </p>
        </div>

        {isProcessing ? (
          <div className="flex items-center justify-center py-12 text-slate-500 dark:text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        ) : (
          <div className="rounded-lg border border-[#25D366]/20 bg-[#25D366]/5 p-4 text-sm text-slate-700 dark:border-[#25D366]/10 dark:bg-[#25D366]/10 dark:text-gray-200">
            Email verified successfully. Redirecting...
          </div>
        )}

        <div className="mt-8 border-t border-gray-100 pt-6 text-center dark:border-slate-800">
          <Link to={sessionToken ? '/app/dashboard' : '/login'} className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-[#25D366] dark:text-slate-400">
            <ArrowLeft className="h-4 w-4" />
            {sessionToken ? 'Back to app' : 'Back to sign in'}
          </Link>
        </div>
      </div>
    </div>
  );
}
