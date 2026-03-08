import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useApp } from '../contexts/AppContext';
import { 
  Search, 
  Filter, 
  MoreVertical, 
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
  Users
} from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

interface Message {
  id: string;
  content: string;
  direction: 'INCOMING' | 'OUTGOING';
  senderType: 'USER' | 'AI_BOT' | 'SYSTEM';
  senderName?: string;
  status: string;
  isInternal?: boolean;
  createdAt: string;
}

interface Conversation {
  id: string;
  channelType: 'WHATSAPP' | 'INSTAGRAM';
  contact: {
    id: string;
    name: string;
    phoneNumber?: string;
    instagramUsername?: string;
    avatar?: string;
  };
  messages: Message[];
  lastMessageAt: string;
  number?: {
    phoneNumber: string;
  };
  instagramAccount?: {
    username: string;
  };
}

export default function Inbox() {
  const { activeWorkspace, user } = useApp();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isInternalMode, setIsInternalMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeWorkspace) {
      fetchConversations();
    } else {
      // If activeWorkspace is null, we shouldn't keep loading forever
      // especially if the app context itself has finished loading
      setIsLoading(false);
    }
  }, [activeWorkspace]);

  useEffect(() => {
    if (selectedConv) {
      fetchMessages(selectedConv.id);
    }
  }, [selectedConv]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchConversations = async () => {
    try {
      const res = await axios.get(`/api/conversations?workspaceId=${activeWorkspace?.id}`);
      const data = Array.isArray(res.data) ? res.data : [];
      setConversations(data);
      if (data.length > 0 && !selectedConv) {
        setSelectedConv(data[0]);
      }
    } catch (error) {
      console.error('Failed to fetch conversations', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMessages = async (id: string) => {
    try {
      const res = await axios.get(`/api/conversations/${id}`);
      const data = res.data?.messages || [];
      setMessages(data);
      fetchSuggestions(id);
    } catch (error) {
      console.error('Failed to fetch messages', error);
    }
  };

  const fetchSuggestions = async (id: string) => {
    if (isInternalMode) return;
    setIsLoadingSuggestions(true);
    try {
      const res = await axios.get(`/api/ai/suggestions?conversationId=${id}`);
      const data = Array.isArray(res.data) ? res.data : [];
      setSuggestions(data);
    } catch (error) {
      console.error('Failed to fetch suggestions', error);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConv || isSending) return;

    setIsSending(true);
    try {
      const res = await axios.post('/api/messages', {
        conversationId: selectedConv.id,
        content: newMessage,
        direction: 'OUTGOING',
        senderType: 'USER',
        isInternal: isInternalMode,
        senderName: user?.name
      });
      setMessages([...messages, res.data]);
      setNewMessage('');
      fetchConversations(); // Update last message in list
      fetchSuggestions(selectedConv.id);
    } catch (error) {
      console.error('Failed to send message', error);
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#25D366] animate-spin" />
      </div>
    );
  }

  if (!activeWorkspace) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-white">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-gray-300 mb-4">
          <Users className="w-10 h-10" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">No workspace selected</h3>
        <p className="text-sm text-gray-500 max-w-xs mt-2">
          Please select a workspace from the user menu in the sidebar to view your inbox.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex bg-white">
      {/* Left Column: Conversation List */}
      <div className="w-80 border-r border-gray-100 flex flex-col">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-[#25D366] rounded-full" />
            <span className="font-medium text-sm">Active</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-1.5 hover:bg-gray-50 rounded-lg text-gray-400">
              <Search className="w-4 h-4" />
            </button>
            <button className="p-1.5 hover:bg-gray-50 rounded-lg text-gray-400">
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setSelectedConv(conv)}
              className={cn(
                "w-full p-4 flex items-center gap-3 transition-colors border-b border-gray-50",
                selectedConv?.id === conv.id ? "bg-[#25D366]/5" : "hover:bg-gray-50"
              )}
            >
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 shrink-0 relative">
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
                  <h3 className="font-medium text-sm text-gray-900 truncate">
                    {conv.contact.name || conv.contact.phoneNumber || conv.contact.instagramUsername}
                  </h3>
                  <span className="text-[10px] text-gray-400">
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
                <p className="text-xs text-gray-500 truncate">
                  {conv.messages[0]?.content || 'No messages'}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Center Column: Chat Timeline */}
      <div className="flex-1 flex flex-col bg-[#F8F9FA]">
        {selectedConv ? (
          <>
            <div className="h-16 bg-white border-b border-gray-100 px-6 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-400">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">
                    {selectedConv.contact.name || selectedConv.contact.phoneNumber || selectedConv.contact.instagramUsername}
                  </h2>
                  <p className="text-[10px] text-[#25D366] font-medium uppercase tracking-wider">
                    Online
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-100">
                  <span className="text-xs text-gray-500">From:</span>
                  <span className="text-xs font-medium text-gray-700">
                    {selectedConv.channelType === 'INSTAGRAM' 
                      ? `@${selectedConv.instagramAccount?.username || 'instagram'}`
                      : selectedConv.number?.phoneNumber || '+971 50 123 4567'}
                  </span>
                </div>
                <button className="p-2 hover:bg-gray-50 rounded-lg text-gray-400">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-6 space-y-6"
            >
              {messages.map((msg) => (
                <div 
                  key={msg.id}
                  className={cn(
                    "flex flex-col",
                    msg.isInternal ? "items-center w-full" : (msg.direction === 'OUTGOING' ? "ml-auto items-end max-w-[70%]" : "mr-auto items-start max-w-[70%]")
                  )}
                >
                  <div 
                    className={cn(
                      "px-4 py-2.5 rounded-2xl text-sm shadow-sm",
                      msg.isInternal 
                        ? "bg-yellow-50 border border-yellow-100 text-yellow-800 w-full max-w-2xl italic"
                        : (msg.direction === 'OUTGOING' 
                          ? "bg-[#DCF8C6] text-gray-800 rounded-tr-none" 
                          : "bg-white text-gray-800 rounded-tl-none")
                    )}
                  >
                    {msg.isInternal && (
                      <div className="flex items-center gap-2 mb-1 not-italic">
                        <Edit2 className="w-3 h-3" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Internal Note</span>
                        {msg.senderName && <span className="text-[10px] opacity-60">• {msg.senderName}</span>}
                      </div>
                    )}
                    {msg.content}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5 px-1">
                    {msg.senderType === 'AI_BOT' && (
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
                      <CheckCheck className="w-3 h-3 text-[#25D366]" />
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-white border-t border-gray-100 shrink-0">
              <div className="flex items-center gap-4 mb-3 px-1">
                <button 
                  onClick={() => setIsInternalMode(false)}
                  className={cn(
                    "text-xs font-bold uppercase tracking-widest pb-1 transition-all border-b-2",
                    !isInternalMode ? "text-[#25D366] border-[#25D366]" : "text-gray-400 border-transparent hover:text-gray-600"
                  )}
                >
                  Reply
                </button>
                <button 
                  onClick={() => setIsInternalMode(true)}
                  className={cn(
                    "text-xs font-bold uppercase tracking-widest pb-1 transition-all border-b-2",
                    isInternalMode ? "text-yellow-600 border-yellow-600" : "text-gray-400 border-transparent hover:text-gray-600"
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
                        className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs text-gray-600 hover:border-[#25D366] hover:text-[#25D366] transition-all shadow-sm"
                      >
                        {suggestion}
                      </button>
                    ))
                  )}
                </div>
              )}

              <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <button type="button" className="p-2 hover:bg-gray-50 rounded-lg text-gray-400">
                    <Smile className="w-5 h-5" />
                  </button>
                  <button type="button" className="p-2 hover:bg-gray-50 rounded-lg text-gray-400">
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <button type="button" className="p-2 hover:bg-gray-50 rounded-lg text-gray-400">
                    <FileText className="w-5 h-5" />
                  </button>
                </div>
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={isInternalMode ? "Type an internal note (only your team sees this)..." : "Type a message..."}
                  className={cn(
                    "flex-1 border-none rounded-xl px-4 py-2.5 text-sm outline-none transition-all",
                    isInternalMode 
                      ? "bg-yellow-50 focus:ring-2 focus:ring-yellow-200 text-yellow-900 placeholder:text-yellow-400" 
                      : "bg-gray-50 focus:ring-2 focus:ring-[#25D366]/20 text-gray-900"
                  )}
                />
                <button type="button" className="p-2 hover:bg-gray-50 rounded-lg text-gray-400">
                  <Mic className="w-5 h-5" />
                </button>
                <button 
                  type="submit"
                  disabled={!newMessage.trim() || isSending}
                  className={cn(
                    "p-2.5 text-white rounded-xl transition-colors disabled:opacity-50",
                    isInternalMode ? "bg-yellow-500 hover:bg-yellow-600" : "bg-[#25D366] hover:bg-[#128C7E]"
                  )}
                >
                  {isInternalMode ? <Edit2 className="w-5 h-5" /> : <Send className="w-5 h-5" />}
                </button>
              </form>
              <div className="mt-2 flex justify-end">
                <p className="text-[10px] text-gray-400 italic">
                  Auto replying with AI Bot
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-gray-300 mb-4">
              <MessageSquare className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">No conversation selected</h3>
            <p className="text-sm text-gray-500 max-w-xs mt-2">
              Select a conversation from the list to start messaging.
            </p>
          </div>
        )}
      </div>

      {/* Right Column: Contact Info */}
      <div className="w-72 border-l border-gray-100 flex flex-col bg-white">
        {selectedConv && (
          <div className="p-6 space-y-8 overflow-y-auto">
            <div className="text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 mx-auto mb-4">
                <User className="w-10 h-10" />
              </div>
              <h3 className="font-semibold text-gray-900">
                {selectedConv.contact.name || 'Unknown Contact'}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {selectedConv.channelType === 'INSTAGRAM' 
                  ? `@${selectedConv.contact.instagramUsername}`
                  : selectedConv.contact.phoneNumber}
              </p>
              <button className="mt-4 flex items-center gap-2 px-4 py-1.5 bg-gray-50 text-gray-600 text-xs font-medium rounded-full hover:bg-gray-100 mx-auto">
                <Edit2 className="w-3 h-3" />
                Edit Profile
              </button>
            </div>

            <div className="space-y-4">
              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Custom Attributes</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Vehicle Type</span>
                  <span className="font-medium text-gray-900">Light Vehicle</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Last Service</span>
                  <span className="font-medium text-gray-900">2024-03-01</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Permissions</h4>
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-green-50 text-green-600 text-[10px] font-bold rounded uppercase">Allowed</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Notes</h4>
                <button className="text-[10px] font-bold text-[#25D366] uppercase">Add Note</button>
              </div>
              <div className="space-y-3">
                <div className="p-3 bg-gray-50 rounded-xl">
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Customer is interested in heavy bus registration services. Follow up next week.
                  </p>
                  <p className="text-[10px] text-gray-400 mt-2">Mar 08, 2024</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
