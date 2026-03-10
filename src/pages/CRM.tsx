import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useApp } from '../contexts/AppContext';
import { 
  Loader2, 
  User, 
  Phone, 
  MoreVertical, 
  Plus,
  Search,
  Filter,
  ArrowRight
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

interface Contact {
  id: string;
  name: string;
  phoneNumber?: string;
  pipelineStage: string;
  conversations: any[];
}

const STAGES = [
  { id: 'NEW_LEAD', label: 'New Lead', color: 'bg-blue-500' },
  { id: 'CONTACTED', label: 'Contacted', color: 'bg-indigo-500' },
  { id: 'QUALIFIED', label: 'Qualified', color: 'bg-purple-500' },
  { id: 'QUOTE_SENT', label: 'Quote Sent', color: 'bg-orange-500' },
  { id: 'WON', label: 'Won', color: 'bg-green-500' },
  { id: 'LOST', label: 'Lost', color: 'bg-red-500' },
];

export default function CRM() {
  const { activeWorkspace } = useApp();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (activeWorkspace) {
      fetchContacts();
    }
  }, [activeWorkspace]);

  const fetchContacts = async () => {
    try {
      const res = await axios.get(`/api/contacts?workspaceId=${activeWorkspace?.id}`);
      setContacts(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Failed to fetch contacts', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateStage = async (contactId: string, newStage: string) => {
    try {
      await axios.patch(`/api/contacts/${contactId}`, { pipelineStage: newStage });
      setContacts(contacts.map(c => c.id === contactId ? { ...c, pipelineStage: newStage } : c));
    } catch (error) {
      console.error('Failed to update stage', error);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#25D366] animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#F8F9FA] dark:bg-slate-950 transition-colors">
      <div className="h-16 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 px-8 flex items-center justify-between shrink-0 transition-colors">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">CRM Pipeline</h1>
          <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 dark:bg-slate-800 rounded-full border border-gray-100 dark:border-slate-700">
            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Total Leads:</span>
            <span className="text-xs font-bold text-[#25D366]">{contacts.length}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search leads..."
              className="pl-9 pr-4 py-2 bg-gray-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-[#25D366]/20 dark:focus:ring-[#25D366]/10 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600 transition-all w-64"
            />
          </div>
          <button className="p-2 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl text-gray-400 border border-gray-100 dark:border-slate-800 transition-colors">
            <Filter className="w-4 h-4" />
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white text-sm font-bold rounded-xl hover:bg-[#128C7E] transition-colors shadow-sm">
            <Plus className="w-4 h-4" />
            Add Lead
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto p-8">
        <div className="flex gap-6 h-full min-w-max">
          {STAGES.map((stage) => (
            <div key={stage.id} className="w-72 flex flex-col gap-4">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", stage.color)} />
                  <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{stage.label}</h3>
                  <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded transition-colors">
                    {contacts.filter(c => c.pipelineStage === stage.id).length}
                  </span>
                </div>
                <button className="text-gray-300 hover:text-gray-500">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 bg-gray-100/50 dark:bg-slate-900/50 rounded-2xl p-3 space-y-3 overflow-y-auto border border-dashed border-gray-200 dark:border-slate-800 transition-colors">
                {contacts
                  .filter(c => c.pipelineStage === stage.id)
                  .map((contact) => (
                    <motion.div
                      layoutId={contact.id}
                      key={contact.id}
                      className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 group hover:border-[#25D366]/30 transition-all cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-8 h-8 bg-gray-50 dark:bg-slate-700 rounded-full flex items-center justify-center text-gray-400">
                          <User className="w-4 h-4" />
                        </div>
                        <div className="flex items-center gap-1">
                          {STAGES.indexOf(stage) < STAGES.length - 1 && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                updateStage(contact.id, STAGES[STAGES.indexOf(stage) + 1].id);
                              }}
                              className="p-1 hover:bg-gray-50 dark:hover:bg-slate-700 rounded text-gray-300 hover:text-[#25D366] transition-colors"
                              title="Move to next stage"
                            >
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1">{contact.name || 'Unknown'}</h4>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-3">
                        <Phone className="w-3 h-3" />
                        {contact.phoneNumber}
                      </div>
                      <div className="pt-3 border-t border-gray-50 dark:border-slate-700 flex items-center justify-between">
                        <div className="flex -space-x-1">
                          <div className="w-5 h-5 rounded-full bg-gray-100 dark:bg-slate-700 border border-white dark:border-slate-800 flex items-center justify-center text-[8px] font-bold text-gray-400">
                            AI
                          </div>
                        </div>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">
                          {contact.conversations?.[0] ? 'Active' : 'No chat'}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                {contacts.filter(c => c.pipelineStage === stage.id).length === 0 && (
                  <div className="h-32 flex flex-col items-center justify-center text-center p-4 border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-xl">
                    <p className="text-[10px] font-medium text-gray-400 dark:text-gray-600 uppercase tracking-tighter">No leads here</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
