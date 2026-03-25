import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
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
  Trash2
} from 'lucide-react';
import { cn, getDisplayName } from '../lib/utils';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { generateReplySuggestions, summarizeConversation } from '../services/aiService';
import ActivationChecklist from '../components/ActivationChecklist';
import { toast } from 'sonner';
import ContactListPicker from '../components/ContactListPicker';
import AppTooltip from '../components/AppTooltip';
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

function MessageMedia({ message }: { message: Message }) {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(message.mediaId));
  const [error, setError] = useState<string | null>(null);

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
          Loading media...
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
            Download audio
          </a>
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

export default function Inbox() {
  const { activeWorkspace, workspaces, setActiveWorkspace, user, hasFullAccess, hasVerifiedEmail } = useApp();
  const currentUserDisplayName = getDisplayName(user?.name, user?.email);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isInternalMode, setIsInternalMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [rightTab, setRightTab] = useState<'info' | 'tasks' | 'activity'>('info');
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [slaBreachAlert, setSlaBreachAlert] = useState<string | null>(null);
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
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [channelFilter, setChannelFilter] = useState<'ALL' | 'WHATSAPP'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'WAITING_FOR_CUSTOMER' | 'WAITING_FOR_INTERNAL' | 'RESOLVED'>('ALL');
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

    return matchesSearch && matchesChannel && matchesStatus;
  });
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

      if (data.length > 0 && !selectedConv) {
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
      fetchSuggestions(id, data);
    } catch (error) {
      console.error('Failed to fetch messages', error);
    }
  };

  const fetchSuggestions = async (id: string, messageList?: Message[]) => {
    if (isInternalMode) return;
    setIsLoadingSuggestions(true);
    try {
      // Format history for AI
      const history = (messageList || messages)
        .filter(m => !m.isInternal)
        .map(m => ({
          content: m.content,
          senderType: m.senderType
        }));
      
      if (!activeWorkspace?.id) {
        throw new Error('Workspace is required to generate AI suggestions');
      }

      const data = await generateReplySuggestions(activeWorkspace.id, history);
      setSuggestions(data);
    } catch (error) {
      console.error('Failed to fetch suggestions', error);
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.error || 'Could not generate AI suggestions');
      } else {
        toast.error('Could not generate AI suggestions');
      }
    } finally {
      setIsLoadingSuggestions(false);
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
      fetchSuggestions(selectedConv.id);
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
          label: 'Waiting for customer'
        };
      case 'WAITING_FOR_INTERNAL':
        return {
          rail: 'before:bg-purple-500',
          pill: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
          label: 'Waiting for internal'
        };
      case 'RESOLVED':
        return {
          rail: 'before:bg-green-500',
          pill: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
          label: 'Resolved'
        };
      default:
        return {
          rail: 'before:bg-slate-200 dark:before:bg-slate-700',
          pill: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
          label: 'Open'
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
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No workspace selected</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mt-2 mb-8">
          {workspaces.length > 0 
            ? "Please select one of your workspaces below to view your inbox."
            : "You don't have any workspaces yet. Please create one to get started."}
        </p>
        
        {workspaces.length === 0 && (
          <div className="mb-8 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 rounded-2xl text-amber-700 dark:text-amber-400 text-xs max-w-xs">
            <p className="font-bold mb-1">Having trouble?</p>
            <p className="mb-3">If you can't create a workspace, the system might need a quick repair.</p>
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
              Run Quick Repair
            </button>
          </div>
        )}

        {workspaces.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-md">
            {workspaces.map(ws => (
              <button
                key={ws.id}
                onClick={() => setActiveWorkspace(ws)}
                className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl hover:border-[#25D366] hover:shadow-md transition-all text-left group cursor-pointer"
              >
                <div className="w-10 h-10 bg-gray-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-gray-400 dark:text-gray-600 group-hover:bg-[#25D366]/10 group-hover:text-[#25D366] font-bold">
                  {ws.name[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{ws.name}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    {ws.plan === 'NONE' ? 'NO PLAN SELECTED' : `${ws.plan} Plan`}
                  </p>
                </div>
              </button>
            ))}
            <button 
              onClick={() => setIsCreatingWorkspace(true)}
              className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-slate-900/50 border border-dashed border-gray-200 dark:border-slate-800 rounded-2xl hover:border-[#25D366] hover:bg-white dark:hover:bg-slate-900 transition-all text-left group cursor-pointer"
            >
              <div className="w-10 h-10 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-800 rounded-xl flex items-center justify-center text-gray-400 dark:text-gray-600 group-hover:text-[#25D366]">
                <Plus className="w-5 h-5" />
              </div>
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 group-hover:text-[#25D366]">New Workspace</p>
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
                Create Your First Workspace
              </button>
            ) : (
              <form onSubmit={handleCreateWorkspace} className="bg-gray-50 dark:bg-slate-900 p-6 rounded-2xl border border-gray-100 dark:border-slate-800">
                <input
                  autoFocus
                  type="text"
                  placeholder="Workspace Name (e.g. My Business)"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#25D366]/20 mb-4"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreatingWorkspace(false)}
                    className="flex-1 px-4 py-2 text-sm font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newWorkspaceName.trim() || isCreating}
                    className="flex-1 px-4 py-2 text-sm font-bold bg-[#25D366] text-white rounded-xl hover:bg-[#128C7E] transition-colors disabled:opacity-50"
                  >
                    {isCreating ? 'Creating...' : 'Create'}
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
    <div className="h-full flex bg-white dark:bg-slate-950 transition-colors">
      {/* Left Column: Conversation List */}
      <div className="w-80 border-r border-gray-100 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900 transition-colors">
        {isRestrictedMode && (
          <div className="mx-4 mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
            {hasVerifiedEmail
              ? 'Inbox is view-only until you subscribe to a plan in Billing.'
              : 'Verify your email first, then choose a plan in Billing to unlock replies and CRM actions.'}
          </div>
        )}
        <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-[#25D366] rounded-full" />
            <span className="font-medium text-sm dark:text-gray-200">Active</span>
          </div>
          <div className="flex items-center gap-2">
            <AppTooltip content="Search conversations" side="bottom">
              <button
                onClick={() => setIsSearchOpen((prev) => !prev)}
                className={cn(
                  "p-1.5 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg transition-colors",
                  isSearchOpen ? "text-[#25D366] bg-[#25D366]/10" : "text-gray-400"
                )}
              >
                <Search className="w-4 h-4" />
              </button>
            </AppTooltip>
            <AppTooltip content="Filter conversations" side="bottom">
              <button
                onClick={() => setShowFilters((prev) => !prev)}
                className={cn(
                  "p-1.5 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg transition-colors",
                  showFilters || channelFilter !== 'ALL' || statusFilter !== 'ALL'
                    ? "text-[#25D366] bg-[#25D366]/10"
                    : "text-gray-400"
                )}
              >
                <Filter className="w-4 h-4" />
              </button>
            </AppTooltip>
          </div>
        </div>

        {(isSearchOpen || showFilters) && (
          <div className="border-b border-gray-100 dark:border-slate-800 px-4 py-3 space-y-3 bg-white dark:bg-slate-900">
            {isSearchOpen && (
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, number, or latest message..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            )}

            {showFilters && (
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={channelFilter}
                  onChange={(e) => setChannelFilter(e.target.value as 'ALL' | 'WHATSAPP')}
                  className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700 outline-none focus:border-[#25D366] dark:border-slate-700 dark:bg-slate-800 dark:text-gray-200"
                >
                  <option value="ALL">All channels</option>
                  <option value="WHATSAPP">WhatsApp</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'OPEN' | 'WAITING_FOR_CUSTOMER' | 'WAITING_FOR_INTERNAL' | 'RESOLVED')}
                  className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700 outline-none focus:border-[#25D366] dark:border-slate-700 dark:bg-slate-800 dark:text-gray-200"
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
                    setChannelFilter('ALL');
                    setStatusFilter('ALL');
                  }}
                  className="col-span-2 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-500 transition-colors hover:border-[#25D366] hover:text-[#25D366] dark:border-slate-700 dark:text-gray-400"
                >
                  Clear search and filters
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {filteredConversations.map((conv) => {
            const unreadCount = conv.unreadCount || 0;
            const hasUnread = unreadCount > 0;

            return (
            <button
              key={conv.id}
              onClick={() => setSelectedConv(conv)}
              className={cn(
                "relative w-full p-4 flex items-center gap-3 transition-colors border-b border-gray-50 dark:border-slate-800/50 before:absolute before:left-0 before:top-3 before:bottom-3 before:rounded-r-full",
                getConversationStatusStyles(conv.internalStatus).rail,
                selectedConv?.id === conv.id
                  ? "bg-[#25D366]/5 dark:bg-[#25D366]/10"
                  : hasUnread
                    ? "before:w-1.5 border-l-4 border-l-[#25D366] bg-[#25D366]/[0.09] shadow-[inset_0_0_0_1px_rgba(37,211,102,0.12)] hover:bg-[#25D366]/[0.14] dark:bg-[#25D366]/[0.12] dark:hover:bg-[#25D366]/[0.18]"
                    : "hover:bg-gray-50 dark:hover:bg-slate-800/50"
              )}
            >
              <div className="w-12 h-12 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-gray-400 shrink-0 relative">
                {conv.contact.avatar ? (
                  <img src={conv.contact.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <User className="w-6 h-6" />
                )}
                <div className={cn(
                  "absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-white",
                  conv.channelType === 'INSTAGRAM' ? "bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF]" : "bg-[#25D366]"
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
                          ? "font-bold text-gray-950 dark:text-white"
                          : "font-medium text-gray-900 dark:text-gray-100"
                      )}>
                        {getConversationContactLabel(conv.contact)}
                      </h3>
                      {hasUnread && (
                        <span className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-[#25D366]" title="Unread conversation" />
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
                        ? "font-bold text-[#128C7E] dark:text-[#7DE2A8]"
                        : "text-gray-400"
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
                      <span className="inline-flex items-center rounded-full bg-[#25D366] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm">
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
                        ? "font-semibold text-gray-800 dark:text-gray-200"
                        : "text-gray-500"
                    )}>
                      {conv.messages[0]?.content || 'No messages'}
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      {hasUnread && (
                        <span className="min-w-6 rounded-full bg-[#25D366] px-2 py-0.5 text-center text-[10px] font-extrabold text-white shadow-sm">
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
            <div className="px-6 py-12 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 dark:bg-slate-800 dark:text-gray-500">
                <Search className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">No conversations match</p>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                Try a different search term or clear the active filters.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Center Column: Chat Timeline */}
      <div className="flex-1 flex flex-col bg-[#F8F9FA] dark:bg-slate-950 transition-colors">
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
          <div className="shrink-0 border-b border-gray-100 p-6 dark:border-slate-800">
            <ActivationChecklist />
          </div>
        )}
        {selectedConv ? (
          <>
            <div className="h-16 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 px-6 flex items-center justify-between shrink-0 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-gray-400">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                      {getConversationContactLabel(selectedConv.contact)}
                    </h2>
                    <select 
                      value={selectedConv.priority}
                      onChange={(e) => updateConversation(selectedConv.id, { priority: e.target.value as any })}
                      className={cn(
                        "text-[10px] font-bold px-1.5 py-0.5 rounded border-none outline-none cursor-pointer",
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
                        "text-[10px] font-bold px-1.5 py-0.5 rounded border-none outline-none cursor-pointer",
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
                  <p className="text-[10px] text-[#25D366] font-medium uppercase tracking-wider">
                    Online
                  </p>
                  {getAssignedBotName(selectedConv) && (
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">
                      Bot: <span className="font-semibold text-gray-600 dark:text-gray-300">{getAssignedBotName(selectedConv)}</span>
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3">
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
                        "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
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
                  className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800"
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
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-100 dark:border-slate-700">
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
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-slate-800 rounded-lg border border-gray-100 dark:border-slate-700">
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
                <div className="relative">
                  <AppTooltip content="Conversation actions" side="bottom">
                    <button
                      onClick={() => setShowConvMenu(prev => !prev)}
                      className="p-2 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg text-gray-400"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </AppTooltip>
                  {showConvMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowConvMenu(false)} />
                      <div className="absolute right-0 top-full mt-1 z-50 w-52 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-100 dark:border-slate-700 py-1 text-sm">
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
                        <div className="border-t border-gray-100 dark:border-slate-700 my-1" />
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
              className="flex-1 overflow-y-auto p-6 space-y-6"
            >
              {messages.map((msg) => {
                const quotedMsg = msg.replyToId ? messages.find(m => m.id === msg.replyToId) : null;
                return (
                <div
                  key={msg.id}
                  id={`msg-${msg.id}`}
                  className={cn(
                    "flex flex-col group/msg transition-all duration-300",
                    msg.isInternal ? "items-center w-full" : (msg.direction === 'OUTGOING' ? "ml-auto items-end max-w-[70%]" : "mr-auto items-start max-w-[70%]")
                  )}
                >
                  <div className={cn("flex items-center gap-1", msg.direction === 'OUTGOING' ? "flex-row-reverse" : "flex-row")}>
                    <div
                      className={cn(
                        "px-4 py-2.5 rounded-2xl text-sm shadow-sm transition-colors",
                        msg.isInternal
                          ? "bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-900/30 text-yellow-800 dark:text-yellow-200 w-full max-w-2xl italic"
                          : (msg.direction === 'OUTGOING'
                            ? "bg-[#DCF8C6] dark:bg-[#25D366]/20 text-gray-800 dark:text-gray-100 rounded-tr-none"
                            : "bg-white dark:bg-slate-800 text-gray-800 dark:text-gray-100 rounded-tl-none")
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
                              {quotedMsg.type === 'IMAGE' ? '📷 Photo' : quotedMsg.type === 'AUDIO' ? '🎵 Audio' : quotedMsg.type === 'DOCUMENT' ? `📄 ${quotedMsg.mediaFilename || 'Document'}` : quotedMsg.content}
                            </div>
                          </div>
                          {quotedMsg.type === 'IMAGE' && quotedMsg.mediaId && (
                            <QuoteThumbnail message={quotedMsg} />
                          )}
                        </div>
                      )}
                      {!msg.isInternal && msg.direction === 'OUTGOING' && (
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
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
                        className="opacity-0 group-hover/msg:opacity-100 transition-opacity p-1 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        title="Reply"
                      >
                        <Reply className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5 px-1">
                    {msg.senderType === 'AI_BOT' && !msg.senderName && (
                      <span className="text-[10px] font-bold text-[#25D366] uppercase tracking-tighter">AI Bot</span>
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
              <div className="px-4 py-2 bg-gray-50 dark:bg-slate-800 border-t border-gray-100 dark:border-slate-700 flex items-center gap-3">
                <div className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-slate-700 border-l-4 border-[#25D366] text-sm flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[#25D366] text-xs mb-0.5">
                      {replyToMessage.direction === 'INCOMING' ? (selectedConv?.contact?.name || 'Customer') : (replyToMessage.senderName || 'You')}
                    </div>
                    <div className="text-gray-600 dark:text-gray-300 text-xs line-clamp-1">
                      {replyToMessage.type === 'IMAGE' ? '📷 Photo' : replyToMessage.type === 'AUDIO' ? '🎵 Audio' : replyToMessage.type === 'DOCUMENT' ? `📄 ${replyToMessage.mediaFilename || 'Document'}` : replyToMessage.content}
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

            <div className="p-4 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 shrink-0 transition-colors">
              <div className="flex items-center gap-4 mb-3 px-1">
                <button 
                  onClick={() => setIsInternalMode(false)}
                  className={cn(
                    "text-xs font-bold uppercase tracking-widest pb-1 transition-all border-b-2",
                    !isInternalMode ? "text-[#25D366] border-[#25D366]" : "text-gray-400 dark:text-gray-500 border-transparent hover:text-gray-600 dark:hover:text-gray-300"
                  )}
                >
                  Reply
                </button>
                <button 
                  onClick={() => setIsInternalMode(true)}
                  className={cn(
                    "text-xs font-bold uppercase tracking-widest pb-1 transition-all border-b-2",
                    isInternalMode ? "text-yellow-600 border-yellow-600" : "text-gray-400 dark:text-gray-500 border-transparent hover:text-gray-600 dark:hover:text-gray-300"
                  )}
                >
                  Internal Note
                </button>
              </div>

              {!isInternalMode && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {isLoadingSuggestions ? (
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 animate-pulse px-2">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Generating AI suggestions...
                    </div>
                  ) : (
                    suggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => setNewMessage(suggestion)}
                        className={cn(
                          "px-3 py-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-full text-xs text-gray-600 dark:text-gray-300 hover:border-[#25D366] hover:text-[#25D366] transition-all shadow-sm"
                        )}
                      >
                        {suggestion}
                      </button>
                    ))
                  )}
                </div>
              )}

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

              <form onSubmit={handleSendMessage} className="flex items-center gap-2">
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
                        className="p-2 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg text-gray-400"
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
                      className="p-2 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg text-gray-400"
                    >
                      <Paperclip className="w-5 h-5" />
                    </button>
                  </AppTooltip>
                  <div className="relative">
                    <AppTooltip content="Insert template" side="top">
                      <button
                        type="button"
                        onClick={handleTemplatePickerToggle}
                        className="p-2 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg text-gray-400"
                      >
                        <FileText className="w-5 h-5" />
                      </button>
                    </AppTooltip>
                    {showTemplatePicker && (
                      <div className="absolute bottom-12 left-0 z-20 w-80 max-h-[26rem] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                        <div className="border-b border-gray-100 px-3 py-3 dark:border-slate-800">
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
                    "flex-1 border-none rounded-xl px-4 py-2.5 text-sm outline-none transition-all",
                    isInternalMode 
                      ? "bg-yellow-50 dark:bg-yellow-900/20 focus:ring-2 focus:ring-yellow-200 dark:focus:ring-yellow-900/40 text-yellow-900 dark:text-yellow-100 placeholder:text-yellow-400 dark:placeholder:text-yellow-700" 
                      : "bg-gray-50 dark:bg-slate-800 focus:ring-2 focus:ring-[#25D366]/20 dark:focus:ring-[#25D366]/10 text-gray-900 dark:text-gray-100 transition-colors"
                  )}
                />
                <AppTooltip content="Voice note recording is coming soon" side="top">
                  <button type="button" className="p-2 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg text-gray-400">
                    <Mic className="w-5 h-5" />
                  </button>
                </AppTooltip>
                <AppTooltip content={isInternalMode ? 'Save internal note' : 'Send message'} side="top">
                  <button 
                    type="submit"
                    disabled={(!newMessage.trim() && pendingAttachments.length === 0) || isSending || isRestrictedMode}
                    className={cn(
                      "p-2.5 text-white rounded-xl transition-colors disabled:opacity-50",
                      isInternalMode ? "bg-yellow-500 hover:bg-yellow-600" : "bg-[#25D366] hover:bg-[#128C7E]"
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
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No conversation selected</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mt-2">
              Select a conversation from the list to start messaging.
            </p>
          </div>
        )}
      </div>

      {/* Right Column: Contact Info / Tasks / Activity */}
      <div className="w-80 border-l border-gray-100 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900 transition-colors">
        {selectedConv && (
          <>
            <div className="flex border-b border-gray-100 dark:border-slate-800 shrink-0">
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

            <div className="flex-1 overflow-y-auto p-6">
              {rightTab === 'info' && (
                <div className="space-y-8">
                  <div className="text-center">
                    <div className="w-20 h-20 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-gray-400 mx-auto mb-4">
                      <User className="w-10 h-10" />
                    </div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
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
                    <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 space-y-3">
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
                      <div key={task.id} className="p-3 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl shadow-sm">
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
