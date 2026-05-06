import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'motion/react';
import { Mail, Lock, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Login() {
  const { user, setUser } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const isAddingAccount = searchParams.get('addAccount') === '1';
  const getPostLoginPath = (nextUser?: { email?: string | null }) =>
    (nextUser?.email || '').toLowerCase() === (process.env.SUPERADMIN_EMAIL || '').toLowerCase() ? '/app/superadmin' : '/app/dashboard';

  useEffect(() => {
    if (user && !isAddingAccount) {
      navigate(getPostLoginPath(user));
    }
  }, [isAddingAccount, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const res = await axios.post('/api/auth/login', { email, password });
      setUser(res.data.user, res.data.token, rememberMe);
      navigate(getPostLoginPath(res.data.user));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="tawasel-app-shell min-h-screen flex items-center justify-center p-4 transition-colors">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="tawasel-card w-full max-w-md p-8 transition-colors"
      >
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-950 dark:ring-slate-800">
            <img src="/tawasel-logo.png" alt="Tawasel" className="h-12 w-12 object-contain" />
          </div>
          <h1 className="font-serif text-4xl font-normal leading-none text-gray-900 dark:text-white">
            {isAddingAccount ? 'Add another account' : t('auth.loginTitle')}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            {isAddingAccount ? 'Sign in to another saved workspace on this device.' : t('auth.loginSubtitle')}
          </p>
          <button
            onClick={() => i18n.changeLanguage(isRtl ? 'en' : 'ar')}
            className="mt-3 text-xs text-[#25D366] hover:text-[#128C7E] font-medium transition-colors"
          >
            {isRtl ? 'English' : 'العربية'}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('common.email')}</label>
            <div className="relative">
              <Mail className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="tawasel-control w-full ps-10 pe-4 py-2.5 outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600"
                placeholder="name@company.com"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('common.password')}</label>
              <Link to="/forgot-password" className="text-xs font-semibold text-[#25D366] transition-colors hover:text-[#128C7E]">
                {t('auth.forgotPassword')}
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="tawasel-control w-full ps-10 pe-4 py-2.5 outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-gray-600"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="rememberMe"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 dark:border-slate-600 text-[#25D366] focus:ring-[#25D366]/20 bg-gray-50 dark:bg-slate-800 cursor-pointer"
            />
            <label htmlFor="rememberMe" className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer select-none">
              {t('auth.rememberMe')}
            </label>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="tawasel-primary flex w-full items-center justify-center gap-2 py-3 font-bold transition-colors disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('auth.signIn')}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-slate-800 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('auth.noAccount')}{' '}
            <Link to="/register" className="text-[#25D366] font-medium hover:text-[#128C7E] transition-colors">
              {t('auth.signUp')}
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
