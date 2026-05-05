import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useApp } from '../contexts/AppContext';
import { getPlanConfig, PLANS } from '../constants/plans';
import { 
  Bot, 
  Plus, 
  MoreVertical, 
  Hash, 
  CheckCircle2, 
  ChevronRight,
  Zap,
  MessageSquare,
  Send,
  Loader2,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import * as Switch from '@radix-ui/react-switch';
import { toast } from 'sonner';

const APPENDED_SAFETY_INSTRUCTIONS = `# Safety Instructions
- Respond only to the customer's explicit requests. Do not offer unsolicited actions or promises.
- Use only the business instructions, the current conversation, and information already provided in the chat.
- If information is not available, reply exactly: "Sorry, I don't have information on that."
- Do not invent pricing, policies, delivery times, contact methods, or account status.
- Do not claim to access files, private systems, live databases, or external tools unless the business instructions clearly provide that ability.
- If the customer asks for a human agent or asks for something outside your allowed scope, say a human agent will follow up.
- Do not claim abilities you do not have, such as generating images, videos, or checking third-party systems live.`;

const ABOUT_BUSINESS_TEMPLATE = `## About us

## What makes us different

## Common customer questions
Q:
A:

## Things to mention if relevant
-

## Things to NEVER say
-`;

const ACTION_OPTIONS = [
  { value: 'answer_faqs', labelKey: 'chatbots.actionAnswerFaqs' },
  { value: 'quote_prices', labelKey: 'chatbots.actionQuotePrices' },
  { value: 'book_appointments', labelKey: 'chatbots.actionBookAppointments' },
  { value: 'send_brochures', labelKey: 'chatbots.actionSendBrochures' },
  { value: 'escalate_to_agent', labelKey: 'chatbots.actionEscalate' },
];

const BLOCKED_TOPIC_OPTIONS = [
  { value: 'competitors', labelKey: 'chatbots.blockCompetitors' },
  { value: 'legal_advice', labelKey: 'chatbots.blockLegalAdvice' },
  { value: 'medical_advice', labelKey: 'chatbots.blockMedicalAdvice' },
  { value: 'unauthorized_discounts', labelKey: 'chatbots.blockUnauthorizedDiscounts' },
  { value: 'delivery_promises', labelKey: 'chatbots.blockDeliveryPromises' },
];

function parseJsonList(value: any, fallback: string[] = []) {
  if (Array.isArray(value)) return value.map(String);
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : fallback;
  } catch {
    return fallback;
  }
}

