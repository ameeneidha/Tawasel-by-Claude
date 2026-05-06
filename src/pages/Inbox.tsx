import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import socket from '../lib/socket';
import { 
  Search, 
  Filter, 
  MoreVertical, 
  ChevronDown,
  Smile, 
  Paperclip, 
  FileText, 
  Mic, 
  Send,
  User,
  Phone,
  Edit2,
  Check,
  CheckCheck,
  Loader2,
  MessageSquare,
  Instagram,
  Users,
  Plus,
  ShieldAlert,
  Bot,
  BotOff,
  Reply,
  X,
  Trash2,
  ArrowLeft,
  PanelRightOpen
} from 'lucide-react';
import { cn, getDisplayName } from '../lib/utils';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { summarizeConversation } from '../services/aiService';
import ActivationChecklist from '../components/ActivationChecklist';
import { toast } from 'sonner';
import ContactListPicker from '../components/ContactListPicker';
import AppTooltip from '../components/AppTooltip';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_PIPELINE_STAGE_KEY,
  getFallbackPipelineStageKey,
  getPipelineStageColor,
  PipelineStage,
} from '../lib/pipelineStages';

interface Message {
  id: string;
  content: string;
  type: 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'AUDIO' | 'TEMPLATE' | string;
  mediaId?: string | null;
  mediaMimeType?: string | null;
  mediaFilename?: string | null;
  transcription?: string | null;
  transcriptionLang?: string | null;
  transcriptionStatus?: 'NONE' | 'PENDING' | 'COMPLETED' | 'FAILED' | string;
  transcriptionError?: string | null;
  transcribedAt?: string | null;
  direction: 'INCOMING' | 'OUTGOING';
  senderType: 'USER' | 'AI_BOT' | 'SYSTEM';
  senderName?: string;
  status: string;
  metaMessageId?: string | null;
  replyToId?: string | null;
  isInternal?: boolean;
  createdAt: string;
  conversationId: string;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'PENDING' | 'COMPLETED';
}

interface Activity {
  id: string;
  type: string;
  content: string;
  createdAt: string;
}

interface ContactListOption {
  id: string;
  name: string;
}

interface PendingAttachment {
  id: string;
  file: File;
}

interface SessionTemplate {
  id: string;
  name: string;
  content: string;
}

interface Conversation {
  id: string;
  channelType: 'WHATSAPP' | 'INSTAGRAM';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  internalStatus: 'OPEN' | 'WAITING_FOR_CUSTOMER' | 'WAITING_FOR_INTERNAL' | 'RESOLVED';
  aiPaused?: boolean;
  slaStatus: 'OK' | 'BREACHED';
  slaDeadline?: string;
  assignedToId?: string;
  assignedTo?: {
    id: string;
    name: string;
    image?: string;
  };
  tags?: string;
  contact: {
    id: string;
    name: string;
    phoneNumber?: string;
    instagramId?: string;
    instagramScopedUserId?: string;
    instagramUsername?: string;
    avatar?: string;
    pipelineStage: string;
    leadSource?: string;
    activities?: Activity[];
    tasks?: Task[];
    listMemberships?: {
      list: ContactListOption;
    }[];
  };
  messages: Message[];
  lastMessageAt: string;
  number?: {
    phoneNumber: string;
    autoReply?: boolean;
    chatbotId?: string | null;
    chatbot?: {
      id: string;
      name: string;
      enabled: boolean;
    } | null;
  };
  instagramAccount?: {
    username: string;
    chatbotId?: string | null;
    chatbot?: {
      id: string;
      name: string;
      enabled: boolean;
    } | null;
  };
  tasks?: Task[];
  activities?: Activity[];
  unreadCount?: number;
}

const QUICK_EMOJIS = ['\u{1F642}', '\u{1F44D}', '\u{1F64F}', '\u{1F525}', '\u{2705}', '\u{1F389}', '\u{1F4DE}', '\u{1F440}'];

const getConversationContactLabel = (contact?: Conversation['contact']) => {
  if (contact?.instagramUsername?.trim()) return `@${contact.instagramUsername.trim()}`;
  if (contact?.name?.trim()) return contact.name.trim();
  if (contact?.phoneNumber?.trim()) return contact.phoneNumber.trim();
  if (contact?.instagramScopedUserId?.trim()) return `IG User ${contact.instagramScopedUserId.trim().slice(-4)}`;
  if (contact?.instagramId?.trim()) return `IG User ${contact.instagramId.trim().slice(-4)}`;
  return 'Unknown Contact';
};

const getMessagePreview = (message?: Message | null) => {
  if (!message) return 'No messages';
  if (message.type === 'AUDIO') {
    if (message.transcriptionStatus === 'COMPLETED' && message.transcription?.trim()) {
      return message.transcription.trim();
    }
    if (message.transcriptionStatus === 'PENDING') return 'Voice note - transcribing...';
    if (message.transcriptionStatus === 'FAILED') return 'Voice note - transcription unavailable';
    return message.content || 'Voice note';
  }
  if (message.type === 'IMAGE') return message.content && message.content !== '[Image]' ? message.content : 'Photo';
  if (message.type === 'DOCUMENT') return message.mediaFilename || message.content || 'Document';
  return message.content || 'No messages';
};

const getInitials = (value?: string | null) => {
  const cleaned = (value || '').trim();
  if (!cleaned) return '??';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
};

function MessageMedia({ message }: { message: Message }) {
  const { t } = useTranslation();
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(message.mediaId));
  const [error, setError] = useState<string | null>(null);
  const [isRetryingTranscription, setIsRetryingTranscription] = useState(false);

  useEffect(() => {
    if (!message.mediaId) {
      setMediaUrl(null);
      setIsLoading(false);
      return;
    }

    let isActive = true;
    let objectUrl: string | null = null;

    setIsLoading(true);
    setError(null);

    axios
      .get(`/api/messages/${message.id}/media`, { responseType: 'blob' })
      .then((response) => {
        objectUrl = URL.createObjectURL(response.data);
        if (!isActive) return;
        setMediaUrl(objectUrl);
      })
      .catch((err) => {
        if (!isActive) return;
        if (axios.isAxiosError(err)) {
          setError(err.response?.data?.error || 'Could not load media');
        } else {
          setError('Could not load media');
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [message.id, message.mediaId]);

  const filename = message.mediaFilename || 'Attachment';
  const isImage = message.type === 'IMAGE';
  const isAudio = message.type === 'AUDIO';
  const isDocument = message.type === 'DOCUMENT';
  const trimmedContent = message.content?.trim() || '';
  const hideDefaultLabel =
    trimmedContent === '[Image]' ||
    trimmedContent === '[Audio]' ||
    trimmedContent === '[Voice note]' ||
    trimmedContent === `[Document] ${filename}`;

  return (
    <div className="space-y-2">
      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t('inbox.loadingMedia')}
        </div>
      )}

      {!isLoading && error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {!isLoading && !error && mediaUrl && isImage && (
        <a href={mediaUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl">
          <img
            src={mediaUrl}
            alt={filename}
            className="max-h-72 w-full rounded-2xl object-cover"
          />
        </a>
      )}

      {!isLoading && !error && mediaUrl && isAudio && (
        <div className="space-y-2">
          <audio controls className="max-w-full">
            <source src={mediaUrl} type={message.mediaMimeType || undefined} />
          </audio>
          <a
            href={mediaUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#25D366]"
          >
            <Mic className="h-3.5 w-3.5" />
            {t('inbox.downloadAudio')}
          </a>
        </div>
      )}

      {isAudio && (
        <div className="rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-2 text-xs text-gray-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-gray-200">
          {message.transcriptionStatus === 'COMPLETED' && message.transcription?.trim() ? (
            <div className="space-y-1">
              <div className="font-semibold uppercase tracking-wide text-[10px] text-gray-400">
                {t('inbox.transcription')}
              </div>
              <div className="whitespace-pre-wrap break-words leading-relaxed">{message.transcription}</div>
            </div>
          ) : message.transcriptionStatus === 'FAILED' ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-red-500">{t('inbox.transcriptionUnavailable')}</span>
              <button
                type="button"
                disabled={isRetryingTranscription}
                onClick={async () => {
                  setIsRetryingTranscription(true);
                  try {
                    await axios.post(`/api/messages/${message.id}/transcribe/retry`);
                    toast.success(t('inbox.transcriptionRetryQueued'));
                  } catch (err) {
                    toast.error(t('inbox.transcriptionRetryFailed'));
                  } finally {
                    setIsRetryingTranscription(false);
                  }
                }}
                className="rounded-lg bg-white px-2 py-1 text-[10px] font-semibold text-[#128C7E] shadow-sm transition hover:bg-[#25D366]/10 disabled:opacity-60 dark:bg-slate-800"
              >
                {isRetryingTranscription ? t('common.loading') : t('common.retry')}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t('inbox.transcribing')}
            </div>
          )}
        </div>
      )}

      {!isLoading && !error && mediaUrl && isDocument && (
        <a
          href={mediaUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white/70 px-3 py-2 text-left text-sm text-gray-700 transition hover:border-[#25D366] hover:text-[#25D366] dark:border-slate-700 dark:bg-slate-900/40 dark:text-gray-200"
        >
          <FileText className="h-4 w-4 shrink-0" />
          <span className="truncate">{filename}</span>
        </a>
      )}

      {trimmedContent && !hideDefaultLabel && (
        <div className="whitespace-pre-wrap break-words">{trimmedContent}</div>
      )}
    </div>
  );
}

function QuoteThumbnail({ message }: { message: Message }) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!message.mediaId) return;
    let objectUrl: string | null = null;
    axios
      .get(`/api/messages/${message.id}/media`, { responseType: 'blob' })
      .then((res) => {
        objectUrl = URL.createObjectURL(res.data);
        setThumbUrl(objectUrl);
      })
      .catch(() => {});
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [message.id, message.mediaId]);

  if (!thumbUrl) return null;
  return (
    <img
      src={thumbUrl}
      alt="Quote"
      className="w-10 h-10 rounded object-cover flex-shrink-0"
    />
  );
}

function isMobileViewport() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;
}

