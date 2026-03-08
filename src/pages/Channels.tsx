import { useState, useEffect } from 'react';
import axios from 'axios';
import { useApp } from '../contexts/AppContext';
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
  Phone
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import * as Switch from '@radix-ui/react-switch';

export default function Channels() {
  const { activeWorkspace } = useApp();
  const [numbers, setNumbers] = useState<any[]>([]);
  const [instagramAccounts, setInstagramAccounts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
    <div className="h-full bg-[#F8F9FA] p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Communication Channels</h1>
            <p className="text-gray-500 mt-1">Connect and manage your WhatsApp and Instagram accounts.</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-pink-600 text-white font-medium rounded-xl hover:bg-pink-700 transition-all shadow-sm">
              <Instagram className="w-4 h-4" />
              Connect Instagram
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white font-medium rounded-xl hover:bg-[#128C7E] transition-all shadow-sm">
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
                <h2 className="text-lg font-semibold text-gray-900">WhatsApp Numbers</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {numbers.map((num) => (
                  <motion.div
                    key={num.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-2 bg-gray-50 text-gray-600 rounded-xl">
                        <Hash className="w-6 h-6" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                          num.status === 'CONNECTED' ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                        )}>
                          {num.status}
                        </span>
                        <button className="p-1 text-gray-400 hover:text-gray-600">
                          <MoreVertical className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    
                    <h3 className="font-semibold text-gray-900 mb-1">{num.name}</h3>
                    <p className="text-sm text-gray-500 mb-6">{num.phoneNumber}</p>

                    <div className="space-y-4 pt-4 border-t border-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Bot className="w-4 h-4 text-[#25D366]" />
                          <span className="text-xs font-medium text-gray-700">Auto Reply</span>
                        </div>
                        <Switch.Root 
                          checked={num.autoReply}
                          className="w-9 h-5 bg-gray-200 rounded-full relative data-[state=checked]:bg-[#25D366] outline-none cursor-pointer transition-colors"
                        >
                          <Switch.Thumb className="block w-4 h-4 bg-white rounded-full transition-transform translate-x-0.5 data-[state=checked]:translate-x-[18px]" />
                        </Switch.Root>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Assigned Bot</span>
                        {num.chatbot ? (
                          <span className="px-2 py-1 bg-[#25D366]/10 text-[#25D366] text-[10px] font-bold rounded uppercase">
                            {num.chatbot.name}
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400 italic">None</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-gray-50">
                      <button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Settings2 className="w-4 h-4" />
                      </button>
                      <button className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}

                <button className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-6 flex flex-col items-center justify-center text-center hover:bg-gray-100 transition-all group min-h-[200px]">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform">
                    <Plus className="w-6 h-6 text-gray-400" />
                  </div>
                  <p className="text-sm font-semibold text-gray-600">Add WhatsApp Number</p>
                  <p className="text-xs text-gray-400 mt-1">Connect your business line</p>
                </button>
              </div>
            </section>

            {/* Instagram Section */}
            <section>
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 bg-pink-50 rounded-lg flex items-center justify-center">
                  <Instagram className="w-4 h-4 text-pink-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Instagram Accounts</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {instagramAccounts.map((acc) => (
                  <motion.div
                    key={acc.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-2 bg-pink-50 text-pink-600 rounded-xl">
                        <Instagram className="w-6 h-6" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                          acc.status === 'CONNECTED' ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                        )}>
                          {acc.status}
                        </span>
                        <button className="p-1 text-gray-400 hover:text-gray-600">
                          <MoreVertical className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    
                    <h3 className="font-semibold text-gray-900 mb-1">{acc.name}</h3>
                    <p className="text-sm text-gray-500 mb-6">@{acc.username}</p>

                    <div className="space-y-4 pt-4 border-t border-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Bot className="w-4 h-4 text-pink-600" />
                          <span className="text-xs font-medium text-gray-700">AI Chatbot</span>
                        </div>
                        <span className="px-2 py-1 bg-pink-50 text-pink-600 text-[10px] font-bold rounded uppercase">
                          {acc.chatbots?.[0]?.name || 'Enabled'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-gray-50">
                      <button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Settings2 className="w-4 h-4" />
                      </button>
                      <button className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}

                <button className="bg-pink-50 border-2 border-dashed border-pink-100 rounded-2xl p-6 flex flex-col items-center justify-center text-center hover:bg-pink-100/50 transition-all group min-h-[200px]">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform">
                    <Instagram className="w-6 h-6 text-pink-400" />
                  </div>
                  <p className="text-sm font-semibold text-pink-600">Connect Instagram</p>
                  <p className="text-xs text-pink-400 mt-1">Manage your DMs</p>
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
