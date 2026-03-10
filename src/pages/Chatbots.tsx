import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useApp } from '../contexts/AppContext';
import { PLANS, PlanType } from '../constants/plans';
import { 
  Bot, 
  Plus, 
  MoreVertical, 
  Hash, 
  CheckCircle2, 
  Settings2, 
  Trash2, 
  ChevronRight,
  Zap,
  MessageSquare,
  Send,
  Loader2,
  SwitchCamera,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import * as Switch from '@radix-ui/react-switch';
import { toast } from 'sonner';

export default function Chatbots() {
  const { activeWorkspace } = useApp();
  const [chatbots, setChatbots] = useState<any[]>([]);
  const [selectedBot, setSelectedBot] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const currentPlan = (activeWorkspace?.plan || 'STARTER') as PlanType;
  const planInfo = PLANS[currentPlan];
  const limitReached = chatbots.length >= planInfo.chatbotLimit;

  useEffect(() => {
    if (activeWorkspace) {
      fetchChatbots();
    } else {
      setIsLoading(false);
    }
  }, [activeWorkspace]);

  const fetchChatbots = async () => {
    try {
      const res = await axios.get(`/api/chatbots?workspaceId=${activeWorkspace?.id}`);
      const data = Array.isArray(res.data) ? res.data : [];
      setChatbots(data);
    } catch (error) {
      console.error('Failed to fetch chatbots', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateChatbot = async () => {
    if (limitReached) {
      toast.error(`Chatbot limit reached for ${planInfo.name} plan`);
      return;
    }

    try {
      const res = await axios.post('/api/chatbots', {
        workspaceId: activeWorkspace?.id,
        name: 'New AI Assistant',
        instructions: 'You are a helpful assistant.',
        model: 'gpt-4o-mini'
      });
      setChatbots([...chatbots, res.data]);
      setSelectedBot(res.data);
      toast.success('New chatbot created');
    } catch (error) {
      console.error('Failed to create chatbot', error);
      toast.error('Failed to create chatbot');
    }
  };

  if (selectedBot) {
    return <ChatbotConfig bot={selectedBot} onBack={() => { setSelectedBot(null); fetchChatbots(); }} />;
  }

  return (
    <div className="h-full bg-[#F8F9FA] dark:bg-slate-950 p-8 overflow-y-auto transition-colors">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">AI Chatbots</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Configure AI-powered automated responses for your WhatsApp numbers.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end mr-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#25D366] uppercase tracking-wider bg-[#25D366]/5 px-3 py-1 rounded-full border border-[#25D366]/10">
                <ShieldCheck className="w-3 h-3" />
                {planInfo.name} Plan
              </div>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                Chatbots: {chatbots.length}/{planInfo.chatbotLimit}
              </p>
            </div>
            <button 
              disabled={limitReached}
              onClick={handleCreateChatbot}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-white font-medium rounded-xl transition-all shadow-sm",
                limitReached ? "bg-gray-300 dark:bg-slate-800 cursor-not-allowed" : "bg-[#25D366] hover:bg-[#128C7E]"
              )}
            >
              <Plus className="w-5 h-5" />
              New AI Chatbot
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-[#25D366] animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {chatbots.map((bot) => (
              <motion.div
                key={bot.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2 bg-[#25D366]/10 text-[#25D366] rounded-xl">
                    <Bot className="w-6 h-6" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch.Root 
                      checked={bot.enabled}
                      className="w-9 h-5 bg-gray-200 dark:bg-slate-800 rounded-full relative data-[state=checked]:bg-[#25D366] outline-none cursor-pointer transition-colors"
                    >
                      <Switch.Thumb className="block w-4 h-4 bg-white dark:bg-slate-100 rounded-full transition-transform translate-x-0.5 data-[state=checked]:translate-x-[18px]" />
                    </Switch.Root>
                    <button className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{bot.name}</h3>
                <div className="flex flex-wrap gap-2 mb-6">
                  {bot.numbers.map((num: any) => (
                    <div key={num.id} className="flex items-center gap-1 px-2 py-1 bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-gray-400 text-[10px] font-medium rounded-lg border border-gray-100 dark:border-slate-700 transition-colors">
                      <Hash className="w-3 h-3" />
                      {num.phoneNumber}
                    </div>
                  ))}
                  {bot.numbers.length === 0 && (
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 italic">No numbers assigned</span>
                  )}
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-gray-50 dark:border-slate-800 transition-colors">
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{bot.tools.length} tools active</span>
                  </div>
                  <button 
                    onClick={() => setSelectedBot(bot)}
                    className="text-xs font-bold text-[#25D366] flex items-center gap-1 group-hover:gap-2 transition-all"
                  >
                    Configure
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ChatbotConfig({ bot, onBack }: { bot: any, onBack: () => void }) {
  const [activeTab, setActiveTab] = useState('info');
  const [testMessages, setTestMessages] = useState<any[]>([]);
  const [testInput, setTestInput] = useState('');
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [name, setName] = useState(bot.name);
  const [instructions, setInstructions] = useState(bot.instructions);
  const [model, setModel] = useState(bot.model || 'gpt-4o-mini');
  const [language, setLanguage] = useState(bot.language || 'en');
  const [enabled, setEnabled] = useState(bot.enabled);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await axios.patch(`/api/chatbots/${bot.id}`, {
        name,
        instructions,
        model,
        language,
        enabled
      });
      toast.success('Chatbot settings saved');
    } catch (error) {
      console.error('Failed to save chatbot', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testInput.trim()) return;

    const userMsg = { id: Date.now().toString(), content: testInput, direction: 'OUTGOING' };
    setTestMessages(prev => [...prev, userMsg]);
    const currentInput = testInput;
    setTestInput('');
    setIsBotTyping(true);

    try {
      const res = await axios.post('/api/chatbots/query', {
        chatbotId: bot.id,
        message: currentInput
      });
      
      const botMsg = { 
        id: Date.now().toString(), 
        content: res.data.response, 
        direction: 'INCOMING' 
      };
      setTestMessages(prev => [...prev, botMsg]);
    } catch (error) {
      console.error('AI Test Error:', error);
      toast.error('Failed to get AI response');
    } finally {
      setIsBotTyping(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900 transition-colors">
      <div className="h-16 border-b border-gray-100 dark:border-slate-800 px-6 flex items-center justify-between shrink-0 transition-colors">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg text-gray-400 dark:text-gray-500 transition-colors">
            <ChevronRight className="w-5 h-5 rotate-180" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#25D366]/10 text-[#25D366] rounded-lg flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <h2 className="font-semibold text-gray-900 dark:text-white">{bot.name}</h2>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Enabled</span>
            <Switch.Root 
              checked={enabled}
              onCheckedChange={setEnabled}
              className="w-9 h-5 bg-gray-200 dark:bg-slate-800 rounded-full relative data-[state=checked]:bg-[#25D366] outline-none cursor-pointer transition-colors"
            >
              <Switch.Thumb className="block w-4 h-4 bg-white dark:bg-slate-100 rounded-full transition-transform translate-x-0.5 data-[state=checked]:translate-x-[18px]" />
            </Switch.Root>
          </div>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-1.5 bg-[#25D366] text-white text-xs font-bold rounded-lg hover:bg-[#128C7E] transition-all disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Config Panel */}
        <div className="w-1/2 border-r border-gray-100 dark:border-slate-800 flex flex-col transition-colors">
          <div className="flex border-b border-gray-100 dark:border-slate-800 transition-colors">
            <button 
              onClick={() => setActiveTab('info')}
              className={cn(
                "px-6 py-4 text-sm font-medium relative transition-colors",
                activeTab === 'info' ? "text-[#25D366]" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              )}
            >
              Bot Info
              {activeTab === 'info' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#25D366]" />}
            </button>
            <button 
              onClick={() => setActiveTab('tools')}
              className={cn(
                "px-6 py-4 text-sm font-medium relative transition-colors",
                activeTab === 'tools' ? "text-[#25D366]" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              )}
            >
              Tools
              {activeTab === 'tools' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#25D366]" />}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 space-y-8">
            {activeTab === 'info' ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Bot Name</label>
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-[#25D366]/10 text-gray-900 dark:text-white transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">AI Model</label>
                  <select 
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl outline-none text-gray-900 dark:text-white transition-colors"
                  >
                    <optgroup label="OpenAI">
                      <option value="gpt-4o-mini">GPT-4o Mini (Fast & Cheap)</option>
                      <option value="gpt-4o">GPT-4o (Powerful)</option>
                      <option value="gpt-5-nano">GPT-5 Nano (Experimental)</option>
                    </optgroup>
                    <optgroup label="Google Gemini">
                      <option value="gemini-1.5-flash">Gemini 1.5 Flash (Fast)</option>
                      <option value="gemini-1.5-pro">Gemini 1.5 Pro (Advanced)</option>
                    </optgroup>
                  </select>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">
                    Select the AI engine that powers this chatbot. OpenAI models require an OpenAI API Key.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Bot Instructions</label>
                  <textarea 
                    rows={8}
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-[#25D366]/10 resize-none text-sm leading-relaxed text-gray-900 dark:text-white transition-colors"
                    placeholder="Describe how the bot should behave..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Default Language</label>
                  <select 
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl outline-none text-gray-900 dark:text-white transition-colors"
                  >
                    <option value="en">English</option>
                    <option value="ar">Arabic</option>
                  </select>
                </div>
              </>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Active Tools</h3>
                  <button className="flex items-center gap-1.5 text-xs font-bold text-[#25D366] uppercase">
                    <Plus className="w-3 h-3" />
                    Add Tool
                  </button>
                </div>
                <div className="space-y-4">
                  {bot.tools.map((tool: any) => (
                    <div key={tool.id} className="p-4 bg-gray-50 dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 flex items-start justify-between transition-colors">
                      <div className="flex gap-3">
                        <div className="p-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm transition-colors">
                          <Zap className="w-4 h-4 text-amber-500" />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{tool.name}</h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{tool.description}</p>
                          <div className="mt-2">
                            <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-[10px] font-bold rounded uppercase">Enabled</span>
                          </div>
                        </div>
                      </div>
                      <button className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Test Panel */}
        <div className="flex-1 flex flex-col bg-[#F8F9FA] dark:bg-slate-950 transition-colors">
          <div className="h-12 px-6 flex items-center border-b border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 transition-colors">
            <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Test Your Bot</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {testMessages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-50">
                <MessageSquare className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Send a message to start testing your bot's responses.</p>
              </div>
            )}
            {testMessages.map((msg) => (
              <div 
                key={msg.id}
                className={cn(
                  "flex flex-col max-w-[80%]",
                  msg.direction === 'OUTGOING' ? "ml-auto items-end" : "mr-auto items-start"
                )}
              >
                <div 
                  className={cn(
                    "px-4 py-2 rounded-2xl text-sm shadow-sm",
                    msg.direction === 'OUTGOING' 
                      ? "bg-[#25D366] text-white rounded-tr-none" 
                      : "bg-white dark:bg-slate-900 text-gray-800 dark:text-gray-200 rounded-tl-none transition-colors"
                  )}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {isBotTyping && (
              <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500">
                <div className="w-8 h-8 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center shadow-sm transition-colors">
                  <Bot className="w-4 h-4 text-[#25D366]" />
                </div>
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-gray-300 dark:bg-slate-700 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-gray-300 dark:bg-slate-700 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-1.5 h-1.5 bg-gray-300 dark:bg-slate-700 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}
          </div>

          <div className="p-4 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 shrink-0 transition-colors">
            <form onSubmit={handleTestSend} className="flex items-center gap-2">
              <input
                type="text"
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                placeholder="Type a test message..."
                className="flex-1 bg-gray-50 dark:bg-slate-800 border-none rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#25D366]/20 outline-none text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 transition-colors"
              />
              <button 
                type="submit"
                disabled={!testInput.trim() || isBotTyping}
                className="p-2.5 bg-[#25D366] text-white rounded-xl hover:bg-[#128C7E] transition-colors disabled:opacity-50"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