export default function Inbox() {
  const { t } = useTranslation();
  const { activeWorkspace, workspaces, setActiveWorkspace, user, hasFullAccess, hasVerifiedEmail } = useApp();
  const currentUserDisplayName = getDisplayName(user?.name, user?.email);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isInternalMode, setIsInternalMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [rightTab, setRightTab] = useState<'info' | 'tasks' | 'activity'>('info');
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [slaBreachAlert, setSlaBreachAlert] = useState<string | null>(null);
  const [mobileContactPanel, setMobileContactPanel] = useState(false);
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [sessionTemplates, setSessionTemplates] = useState<SessionTemplate[]>([]);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);
  const [templatePickerSearch, setTemplatePickerSearch] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [showConvMenu, setShowConvMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [channelFilter, setChannelFilter] = useState<'ALL' | 'WHATSAPP' | 'INSTAGRAM'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'WAITING_FOR_CUSTOMER' | 'WAITING_FOR_INTERNAL' | 'RESOLVED'>('ALL');
  const [listFilter, setListFilter] = useState<'ALL' | 'UNREAD' | 'MINE' | 'OVERDUE'>('ALL');
  const [contactDraft, setContactDraft] = useState({ name: '', phoneNumber: '', listNames: [] as string[] });
  const [contactLists, setContactLists] = useState<ContactListOption[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const isRestrictedMode = !hasFullAccess;
  const filteredConversations = conversations.filter((conversation) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      query.length === 0 ||
      (conversation.contact.name || '').toLowerCase().includes(query) ||
      (conversation.contact.phoneNumber || '').toLowerCase().includes(query) ||
      (conversation.contact.instagramUsername || '').toLowerCase().includes(query) ||
      (conversation.messages?.[0]?.content || '').toLowerCase().includes(query);

    const matchesChannel = channelFilter === 'ALL' || conversation.channelType === channelFilter;
    const matchesStatus = statusFilter === 'ALL' || conversation.internalStatus === statusFilter;
    const matchesListFilter =
      listFilter === 'ALL' ||
      (listFilter === 'UNREAD' && (conversation.unreadCount || 0) > 0) ||
      (listFilter === 'MINE' && Boolean(user?.id && conversation.assignedToId === user.id)) ||
      (listFilter === 'OVERDUE' && conversation.slaStatus === 'BREACHED');

    return matchesSearch && matchesChannel && matchesStatus && matchesListFilter;
  });
  const unreadConversationCount = conversations.filter((conversation) => (conversation.unreadCount || 0) > 0).length;
  const myConversationCount = conversations.filter((conversation) => user?.id && conversation.assignedToId === user.id).length;
  const overdueConversationCount = conversations.filter((conversation) => conversation.slaStatus === 'BREACHED').length;
  const activePipelineStageKey =
    selectedConv?.contact.pipelineStage ||
    getFallbackPipelineStageKey(pipelineStages) ||
    DEFAULT_PIPELINE_STAGE_KEY;
  const activePipelineStageColor = getPipelineStageColor(pipelineStages, activePipelineStageKey);

  const filteredSessionTemplates = useMemo(() => {
    const query = templatePickerSearch.trim().toLowerCase();
    if (!query) {
      return sessionTemplates;
    }

    return sessionTemplates.filter((template) =>
      [template.name, template.content].join(' ').toLowerCase().includes(query)
    );
  }, [sessionTemplates, templatePickerSearch]);

  useEffect(() => {
    if (activeWorkspace) {
      fetchConversations();
      fetchContactLists();
      fetchSessionTemplates();
      fetchPipelineStages();
      
      // Socket.io setup
      socket.connect();
      socket.emit('join-workspace', activeWorkspace.id);

      socket.on('new-message', (message: Message) => {
        // Update messages if it belongs to the selected conversation
        if (selectedConv && message.conversationId === selectedConv.id) {
          setMessages(prev => {
            // Avoid duplicates
            if (prev.find(m => m.id === message.id)) return prev;
            return [...prev, message];
          });
          loadConversationDetails(message.conversationId);
        }
        
        // Update conversation list last message
        setConversations(prev => prev.map(conv => {
          if (conv.id === message.conversationId) {
            return {
              ...conv,
              messages: [message],
              lastMessageAt: message.createdAt
            };
          }
          return conv;
        }).sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()));
      });

      socket.on('conversation-updated', (convId: string) => {
        fetchConversations(convId);
        if (selectedConv?.id === convId) {
          loadConversationDetails(convId);
        }
      });

      socket.on('conversation-deleted', (convId: string) => {
        setConversations(prev => prev.filter(c => c.id !== convId));
        if (selectedConv?.id === convId) {
          setSelectedConv(null);
          setMessages([]);
        }
      });

      // Real-time delivery status updates (SENT → DELIVERED → READ)
      socket.on('message-status-updated', (data: { messageId: string; conversationId: string; status: string }) => {
        if (selectedConv && data.conversationId === selectedConv.id) {
          setMessages(prev => prev.map(msg =>
            msg.id === data.messageId ? { ...msg, status: data.status } : msg
          ));
        }
      });

      socket.on('message-transcribed', (data: Partial<Message> & { messageId: string; conversationId: string }) => {
        const applyTranscription = (msg: Message): Message =>
          msg.id === data.messageId
            ? {
                ...msg,
                transcription: data.transcription ?? msg.transcription,
                transcriptionLang: data.transcriptionLang ?? msg.transcriptionLang,
                transcriptionStatus: data.transcriptionStatus ?? msg.transcriptionStatus,
                transcriptionError: data.transcriptionError ?? msg.transcriptionError,
                transcribedAt: data.transcribedAt ?? msg.transcribedAt,
              }
            : msg;

        if (selectedConv && data.conversationId === selectedConv.id) {
          setMessages(prev => prev.map(applyTranscription));
        }

        setConversations(prev => prev.map(conv => {
          if (conv.id !== data.conversationId) return conv;
          return {
            ...conv,
            messages: conv.messages.map(applyTranscription),
          };
        }));
      });

      // AI Escalation notification — agent needs to take over
      socket.on('ai-escalation', (data: { conversationId: string; contactName: string; reason: string }) => {
        // Play notification sound
        try {
          const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2JkpuTj4eDfnl4eH19hIuTm5+dm5eSjIZ/eHRxcXR5gIiQl5yenp2alI6HgHp1cXBydnyDi5KYnJ6enZqVj4mCfHZycHJ2fISLkpibnp6dmpiSjIV/eXRxcnZ8g4qRl5udnp2bmpSPiYJ8dnJwcnV7goqRl5ucnZ2cmZWQioN9d3JxcnV7gYmQlpucnZ2cmZWQioN9d3NxcnV7gYiQlpqcnZycmZWQi4R+eHNxcnR6gIiPlpqcnJ2cmZaRi4R+eHNxcnR6gIiPlpmcnJ2cmZaRi4V+eHRycnR6gIePlpmbnJ2cmZaRjIV/eXRycnR6f4ePlpmbnJ2cmZaRjIV/eXRycnR5f4ePlpmbnJ2cmJaRjIV/eXRycnR5f4ePlpmbnJycmJaRjIV/eXRycXR5f4ePlpmbnJycmJaSjIV/eXRxcnR5f4eOlZmbnJycmJaSjIV/eXRxcnR5f4eOlZmbnJycmJaSjIZ/eXVycnR5f4eOlZmbnJycmJaSjIZ/eXVycnR5f4eOlZmbnJycl5aSjIZ/enVycnR5f4eOlZmbnJybmJaSjIaAenVycnR5f4eOlZmbnJybmJaSjIaAenVycnR5foaOlZmbnJybmJaSjIaAenVycnR5foaOlZibnJybmJaSjIaAenVycXR5foaOlZibnJybmJaTjIaAenVycXR5foaOlZibnJybmJaTjIaAenVycXR5foaOlZibnJybmJaTjIaAenVycXR5foaOlZibnJybmJaTjIaAenVycXR5foaOlJibnJybmJaTjIaAe3VycXR5foWOlJibnJybmJaTjIaAe3VycXR4foWOlJibm5ybmJaTjIaAe3VycXR4foWNlJibm5ybmJaTjIeBe3ZycXR4foWNlJibm5ybmJaTjYeBe3ZycXR4foWNlJibm5ubmJaTjYeBe3ZycXR4foWNlJibm5ubmJaTjYeBe3ZycXR4foWNlJibm5ubmJaTjYeBe3ZycXR4foWNlJibm5ubmJaTjYeBe3ZycXR4foWNlJiamJaTjYeBe3ZycXR4foWNlJiamJaTjYeBe3ZycXR4fg==');
          audio.volume = 0.5;
          audio.play().catch(() => {});
        } catch {}

        // Show toast notification
        toast.warning(`🔔 Agent needed: ${data.contactName}`, {
          description: data.reason,
          duration: 10000,
          action: {
            label: 'Open',
            onClick: () => {
              // Find and select the escalated conversation
              setConversations(prev => {
                const conv = prev.find(c => c.id === data.conversationId);
                if (conv) setSelectedConv(conv);
                return prev;
              });
            },
          },
        });

        // Refresh conversation list to show updated status
        fetchConversations(data.conversationId);
      });

      return () => {
        socket.off('new-message');
        socket.off('conversation-updated');
        socket.off('conversation-deleted');
        socket.off('message-status-updated');
        socket.off('message-transcribed');
        socket.off('ai-escalation');
        socket.disconnect();
      };
    } else {
      setIsLoading(false);
    }
  }, [activeWorkspace, selectedConv?.id]);

  useEffect(() => {
    if (selectedConv) {
      loadConversationDetails(selectedConv.id);
      setSummary(null);
    }
  }, [selectedConv?.id]);

  useEffect(() => {
    if (selectedConv) {
      setContactDraft({
        name: selectedConv.contact.name || '',
        phoneNumber: selectedConv.contact.phoneNumber || '',
        listNames: selectedConv.contact.listMemberships?.map((membership) => membership.list.name) || []
      });
    }
  }, [selectedConv?.id, selectedConv?.contact.name, selectedConv?.contact.phoneNumber, selectedConv?.contact.listMemberships]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchConversations = async (focusConversationId?: string) => {
    try {
      const res = await axios.get(`/api/conversations?workspaceId=${activeWorkspace?.id}`);
      const data = Array.isArray(res.data) ? res.data : [];
      setConversations(data);
      
      // Check for new SLA breaches
      const breached = data.find(c => c.slaStatus === 'BREACHED');
      if (breached) {
        setSlaBreachAlert(`Urgent: Conversation with ${breached.contact.name || breached.contact.phoneNumber} has breached SLA!`);
      } else {
        setSlaBreachAlert(null);
      }

      if (focusConversationId) {
        const refreshedConversation = data.find(conversation => conversation.id === focusConversationId);
        if (refreshedConversation) {
          setSelectedConv(prev => {
            if (prev && prev.id !== focusConversationId) return prev;
            return {
              ...(prev || refreshedConversation),
              ...refreshedConversation,
              messages: prev?.messages || refreshedConversation.messages,
              tasks: prev?.tasks || refreshedConversation.tasks,
              activities: prev?.activities || refreshedConversation.activities,
              contact: {
                ...refreshedConversation.contact,
                tasks: prev?.contact?.tasks || refreshedConversation.contact.tasks,
                activities: prev?.contact?.activities || refreshedConversation.contact.activities,
              },
            };
          });
        }
      }

      if (data.length > 0 && !selectedConv && !isMobileViewport()) {
        setSelectedConv(data[0]);
      }
    } catch (error) {
      console.error('Failed to fetch conversations', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchContactLists = async () => {
    try {
      const res = await axios.get(`/api/contact-lists?workspaceId=${activeWorkspace?.id}`);
      setContactLists(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Failed to fetch contact lists', error);
    }
  };

  const fetchSessionTemplates = async () => {
    if (!activeWorkspace?.id) {
      setSessionTemplates([]);
      return;
    }

    try {
      const res = await axios.get(`/api/templates/session?workspaceId=${activeWorkspace.id}`);
      setSessionTemplates(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Failed to fetch session templates', error);
    }
  };

  const fetchPipelineStages = async () => {
    if (!activeWorkspace?.id) {
      setPipelineStages([]);
      return;
    }

    try {
      const res = await axios.get(`/api/pipeline-stages?workspaceId=${activeWorkspace.id}`);
      setPipelineStages(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Failed to fetch pipeline stages', error);
    }
  };

  const loadConversationDetails = async (id: string) => {
    try {
      const res = await axios.get(`/api/conversations/${id}`);
      const conversation = res.data;
      const data = conversation?.messages || [];
      setMessages(data);
      setSelectedConv(prev => {
        if (prev && prev.id !== id) return prev;
        return conversation;
      });
      setConversations(prev =>
        prev.map(conv =>
          conv.id === id
            ? {
                ...conv,
                unreadCount: 0,
              }
            : conv
        )
      );
    } catch (error) {
      console.error('Failed to fetch messages', error);
    }
  };

  const updateConversation = async (id: string, data: Partial<Conversation>) => {
    if (isRestrictedMode) return;
    try {
      const res = await axios.patch(`/api/conversations/${id}`, data);
      const updated = res.data;
      setSelectedConv(prev => prev && prev.id === id ? { ...prev, ...updated } : prev);
      setConversations(prev => prev.map(conv => conv.id === id ? { ...conv, ...updated } : conv));
      loadConversationDetails(id);
      fetchConversations(id);
    } catch (error) {
      console.error('Failed to update conversation', error);
    }
  };

  const fetchSummary = async () => {
    if (!selectedConv) return;
    setIsSummarizing(true);
    try {
      const history = messages
        .filter(m => !m.isInternal)
        .map(m => ({
          content: m.content,
          senderType: m.senderType
        }));
      
      if (!activeWorkspace?.id) {
        throw new Error('Workspace is required to generate AI summary');
      }

      const summaryText = await summarizeConversation(activeWorkspace.id, history);
      setSummary(summaryText);
    } catch (error) {
      console.error('Failed to fetch summary', error);
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.error || 'Could not generate AI summary');
      } else {
        toast.error('Could not generate AI summary');
      }
    } finally {
      setIsSummarizing(false);
    }
  };

  const updateContact = async (id: string, data: any) => {
    if (isRestrictedMode) return;
    try {
      await axios.patch(`/api/contacts/${id}`, data);
      if (selectedConv) {
        setSelectedConv({
          ...selectedConv,
          contact: { ...selectedConv.contact, ...data }
        });
        loadConversationDetails(selectedConv.id);
      }
      fetchConversations(selectedConv?.id);
      fetchContactLists();
      toast.success('Contact saved');
    } catch (error) {
      console.error('Failed to update contact', error);
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.error || 'Could not save contact');
      } else {
        toast.error('Could not save contact');
      }
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && pendingAttachments.length === 0) || !selectedConv || isSending || isRestrictedMode) return;

    setIsSending(true);
    setSendError(null);
    try {
      const trimmedMessage = newMessage.trim();

      if (isInternalMode) {
        const content = [
          trimmedMessage,
          pendingAttachments.length > 0 ? `Attachments: ${pendingAttachments.map((attachment) => attachment.file.name).join(', ')}` : '',
        ]
          .filter(Boolean)
          .join('\n\n');

        await axios.post('/api/messages', {
          conversationId: selectedConv.id,
          content,
          direction: 'OUTGOING',
          senderType: 'USER',
            senderName: currentUserDisplayName,
          isInternal: isInternalMode
        });
      } else {
        if (selectedConv.channelType === 'INSTAGRAM' && pendingAttachments.length > 0) {
          throw new Error('Instagram attachments are not connected yet. Send text only for now.');
        }

        const formData = new FormData();
        formData.append('conversationId', selectedConv.id);
        formData.append('content', trimmedMessage);
        formData.append('senderId', user?.id || '');
        formData.append('senderName', currentUserDisplayName);
        formData.append('isInternal', String(isInternalMode));
        if (replyToMessage?.metaMessageId) {
          formData.append('replyToMetaMessageId', replyToMessage.metaMessageId);
          formData.append('replyToId', replyToMessage.id);
        }
        pendingAttachments.forEach((attachment) => {
          formData.append('attachments', attachment.file, attachment.file.name);
        });

        await axios.post('/api/messages/send', formData);
      }
      
      // We don't need to manually update state here because the socket will broadcast it back to us
      // But for better UX, we can optimistically update or just wait for the socket
      setNewMessage('');
      setPendingAttachments([]);
      setShowEmojiPicker(false);
      setShowTemplatePicker(false);
      setReplyToMessage(null);
      loadConversationDetails(selectedConv.id);
      fetchConversations(selectedConv.id);
    } catch (error) {
      console.error('Failed to send message', error);
      if (axios.isAxiosError(error)) {
        setSendError(error.response?.data?.error || error.message || 'Message could not be sent.');
      } else {
        setSendError('Message could not be sent. Please try again.');
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleEmojiInsert = (emoji: string) => {
    setNewMessage((prev) => `${prev}${emoji}`);
    setSendError(null);
    setShowEmojiPicker(false);
    setTimeout(() => messageInputRef.current?.focus(), 0);
  };

  const handleAttachmentPick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []) as File[];
    if (files.length === 0) return;
    setPendingAttachments((prev) => [
      ...prev,
      ...files.map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        file,
      })),
    ]);
    setSendError(null);
    event.target.value = '';
    setTimeout(() => messageInputRef.current?.focus(), 0);
  };

  const handleTemplateInsert = (templateContent: string) => {
    setNewMessage(templateContent);
    setSendError(null);
    setShowTemplatePicker(false);
    setTemplatePickerSearch('');
    setTimeout(() => messageInputRef.current?.focus(), 0);
  };

  const handleTemplatePickerToggle = async () => {
    const nextOpen = !showTemplatePicker;
    setShowTemplatePicker(nextOpen);
    setShowEmojiPicker(false);

    if (nextOpen) {
      setTemplatePickerSearch('');
      await fetchSessionTemplates();
    } else {
      setTemplatePickerSearch('');
    }
  };

  const conversationHasAiBot = (conversation: Conversation | null) => {
    if (!conversation) return false;
    if (conversation.channelType === 'WHATSAPP') {
      return Boolean(conversation.number?.autoReply && conversation.number?.chatbotId);
    }
    return Boolean(conversation.instagramAccount?.chatbotId);
  };

  const getAssignedBotName = (conversation: Conversation | null) => {
    if (!conversation) return null;
    if (conversation.channelType === 'WHATSAPP') {
      return conversation.number?.chatbot?.name || null;
    }
    return conversation.instagramAccount?.chatbot?.name || null;
  };

  const handleAiToggle = async () => {
    if (!selectedConv || isRestrictedMode || !conversationHasAiBot(selectedConv)) return;
    await updateConversation(selectedConv.id, { aiPaused: !selectedConv.aiPaused });
  };

  const getConversationStatusStyles = (status: Conversation['internalStatus']) => {
    switch (status) {
      case 'WAITING_FOR_CUSTOMER':
        return {
          rail: 'before:bg-yellow-500',
          pill: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
          label: t('inbox.statusWaitingForCustomer')
        };
      case 'WAITING_FOR_INTERNAL':
        return {
          rail: 'before:bg-purple-500',
          pill: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
          label: t('inbox.statusWaitingForInternal')
        };
      case 'RESOLVED':
        return {
          rail: 'before:bg-green-500',
          pill: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
          label: t('inbox.statusResolved')
        };
      default:
        return {
          rail: 'before:bg-slate-200 dark:before:bg-slate-700',
          pill: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
          label: t('inbox.statusOpen')
        };
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#25D366] animate-spin" />
      </div>
    );
  }

  const handleCreateWorkspace = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newWorkspaceName.trim() || !user || isCreating || isRestrictedMode) return;

    setIsCreating(true);
    try {
      await axios.post('/api/workspaces', { name: newWorkspaceName, userId: user.id });
      window.location.reload();
    } catch (error: any) {
      console.error('Failed to create workspace:', error.response?.data || error.message);
      alert(`Failed to create workspace: ${error.response?.data?.error || error.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  if (!activeWorkspace) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-white dark:bg-slate-950 relative z-10 transition-colors">
        <div className="w-20 h-20 bg-gray-100 dark:bg-slate-900 rounded-full flex items-center justify-center text-gray-300 dark:text-gray-700 mb-4">
          <Users className="w-10 h-10" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('inbox.noWorkspaceSelected')}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mt-2 mb-8">
          {workspaces.length > 0
            ? t('inbox.selectWorkspacePrompt')
            : t('inbox.noWorkspacesYet')}
        </p>
        
        {workspaces.length === 0 && (
          <div className="mb-8 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 rounded-2xl text-amber-700 dark:text-amber-400 text-xs max-w-xs">
            <p className="font-bold mb-1">{t('inbox.havingTrouble')}</p>
            <p className="mb-3">{t('inbox.repairHint')}</p>
            <button 
              onClick={async () => {
                try {
                  await axios.post('/api/dev/bootstrap');
                  window.location.reload();
                } catch (e) {
                  alert("Repair failed. Please try again later.");
                }
              }}
              className="px-4 py-2 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition-all"
            >
              {t('inbox.runQuickRepair')}
            </button>
          </div>
        )}

        {workspaces.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-md">
            {workspaces.map(ws => (
              <button
                key={ws.id}
                onClick={() => setActiveWorkspace(ws)}
                className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl hover:border-[#25D366] hover:shadow-md transition-all text-left group cursor-pointer"
              >
                <div className="w-10 h-10 bg-gray-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-gray-400 dark:text-gray-600 group-hover:bg-[#25D366]/10 group-hover:text-[#25D366] font-bold">
                  {ws.name[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{ws.name}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    {ws.plan === 'NONE' ? t('inbox.noPlanSelected') : t('inbox.planLabel', { plan: ws.plan })}
                  </p>
                </div>
              </button>
            ))}
            <button 
              onClick={() => setIsCreatingWorkspace(true)}
              className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-slate-900/50 border border-dashed border-gray-200 dark:border-slate-800 rounded-2xl hover:border-[#25D366] hover:bg-white dark:hover:bg-slate-900 transition-all text-left group cursor-pointer"
            >
              <div className="w-10 h-10 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-800 rounded-xl flex items-center justify-center text-gray-400 dark:text-gray-600 group-hover:text-[#25D366]">
                <Plus className="w-5 h-5" />
              </div>
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 group-hover:text-[#25D366]">{t('inbox.newWorkspace')}</p>
            </button>
          </div>
        ) : (
          <div className="w-full max-w-sm">
            {!isCreatingWorkspace ? (
              <button 
                onClick={() => setIsCreatingWorkspace(true)}
                className="flex items-center gap-2 px-6 py-3 bg-[#25D366] text-white font-bold rounded-2xl hover:bg-[#128C7E] transition-all shadow-lg cursor-pointer mx-auto"
              >
                <Plus className="w-5 h-5" />
                {t('inbox.createFirstWorkspace')}
              </button>
            ) : (
              <form onSubmit={handleCreateWorkspace} className="bg-gray-50 dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800">
                <input
                  autoFocus
                  type="text"
                  placeholder={t('inbox.workspaceNamePlaceholder')}
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#25D366]/20 mb-4"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreatingWorkspace(false)}
                    className="flex-1 px-4 py-2 text-sm font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={!newWorkspaceName.trim() || isCreating}
                    className="flex-1 px-4 py-2 text-sm font-bold bg-[#25D366] text-white rounded-xl hover:bg-[#128C7E] transition-colors disabled:opacity-50"
                  >
                    {isCreating ? t('inbox.creating') : t('common.create')}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex bg-[#FAFAF7] dark:bg-slate-950 transition-colors">
      {/* Left Column: Conversation List */}
      <div className={cn(
        "w-full md:w-80 border-r border-[#E7E6DF] dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900 transition-colors",
        selectedConv && "hidden md:flex"
      )}>
        {isRestrictedMode && (
          <div className="mx-4 mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
            {hasVerifiedEmail
              ? t('inbox.viewOnlySubscribe')
              : t('inbox.verifyEmailFirst')}
          </div>
        )}
        <div className="border-b border-[#E7E6DF] px-5 py-5 dark:border-slate-800">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="font-serif text-3xl leading-none text-[#0F1A14] dark:text-white">Conversations</h2>
              <p className="mt-1 text-sm text-[#5A6A60] dark:text-gray-400">
                {conversations.filter((conversation) => conversation.internalStatus !== 'RESOLVED').length} open · {unreadConversationCount} unread
              </p>
            </div>
            <span className="rounded-full border border-[#E7E6DF] bg-[#FAFAF7] px-2.5 py-1 text-[11px] font-semibold text-[#5A6A60] dark:border-slate-700 dark:bg-slate-800 dark:text-gray-300 md:hidden">
              {filteredConversations.length}
            </span>
          </div>
          <div className="flex h-9 items-center gap-2 rounded-xl bg-[#F1F1EC] px-3 text-sm text-[#5A6A60] dark:bg-slate-800 dark:text-gray-400">
            <Search className="h-3.5 w-3.5 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('inbox.searchPlaceholder')}
              className="min-w-0 flex-1 bg-transparent text-sm text-[#0F1A14] outline-none placeholder:text-[#7E8C84] dark:text-white dark:placeholder:text-gray-500"
            />
            <AppTooltip content={t('inbox.filterConversations')} side="bottom">
              <button
                onClick={() => setShowFilters((prev) => !prev)}
                className={cn(
                  "inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#7E8C84] transition-colors hover:bg-white hover:text-[#0E8A4F] dark:hover:bg-slate-700 dark:hover:text-[#7DE2A8]",
                  showFilters || channelFilter !== 'ALL' || statusFilter !== 'ALL'
                    ? "bg-white text-[#0E8A4F] dark:bg-slate-700 dark:text-[#7DE2A8]"
                    : ""
                )}
              >
                <Filter className="w-4 h-4" />
              </button>
            </AppTooltip>
          </div>
          <div className="mt-3 flex items-center gap-1 overflow-x-auto text-xs scrollbar-hide">
            {[
              { key: 'ALL' as const, label: 'All', count: conversations.length },
              { key: 'UNREAD' as const, label: 'Unread', count: unreadConversationCount },
              { key: 'MINE' as const, label: 'Mine', count: myConversationCount },
              { key: 'OVERDUE' as const, label: 'Overdue', count: overdueConversationCount },
            ].map((filter) => (
              <button
                key={filter.key}
                type="button"
                aria-pressed={listFilter === filter.key}
                onClick={() => setListFilter(filter.key)}
                className={cn(
                  "shrink-0 rounded-lg px-2.5 py-1 font-medium transition-colors",
                  listFilter === filter.key
                    ? "bg-[#0F1A14] text-[#FAFAF7] dark:bg-white dark:text-slate-950"
                    : filter.key === 'OVERDUE'
                      ? "text-[#C8553D] hover:bg-[#C8553D]/10"
                      : "text-[#5A6A60] hover:bg-[#F1F1EC] dark:text-gray-400 dark:hover:bg-slate-800"
                )}
              >
                {filter.label}
                {filter.key !== 'ALL' && (
                  <span className={cn(
                    "ml-1 font-mono text-[11px]",
                    listFilter === filter.key ? "text-inherit" : "text-[#0E8A4F]"
                  )}>
                    {filter.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {showFilters && (
          <div className="border-b border-[#E7E6DF] bg-[#FAFAF7] px-4 py-3 space-y-3 dark:border-slate-800 dark:bg-slate-900">
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={channelFilter}
                  onChange={(e) => setChannelFilter(e.target.value as 'ALL' | 'WHATSAPP' | 'INSTAGRAM')}
                  className="min-w-0 rounded-xl border border-[#E7E6DF] bg-white px-3 py-3 text-xs font-medium text-[#293A30] outline-none focus:border-[#15A862] dark:border-slate-700 dark:bg-slate-800 dark:text-gray-200 md:py-2"
                >
                  <option value="ALL">{t('inbox.allChannels')}</option>
                  <option value="WHATSAPP">{t('inbox.whatsapp')}</option>
                  <option value="INSTAGRAM">{t('inbox.instagram')}</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'OPEN' | 'WAITING_FOR_CUSTOMER' | 'WAITING_FOR_INTERNAL' | 'RESOLVED')}
                  className="min-w-0 rounded-xl border border-[#E7E6DF] bg-white px-3 py-3 text-xs font-medium text-[#293A30] outline-none focus:border-[#15A862] dark:border-slate-700 dark:bg-slate-800 dark:text-gray-200 md:py-2"
                >
                  <option value="ALL">All statuses</option>
                  <option value="OPEN">Open</option>
                  <option value="WAITING_FOR_CUSTOMER">Waiting for customer</option>
                  <option value="WAITING_FOR_INTERNAL">Waiting for internal</option>
                  <option value="RESOLVED">Resolved</option>
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setListFilter('ALL');
                    setChannelFilter('ALL');
                    setStatusFilter('ALL');
                  }}
                  className="col-span-2 rounded-xl border border-[#E7E6DF] bg-white px-3 py-3 text-xs font-semibold text-[#5A6A60] transition-colors hover:border-[#15A862] hover:text-[#0E8A4F] dark:border-slate-700 dark:bg-slate-800 dark:text-gray-400 md:py-2"
                >
                  Clear search and filters
                </button>
              </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-900">
          {filteredConversations.map((conv) => {
            const unreadCount = conv.unreadCount || 0;
            const hasUnread = unreadCount > 0;

            return (
            <button
              key={conv.id}
              onClick={() => setSelectedConv(conv)}
              className={cn(
                "relative w-full p-4 flex items-center gap-3 border-b border-[#F1F1EC] text-left transition-colors before:absolute before:left-0 before:top-3 before:bottom-3 before:rounded-r-full dark:border-slate-800/50 md:p-4",
                getConversationStatusStyles(conv.internalStatus).rail,
                selectedConv?.id === conv.id
                  ? "bg-[#EAF6EE] shadow-[inset_3px_0_0_#15A862] dark:bg-[#25D366]/10"
                  : hasUnread
                    ? "bg-[#EAF6EE]/70 shadow-[inset_3px_0_0_#15A862] hover:bg-[#EAF6EE] dark:bg-[#25D366]/[0.12] dark:hover:bg-[#25D366]/[0.18]"
                    : "hover:bg-[#FAFAF7] dark:hover:bg-slate-800/50"
              )}
            >
              <div className="w-11 h-11 rounded-full border border-[#E7E6DF] bg-[#FAFAF7] dark:border-slate-700 dark:bg-slate-800 flex items-center justify-center text-[#A6B0AA] shrink-0 relative">
                {conv.contact.avatar ? (
                  <img src={conv.contact.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <User className="w-5 h-5" />
                )}
                <div className={cn(
                  "absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900",
                  conv.channelType === 'INSTAGRAM' ? "bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF]" : "bg-[#15A862]"
                )}>
                  {conv.channelType === 'INSTAGRAM' ? (
                    <Instagram className="w-2.5 h-2.5 text-white" />
                  ) : (
                    <Phone className="w-2.5 h-2.5 text-white" />
                  )}
                </div>
              </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h3 className={cn(
                        "text-sm truncate",
                        hasUnread
                          ? "font-bold text-[#0F1A14] dark:text-white"
                          : "font-semibold text-[#293A30] dark:text-gray-100"
                      )}>
                        {getConversationContactLabel(conv.contact)}
                      </h3>
                      {hasUnread && (
                        <span className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-[#15A862]" title="Unread conversation" />
                      )}
                      {conv.priority === 'HIGH' && <div className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" title="High Priority" />}
                      {conv.priority === 'URGENT' && <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 animate-pulse" title="Urgent Priority" />}
                      {conv.slaStatus === 'BREACHED' && (
                        <div className="px-1 py-0.5 bg-red-50 text-red-600 text-[8px] font-bold rounded uppercase tracking-tighter shrink-0">SLA</div>
                      )}
                    </div>
                    <span className={cn(
                      "shrink-0 text-[10px]",
                      hasUnread
                        ? "font-bold text-[#0E8A4F] dark:text-[#7DE2A8]"
                        : "text-[#7E8C84]"
                    )}>
                      {conv.lastMessageAt ? (
                        (() => {
                          try {
                            return format(new Date(conv.lastMessageAt), 'HH:mm');
                          } catch (e) {
                            return '';
                          }
                        })()
                      ) : ''}
                    </span>
                  </div>
                  <div className="mb-1.5 flex items-center gap-2">
                    {hasUnread && (
                      <span className="inline-flex items-center rounded-full bg-[#15A862] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm">
                        Unread
                      </span>
                    )}
                    {conv.internalStatus !== 'OPEN' && (
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                          getConversationStatusStyles(conv.internalStatus).pill
                        )}
                      >
                        {getConversationStatusStyles(conv.internalStatus).label}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <p className={cn(
                      "text-xs truncate flex-1 mr-2",
                      hasUnread
                        ? "font-semibold text-[#293A30] dark:text-gray-200"
                        : "text-[#5A6A60]"
                    )}>
                      {getMessagePreview(conv.messages[0])}
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      {hasUnread && (
                        <span className="min-w-6 rounded-full bg-[#15A862] px-2 py-0.5 text-center text-[10px] font-extrabold text-white shadow-sm">
                          {unreadCount}
                        </span>
                      )}
                      {conv.assignedTo && (
                        <div className="flex -space-x-1 shrink-0">
                          <div className="w-4 h-4 rounded-full bg-gray-200 border border-white flex items-center justify-center overflow-hidden" title={`Assigned to ${conv.assignedTo.name}`}>
                            {conv.assignedTo.image ? (
                              <img src={conv.assignedTo.image} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-2.5 h-2.5 text-gray-400" />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
              </div>
            </button>
          )})}
          {filteredConversations.length === 0 && (
            conversations.length === 0 ? (
              <div className="px-4 py-8">
                <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 p-5 text-center dark:border-slate-800 dark:bg-slate-950/60">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#25D366] shadow-sm dark:bg-slate-900">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">No conversations yet</p>
                  <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                    Connect WhatsApp, send a test message to your business number, and new customer chats will appear here.
                  </p>
                  <div className="mt-4 grid gap-2">
                    <Link
                      to="/app/channels"
                      className="rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#128C7E]"
                    >
                      Connect WhatsApp
                    </Link>
                    <Link
                      to="/app/chatbots"
                      className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-200 dark:hover:bg-slate-800"
                    >
                      Prepare AI bot later
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-6 py-12 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 dark:bg-slate-800 dark:text-gray-500">
                  <Search className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">No conversations match</p>
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  Try a different search term or clear the active filters.
                </p>
              </div>
            )
          )}
        </div>
      </div>

      {/* Center Column: Chat Timeline */}
      <div className={cn(
        "flex-1 flex flex-col tawasel-inbox-surface transition-colors",
        !selectedConv && "hidden md:flex"
      )}>
        {slaBreachAlert && (
          <div className="bg-red-500 text-white px-6 py-2 text-xs font-bold flex items-center justify-between animate-pulse shrink-0">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" />
              {slaBreachAlert}
            </div>
            <button onClick={() => setSlaBreachAlert(null)} className="hover:opacity-80">Dismiss</button>
          </div>
        )}
        {(!hasFullAccess || conversations.length === 0) && (
          <div className="shrink-0 border-b border-gray-200 p-6 dark:border-slate-800">
            <ActivationChecklist />
          </div>
        )}
        {selectedConv ? (
          <>
            <div className="min-h-16 border-b border-[#E7E6DF] bg-white/95 px-3 py-2 shadow-[0_1px_0_rgba(15,26,20,0.03)] transition-colors dark:border-slate-800 dark:bg-slate-900 md:px-6 md:py-0 flex items-center justify-between shrink-0">
              <div className="flex min-w-0 items-center gap-2 md:gap-3">
                <button
                  className="md:hidden -ml-1 inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-sm font-semibold text-[#5A6A60] hover:bg-[#FAFAF7] hover:text-[#0F1A14] dark:text-gray-300 dark:hover:bg-slate-800 dark:hover:text-gray-100"
                  onClick={() => setSelectedConv(null)}
                >
                  <ArrowLeft className="w-5 h-5" />
                  Chats
                </button>
                <div className="w-10 h-10 rounded-full border border-[#E7E6DF] bg-[#D4EDDD] text-[#0A6E3F] dark:border-slate-700 dark:bg-[#25D366]/15 dark:text-[#7DE2A8] flex items-center justify-center shrink-0 text-xs font-semibold md:w-9 md:h-9">
                  {selectedConv.contact.avatar ? (
                    <img src={selectedConv.contact.avatar} alt="" className="h-full w-full rounded-full object-cover" />
                  ) : (
                    getInitials(getConversationContactLabel(selectedConv.contact))
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <h2 className="truncate text-sm font-semibold text-[#0F1A14] dark:text-white">
                      {getConversationContactLabel(selectedConv.contact)}
                    </h2>
                    <select 
                      value={selectedConv.priority}
                      onChange={(e) => updateConversation(selectedConv.id, { priority: e.target.value as any })}
                      className={cn(
                        "hidden text-[10px] font-bold px-1.5 py-0.5 rounded border-none outline-none cursor-pointer sm:block",
                        selectedConv.priority === 'URGENT' ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" :
                        selectedConv.priority === 'HIGH' ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400" :
                        selectedConv.priority === 'MEDIUM' ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" :
                        "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-400"
                      )}
                    >
                      <option value="LOW">LOW</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="HIGH">HIGH</option>
                      <option value="URGENT">URGENT</option>
                    </select>
                    <select 
                      value={selectedConv.internalStatus}
                      onChange={(e) => updateConversation(selectedConv.id, { internalStatus: e.target.value as any })}
                      className={cn(
                        "hidden text-[10px] font-bold px-1.5 py-0.5 rounded border-none outline-none cursor-pointer lg:block",
                        selectedConv.internalStatus === 'RESOLVED' ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" :
                        selectedConv.internalStatus === 'WAITING_FOR_CUSTOMER' ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400" :
                        selectedConv.internalStatus === 'WAITING_FOR_INTERNAL' ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400" :
                        "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-400"
                      )}
                    >
                      <option value="OPEN">OPEN</option>
                      <option value="WAITING_FOR_CUSTOMER">WAITING FOR CUSTOMER</option>
                      <option value="WAITING_FOR_INTERNAL">WAITING FOR INTERNAL</option>
                      <option value="RESOLVED">RESOLVED</option>
                    </select>
                  </div>
                  <p className="text-[10px] text-[#0E8A4F] font-semibold uppercase tracking-[0.06em]">
                    Online
                  </p>
                  {getAssignedBotName(selectedConv) && (
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">
                      Bot: <span className="font-semibold text-gray-600 dark:text-gray-300">{getAssignedBotName(selectedConv)}</span>
                    </p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center justify-end gap-1 md:gap-3">
                {conversationHasAiBot(selectedConv) && (
                  <AppTooltip
                    content={
                      selectedConv.aiPaused
                        ? `AI is paused. ${getAssignedBotName(selectedConv) || 'Assigned bot'} will not auto-reply until you turn it back on.`
                        : `${getAssignedBotName(selectedConv) || 'Assigned bot'} is handling auto replies for this conversation.`
                    }
                    side="bottom"
                  >
                    <button
                      type="button"
                      onClick={handleAiToggle}
                      disabled={isRestrictedMode}
                      className={cn(
                        "hidden items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors sm:flex",
                      selectedConv.aiPaused
                        ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300"
                        : "border-[#25D366]/20 bg-[#25D366]/10 text-[#128C7E] dark:border-[#25D366]/30 dark:bg-[#25D366]/15 dark:text-[#7DE2A8]",
                      isRestrictedMode ? "cursor-not-allowed opacity-60" : "hover:opacity-90"
                      )}
                    >
                      {selectedConv.aiPaused ? <BotOff className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                      {selectedConv.aiPaused ? 'AI Off' : 'AI On'}
                      {getAssignedBotName(selectedConv) && (
                        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold text-inherit dark:bg-slate-900/40">
                          {getAssignedBotName(selectedConv)}
                        </span>
                      )}
                    </button>
                  </AppTooltip>
                )}
                <div
                  className="hidden items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800 sm:flex"
                  style={{
                    borderColor: `${activePipelineStageColor}4D`,
                    backgroundColor: `${activePipelineStageColor}14`,
                  }}
                >
                  <span className="inline-flex h-2.5 w-2.5 rounded-full" style={{ backgroundColor: activePipelineStageColor }} />
                  <span className="text-xs font-medium" style={{ color: activePipelineStageColor }}>Stage:</span>
                  <div className="relative">
                    <select
                      value={activePipelineStageKey}
                      disabled={isRestrictedMode}
                      onChange={(e) => updateContact(selectedConv.contact.id, { pipelineStage: e.target.value })}
                      className="min-w-[150px] appearance-none bg-transparent pr-6 text-xs font-bold outline-none cursor-pointer"
                      style={{ color: activePipelineStageColor }}
                    >
                      {pipelineStages.map((stage) => (
                        <option key={stage.id} value={stage.key}>{stage.name}</option>
                      ))}
                    </select>
                    <ChevronDown
                      className="pointer-events-none absolute right-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
                      style={{ color: activePipelineStageColor }}
                    />
                  </div>
                </div>
                <div className="hidden md:flex items-center gap-2 rounded-xl border border-[#E7E6DF] bg-[#FAFAF7] px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Assigned to:</span>
                  <select
                    value={selectedConv.assignedToId || ''}
                    onChange={(e) => updateConversation(selectedConv.id, { assignedToId: e.target.value || undefined })}
                    className="text-xs font-medium text-gray-700 dark:text-gray-300 bg-transparent border-none outline-none cursor-pointer"
                  >
                    <option value="">Unassigned</option>
                    <option value={user?.id}>{currentUserDisplayName} (You)</option>
                    {/* In a real app, we'd fetch all team members here */}
                  </select>
                </div>
                <div className="hidden md:flex items-center gap-2 rounded-xl border border-[#E7E6DF] bg-[#FAFAF7] px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800">
                  <span className="text-xs text-gray-500 dark:text-gray-400">From:</span>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      {selectedConv.channelType === 'INSTAGRAM' 
                      ? (selectedConv.contact.instagramUsername
                          ? `@${selectedConv.contact.instagramUsername}`
                          : (selectedConv.instagramAccount?.username
                              ? `@${selectedConv.instagramAccount.username}`
                              : getConversationContactLabel(selectedConv.contact)))
                      : selectedConv.contact.phoneNumber || selectedConv.number?.phoneNumber || 'No customer number'}
                    </span>
                  </div>
                <button
                  className="md:hidden p-2 hover:bg-[#FAFAF7] dark:hover:bg-slate-800 rounded-lg text-[#5A6A60]"
                  onClick={() => setMobileContactPanel(true)}
                >
                  <PanelRightOpen className="w-5 h-5" />
                </button>
                <div className="relative">
                  <AppTooltip content="Conversation actions" side="bottom">
                    <button
                      onClick={() => setShowConvMenu(prev => !prev)}
                      className="p-2 hover:bg-[#FAFAF7] dark:hover:bg-slate-800 rounded-lg text-[#7E8C84]"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </AppTooltip>
                  {showConvMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowConvMenu(false)} />
                      <div className="absolute right-0 top-full mt-1 z-50 w-52 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 py-1 text-sm">
                        <button
                          onClick={async () => {
                            setShowConvMenu(false);
                            if (!selectedConv) return;
                            try {
                              await axios.patch(`/api/conversations/${selectedConv.id}`, {
                                internalStatus: selectedConv.internalStatus === 'RESOLVED' ? 'OPEN' : 'RESOLVED',
                                resolvedAt: selectedConv.internalStatus === 'RESOLVED' ? null : new Date().toISOString()
                              });
                              toast.success(selectedConv.internalStatus === 'RESOLVED' ? 'Conversation reopened' : 'Conversation resolved');
                              fetchConversations(selectedConv.id);
                              loadConversationDetails(selectedConv.id);
                            } catch { toast.error('Failed to update conversation'); }
                          }}
                          className="w-full px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-3"
                        >
                          <Check className="w-4 h-4 text-green-500" />
                          {selectedConv?.internalStatus === 'RESOLVED' ? 'Reopen Conversation' : 'Resolve Conversation'}
                        </button>
                        <button
                          onClick={async () => {
                            setShowConvMenu(false);
                            if (!selectedConv || !confirm('Clear all messages in this conversation? This cannot be undone.')) return;
                            try {
                              await axios.delete(`/api/conversations/${selectedConv.id}/messages`);
                              setMessages([]);
                              toast.success('Messages cleared');
                              fetchConversations(selectedConv.id);
                            } catch { toast.error('Failed to clear messages'); }
                          }}
                          className="w-full px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-3"
                        >
                          <Trash2 className="w-4 h-4 text-orange-500" />
                          Clear Messages
                        </button>
                        <div className="border-t border-gray-200 dark:border-slate-700 my-1" />
                        <button
                          onClick={async () => {
                            setShowConvMenu(false);
                            if (!selectedConv || !confirm('Delete this conversation permanently? This cannot be undone.')) return;
                            try {
                              await axios.delete(`/api/conversations/${selectedConv.id}`);
                              setSelectedConv(null);
                              setMessages([]);
                              toast.success('Conversation deleted');
                              fetchConversations();
                            } catch { toast.error('Failed to delete conversation'); }
                          }}
                          className="w-full px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-slate-700 flex items-center gap-3 text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete Conversation
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto space-y-4 p-3 md:space-y-6 md:p-6"
            >
              {messages.map((msg) => {
                const quotedMsg = msg.replyToId ? messages.find(m => m.id === msg.replyToId) : null;
                return (
                <div
                  key={msg.id}
                  id={`msg-${msg.id}`}
                  className={cn(
                    "flex flex-col group/msg transition-all duration-300",
                    msg.isInternal ? "items-center w-full" : (msg.direction === 'OUTGOING' ? "ml-auto items-end max-w-[86%] md:max-w-[70%]" : "mr-auto items-start max-w-[86%] md:max-w-[70%]")
                  )}
                >
                  <div className={cn("flex items-center gap-1", msg.direction === 'OUTGOING' ? "flex-row-reverse" : "flex-row")}>
                    <div
                      className={cn(
                        "tawasel-card-shadow px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed transition-colors md:px-4",
                        msg.isInternal
                          ? "bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-900/30 text-yellow-800 dark:text-yellow-200 w-full max-w-2xl italic"
                          : (msg.direction === 'OUTGOING'
                            ? "bg-[#15A862] text-white rounded-tr-sm dark:bg-[#0E8A4F] dark:text-white"
                            : "border border-[#E7E6DF] bg-white text-[#293A30] rounded-tl-sm dark:border-slate-700 dark:bg-slate-800 dark:text-gray-100")
                      )}
                    >
                      {quotedMsg && (
                        <div className="mb-2 px-3 py-2 rounded-lg bg-black/5 dark:bg-white/10 border-l-4 border-[#25D366] text-xs cursor-pointer hover:bg-black/10 dark:hover:bg-white/15 flex items-center gap-2"
                          onClick={() => {
                            const el = document.getElementById(`msg-${quotedMsg.id}`);
                            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            el?.classList.add('ring-2', 'ring-[#25D366]', 'ring-opacity-50');
                            setTimeout(() => el?.classList.remove('ring-2', 'ring-[#25D366]', 'ring-opacity-50'), 2000);
                          }}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-[#25D366] mb-0.5">
                              {quotedMsg.direction === 'INCOMING' ? (selectedConv?.contact?.name || 'Customer') : (quotedMsg.senderName || 'You')}
                            </div>
                            <div className="text-gray-600 dark:text-gray-300 line-clamp-2">
                              {quotedMsg.type === 'IMAGE' ? 'Photo' : quotedMsg.type === 'AUDIO' ? getMessagePreview(quotedMsg) : quotedMsg.type === 'DOCUMENT' ? `${quotedMsg.mediaFilename || 'Document'}` : quotedMsg.content}
                            </div>
                          </div>
                          {quotedMsg.type === 'IMAGE' && quotedMsg.mediaId && (
                            <QuoteThumbnail message={quotedMsg} />
                          )}
                        </div>
                      )}
                      {!msg.isInternal && msg.direction === 'OUTGOING' && (
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-white/70">
                          {msg.senderType === 'AI_BOT'
                            ? getDisplayName(msg.senderName) || 'AI Bot'
                            : getDisplayName(msg.senderName) || 'Agent'}
                        </div>
                      )}
                      {msg.isInternal && (
                        <div className="flex items-center gap-2 mb-1 not-italic">
                          <Edit2 className="w-3 h-3" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Internal Note</span>
                          {msg.senderName && <span className="text-[10px] opacity-60">• {msg.senderName}</span>}
                        </div>
                      )}
                      {msg.type === 'TEXT' || msg.isInternal ? (
                        <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                      ) : (
                        <MessageMedia message={msg} />
                      )}
                    </div>
                    {!msg.isInternal && (
                      <button
                        onClick={() => setReplyToMessage(msg)}
                      className="opacity-100 md:opacity-0 md:group-hover/msg:opacity-100 transition-opacity p-1 rounded-full hover:bg-white/80 dark:hover:bg-slate-700 text-[#7E8C84] hover:text-[#293A30] dark:hover:text-gray-300"
                        title="Reply"
                      >
                        <Reply className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5 px-1">
                    {msg.senderType === 'AI_BOT' && !msg.senderName && (
                        <span className="text-[10px] font-bold text-[#0E8A4F] uppercase tracking-tighter">AI Bot</span>
                    )}
                    <span className="text-[10px] text-gray-400">
                      {msg.createdAt ? (
                        (() => {
                          try {
                            return format(new Date(msg.createdAt), 'HH:mm');
                          } catch (e) {
                            return '';
                          }
                        })()
                      ) : ''}
                    </span>
                    {msg.direction === 'OUTGOING' && !msg.isInternal && (
                      msg.status === 'FAILED' ? (
                        <span className="text-[10px] text-red-500 font-medium">Failed</span>
                      ) : msg.status === 'READ' ? (
                        <CheckCheck className="w-3 h-3 text-blue-500" />
                      ) : msg.status === 'DELIVERED' ? (
                        <CheckCheck className="w-3 h-3 text-gray-400" />
                      ) : (
                        <Check className="w-3 h-3 text-gray-400" />
                      )
                    )}
                  </div>
                </div>
              );
              })}
            </div>

            {/* Quote reply preview bar */}
            {replyToMessage && (
              <div className="px-4 py-2 bg-gray-50 dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 flex items-center gap-3">
                <div className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-slate-700 border-l-4 border-[#25D366] text-sm flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[#25D366] text-xs mb-0.5">
                      {replyToMessage.direction === 'INCOMING' ? (selectedConv?.contact?.name || 'Customer') : (replyToMessage.senderName || 'You')}
                    </div>
                    <div className="text-gray-600 dark:text-gray-300 text-xs line-clamp-1">
                      {replyToMessage.type === 'IMAGE' ? 'Photo' : replyToMessage.type === 'AUDIO' ? getMessagePreview(replyToMessage) : replyToMessage.type === 'DOCUMENT' ? `${replyToMessage.mediaFilename || 'Document'}` : replyToMessage.content}
                    </div>
                  </div>
                  {replyToMessage.type === 'IMAGE' && replyToMessage.mediaId && (
                    <QuoteThumbnail message={replyToMessage} />
                  )}
                </div>
                <button
                  onClick={() => setReplyToMessage(null)}
                  className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="shrink-0 border-t border-[#E7E6DF] bg-white/95 p-3 transition-colors dark:border-slate-800 dark:bg-slate-900 md:p-4">
              <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl bg-[#F1F1EC] p-1 dark:bg-slate-800 md:flex md:bg-transparent md:p-0">
                <button 
                  onClick={() => setIsInternalMode(false)}
                  className={cn(
                    "rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] transition-all md:border-b-2 md:rounded-none md:px-0 md:py-0 md:pb-1",
                    !isInternalMode ? "bg-white text-[#0E8A4F] shadow-sm md:bg-transparent md:border-[#15A862] md:shadow-none" : "text-[#7E8C84] dark:text-gray-500 md:border-transparent hover:text-[#293A30] dark:hover:text-gray-300"
                  )}
                >
                  Reply
                </button>
                <button 
                  onClick={() => setIsInternalMode(true)}
                  className={cn(
                    "rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] transition-all md:border-b-2 md:rounded-none md:px-0 md:py-0 md:pb-1",
                    isInternalMode ? "bg-white text-yellow-600 shadow-sm md:bg-transparent md:border-yellow-600 md:shadow-none dark:bg-slate-900 md:dark:bg-transparent" : "text-[#7E8C84] dark:text-gray-500 md:border-transparent hover:text-[#293A30] dark:hover:text-gray-300"
                  )}
                >
                  Internal Note
                </button>
              </div>

              {pendingAttachments.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {pendingAttachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-600 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-300"
                      >
                        <Paperclip className="h-3.5 w-3.5" />
                        <span>{attachment.file.name}</span>
                        <button
                          type="button"
                          onClick={() => setPendingAttachments((prev) => prev.filter((item) => item.id !== attachment.id))}
                          className="text-gray-400 transition hover:text-red-500"
                        >
                          x
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {sendError && (
                <div className="mb-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400">
                  {sendError}
                </div>
              )}

              <form onSubmit={handleSendMessage} className="flex items-end gap-2 rounded-2xl border border-[#E7E6DF] bg-white p-2 tawasel-card-shadow dark:border-slate-700 dark:bg-slate-900">
                <input
                  ref={attachmentInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleAttachmentPick}
                />
                <div className="flex items-center gap-1">
                  <div className="relative">
                    <AppTooltip content="Emoji picker" side="top">
                      <button
                        type="button"
                        onClick={() => {
                          setShowEmojiPicker((prev) => !prev);
                          setShowTemplatePicker(false);
                        }}
                        className="hidden p-2 hover:bg-[#FAFAF7] dark:hover:bg-slate-800 rounded-lg text-[#7E8C84] sm:block"
                      >
                        <Smile className="w-5 h-5" />
                      </button>
                    </AppTooltip>
                    {showEmojiPicker && (
                      <div className="absolute bottom-12 left-0 z-20 flex w-52 flex-wrap gap-2 rounded-2xl border border-gray-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                        {QUICK_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleEmojiInsert(emoji)}
                            className="rounded-xl px-2 py-1 text-lg transition hover:bg-gray-100 dark:hover:bg-slate-800"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <AppTooltip content="Attach files" side="top">
                    <button
                      type="button"
                      onClick={() => attachmentInputRef.current?.click()}
                    className="p-2.5 hover:bg-[#FAFAF7] dark:hover:bg-slate-800 rounded-lg text-[#7E8C84]"
                    >
                      <Paperclip className="w-5 h-5" />
                    </button>
                  </AppTooltip>
                  <div className="relative">
                    <AppTooltip content="Insert template" side="top">
                      <button
                        type="button"
                        onClick={handleTemplatePickerToggle}
                        className="p-2.5 hover:bg-[#FAFAF7] dark:hover:bg-slate-800 rounded-lg text-[#7E8C84]"
                      >
                        <FileText className="w-5 h-5" />
                      </button>
                    </AppTooltip>
                    {showTemplatePicker && (
                      <div className="fixed inset-x-3 bottom-20 z-20 max-h-[70vh] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 sm:absolute sm:bottom-12 sm:left-0 sm:inset-x-auto sm:w-80 sm:max-h-[26rem]">
                        <div className="border-b border-gray-200 px-3 py-3 dark:border-slate-800">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                              Session Templates
                            </div>
                            <span className="rounded-full bg-[#25D366]/10 px-2 py-0.5 text-[10px] font-semibold text-[#128C7E]">
                              {filteredSessionTemplates.length}
                            </span>
                          </div>
                          <div className="relative mt-2">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                            <input
                              type="text"
                              value={templatePickerSearch}
                              onChange={(e) => setTemplatePickerSearch(e.target.value)}
                              placeholder="Search templates..."
                              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-xs text-gray-700 outline-none transition focus:border-[#25D366]/30 focus:bg-white focus:ring-2 focus:ring-[#25D366]/10 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-200 dark:focus:bg-slate-900"
                            />
                          </div>
                        </div>
                        <div className="max-h-[18rem] overflow-y-auto overscroll-contain scroll-smooth p-2">
                          {sessionTemplates.length === 0 ? (
                            <div className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                              No session templates yet. Create one on the Message Templates page.
                            </div>
                          ) : filteredSessionTemplates.length === 0 ? (
                            <div className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                              No templates match your search.
                            </div>
                          ) : (
                            filteredSessionTemplates.map((template) => (
                              <button
                                key={template.id}
                                type="button"
                                onClick={() => handleTemplateInsert(template.content)}
                                className="w-full rounded-xl px-3 py-2 text-left transition hover:bg-gray-50 dark:hover:bg-slate-800"
                              >
                                <div className="text-xs font-semibold text-gray-900 dark:text-white">{template.name}</div>
                                <div className="mt-1 line-clamp-2 text-[11px] text-gray-500 dark:text-gray-400">
                                  {template.content}
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <input
                  ref={messageInputRef}
                  type="text"
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    if (sendError) {
                      setSendError(null);
                    }
                  }}
                  disabled={isRestrictedMode}
                  placeholder={isInternalMode ? "Type an internal note (only your team sees this)..." : "Type a message..."}
                  className={cn(
                    "min-w-0 flex-1 border-none rounded-xl px-4 py-3 text-sm outline-none transition-all md:py-2.5",
                    isInternalMode 
                      ? "bg-yellow-50 dark:bg-yellow-900/20 focus:ring-2 focus:ring-yellow-200 dark:focus:ring-yellow-900/40 text-yellow-900 dark:text-yellow-100 placeholder:text-yellow-400 dark:placeholder:text-yellow-700" 
                      : "bg-[#FAFAF7] dark:bg-slate-800 focus:ring-2 focus:ring-[#15A862]/20 dark:focus:ring-[#25D366]/10 text-[#0F1A14] dark:text-gray-100 transition-colors"
                  )}
                />
                <AppTooltip content="Voice note recording is coming soon" side="top">
                  <button type="button" className="hidden p-2 hover:bg-[#FAFAF7] dark:hover:bg-slate-800 rounded-lg text-[#7E8C84] sm:block">
                    <Mic className="w-5 h-5" />
                  </button>
                </AppTooltip>
                <AppTooltip content={isInternalMode ? 'Save internal note' : 'Send message'} side="top">
                  <button 
                    type="submit"
                    disabled={(!newMessage.trim() && pendingAttachments.length === 0) || isSending || isRestrictedMode}
                    className={cn(
                      "p-3 text-white rounded-xl transition-colors disabled:opacity-50 md:p-2.5",
                      isInternalMode ? "bg-yellow-500 hover:bg-yellow-600" : "bg-[#15A862] hover:bg-[#0E8A4F]"
                    )}
                  >
                    {isInternalMode ? <Edit2 className="w-5 h-5" /> : <Send className="w-5 h-5" />}
                  </button>
                </AppTooltip>
              </form>
              <div className="mt-2 flex justify-end">
                {conversationHasAiBot(selectedConv) ? (
                  <button
                    type="button"
                    onClick={handleAiToggle}
                    disabled={isRestrictedMode}
                    className={cn(
                      "inline-flex items-center gap-1 text-[10px] font-medium italic transition-colors",
                      selectedConv.aiPaused
                        ? "text-amber-600 dark:text-amber-300"
                        : "text-[#25D366]",
                      isRestrictedMode ? "cursor-not-allowed opacity-60" : "hover:opacity-80"
                    )}
                  >
                    {selectedConv.aiPaused ? <BotOff className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                    {selectedConv.aiPaused ? 'AI chatbot paused. Agent is in control.' : 'Auto replying with AI Bot. Click to turn off.'}
                  </button>
                ) : (
                  <p className="text-[10px] text-gray-400 italic">
                    AI chatbot is not connected to this conversation.
                  </p>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="w-20 h-20 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-gray-300 dark:text-gray-600 mb-4 transition-colors">
              <MessageSquare className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {conversations.length === 0 ? 'Inbox is waiting for the first message' : 'No conversation selected'}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mt-2">
              {conversations.length === 0
                ? 'Once WhatsApp is connected, send a test message to your business number. The conversation will appear here in real time.'
                : 'Select a conversation from the list to start messaging.'}
            </p>
            {conversations.length === 0 && (
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Link to="/app/channels" className="rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#128C7E]">
                  Connect WhatsApp
                </Link>
                <Link to="/app/templates" className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-200 dark:hover:bg-slate-800">
                  Prepare templates
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile backdrop for contact panel */}
      {mobileContactPanel && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileContactPanel(false)}
        />
      )}
      {/* Right Column: Contact Info / Tasks / Activity */}
      <div className={cn(
        "w-full border-l border-gray-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900 transition-all duration-300 md:w-80",
        "fixed inset-y-0 right-0 z-50 md:relative md:translate-x-0",
        mobileContactPanel ? "translate-x-0" : "translate-x-full md:translate-x-0",
        "hidden md:flex",
        mobileContactPanel && "flex"
      )}>
        {selectedConv && (
          <>
            <div className="flex border-b border-gray-200 dark:border-slate-800 shrink-0">
              <button
                className="md:hidden px-3 py-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                onClick={() => setMobileContactPanel(false)}
              >
                <X className="w-4 h-4" />
              </button>
              <button
                onClick={() => setRightTab('info')}
                className={cn(
                  "flex-1 py-3 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all",
                  rightTab === 'info' ? "text-[#25D366] border-[#25D366]" : "text-gray-400 dark:text-gray-500 border-transparent hover:text-gray-600 dark:hover:text-gray-300"
                )}
              >
                Info
              </button>
              <button 
                onClick={() => setRightTab('tasks')}
                className={cn(
                  "flex-1 py-3 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all",
                  rightTab === 'tasks' ? "text-[#25D366] border-[#25D366]" : "text-gray-400 dark:text-gray-500 border-transparent hover:text-gray-600 dark:hover:text-gray-300"
                )}
              >
                Tasks
              </button>
              <button 
                onClick={() => setRightTab('activity')}
                className={cn(
                  "flex-1 py-3 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all",
                  rightTab === 'activity' ? "text-[#25D366] border-[#25D366]" : "text-gray-400 dark:text-gray-500 border-transparent hover:text-gray-600 dark:hover:text-gray-300"
                )}
              >
                Activity
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              {rightTab === 'info' && (
                <div className="space-y-8">
                  <div className="text-center">
                    <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[#D4EDDD] text-2xl font-semibold text-[#0A6E3F] ring-2 ring-[#FAFAF7] shadow-[0_0_0_3px_#E7E6DF] dark:bg-[#25D366]/15 dark:text-[#7DE2A8] dark:ring-slate-900 dark:shadow-[0_0_0_3px_rgba(51,65,85,1)]">
                      {selectedConv.contact.avatar ? (
                        <img src={selectedConv.contact.avatar} alt="" className="h-full w-full rounded-full object-cover" />
                      ) : (
                        getInitials(getConversationContactLabel(selectedConv.contact))
                      )}
                    </div>
                    <h3 className="font-serif text-2xl text-[#0F1A14] dark:text-white">
                      {getConversationContactLabel(selectedConv.contact)}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {selectedConv.channelType === 'INSTAGRAM' 
                        ? (selectedConv.contact.instagramUsername
                            ? `@${selectedConv.contact.instagramUsername}`
                            : getConversationContactLabel(selectedConv.contact))
                        : selectedConv.contact.phoneNumber}
                    </p>
                    
                    <div className="mt-4 flex flex-col gap-2">
                      <input
                        type="text"
                        value={contactDraft.name}
                        disabled={isRestrictedMode}
                        onChange={(e) => setContactDraft((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="Customer name"
                        className="w-full rounded-xl bg-gray-50 px-4 py-2 text-sm text-gray-700 outline-none transition-colors focus:ring-2 focus:ring-[#25D366]/20 dark:bg-slate-800 dark:text-gray-300"
                      />
                      <input
                        type="text"
                        value={contactDraft.phoneNumber}
                        disabled={isRestrictedMode || selectedConv.channelType === 'INSTAGRAM'}
                        onChange={(e) => setContactDraft((prev) => ({ ...prev, phoneNumber: e.target.value }))}
                        placeholder="Customer phone number"
                        className="w-full rounded-xl bg-gray-50 px-4 py-2 text-sm text-gray-700 outline-none transition-colors focus:ring-2 focus:ring-[#25D366]/20 dark:bg-slate-800 dark:text-gray-300 disabled:opacity-60"
                      />
                      <ContactListPicker
                        options={contactLists}
                        value={contactDraft.listNames}
                        disabled={isRestrictedMode}
                        onChange={(value) => setContactDraft((prev) => ({ ...prev, listNames: value }))}
                        placeholder="Add custom lists like Abu Dhabi, VIP, Follow Up"
                      />
                      <button
                        type="button"
                        disabled={isRestrictedMode}
                        onClick={() => updateContact(selectedConv.contact.id, {
                          name: contactDraft.name,
                          phoneNumber: selectedConv.channelType === 'INSTAGRAM' ? selectedConv.contact.phoneNumber : contactDraft.phoneNumber,
                          listNames: contactDraft.listNames
                        })}
                        className="rounded-xl bg-[#25D366] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#128C7E] disabled:opacity-50"
                      >
                        Save Contact
                      </button>
                      <select 
                        value={selectedConv.contact.pipelineStage || getFallbackPipelineStageKey(pipelineStages) || DEFAULT_PIPELINE_STAGE_KEY}
                        disabled={isRestrictedMode}
                        onChange={(e) => updateContact(selectedConv.contact.id, { pipelineStage: e.target.value })}
                        className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-xl border-none outline-none cursor-pointer uppercase tracking-wider transition-colors"
                      >
                        {pipelineStages.map((stage) => (
                          <option key={stage.id} value={stage.key}>{stage.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">AI Summary</h4>
                      <AppTooltip content="Generate a quick AI summary of this conversation" side="left">
                        <button
                          onClick={fetchSummary}
                          disabled={isSummarizing || isRestrictedMode}
                          className="text-[10px] font-bold text-[#25D366] uppercase hover:underline disabled:opacity-50"
                        >
                          {isSummarizing ? 'Summarizing...' : (summary ? 'Refresh' : 'Generate')}
                        </button>
                      </AppTooltip>
                    </div>
                    {summary ? (
                      <div className="p-3 bg-[#25D366]/5 dark:bg-[#25D366]/10 rounded-xl border border-[#25D366]/10 dark:border-[#25D366]/20">
                        <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed italic">
                          "{summary}"
                        </p>
                      </div>
                    ) : (
                      <p className="text-[10px] text-gray-400 italic">No summary generated yet.</p>
                    )}
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Lead Source</h4>
                    <span className="px-2 py-1 bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-400 text-[10px] font-bold rounded uppercase">
                      {selectedConv.contact.leadSource || 'Direct Search'}
                    </span>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Custom Attributes</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500 dark:text-gray-400">Vehicle Type</span>
                        <span className="font-medium text-gray-900 dark:text-gray-200">Light Vehicle</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500 dark:text-gray-400">Last Service</span>
                        <span className="font-medium text-gray-900 dark:text-gray-200">2024-03-01</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {rightTab === 'tasks' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Follow-up Tasks</h4>
                      <button 
                        disabled={isRestrictedMode}
                        onClick={() => setIsAddingTask(true)}
                        className="p-1 hover:bg-gray-50 dark:hover:bg-slate-800 rounded text-[#25D366]"
                      >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {isAddingTask && (
                    <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 space-y-3">
                      <input 
                        type="text"
                        placeholder="Task title..."
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#25D366]/20"
                      />
                      <div className="flex items-center gap-2">
                        <button 
                            onClick={async () => {
                              if (isRestrictedMode) return;
                              if (!newTaskTitle.trim()) return;
                            try {
                              await axios.post('/api/tasks', {
                                title: newTaskTitle,
                                workspaceId: activeWorkspace?.id,
                                contactId: selectedConv.contact.id,
                                conversationId: selectedConv.id,
                                priority: 'MEDIUM'
                              });
                              setNewTaskTitle('');
                              setIsAddingTask(false);
                              loadConversationDetails(selectedConv.id);
                              fetchConversations(selectedConv.id);
                            } catch (e) {
                              console.error(e);
                            }
                          }}
                          className="flex-1 py-1.5 bg-[#25D366] text-white text-[10px] font-bold rounded-lg uppercase"
                        >
                          Save
                        </button>
                        <button 
                          onClick={() => setIsAddingTask(false)}
                          className="flex-1 py-1.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-400 dark:text-gray-500 text-[10px] font-bold rounded-lg uppercase"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    {selectedConv.tasks?.length ? selectedConv.tasks.map((task) => (
                      <div key={task.id} className="p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm">
                        <div className="flex items-start gap-3">
                          <button 
                            onClick={async () => {
                              if (isRestrictedMode) return;
                              try {
                                await axios.patch(`/api/tasks/${task.id}`, { status: task.status === 'PENDING' ? 'COMPLETED' : 'PENDING' });
                                loadConversationDetails(selectedConv.id);
                                fetchConversations(selectedConv.id);
                              } catch (e) { console.error(e); }
                            }}
                            className={cn(
                              "w-4 h-4 rounded border mt-0.5 flex items-center justify-center transition-colors",
                              task.status === 'COMPLETED' ? "bg-[#25D366] border-[#25D366] text-white" : "border-gray-200 dark:border-slate-600 hover:border-[#25D366]"
                            )}
                          >
                            {task.status === 'COMPLETED' && <Check className="w-3 h-3" />}
                          </button>
                          <div>
                            <p className={cn("text-xs font-medium", task.status === 'COMPLETED' ? "text-gray-400 dark:text-gray-500 line-through" : "text-gray-900 dark:text-gray-100")}>
                              {task.title}
                            </p>
                            {task.dueDate && (
                              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">Due {format(new Date(task.dueDate), 'MMM dd')}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )) : (
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 italic text-center py-8">No tasks for this conversation.</p>
                    )}
                  </div>
                </div>
              )}

              {rightTab === 'activity' && (
                <div className="space-y-6">
                  <h4 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Activity Timeline</h4>
                  <div className="relative space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-gray-100 dark:before:bg-slate-800">
                    {selectedConv.activities?.length ? selectedConv.activities.map((activity) => (
                      <div key={activity.id} className="relative pl-8">
                        <div className="absolute left-0 top-1.5 w-4 h-4 bg-white dark:bg-slate-900 border-2 border-[#25D366] rounded-full z-10" />
                        <p className="text-xs text-gray-900 dark:text-gray-100 font-medium">{activity.content}</p>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">{format(new Date(activity.createdAt), 'MMM dd, HH:mm')}</p>
                      </div>
                    )) : (
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 italic text-center py-8">No activity recorded yet.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
