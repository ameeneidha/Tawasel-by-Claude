import { useEffect, useState, type ComponentType } from 'react';
import axios from 'axios';
import { CheckCircle2, CreditCard, Loader2, MailCheck, MessageSquarePlus, Route, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { cn } from '../lib/utils';

type Step = {
  id: string;
  title: string;
  description: string;
  complete: boolean;
  ctaLabel?: string;
  ctaHref?: string;
  ctaAction?: () => Promise<void> | void;
  icon: ComponentType<{ className?: string }>;
};

export default function ActivationChecklist({ className }: { className?: string }) {
  const {
    user,
    activeWorkspace,
    hasVerifiedEmail,
    hasActiveSubscription,
    hasFullAccess,
    verifyEmail,
  } = useApp();
  const [channelCount, setChannelCount] = useState<number | null>(null);
  const [chatbotCount, setChatbotCount] = useState<number | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (!hasActiveSubscription || !activeWorkspace) {
      setChannelCount(null);
      setChatbotCount(null);
      return;
    }

    let isMounted = true;
    Promise.all([
      axios.get(`/api/numbers?workspaceId=${activeWorkspace.id}`),
      axios.get(`/api/instagram/accounts?workspaceId=${activeWorkspace.id}`),
      axios.get(`/api/chatbots?workspaceId=${activeWorkspace.id}`),
    ]).then(([numbersRes, instagramRes, chatbotsRes]) => {
      if (!isMounted) return;
      const numbers = Array.isArray(numbersRes.data) ? numbersRes.data.length : 0;
      const instagrams = Array.isArray(instagramRes.data) ? instagramRes.data.length : 0;
      const bots = Array.isArray(chatbotsRes.data) ? chatbotsRes.data.length : 0;
      setChannelCount(numbers + instagrams);
      setChatbotCount(bots);
    }).catch((error) => {
      console.error('Failed to load activation checklist data', error);
      if (isMounted) {
        setChannelCount(0);
        setChatbotCount(0);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [activeWorkspace, hasActiveSubscription]);

  if (!user || !activeWorkspace) return null;

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      await verifyEmail();
    } finally {
      setIsVerifying(false);
    }
  };

  const steps: Step[] = [
    {
      id: 'verify',
      title: 'Verify email',
      description: 'Confirm the account before billing and workspace actions unlock.',
      complete: hasVerifiedEmail,
      ctaLabel: hasVerifiedEmail ? undefined : (isVerifying ? 'Verifying...' : 'Verify now'),
      ctaAction: hasVerifiedEmail ? undefined : handleVerify,
      icon: MailCheck,
    },
    {
      id: 'subscribe',
      title: 'Choose a plan',
      description: 'Subscribe to unlock sending, CRM tools, campaigns, and automation.',
      complete: hasActiveSubscription,
      ctaLabel: hasActiveSubscription ? undefined : 'Open billing',
      ctaHref: hasActiveSubscription ? undefined : '/app/settings/billing/plans',
      icon: CreditCard,
    },
    {
      id: 'channel',
      title: 'Connect a channel',
      description: 'Add your first WhatsApp number or Instagram account to start receiving conversations.',
      complete: hasActiveSubscription && (channelCount || 0) > 0,
      ctaLabel: hasActiveSubscription && (channelCount || 0) === 0 ? 'Open channels' : undefined,
      ctaHref: hasActiveSubscription && (channelCount || 0) === 0 ? '/app/channels' : undefined,
      icon: Route,
    },
    {
      id: 'bot',
      title: 'Create your first AI bot',
      description: 'Add instructions and assign a bot so incoming leads can get instant answers.',
      complete: hasFullAccess && (chatbotCount || 0) > 0,
      ctaLabel: hasFullAccess && (chatbotCount || 0) === 0 ? 'Open chatbots' : undefined,
      ctaHref: hasFullAccess && (chatbotCount || 0) === 0 ? '/app/chatbots' : undefined,
      icon: Sparkles,
    },
  ];

  const completedCount = steps.filter((step) => step.complete).length;
  const allComplete = completedCount === steps.length;

  return (
    <section className={cn('rounded-3xl border border-[#25D366]/15 bg-white p-6 shadow-sm dark:bg-slate-900 dark:border-[#25D366]/10', className)}>
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[#25D366]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#25D366]">
            Activation checklist
          </div>
          <h2 className="mt-3 text-2xl font-semibold text-gray-900 dark:text-white">
            {allComplete ? 'Workspace is fully activated' : 'Finish setup to unlock the full product'}
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {allComplete
              ? 'Your core onboarding is complete. Next, bring in contacts and launch your first campaign.'
              : `Complete ${steps.length - completedCount} more step${steps.length - completedCount === 1 ? '' : 's'} to move from setup into daily operations.`}
          </p>
        </div>
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#25D366]/10 text-[#25D366]">
          <div className="text-center">
            <div className="text-xl font-bold">{completedCount}/{steps.length}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider">Done</div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.id}
              className={cn(
                'rounded-2xl border p-4 transition-colors',
                step.complete
                  ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/30 dark:bg-emerald-900/10'
                  : 'border-gray-200 bg-gray-50 dark:border-slate-800 dark:bg-slate-950/60'
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  'mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl',
                  step.complete ? 'bg-emerald-500 text-white' : 'bg-white text-[#25D366] dark:bg-slate-900'
                )}>
                  {step.complete ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{step.title}</h3>
                    <span className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                      step.complete
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                    )}>
                      {step.complete ? 'Done' : 'Next'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{step.description}</p>
                  {!step.complete && (step.ctaHref || step.ctaAction) && (
                    <div className="mt-3">
                      {step.ctaHref ? (
                        <Link
                          to={step.ctaHref}
                          className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#128C7E]"
                        >
                          {step.ctaLabel}
                          <MessageSquarePlus className="h-3.5 w-3.5" />
                        </Link>
                      ) : (
                        <button
                          onClick={() => step.ctaAction?.()}
                          disabled={isVerifying}
                          className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#128C7E] disabled:opacity-60"
                        >
                          {step.ctaLabel}
                          {isVerifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquarePlus className="h-3.5 w-3.5" />}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
