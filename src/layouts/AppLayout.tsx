import { Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import { useApp } from '../contexts/AppContext';
import { useSidebar } from '../contexts/SidebarContext';
import { AlertCircle, CheckCircle2, CreditCard, Loader2, Lock, Menu } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const routeTitleKeys: Record<string, string> = {
  '/app/dashboard': 'sidebar.dashboard',
  '/app/inbox': 'sidebar.inbox',
  '/app/crm': 'sidebar.crmPipeline',
  '/app/contacts': 'sidebar.contacts',
  '/app/appointments': 'sidebar.appointments',
  '/app/compose': 'sidebar.compose',
  '/app/broadcast': 'sidebar.broadcast',
  '/app/templates': 'sidebar.templates',
  '/app/chatbots': 'sidebar.aiChatbots',
  '/app/campaigns': 'sidebar.campaigns',
  '/app/auto-assign': 'sidebar.autoAssign',
  '/app/follow-ups': 'sidebar.followUps',
  '/app/integrations': 'sidebar.integrations',
  '/app/channels': 'sidebar.channels',
  '/app/team': 'sidebar.team',
  '/app/superadmin': 'sidebar.superadmin',
  '/app/switch-account': 'sidebar.switchAccount',
  '/app/feature-request': 'sidebar.featureRequest',
  '/app/report-issue': 'sidebar.reportIssue',
  '/app/web-chat-widget': 'sidebar.webChatWidget',
  '/app/settings': 'common.settings',
};

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isLoading, requestEmailVerification, hasVerifiedEmail, hasActiveSubscription, hasFullAccess, activeWorkspace, isSuperadmin, isImpersonating, impersonatingWorkspaceName, stopImpersonation } = useApp();
  const { toggle } = useSidebar();
  const { t } = useTranslation();
  const [isVerifying, setIsVerifying] = useState(false);

  // Resolve page title from current route
  const pageTitleKey = Object.entries(routeTitleKeys).find(
    ([path]) => location.pathname === path || location.pathname.startsWith(path + '/')
  )?.[1] || 'sidebar.dashboard';
  const pageTitle = t(pageTitleKey);

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#F8F9FA] dark:bg-slate-950 transition-colors">
        <div className="w-12 h-12 border-4 border-[#25D366]/20 border-t-[#25D366] rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (isSuperadmin && !isImpersonating && !location.pathname.startsWith('/app/superadmin')) {
    return <Navigate to="/app/superadmin" replace />;
  }

  if (!isSuperadmin && location.pathname.startsWith('/app/superadmin')) {
    return <Navigate to="/app/dashboard" replace />;
  }

  const isBillingRoute = location.pathname.startsWith('/app/settings/billing');
  const isInboxRoute = location.pathname.startsWith('/app/inbox');
  const subscriptionStatus = String(activeWorkspace?.subscriptionStatus || '').toLowerCase();
  const trialEndsAt = activeWorkspace?.trialEndsAt ? new Date(activeWorkspace.trialEndsAt) : null;
  const trialDaysLeft = trialEndsAt ? Math.ceil((trialEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : null;
  const isActiveTrial = subscriptionStatus === 'trialing' && hasActiveSubscription;

  if (!isSuperadmin && !hasFullAccess && !isBillingRoute && !isInboxRoute) {
    return <Navigate to="/app/inbox" replace />;
  }

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      const result = await requestEmailVerification();
      navigate('/verify-email-sent', {
        state: {
          email: user?.email,
          ...result,
        },
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#F8F9FA] dark:bg-slate-950 overflow-hidden transition-colors">
      {/* Mobile top bar */}
      <div className="md:hidden flex items-center h-14 px-4 border-b border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
        <button onClick={toggle} className="text-gray-600 dark:text-gray-300">
          <Menu className="w-6 h-6" />
        </button>
        <div className="ml-3 flex items-center gap-2">
          <div className="w-7 h-7 bg-[#25D366] rounded-lg flex items-center justify-center text-white font-bold text-sm">
            T
          </div>
          <span className="font-bold text-lg text-gray-900 dark:text-white">Tawasel</span>
        </div>
      </div>
      <div className="flex flex-1 min-h-0">
      <Sidebar />
      <main className="flex-1 min-h-0 overflow-hidden relative flex flex-col">
        {isImpersonating && (
          <div className="bg-amber-400 px-4 py-2 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 text-amber-900 text-sm font-bold">
              <AlertCircle className="w-4 h-4" />
              <span>You are impersonating: {impersonatingWorkspaceName || 'Workspace'}</span>
            </div>
            <button
              onClick={async () => {
                await stopImpersonation();
                navigate('/app/superadmin');
              }}
              className="px-3 py-1 bg-amber-900 hover:bg-amber-950 text-white text-xs font-bold rounded-lg transition-colors"
            >
              Exit Impersonation
            </button>
          </div>
        )}
        {!isSuperadmin && !isImpersonating && !hasVerifiedEmail && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-900/30 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm font-medium">
              <AlertCircle className="w-4 h-4" />
              <span>Verify your email first. Billing unlocks after verification, and the rest of the app unlocks after payment.</span>
            </div>
            <button
              onClick={handleVerify}
              disabled={isVerifying}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {isVerifying ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
              Send verification email
            </button>
          </div>
        )}
        {!isSuperadmin && !isImpersonating && hasVerifiedEmail && !hasActiveSubscription && (
          <div className="bg-blue-50 border-b border-blue-100 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-blue-700 text-sm font-medium">
              <Lock className="w-4 h-4" />
              <span>{subscriptionStatus === 'trial_expired' ? 'Your 30-day trial has ended. Choose a plan to continue sending messages, bookings, reminders, and automation.' : 'You are in restricted mode. You can view Inbox and choose a plan, but the CRM unlocks only after subscription payment.'}</span>
            </div>
            <button
              onClick={() => navigate('/app/settings/billing/plans')}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
            >
              <CreditCard className="w-3 h-3" />
              Choose Plan
            </button>
          </div>
        )}
        {!isSuperadmin && !isImpersonating && hasVerifiedEmail && isActiveTrial && (
          <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-700 text-sm font-medium">
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {trialDaysLeft !== null
                  ? `Your Tawasel trial is active. ${Math.max(0, trialDaysLeft)} day${trialDaysLeft === 1 ? '' : 's'} left to prove it in the business.`
                  : 'Your Tawasel trial is active. Use it in the business, then decide.'}
              </span>
            </div>
            <button
              onClick={() => navigate('/app/settings/billing/plans')}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
            >
              <CreditCard className="w-3 h-3" />
              View Plans
            </button>
          </div>
        )}
        <div className="hidden md:block">
          <Topbar title={pageTitle} />
        </div>
        <div className="flex-1 overflow-auto relative min-h-0">
          <Outlet />
        </div>
      </main>
      </div>
    </div>
  );
}
