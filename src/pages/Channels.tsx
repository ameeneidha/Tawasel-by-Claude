import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useApp } from '../contexts/AppContext';
import { getPlanConfig, PLANS, PlanType } from '../constants/plans';
import {
  Hash,
  Plus,
  MoreVertical,
  Bot,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Trash2,
  Settings2,
  Loader2,
  Phone,
  ShieldCheck,
  Instagram,
  ExternalLink
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import * as Switch from '@radix-ui/react-switch';
import { toast } from 'sonner';
import ActivationChecklist from '../components/ActivationChecklist';
import TawaselLoader from '../components/TawaselLoader';
import { getAllowedMessageOrigins } from '../lib/runtime-config';

type EmbeddedSignupConfig = {
  enabled: boolean;
  graphVersion: string;
  appId: string | null;
  configId: string | null;
  callbackUrl: string | null;
  missingKeys?: string[];
};

type MetaEmbeddedSignupSessionHints = {
  businessId?: string | null;
  wabaId?: string | null;
  phoneNumberId?: string | null;
  displayPhoneNumber?: string | null;
};

type EmbeddedSignupMessagePayload = {
  success: boolean;
  error?: string;
  workspaceId?: string | null;
  businessId?: string | null;
  accessToken?: string | null;
  tokenExpiresAt?: string | null;
  phoneNumbers?: Array<{
    wabaId?: string | null;
    phoneNumberId: string;
    displayPhoneNumber: string;
    verifiedName?: string | null;
    businessName?: string | null;
  }>;
};

type InstagramConnectionAccount = {
  pageId: string;
  pageName: string;
  pageAccessToken: string;
  instagramId: string;
  username?: string | null;
  name?: string | null;
};

type InstagramConnectMessagePayload = {
  success: boolean;
  error?: string;
  workspaceId?: string | null;
  tokenExpiresAt?: string | null;
  accounts?: InstagramConnectionAccount[];
};

const META_EMBEDDED_SIGNUP_ORIGINS = [
  'https://www.facebook.com',
  'https://web.facebook.com',
  'https://business.facebook.com',
  'https://m.facebook.com',
];

export default function Channels() {
  const { t } = useTranslation();
  const { activeWorkspace } = useApp();
  const [numbers, setNumbers] = useState<any[]>([]);
  const [igAccounts, setIgAccounts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnectingWhatsApp, setIsConnectingWhatsApp] = useState(false);
  const [isFinalizingWhatsApp, setIsFinalizingWhatsApp] = useState(false);
  const [isConnectingInstagram, setIsConnectingInstagram] = useState(false);
  const [isFinalizingInstagram, setIsFinalizingInstagram] = useState(false);
  const [pendingInstagramAccounts, setPendingInstagramAccounts] = useState<InstagramConnectionAccount[]>([]);
  const [pendingInstagramTokenExpiresAt, setPendingInstagramTokenExpiresAt] = useState<string | null>(null);
  const [embeddedSignupConfig, setEmbeddedSignupConfig] = useState<EmbeddedSignupConfig | null>(null);
  const [isLoadingEmbeddedSignupConfig, setIsLoadingEmbeddedSignupConfig] = useState(false);
  const [embeddedSignupSessionHints, setEmbeddedSignupSessionHints] = useState<MetaEmbeddedSignupSessionHints | null>(null);
  const embeddedSignupSessionHintsRef = useRef<MetaEmbeddedSignupSessionHints | null>(null);

  const currentPlan = activeWorkspace?.plan || 'NONE';
  const planInfo = getPlanConfig(currentPlan) || PLANS.STARTER;
  const isMetaTestNumber = (phoneNumber?: string) => phoneNumber?.replace(/\D/g, '') === '15551363768';

  const waLimitReached = numbers.length >= planInfo.whatsappLimit;
  const igLimitReached = igAccounts.length >= (planInfo.instagramLimit || 1);

  useEffect(() => {
    if (activeWorkspace) {
      fetchChannels();
      fetchEmbeddedSignupConfig();
    } else {
      setIsLoading(false);
      setEmbeddedSignupConfig(null);
    }
  }, [activeWorkspace]);

  useEffect(() => {
    const finalizeInstagramAccount = async (
      payload: InstagramConnectMessagePayload,
      account: InstagramConnectionAccount
    ) => {
      if (!activeWorkspace?.id) return;

      setIsFinalizingInstagram(true);
      try {
        const response = await axios.post('/api/instagram/connect/finalize', {
          workspaceId: activeWorkspace.id,
          pageId: account.pageId,
          pageName: account.pageName,
          pageAccessToken: account.pageAccessToken,
          instagramId: account.instagramId,
          username: account.username,
          name: account.name || account.username || account.pageName,
          tokenExpiresAt: payload.tokenExpiresAt || pendingInstagramTokenExpiresAt,
        });

        await fetchChannels();
        setPendingInstagramAccounts([]);
        setPendingInstagramTokenExpiresAt(null);

        if (response.data?.webhookSubscribed === false) {
          toast.warning(response.data?.webhookError || 'Instagram connected, but webhook subscription needs attention in Meta.');
        } else {
          toast.success(`Instagram ${account.username ? `@${account.username}` : account.pageName} connected`);
        }
      } catch (error) {
        if (axios.isAxiosError(error)) {
          toast.error(error.response?.data?.error || 'Could not save Instagram account');
        } else {
          toast.error('Could not save Instagram account');
        }
      } finally {
        setIsFinalizingInstagram(false);
      }
    };

    const finalizeConnectedPhone = async (
      payload: EmbeddedSignupMessagePayload,
      phoneNumbersInput?: EmbeddedSignupMessagePayload['phoneNumbers']
    ) => {
      if (!activeWorkspace?.id) return;

      const phoneNumbers = Array.isArray(phoneNumbersInput) ? phoneNumbersInput : [];
      const selectedPhone = phoneNumbers[0];

      if (!selectedPhone?.phoneNumberId || !selectedPhone?.displayPhoneNumber || !payload?.accessToken) {
        toast.error(t('channels.couldNotSaveChannel'));
        return;
      }

      if (payload.workspaceId && payload.workspaceId !== activeWorkspace.id) {
        toast.error(t('channels.couldNotSaveChannel'));
        return;
      }

      setIsFinalizingWhatsApp(true);
      try {
        await axios.post('/api/meta/embedded-signup/finalize', {
          workspaceId: activeWorkspace.id,
          phoneNumberId: selectedPhone.phoneNumberId,
          displayPhoneNumber: selectedPhone.displayPhoneNumber,
          wabaId: selectedPhone.wabaId || embeddedSignupSessionHints?.wabaId || null,
          businessId: payload.businessId || embeddedSignupSessionHints?.businessId || null,
          accessToken: payload.accessToken,
          tokenExpiresAt: payload.tokenExpiresAt,
          verifiedName: selectedPhone.verifiedName,
          businessName: selectedPhone.businessName,
          name: selectedPhone.verifiedName || selectedPhone.businessName || selectedPhone.displayPhoneNumber,
        });

        await fetchChannels();
        setEmbeddedSignupSessionHints(null);
        toast.success(t('channels.connected', { phone: selectedPhone.displayPhoneNumber }));

        if (phoneNumbers.length > 1) {
          toast.info(t('channels.multipleNumbersInfo'));
        }
      } catch (error) {
        if (axios.isAxiosError(error)) {
          toast.error(error.response?.data?.error || t('channels.couldNotSaveChannel'));
        } else {
          toast.error('Could not save WhatsApp channel');
        }
      } finally {
        setIsFinalizingWhatsApp(false);
      }
    };

    const handleEmbeddedSignupMessage = async (event: MessageEvent) => {
      let rawData = event.data;
      if (typeof rawData === 'string') {
        try {
          rawData = JSON.parse(rawData);
        } catch {
          rawData = event.data;
        }
      }

      if (
        META_EMBEDDED_SIGNUP_ORIGINS.includes(event.origin) &&
        rawData &&
        typeof rawData === 'object' &&
        rawData.type === 'WA_EMBEDDED_SIGNUP' &&
        rawData.event === 'FINISH'
      ) {
        const hints = {
          businessId: rawData.data?.business_id || null,
          wabaId: rawData.data?.waba_id || null,
          phoneNumberId: rawData.data?.phone_number_id || null,
          displayPhoneNumber: rawData.data?.display_phone_number || null,
        };
        console.log('[embedded-signup] WA_EMBEDDED_SIGNUP hints received', hints);
        embeddedSignupSessionHintsRef.current = hints;
        setEmbeddedSignupSessionHints(hints);
        return;
      }

      const allowedOrigins = getAllowedMessageOrigins();
      if (!allowedOrigins.has(event.origin)) return;

      if (rawData?.type === 'meta-instagram-connect') {
        if (!activeWorkspace?.id) return;
        const payload = rawData.payload as InstagramConnectMessagePayload;
        if (!payload?.success) {
          toast.error(payload?.error || 'Could not connect Instagram');
          return;
        }

        if (payload.workspaceId && payload.workspaceId !== activeWorkspace.id) {
          toast.error('Instagram connection belongs to a different workspace');
          return;
        }

        const accounts = Array.isArray(payload.accounts) ? payload.accounts : [];
        if (accounts.length === 0) {
          toast.error('No linked Instagram Business account was returned by Meta');
          return;
        }

        if (accounts.length === 1) {
          await finalizeInstagramAccount(payload, accounts[0]);
          return;
        }

        setPendingInstagramAccounts(accounts);
        setPendingInstagramTokenExpiresAt(payload.tokenExpiresAt || null);
        toast.info('Choose which Instagram account to connect.');
        return;
      }

      if (rawData?.type !== 'meta-embedded-signup') return;
      if (!activeWorkspace?.id) return;

      const payload = rawData.payload as EmbeddedSignupMessagePayload;
      if (!payload?.success) {
        // Use ref for synchronous access (state may not have updated yet)
        const hints = embeddedSignupSessionHintsRef.current;
        console.log('[embedded-signup] callback failed, checking hints ref', hints);

        // If we have session hints with a phoneNumberId, use it directly as fallback
        if (payload?.accessToken && hints?.phoneNumberId) {
          await finalizeConnectedPhone(payload, [{
            phoneNumberId: hints.phoneNumberId,
            displayPhoneNumber: hints.displayPhoneNumber || hints.phoneNumberId,
            wabaId: hints.wabaId || null,
            businessName: null,
            verifiedName: null,
          }]);
          return;
        }

        const canRetryLookup =
          Boolean(payload?.accessToken) &&
          Boolean(hints?.businessId || hints?.wabaId);

        if (canRetryLookup) {
          try {
            const response = await axios.post('/api/meta/embedded-signup/resolve-assets', {
              accessToken: payload.accessToken,
              businessId: hints?.businessId || undefined,
              wabaId: hints?.wabaId || undefined,
            });

            const resolvedPhoneNumbers = Array.isArray(response.data?.phoneNumbers)
              ? response.data.phoneNumbers
              : [];

            if (resolvedPhoneNumbers.length > 0) {
              await finalizeConnectedPhone(payload, resolvedPhoneNumbers);
              return;
            }
          } catch (error) {
            console.error('Failed to resolve embedded signup phone assets', error);
          }
        }

        toast.error(payload?.error || t('channels.couldNotStartSignup'));
        return;
      }

      await finalizeConnectedPhone(payload, payload.phoneNumbers);
    };

    window.addEventListener('message', handleEmbeddedSignupMessage);
    return () => window.removeEventListener('message', handleEmbeddedSignupMessage);
  }, [activeWorkspace?.id, embeddedSignupSessionHints, pendingInstagramTokenExpiresAt]);

  const fetchChannels = async () => {
    setIsLoading(true);
    try {
      const [numRes, igRes] = await Promise.all([
        axios.get(`/api/numbers?workspaceId=${activeWorkspace?.id}`),
        axios.get(`/api/instagram/accounts?workspaceId=${activeWorkspace?.id}`).catch(() => ({ data: [] }))
      ]);
      setNumbers(Array.isArray(numRes.data) ? numRes.data : []);
      setIgAccounts(Array.isArray(igRes.data) ? igRes.data : []);
    } catch (error) {
      console.error('Failed to fetch channels', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEmbeddedSignupConfig = async () => {
    setIsLoadingEmbeddedSignupConfig(true);
    try {
      const response = await axios.get('/api/meta/embedded-signup/config');
      setEmbeddedSignupConfig(response.data);
    } catch (error) {
      console.error('Failed to fetch embedded signup config', error);
      setEmbeddedSignupConfig(null);
    } finally {
      setIsLoadingEmbeddedSignupConfig(false);
    }
  };

  const handleDeleteNumber = async (id: string, label: string) => {
    if (!confirm(t('channels.deleteNumber', { label }))) return;
    try {
      await axios.delete(`/api/numbers/${id}`, { headers: { 'x-workspace-id': activeWorkspace?.id } });
      toast.success(t('channels.numberDeleted'));
      fetchChannels();
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('channels.failedToDeleteNumber'));
    }
  };

  const handleConnectWhatsApp = async () => {
    if (waLimitReached) {
      toast.error(t('channels.limitReached', { plan: planInfo.name }));
      return;
    }

    if (!activeWorkspace?.id) {
      toast.error(t('channels.chooseWorkspace'));
      return;
    }

    if (embeddedSignupConfig && !embeddedSignupConfig.enabled) {
      const missingKeys = embeddedSignupConfig.missingKeys?.length
        ? embeddedSignupConfig.missingKeys.join(', ')
        : 'Meta app credentials';
      toast.error(t('channels.embeddedSignupNotConfigured') + '. ' + t('channels.missingMetaKeys', { keys: missingKeys }));
      return;
    }

    setIsConnectingWhatsApp(true);
    setEmbeddedSignupSessionHints(null);
    const popup = window.open(
      '',
      'meta-whatsapp-embedded-signup',
      'width=520,height=760,scrollbars=yes,resizable=yes'
    );

    if (!popup) {
      setIsConnectingWhatsApp(false);
      toast.error(t('channels.popupBlocked'));
      return;
    }

    popup.document.write('<p style="font-family:Arial,sans-serif;padding:24px;">Opening Meta WhatsApp signup...</p>');
    try {
      const response = await axios.get(`/api/meta/embedded-signup/start?workspaceId=${activeWorkspace.id}`);
      const signupUrl = response.data?.url;

      if (!signupUrl) {
        popup.close();
        toast.error('Embedded Signup is not configured yet');
        return;
      }

      popup.location.href = signupUrl;
      popup.focus();
      toast.info('Complete the Meta WhatsApp flow in the popup window.');
    } catch (error) {
      popup.close();
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.error || 'Could not start WhatsApp Embedded Signup');
      } else {
        toast.error('Could not start WhatsApp Embedded Signup');
      }
    } finally {
      setIsConnectingWhatsApp(false);
    }
  };

  const handleConnectInstagram = async () => {
    if (igLimitReached) {
      toast.error(t('channels.limitReached', { plan: planInfo.name }));
      return;
    }

    if (!activeWorkspace?.id) {
      toast.error(t('channels.chooseWorkspace'));
      return;
    }

    setIsConnectingInstagram(true);
    setPendingInstagramAccounts([]);
    setPendingInstagramTokenExpiresAt(null);

    const popup = window.open(
      '',
      'meta-instagram-connect',
      'width=560,height=760,scrollbars=yes,resizable=yes'
    );

    if (!popup) {
      setIsConnectingInstagram(false);
      toast.error(t('channels.popupBlocked'));
      return;
    }

    popup.document.write('<p style="font-family:Arial,sans-serif;padding:24px;">Opening Instagram connection...</p>');
    try {
      const response = await axios.get(`/api/instagram/connect/start?workspaceId=${activeWorkspace.id}`);
      const connectUrl = response.data?.url;

      if (!connectUrl) {
        popup.close();
        toast.error('Instagram connection is not configured yet');
        return;
      }

      popup.location.href = connectUrl;
      popup.focus();
      toast.info('Complete the Meta Instagram flow in the popup window.');
    } catch (error) {
      popup.close();
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.error || 'Could not start Instagram connection');
      } else {
        toast.error('Could not start Instagram connection');
      }
    } finally {
      setIsConnectingInstagram(false);
    }
  };

  const handleFinalizePendingInstagram = async (account: InstagramConnectionAccount) => {
    setIsFinalizingInstagram(true);
    try {
      const response = await axios.post('/api/instagram/connect/finalize', {
        workspaceId: activeWorkspace?.id,
        pageId: account.pageId,
        pageName: account.pageName,
        pageAccessToken: account.pageAccessToken,
        instagramId: account.instagramId,
        username: account.username,
        name: account.name || account.username || account.pageName,
        tokenExpiresAt: pendingInstagramTokenExpiresAt,
      });

      await fetchChannels();
      setPendingInstagramAccounts([]);
      setPendingInstagramTokenExpiresAt(null);
      if (response.data?.webhookSubscribed === false) {
        toast.warning(response.data?.webhookError || 'Instagram connected, but webhook subscription needs attention in Meta.');
      } else {
        toast.success(`Instagram ${account.username ? `@${account.username}` : account.pageName} connected`);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.error || 'Could not save Instagram account');
      } else {
        toast.error('Could not save Instagram account');
      }
    } finally {
      setIsFinalizingInstagram(false);
    }
  };

  return (
    <div className="h-full bg-[#F8F9FA] dark:bg-slate-950 p-8 overflow-y-auto transition-colors">
      {pendingInstagramAccounts.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Choose Instagram account</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Meta returned more than one Page with a linked Instagram account.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPendingInstagramAccounts([]);
                  setPendingInstagramTokenExpiresAt(null);
                }}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-slate-800 dark:hover:text-gray-200"
              >
                <MoreVertical className="h-4 w-4 rotate-90" />
              </button>
            </div>
            <div className="space-y-3">
              {pendingInstagramAccounts.map((account) => (
                <button
                  key={`${account.pageId}-${account.instagramId}`}
                  type="button"
                  disabled={isFinalizingInstagram}
                  onClick={() => handleFinalizePendingInstagram(account)}
                  className="flex w-full items-center gap-3 rounded-xl border border-gray-200 p-4 text-left transition-colors hover:border-pink-300 hover:bg-pink-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:hover:border-pink-900/60 dark:hover:bg-pink-950/20"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white">
                    {isFinalizingInstagram ? <Loader2 className="h-5 w-5 animate-spin" /> : <Instagram className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                      {account.username ? `@${account.username}` : account.name || account.pageName}
                    </p>
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                      Facebook Page: {account.pageName}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Channels</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Connect and manage your WhatsApp & Instagram channels.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end mr-4">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#25D366] uppercase tracking-wider bg-[#25D366]/5 px-3 py-1 rounded-full border border-[#25D366]/10">
                <ShieldCheck className="w-3 h-3" />
                {planInfo.name} Plan
              </div>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                WhatsApp: {numbers.length}/{planInfo.whatsappLimit}
              </p>
            </div>
            <button 
              disabled={waLimitReached || isConnectingWhatsApp || isFinalizingWhatsApp}
              onClick={handleConnectWhatsApp}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-white font-medium rounded-xl transition-all shadow-sm",
                waLimitReached || isConnectingWhatsApp || isFinalizingWhatsApp
                  ? "bg-gray-300 dark:bg-slate-800 cursor-not-allowed"
                  : "bg-[#25D366] hover:bg-[#128C7E]"
              )}
            >
              {isConnectingWhatsApp || isFinalizingWhatsApp ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Plus className="w-5 h-5" />
              )}
              {isFinalizingWhatsApp ? 'Saving Channel...' : isConnectingWhatsApp ? 'Opening Meta...' : 'Connect WhatsApp'}
            </button>
          </div>
        </div>

        {!isLoadingEmbeddedSignupConfig && embeddedSignupConfig && !embeddedSignupConfig.enabled && (
          <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-900 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <h2 className="text-sm font-semibold">Embedded Signup is not configured yet</h2>
                <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
                  Missing Meta environment keys: {(embeddedSignupConfig.missingKeys || []).join(', ') || 'Unknown'}.
                </p>
                {embeddedSignupConfig.callbackUrl && (
                  <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                    Callback URL for Meta: {embeddedSignupConfig.callbackUrl}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {!isLoading && numbers.length === 0 && (
          <div className="mb-8 space-y-6">
            <ActivationChecklist />
            <div className="rounded-2xl border border-dashed border-[#25D366]/30 bg-white p-6 shadow-sm dark:border-[#25D366]/15 dark:bg-slate-900">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Connect your first WhatsApp number</h2>
              <p className="mt-2 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
                Start with one WhatsApp number so the inbox can receive live conversations. After that, assign a bot, import contacts, and launch your first campaign.
              </p>
              <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
                <span className="rounded-full bg-gray-100 px-3 py-1 dark:bg-slate-800">1. Add a WhatsApp number</span>
                <span className="rounded-full bg-gray-100 px-3 py-1 dark:bg-slate-800">2. Test an incoming message</span>
                <span className="rounded-full bg-gray-100 px-3 py-1 dark:bg-slate-800">3. Attach an AI bot</span>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <TawaselLoader size={48} variant="orbit" label={t('common.loading')} />
          </div>
        ) : (
          <div className="space-y-12">
            {/* WhatsApp Section */}
            <section>
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 bg-[#25D366]/10 rounded-lg flex items-center justify-center">
                  <Phone className="w-4 h-4 text-[#25D366]" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">WhatsApp Numbers</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {numbers.map((num) => (
                  <motion.div
                    key={num.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-2 bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-400 rounded-xl transition-colors">
                        <Hash className="w-6 h-6" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                          num.status === 'CONNECTED' ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400" : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                        )}>
                          {num.status}
                        </span>
                        <button className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                          <MoreVertical className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{num.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{num.phoneNumber}</p>
                    {isMetaTestNumber(num.phoneNumber) && (
                      <div className="mt-3 mb-6 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[11px] font-medium text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300">
                        Active Meta test line for webhook and inbox testing.
                      </div>
                    )}
                    {!isMetaTestNumber(num.phoneNumber) && <div className="mb-6" />}

                    <div className="space-y-4 pt-4 border-t border-gray-50 dark:border-slate-800 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Bot className="w-4 h-4 text-[#25D366]" />
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Auto Reply</span>
                        </div>
                        <Switch.Root 
                          checked={num.autoReply}
                          className="w-9 h-5 bg-gray-200 dark:bg-slate-800 rounded-full relative data-[state=checked]:bg-[#25D366] outline-none cursor-pointer transition-colors"
                        >
                          <Switch.Thumb className="block w-4 h-4 bg-white dark:bg-slate-100 rounded-full transition-transform translate-x-0.5 data-[state=checked]:translate-x-[18px]" />
                        </Switch.Root>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Assigned Bot</span>
                        {num.chatbot ? (
                          <span className="px-2 py-1 bg-[#25D366]/10 text-[#25D366] text-[10px] font-bold rounded uppercase">
                            {num.chatbot.name}
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 italic">None</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Connection</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                          {num.connectionSource === 'EMBEDDED_SIGNUP' ? 'Embedded Signup' : 'Manual'}
                        </span>
                      </div>
                      {isMetaTestNumber(num.phoneNumber) && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500 dark:text-gray-400">Test Route</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                            Meta Webhook Live
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-gray-50 dark:border-slate-800 transition-colors">
                      <button className="p-2 text-gray-400 dark:text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
                        <Settings2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteNumber(num.id, num.label || num.phoneNumber)}
                        className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}

                <button 
                  disabled={waLimitReached || isConnectingWhatsApp || isFinalizingWhatsApp}
                  onClick={handleConnectWhatsApp}
                  className={cn(
                    "border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all group min-h-[200px]",
                    waLimitReached || isConnectingWhatsApp || isFinalizingWhatsApp
                      ? "bg-gray-50 dark:bg-slate-900/50 border-gray-200 dark:border-slate-800 cursor-not-allowed"
                      : "bg-gray-50 dark:bg-slate-900/50 border-gray-200 dark:border-slate-800 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                  )}
                >
                  <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform">
                    {isConnectingWhatsApp || isFinalizingWhatsApp ? (
                      <Loader2 className="w-6 h-6 animate-spin text-gray-400 dark:text-gray-500" />
                    ) : (
                      <Plus className={cn("w-6 h-6", waLimitReached ? "text-gray-300 dark:text-gray-700" : "text-gray-400 dark:text-gray-500")} />
                    )}
                  </div>
                  <p className={cn("text-sm font-semibold", waLimitReached ? "text-gray-400 dark:text-gray-600" : "text-gray-600 dark:text-gray-300")}>
                    {isFinalizingWhatsApp ? 'Saving Channel...' : isConnectingWhatsApp ? 'Opening Meta...' : 'Connect WhatsApp'}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {waLimitReached ? `Limit reached for ${planInfo.name} plan` : 'Use Meta Embedded Signup for this workspace'}
                  </p>
                </button>
              </div>
            </section>

            {/* Instagram Section */}
            <section>
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-lg flex items-center justify-center">
                  <Instagram className="w-4 h-4 text-pink-500" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Instagram Accounts</h2>
                <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">
                  {igAccounts.length}/{planInfo.instagramLimit || 1}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {igAccounts.map((account: any) => (
                  <motion.div
                    key={account.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-2 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 text-pink-500 rounded-xl">
                        <Instagram className="w-6 h-6" />
                      </div>
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                        account.status === 'CONNECTED'
                          ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400"
                          : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                      )}>
                        {account.status}
                      </span>
                    </div>

                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{account.name}</h3>
                    {account.username && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">@{account.username}</p>
                    )}
                    <div className="mb-6" />

                    <div className="space-y-4 pt-4 border-t border-gray-50 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Bot className="w-4 h-4 text-pink-500" />
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">AI Chatbot</span>
                        </div>
                        {account.chatbot ? (
                          <span className="px-2 py-1 bg-pink-500/10 text-pink-500 text-[10px] font-bold rounded uppercase">
                            {account.chatbot.name}
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 italic">None</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Instagram ID</span>
                        <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400">
                          {account.instagramId || '—'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-gray-50 dark:border-slate-800">
                      <button
                        onClick={async () => {
                          if (!confirm(`Delete Instagram account "${account.name}"?`)) return;
                          try {
                            await axios.delete(`/api/instagram/accounts/${account.id}`, {
                              headers: { 'x-workspace-id': activeWorkspace?.id }
                            });
                            toast.success('Instagram account removed');
                            fetchChannels();
                          } catch (err: any) {
                            toast.error(err.response?.data?.error || 'Failed to delete');
                          }
                        }}
                        className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}

                <button
                  disabled={igLimitReached || isConnectingInstagram || isFinalizingInstagram}
                  onClick={handleConnectInstagram}
                  className={cn(
                    "border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all group min-h-[200px]",
                    igLimitReached || isConnectingInstagram || isFinalizingInstagram
                      ? "bg-gray-50 dark:bg-slate-900/50 border-gray-200 dark:border-slate-800 cursor-not-allowed"
                      : "bg-gray-50 dark:bg-slate-900/50 border-gray-200 dark:border-slate-800 hover:bg-gray-100 dark:hover:bg-slate-800"
                  )}
                >
                  <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform">
                    {isConnectingInstagram || isFinalizingInstagram ? (
                      <Loader2 className="w-6 h-6 animate-spin text-gray-400 dark:text-gray-500" />
                    ) : (
                      <Instagram className={cn("w-6 h-6", igLimitReached ? "text-gray-300 dark:text-gray-700" : "text-pink-400")} />
                    )}
                  </div>
                  <p className={cn("text-sm font-semibold", igLimitReached ? "text-gray-400 dark:text-gray-600" : "text-gray-600 dark:text-gray-300")}>
                    {isFinalizingInstagram ? 'Saving Instagram...' : isConnectingInstagram ? 'Opening Meta...' : 'Connect Instagram'}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {igLimitReached ? `Limit reached for ${planInfo.name} plan` : 'Receive & reply to Instagram DMs'}
                  </p>
                </button>
              </div>
            </section>

          </div>
        )}
      </div>
    </div>
  );
}
