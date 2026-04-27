import { useEffect, useState, type ComponentType } from 'react';
import axios from 'axios';
import {
  BellRing,
  CalendarCheck,
  CheckCircle2,
  CreditCard,
  Loader2,
  MailCheck,
  MessageSquarePlus,
  Route,
  Scissors,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
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
    requestEmailVerification,
  } = useApp();
  const navigate = useNavigate();
  const [channelCount, setChannelCount] = useState<number | null>(null);
  const [chatbotCount, setChatbotCount] = useState<number | null>(null);
  const [serviceCount, setServiceCount] = useState<number | null>(null);
  const [staffCount, setStaffCount] = useState<number | null>(null);
  const [reminderRuleCount, setReminderRuleCount] = useState<number | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    if (!hasActiveSubscription || !activeWorkspace) {
      setChannelCount(null);
      setChatbotCount(null);
      setServiceCount(null);
      setStaffCount(null);
      setReminderRuleCount(null);
      return;
    }

    let isMounted = true;
    Promise.all([
      axios.get(`/api/numbers?workspaceId=${activeWorkspace.id}`),
      axios.get(`/api/chatbots?workspaceId=${activeWorkspace.id}`),
      axios.get(`/api/services?workspaceId=${activeWorkspace.id}`),
      axios.get(`/api/staff?workspaceId=${activeWorkspace.id}`),
      axios.get(`/api/reminder-rules?workspaceId=${activeWorkspace.id}`),
    ]).then(([numbersRes, chatbotsRes, servicesRes, staffRes, reminderRulesRes]) => {
      if (!isMounted) return;
      const numbers = Array.isArray(numbersRes.data) ? numbersRes.data.length : 0;
      const bots = Array.isArray(chatbotsRes.data) ? chatbotsRes.data.length : 0;
      const services = Array.isArray(servicesRes.data) ? servicesRes.data.filter((service) => service.enabled !== false).length : 0;
      const staff = Array.isArray(staffRes.data) ? staffRes.data.filter((member) => member.enabled !== false).length : 0;
      const reminderRules = Array.isArray(reminderRulesRes.data) ? reminderRulesRes.data.filter((rule) => rule.enabled !== false).length : 0;
      setChannelCount(numbers);
      setChatbotCount(bots);
      setServiceCount(services);
      setStaffCount(staff);
      setReminderRuleCount(reminderRules);
    }).catch((error) => {
      console.error('Failed to load activation checklist data', error);
      if (isMounted) {
        setChannelCount(0);
        setChatbotCount(0);
        setServiceCount(0);
        setStaffCount(0);
        setReminderRuleCount(0);
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
      const result = await requestEmailVerification();
      navigate('/verify-email-sent', {
        state: {
          email: user.email,
          ...result,
        },
      });
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
      ctaLabel: hasVerifiedEmail ? undefined : (isVerifying ? 'Preparing...' : 'Send verification email'),
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
      title: 'Connect WhatsApp',
      description: 'Add your first WhatsApp number to start receiving conversations.',
      complete: hasActiveSubscription && (channelCount || 0) > 0,
      ctaLabel: hasActiveSubscription && (channelCount || 0) === 0 ? 'Open channels' : undefined,
      ctaHref: hasActiveSubscription && (channelCount || 0) === 0 ? '/app/channels' : undefined,
      icon: Route,
    },
    {
      id: 'service',
      title: 'Create a service',
      description: 'Add the first bookable service with duration and price so customers can choose what they need.',
      complete: hasFullAccess && (serviceCount || 0) > 0,
      ctaLabel: hasFullAccess && (serviceCount || 0) === 0 ? 'Open appointments' : undefined,
      ctaHref: hasFullAccess && (serviceCount || 0) === 0 ? '/app/appointments' : undefined,
      icon: Scissors,
    },
    {
      id: 'staff',
      title: 'Add staff availability',
      description: 'Add at least one staff member so the booking page can show real appointment slots.',
      complete: hasFullAccess && (staffCount || 0) > 0,
      ctaLabel: hasFullAccess && (staffCount || 0) === 0 ? 'Add staff' : undefined,
      ctaHref: hasFullAccess && (staffCount || 0) === 0 ? '/app/appointments' : undefined,
      icon: UserPlus,
    },
    {
      id: 'booking',
      title: 'Test the booking link',
      description: 'Open the public booking page and make one test booking before sharing it with customers.',
      complete: hasFullAccess && (serviceCount || 0) > 0 && (staffCount || 0) > 0,
      ctaLabel: hasFullAccess && (serviceCount || 0) > 0 && (staffCount || 0) > 0 ? 'Open booking page' : undefined,
      ctaHref: hasFullAccess && (serviceCount || 0) > 0 && (staffCount || 0) > 0 ? `/book/${activeWorkspace.slug}` : undefined,
      icon: CalendarCheck,
    },
    {
      id: 'reminders',
      title: 'Set reminder rules',
      description: 'Create at least one reminder rule so appointments get timely follow-ups and fewer no-shows.',
      complete: hasFullAccess && (reminderRuleCount || 0) > 0,
      ctaLabel: hasFullAccess && (reminderRuleCount || 0) === 0 ? 'Open reminders' : undefined,
      ctaHref: hasFullAccess && (reminderRuleCount || 0) === 0 ? '/app/appointments' : undefined,
      icon: BellRing,
    },
    {
      id: 'bot',
      title: 'Create your first AI bot',
      description: 'Optional: add instructions and assign a bot so incoming leads can get instant answers.',
      complete: hasFullAccess && (chatbotCount || 0) > 0,
      ctaLabel: hasFullAccess && (chatbotCount || 0) === 0 ? 'Open chatbots' : undefined,
      ctaHref: hasFullAccess && (chatbotCount || 0) === 0 ? '/app/chatbots' : undefined,
      icon: Sparkles,
    },
  ];

  const completedCount = steps.filter((step) => step.complete).length;
  const allComplete = completedCount === steps.length;
  const nextStep = steps.find((step) => !step.complete && (step.ctaHref || step.ctaAction));

  return (
    <section className={cn('rounded-3xl border border-[#25D366]/15 bg-white p-4 shadow-sm dark:bg-slate-900 dark:border-[#25D366]/10 md:p-6', className)}>
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
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#25D366]/10 text-[#25D366]">
          <div className="text-center">
            <div className="text-xl font-bold">{completedCount}/{steps.length}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider">Done</div>
          </div>
        </div>
      </div>

      {nextStep && (
        <div className="mt-5 rounded-2xl border border-[#25D366]/15 bg-[#25D366]/5 p-4 dark:border-[#25D366]/10 dark:bg-[#25D366]/10">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#128C7E] dark:text-[#4ADE80]">Next recommended step</p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">{nextStep.title}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{nextStep.description}</p>
            </div>
            {nextStep.ctaHref ? (
              <Link to={nextStep.ctaHref} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#128C7E]">
                {nextStep.ctaLabel}
              </Link>
            ) : (
              <button onClick={() => nextStep.ctaAction?.()} disabled={isVerifying} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#128C7E] disabled:opacity-60">
                {nextStep.ctaLabel}
                {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              </button>
            )}
          </div>
        </div>
      )}

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