export default function Chatbots() {
  const { t } = useTranslation();
  const { activeWorkspace } = useApp();
  const [chatbots, setChatbots] = useState<any[]>([]);
  const [selectedBot, setSelectedBot] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const currentPlan = activeWorkspace?.plan || 'NONE';
  const planInfo = getPlanConfig(currentPlan) || PLANS.STARTER;
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
      toast.error(t('chatbots.chatbotLimit', { plan: planInfo.name }));
      return;
    }

    try {
      const res = await axios.post('/api/chatbots', {
        workspaceId: activeWorkspace?.id,
        name: 'New AI Assistant',
        instructions: 'You are a helpful assistant.'
      });
      setChatbots([...chatbots, res.data]);
      setSelectedBot(res.data);
      toast.success(t('chatbots.newChatbotCreated'));
    } catch (error) {
      console.error('Failed to create chatbot', error);
      toast.error(t('chatbots.failedToCreate'));
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
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{t('chatbots.title')}</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">{t('chatbots.subtitle')}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end mr-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#25D366] uppercase tracking-wider bg-[#25D366]/5 px-3 py-1 rounded-full border border-[#25D366]/10">
                <ShieldCheck className="w-3 h-3" />
                {t('chatbots.planLabel', { name: planInfo.name })}
              </div>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                {t('chatbots.chatbotsCount', { current: chatbots.length, max: planInfo.chatbotLimit })}
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
              {t('chatbots.newChatbot')}
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
                className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all group"
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
                    <div key={num.id} className="flex items-center gap-1 px-2 py-1 bg-gray-50 dark:bg-slate-800 text-gray-500 dark:text-gray-400 text-[10px] font-medium rounded-lg border border-gray-200 dark:border-slate-700 transition-colors">
                      <Hash className="w-3 h-3" />
                      {num.phoneNumber}
                    </div>
                  ))}
                  {bot.numbers.length === 0 && (
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 italic">{t('chatbots.noNumbersAssigned')}</span>
                  )}
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-gray-50 dark:border-slate-800 transition-colors">
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('chatbots.toolsActive', { count: bot.tools.length })}</span>
                  </div>
                  <button 
                    onClick={() => setSelectedBot(bot)}
                    className="text-xs font-bold text-[#25D366] flex items-center gap-1 group-hover:gap-2 transition-all"
                  >
                    {t('chatbots.configure')}
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
  const { t } = useTranslation();
  const { activeWorkspace } = useApp();
  const [activeTab, setActiveTab] = useState('info');
  const [testMessages, setTestMessages] = useState<any[]>([]);
  const [testInput, setTestInput] = useState('');
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingNumbers, setIsLoadingNumbers] = useState(true);
  
  const [name, setName] = useState(bot.name);
  const [instructions, setInstructions] = useState(bot.instructions);
  const [language, setLanguage] = useState(bot.language || 'en');
  const [personaName, setPersonaName] = useState(bot.personaName || bot.name || '');
  const [industry, setIndustry] = useState(bot.industry || '');
  const [primaryLanguage, setPrimaryLanguage] = useState(bot.primaryLanguage || 'both');
  const [preferredDialect, setPreferredDialect] = useState(bot.preferredDialect || 'auto');
  const [tone, setTone] = useState(bot.tone || 'friendly');
  const [emojiUsage, setEmojiUsage] = useState(bot.emojiUsage || 'sparingly');
  const [responseLength, setResponseLength] = useState(bot.responseLength || 'balanced');
  const [allowedActions, setAllowedActions] = useState<string[]>(
    parseJsonList(bot.allowedActions, ['answer_faqs', 'book_appointments', 'escalate_to_agent'])
  );
  const [blockedTopics, setBlockedTopics] = useState<string[]>(
    parseJsonList(bot.blockedTopics, ['competitors', 'legal_advice', 'medical_advice'])
  );
  const [escalationRules, setEscalationRules] = useState(
    bot.escalationRules || 'Escalate when the customer is angry, asks for a manager, has a complaint, asks for a refund, or when the AI is unsure.'
  );
  const [aboutBusiness, setAboutBusiness] = useState(bot.aboutBusiness || ABOUT_BUSINESS_TEMPLATE);
  const [enabled, setEnabled] = useState(bot.enabled);
  const [availableNumbers, setAvailableNumbers] = useState<any[]>([]);
  const [assignedNumberIds, setAssignedNumberIds] = useState<string[]>(
    Array.isArray(bot.numbers) ? bot.numbers.map((num: any) => num.id) : []
  );

  useEffect(() => {
    setAssignedNumberIds(Array.isArray(bot.numbers) ? bot.numbers.map((num: any) => num.id) : []);
  }, [bot.id, bot.numbers]);

  useEffect(() => {
    const fetchAvailableNumbers = async () => {
      if (!activeWorkspace?.id) {
        setAvailableNumbers([]);
        setIsLoadingNumbers(false);
        return;
      }

      setIsLoadingNumbers(true);
      try {
        const res = await axios.get(`/api/numbers?workspaceId=${activeWorkspace.id}`);
        const fetchedNumbers = Array.isArray(res.data) ? res.data : [];
        setAvailableNumbers(fetchedNumbers);
        setAssignedNumberIds(
          fetchedNumbers
            .filter((number: any) => number.chatbotId === bot.id || number.chatbot?.id === bot.id)
            .map((number: any) => number.id)
        );
      } catch (error) {
        console.error('Failed to fetch WhatsApp channels', error);
        setAvailableNumbers([]);
        toast.error(t('chatbots.failedToLoadChannels'));
      } finally {
        setIsLoadingNumbers(false);
      }
    };

    fetchAvailableNumbers();
  }, [activeWorkspace?.id, bot.id]);

  const toggleAssignedNumber = (numberId: string) => {
    setAssignedNumberIds((current) =>
      current.includes(numberId)
        ? current.filter((id) => id !== numberId)
        : [...current, numberId]
    );
  };

  const toggleListValue = (value: string, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const selectionToSave = [...assignedNumberIds];
      await axios.patch(`/api/chatbots/${bot.id}`, {
        name,
        instructions,
        language,
        personaName,
        industry,
        primaryLanguage,
        preferredDialect,
        tone,
        emojiUsage,
        responseLength,
        allowedActions,
        blockedTopics,
        escalationRules,
        aboutBusiness,
        enabled,
        assignedNumberIds: selectionToSave,
        workspaceId: activeWorkspace?.id
      });

      if (activeWorkspace?.id) {
        const numbersRes = await axios.get(`/api/numbers?workspaceId=${activeWorkspace.id}`);
        const refreshedNumbers = Array.isArray(numbersRes.data) ? numbersRes.data : [];
        setAvailableNumbers(refreshedNumbers);
        setAssignedNumberIds(
          refreshedNumbers
            .filter((number: any) => number.chatbotId === bot.id || number.chatbot?.id === bot.id)
            .map((number: any) => number.id)
        );
      } else {
        setAssignedNumberIds(selectionToSave);
      }

      toast.success(t('chatbots.savedSuccess'));
    } catch (error) {
      console.error('Failed to save chatbot', error);
      toast.error(t('chatbots.savedFailed'));
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
      toast.error(t('chatbots.failedToGetAiResponse'));
    } finally {
      setIsBotTyping(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900 transition-colors">
      <div className="h-16 border-b border-gray-200 dark:border-slate-800 px-6 flex items-center justify-between shrink-0 transition-colors">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg text-gray-400 dark:text-gray-500 transition-colors">
            <ChevronRight className="w-5 h-5 rotate-180" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#25D366]/10 text-[#25D366] rounded-lg flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <h2 className="font-semibold text-gray-900 dark:text-white">{name}</h2>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('chatbots.enabled')}</span>
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
            {isSaving ? t('chatbots.saving') : t('chatbots.saveChanges')}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Config Panel */}
        <div className="w-1/2 border-r border-gray-200 dark:border-slate-800 flex flex-col transition-colors">
          <div className="flex border-b border-gray-200 dark:border-slate-800 transition-colors">
            <button 
              onClick={() => setActiveTab('info')}
              className={cn(
                "px-6 py-4 text-sm font-medium relative transition-colors",
                activeTab === 'info' ? "text-[#25D366]" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              )}
            >
              {t('chatbots.botInfo')}
              {activeTab === 'info' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#25D366]" />}
            </button>
            <button
              onClick={() => setActiveTab('tools')}
              className={cn(
                "px-6 py-4 text-sm font-medium relative transition-colors",
                activeTab === 'tools' ? "text-[#25D366]" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              )}
            >
              {t('chatbots.tools')}
              {activeTab === 'tools' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#25D366]" />}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 space-y-8">
            {activeTab === 'info' ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('chatbots.botName')}</label>
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-[#25D366]/10 text-gray-900 dark:text-white transition-colors"
                  />
                </div>
                <div className="rounded-2xl border border-[#25D366]/15 bg-[#25D366]/5 p-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('chatbots.liveBusinessData')}</h3>
                  <p className="mt-1 text-xs leading-5 text-gray-600 dark:text-gray-400">
                    {t('chatbots.liveBusinessDataDesc')}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-[#128C7E] dark:text-[#25D366]">
                    {t('chatbots.sourcePriority')}
                  </p>
                </div>
                <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('chatbots.aiBehavior')}</h3>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('chatbots.aiBehaviorDesc')}</p>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wide text-gray-500">{t('chatbots.personaName')}</label>
                      <input
                        value={personaName}
                        onChange={(e) => setPersonaName(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#25D366]/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        placeholder="Sara from Salem Salon"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wide text-gray-500">{t('chatbots.industry')}</label>
                      <select value={industry} onChange={(e) => setIndustry(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-900 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                        <option value="">{t('chatbots.notSpecified')}</option>
                        <option value="salon">{t('chatbots.industrySalon')}</option>
                        <option value="clinic">{t('chatbots.industryClinic')}</option>
                        <option value="driving_school">{t('chatbots.industryDrivingSchool')}</option>
                        <option value="gym">{t('chatbots.industryGym')}</option>
                        <option value="services">{t('chatbots.industryServices')}</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wide text-gray-500">{t('chatbots.primaryLanguage')}</label>
                      <select value={primaryLanguage} onChange={(e) => setPrimaryLanguage(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-900 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                        <option value="both">{t('chatbots.languageBoth')}</option>
                        <option value="ar">{t('chatbots.arabic')}</option>
                        <option value="en">{t('chatbots.english')}</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wide text-gray-500">{t('chatbots.preferredDialect')}</label>
                      <select value={preferredDialect} onChange={(e) => setPreferredDialect(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-900 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                        <option value="auto">{t('chatbots.dialectAuto')}</option>
                        <option value="khaleeji">{t('chatbots.dialectKhaleeji')}</option>
                        <option value="msa">{t('chatbots.dialectMsa')}</option>
                        <option value="egyptian">{t('chatbots.dialectEgyptian')}</option>
                        <option value="levantine">{t('chatbots.dialectLevantine')}</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wide text-gray-500">{t('chatbots.tone')}</label>
                      <select value={tone} onChange={(e) => setTone(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-900 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                        <option value="formal">{t('chatbots.toneFormal')}</option>
                        <option value="friendly">{t('chatbots.toneFriendly')}</option>
                        <option value="casual">{t('chatbots.toneCasual')}</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wide text-gray-500">{t('chatbots.emojis')}</label>
                      <select value={emojiUsage} onChange={(e) => setEmojiUsage(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-900 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                        <option value="never">{t('chatbots.never')}</option>
                        <option value="sparingly">{t('chatbots.sparingly')}</option>
                        <option value="freely">{t('chatbots.freely')}</option>
                      </select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-bold uppercase tracking-wide text-gray-500">{t('chatbots.responseLength')}</label>
                      <select value={responseLength} onChange={(e) => setResponseLength(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-900 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                        <option value="short">{t('chatbots.shortDirect')}</option>
                        <option value="balanced">{t('chatbots.balanced')}</option>
                        <option value="detailed">{t('chatbots.detailed')}</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wide text-gray-500">{t('chatbots.aiCanDo')}</label>
                      <div className="space-y-2">
                        {ACTION_OPTIONS.map((option) => (
                          <label key={option.value} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                            <input type="checkbox" checked={allowedActions.includes(option.value)} onChange={() => toggleListValue(option.value, setAllowedActions)} className="h-4 w-4 rounded border-gray-300 text-[#25D366]" />
                            {t(option.labelKey)}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wide text-gray-500">{t('chatbots.aiCannotDo')}</label>
                      <div className="space-y-2">
                        {BLOCKED_TOPIC_OPTIONS.map((option) => (
                          <label key={option.value} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                            <input type="checkbox" checked={blockedTopics.includes(option.value)} onChange={() => toggleListValue(option.value, setBlockedTopics)} className="h-4 w-4 rounded border-gray-300 text-[#25D366]" />
                            {t(option.labelKey)}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wide text-gray-500">{t('chatbots.escalationRules')}</label>
                    <textarea rows={3} value={escalationRules} onChange={(e) => setEscalationRules(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-relaxed text-gray-900 outline-none focus:ring-2 focus:ring-[#25D366]/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('chatbots.aboutBusiness')}</label>
                  <textarea
                    rows={10}
                    value={aboutBusiness}
                    onChange={(e) => setAboutBusiness(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-[#25D366]/10 resize-none text-sm leading-relaxed text-gray-900 dark:text-white transition-colors"
                    placeholder={ABOUT_BUSINESS_TEMPLATE}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('chatbots.botInstructions')}</label>
                  <textarea 
                    rows={8}
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-[#25D366]/10 resize-none text-sm leading-relaxed text-gray-900 dark:text-white transition-colors"
                    placeholder={t('chatbots.instructionsDescPlaceholder')}
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('chatbots.assignedWhatsAppChannels')}</label>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {t('chatbots.assignedChannelsDesc')}
                      </p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:bg-slate-800 dark:text-gray-400">
                      {t('chatbots.selected', { count: assignedNumberIds.length })}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {isLoadingNumbers ? (
                      <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-400">
                        <Loader2 className="h-4 w-4 animate-spin text-[#25D366]" />
                        {t('chatbots.loadingChannels')}
                      </div>
                    ) : availableNumbers.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-4 text-sm text-gray-500 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-400">
                        {t('chatbots.noChannelsConnected')}
                      </div>
                    ) : (
                      availableNumbers.map((number) => {
                        const isSelected = assignedNumberIds.includes(number.id);
                        const assignedElsewhere = number.chatbot && number.chatbot.id !== bot.id;

                        return (
                          <label
                            key={number.id}
                            className={cn(
                              "flex w-full cursor-pointer items-start justify-between rounded-2xl border px-4 py-3 text-left transition-all",
                              isSelected
                                ? "border-[#25D366] bg-[#25D366]/5 shadow-sm"
                                : "border-gray-200 bg-white hover:border-[#25D366]/40 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800",
                            )}
                          >
                            <div className="flex min-w-0 items-start gap-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleAssignedNumber(number.id)}
                                className="mt-1 h-4 w-4 rounded border-gray-300 text-[#25D366] focus:ring-[#25D366]"
                              />
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                    {number.name}
                                  </span>
                                  {assignedElsewhere && (
                                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                                      {t('chatbots.currentlyAssigned', { name: number.chatbot.name })}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                  <Hash className="h-3 w-3" />
                                  {number.phoneNumber}
                                </div>
                                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                                  {isSelected
                                    ? t('chatbots.willAnswerAfterSave')
                                    : t('chatbots.tickToConnect')}
                                </p>
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2 pl-3">
                              <span
                                className={cn(
                                  "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                                  isSelected
                                    ? "bg-[#25D366] text-white"
                                    : "bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-gray-400",
                                )}
                              >
                                {isSelected ? t('chatbots.selectedLabel') : t('chatbots.notAssigned')}
                              </span>
                              <CheckCircle2
                                className={cn(
                                  "h-4 w-4 transition-colors",
                                  isSelected ? "text-[#25D366]" : "text-gray-300 dark:text-gray-600",
                                )}
                              />
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('chatbots.appendedInstructions')}</label>
                    <span className="inline-flex items-center rounded-full bg-[#25D366]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#25D366]">
                      {t('chatbots.alwaysOn')}
                    </span>
                  </div>
                  <textarea
                    rows={8}
                    value={APPENDED_SAFETY_INSTRUCTIONS}
                    readOnly
                    className="w-full resize-none rounded-xl border border-gray-200 bg-gray-100 px-4 py-3 font-mono text-xs leading-relaxed text-gray-600 outline-none transition-colors cursor-not-allowed dark:border-slate-700 dark:bg-slate-800 dark:text-gray-300"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('chatbots.defaultLanguage')}</label>
                  <select 
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl outline-none text-gray-900 dark:text-white transition-colors"
                  >
                    <option value="en">{t('chatbots.english')}</option>
                    <option value="ar">{t('chatbots.arabic')}</option>
                  </select>
                </div>
              </>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('chatbots.activeTools')}</h3>
                  <button className="flex items-center gap-1.5 text-xs font-bold text-[#25D366] uppercase">
                    <Plus className="w-3 h-3" />
                    {t('chatbots.addTool')}
                  </button>
                </div>
                <div className="space-y-4">
                  {bot.tools.map((tool: any) => (
                    <div key={tool.id} className="p-4 bg-gray-50 dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 flex items-start justify-between transition-colors">
                      <div className="flex gap-3">
                        <div className="p-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm transition-colors">
                          <Zap className="w-4 h-4 text-amber-500" />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{tool.name}</h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{tool.description}</p>
                          <div className="mt-2">
                            <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-[10px] font-bold rounded uppercase">{t('common.enabled')}</span>
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
          <div className="h-12 px-6 flex items-center border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 transition-colors">
            <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{t('chatbots.testYourBot')}</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {testMessages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-50">
                <MessageSquare className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('chatbots.testBotEmpty')}</p>
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

          <div className="p-4 bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 shrink-0 transition-colors">
            <form onSubmit={handleTestSend} className="flex items-center gap-2">
              <input
                type="text"
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                placeholder={t('chatbots.testMessagePlaceholder')}
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
