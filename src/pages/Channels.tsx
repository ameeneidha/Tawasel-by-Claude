import { useState, useEffect } from 'react';
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
  Instagram,
  Phone,
  ShieldCheck
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import * as Switch from '@radix-ui/react-switch';
import { toast } from 'sonner';
import ActivationChecklist from '../components/ActivationChecklist';
import { getAllowedMessageOrigins } from '../lib/runtime-config';

export default function Channels() {
  const { activeWorkspace } = useApp();
  const [numbers, setNumbers] = useState<any[]>([]);
  const [instagramAccounts, setInstagramAccounts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnectingWhatsApp, setIsConnectingWhatsApp] = useState(false);
  const [isFinalizingWhatsApp, setIsFinalizingWhatsApp] = useState(false);

  const currentPlan = activeWorkspace?.plan || 'NONE';
  const planInfo = getPlanConfig(currentPlan) || PLANS.STARTER;
  const isMetaTestNumber = (phoneNumber?: string) => phoneNumber?.replace(/\D/g, '') === '15551363768';

  const waLimitReached = numbers.length >= planInfo.whatsappLimit;
  const instaLimitReached = instagramAccounts.length >= planInfo.instagramLimit;

  useEffect(() => {
    if (activeWorkspace) {
      fetchChannels();
    } else {
      setIsLoading(false);
    }
  }, [activeWorkspace]);

  useEffect(() => {
    const handleEmbeddedSignupMessage = async (event: MessageEvent) => {
      const allowedOrigins = getAllowedMessageOrigins();
      if (!allowedOrigins.has(event.origin)) return;
      if (event.data?.type !== 'meta-embedded-signup') return;
      if (!activeWorkspace?.id) return;

      const payload = event.data.payload;
      if (!payload?.success) {
        toast.error(payload?.error || 'WhatsApp Embedded Signup was not completed');
        return;
      }

      const phoneNumbers = Array.isArray(payload.phoneNumbers) ? payload.phoneNumbers : [];
      const selectedPhone = phoneNumbers[0];

      if (!selectedPhone?.phoneNumberId || !selectedPhone?.displayPhoneNumber || !payload?.accessToken) {
        toast.error('Meta did not return a usable WhatsApp phone number');
        return;
      }

      if (payload.workspaceId && payload.workspaceId !== activeWorkspace.id) {
        toast.error('This WhatsApp connection belongs to a different workspace');
        return;
      }

      setIsFinalizingWhatsApp(true);
      try {
        await axios.post('/api/meta/embedded-signup/finalize', {
          workspaceId: activeWorkspace.id,
          phoneNumberId: selectedPhone.phoneNumberId,
          displayPhoneNumber: selectedPhone.displayPhoneNumber,
          wabaId: selectedPhone.wabaId,
          businessId: payload.businessId,
          accessToken: payload.accessToken,
          tokenExpiresAt: payload.tokenExpiresAt,
          verifiedName: selectedPhone.verifiedName,
          businessName: selectedPhone.businessName,
          name: selectedPhone.verifiedName || selectedPhone.businessName || selectedPhone.displayPhoneNumber,
        });

        await fetchChannels();
        toast.success(`Connected ${selectedPhone.displayPhoneNumber}`);

        if (phoneNumbers.length > 1) {
          toast.info('Multiple WhatsApp numbers were returned, so the first available number was connected.');
        }
      } catch (error) {
        if (axios.isAxiosError(error)) {
          toast.error(error.response?.data?.error || 'Could not save WhatsApp channel');
        } else {
          toast.error('Could not save WhatsApp channel');
        }
      } finally {
        setIsFinalizingWhatsApp(false);
      }
    };

    window.addEventListener('message', handleEmbeddedSignupMessage);
    return () => window.removeEventListener('message', handleEmbeddedSignupMessage);
  }, [activeWorkspace?.id]);

  const fetchChannels = async () => {
    setIsLoading(true);
    try {
      const [numRes, instaRes] = await Promise.all([
        axios.get(`/api/numbers?workspaceId=${activeWorkspace?.id}`),
        axios.get(`/api/instagram/accounts?workspaceId=${activeWorkspace?.id}`)
      ]);
      setNumbers(Array.isArray(numRes.data) ? numRes.data : []);
      setInstagramAccounts(Array.isArray(instaRes.data) ? instaRes.data : []);
    } catch (error) {
      console.error('Failed to fetch channels', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectWhatsApp = async () => {
    if (waLimitReached) {
      toast.error(`Limit reached for ${planInfo.name} plan`);
      return;
    }

    if (!activeWorkspace?.id) {
      toast.error('Choose a workspace before connecting WhatsApp');
      return;
    }

    setIsConnectingWhatsApp(true);
    const popup = window.open(
      '',
      'meta-whatsapp-embedded-signup',
      'width=520,height=760,scrollbars=yes,resizable=yes'
    );

    if (!popup) {
      setIsConnectingWhatsApp(false);
      toast.error('Popup was blocked. Allow popups and try again.');
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

  return (
    <div className="h-full bg-[#F8F9FA] dark:bg-slate-950 p-8 overflow-y-auto transition-colors">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Communication Channels</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Connect and manage your WhatsApp and Instagram accounts.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end mr-4">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#25D366] uppercase tracking-wider bg-[#25D366]/5 px-3 py-1 rounded-full border border-[#25D366]/10">
                <ShieldCheck className="w-3 h-3" />
                {planInfo.name} Plan
              </div>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                WhatsApp: {numbers.length}/{planInfo.whatsappLimit} • Instagram: {instagramAccounts.length}/{planInfo.instagramLimit}
              </p>
            </div>
            <button 
              disabled={instaLimitReached}
              onClick={() => instaLimitReached ? toast.error(`Limit reached for ${planInfo.name} plan`) : null}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-white font-medium rounded-xl transition-all shadow-sm",
                instaLimitReached ? "bg-gray-300 dark:bg-slate-800 cursor-not-allowed" : "bg-pink-600 hover:bg-pink-700"
              )}
            >
              <Instagram className="w-4 h-4" />
              Connect Instagram
            </button>
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

        {!isLoading && numbers.length === 0 && instagramAccounts.length === 0 && (
          <div className="mb-8 space-y-6">
            <ActivationChecklist />
            <div className="rounded-3xl border border-dashed border-[#25D366]/30 bg-white p-6 shadow-sm dark:border-[#25D366]/15 dark:bg-slate-900">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Connect your first channel</h2>
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
            <Loader2 className="w-8 h-8 text-[#25D366] animate-spin" />
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
                    className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group"
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
                      <button className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
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
                <div className="w-8 h-8 bg-pink-50 dark:bg-pink-900/20 rounded-lg flex items-center justify-center">
                  <Instagram className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Instagram Accounts</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {instagramAccounts.map((acc) => (
                  <motion.div
                    key={acc.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-2 bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 rounded-xl transition-colors">
                        <Instagram className="w-6 h-6" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                          acc.status === 'CONNECTED' ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400" : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                        )}>
                          {acc.status}
                        </span>
                        <button className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                          <MoreVertical className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{acc.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">@{acc.username}</p>

                    <div className="space-y-4 pt-4 border-t border-gray-50 dark:border-slate-800 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Bot className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">AI Chatbot</span>
                        </div>
                        <span className="px-2 py-1 bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 text-[10px] font-bold rounded uppercase">
                          {acc.chatbots?.[0]?.name || 'Enabled'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-gray-50 dark:border-slate-800 transition-colors">
                      <button className="p-2 text-gray-400 dark:text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
                        <Settings2 className="w-4 h-4" />
                      </button>
                      <button className="p-2 text-gray-400 dark:text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}

                <button 
                  disabled={instaLimitReached}
                  onClick={() => instaLimitReached ? toast.error(`Limit reached for ${planInfo.name} plan`) : null}
                  className={cn(
                    "border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all group min-h-[200px]",
                    instaLimitReached ? "bg-pink-50/20 dark:bg-pink-900/10 border-pink-100 dark:border-pink-900/30 cursor-not-allowed" : "bg-pink-50 dark:bg-pink-900/10 border-pink-100 dark:border-pink-900/30 hover:bg-pink-100/50 dark:hover:bg-pink-900/20 transition-colors"
                  )}
                >
                  <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform">
                    <Instagram className={cn("w-6 h-6", instaLimitReached ? "text-pink-200 dark:text-pink-900" : "text-pink-400 dark:text-pink-500")} />
                  </div>
                  <p className={cn("text-sm font-semibold", instaLimitReached ? "text-pink-300 dark:text-pink-800" : "text-pink-600 dark:text-pink-400")}>Connect Instagram</p>
                  <p className="text-xs text-pink-400 dark:text-pink-500 mt-1">
                    {instaLimitReached ? `Limit reached for ${planInfo.name} plan` : 'Manage your DMs'}
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
