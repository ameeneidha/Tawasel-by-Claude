import { useState, useEffect } from 'react';
import axios from 'axios';
import { useApp } from '../contexts/AppContext';
import { PLANS, PlanType } from '../constants/plans';
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

export default function Channels() {
  const { activeWorkspace } = useApp();
  const [numbers, setNumbers] = useState<any[]>([]);
  const [instagramAccounts, setInstagramAccounts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const currentPlan = (activeWorkspace?.plan || 'STARTER') as PlanType;
  const planInfo = PLANS[currentPlan];

  const waLimitReached = numbers.length >= planInfo.whatsappLimit;
  const instaLimitReached = instagramAccounts.length >= planInfo.instagramLimit;

  useEffect(() => {
    if (activeWorkspace) {
      fetchChannels();
    } else {
      setIsLoading(false);
    }
  }, [activeWorkspace]);

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
              disabled={waLimitReached}
              onClick={() => waLimitReached ? toast.error(`Limit reached for ${planInfo.name} plan`) : null}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-white font-medium rounded-xl transition-all shadow-sm",
                waLimitReached ? "bg-gray-300 dark:bg-slate-800 cursor-not-allowed" : "bg-[#25D366] hover:bg-[#128C7E]"
              )}
            >
              <Plus className="w-5 h-5" />
              New WhatsApp Number
            </button>
          </div>
        </div>

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
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{num.phoneNumber}</p>

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
                  disabled={waLimitReached}
                  onClick={() => waLimitReached ? toast.error(`Limit reached for ${planInfo.name} plan`) : null}
                  className={cn(
                    "border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all group min-h-[200px]",
                    waLimitReached ? "bg-gray-50 dark:bg-slate-900/50 border-gray-200 dark:border-slate-800 cursor-not-allowed" : "bg-gray-50 dark:bg-slate-900/50 border-gray-200 dark:border-slate-800 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                  )}
                >
                  <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform">
                    <Plus className={cn("w-6 h-6", waLimitReached ? "text-gray-300 dark:text-gray-700" : "text-gray-400 dark:text-gray-500")} />
                  </div>
                  <p className={cn("text-sm font-semibold", waLimitReached ? "text-gray-400 dark:text-gray-600" : "text-gray-600 dark:text-gray-300")}>Add WhatsApp Number</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {waLimitReached ? `Limit reached for ${planInfo.name} plan` : 'Connect your business line'}
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
