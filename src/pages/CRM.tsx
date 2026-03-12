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
  ArrowLeft,
  ArrowRight
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import ContactListPicker from '../components/ContactListPicker';

interface Contact {
  id: string;
  name: string;
  phoneNumber?: string;
  pipelineStage: string;
  conversations: any[];
}

interface ContactList {
  id: string;
  name: string;
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
  const [lists, setLists] = useState<ContactList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddLead, setShowAddLead] = useState(false);
  const [isSavingLead, setIsSavingLead] = useState(false);
  const [newLead, setNewLead] = useState({
    name: '',
    phoneNumber: '',
    listNames: [] as string[],
    pipelineStage: 'NEW_LEAD'
  });

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

  const fetchLists = async () => {
    try {
      const res = await axios.get(`/api/contact-lists?workspaceId=${activeWorkspace?.id}`);
      setLists(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Failed to fetch contact lists', error);
    }
  };

  useEffect(() => {
    if (activeWorkspace) {
      fetchLists();
    }
  }, [activeWorkspace]);

  const updateStage = async (contactId: string, newStage: string) => {
    try {
      await axios.patch(`/api/contacts/${contactId}`, { pipelineStage: newStage });
      setContacts(prev => prev.map(c => c.id === contactId ? { ...c, pipelineStage: newStage } : c));
      toast.success('Lead moved');
    } catch (error) {
      console.error('Failed to update stage', error);
      toast.error('Could not move lead');
    }
  };

  const createLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace || (!newLead.name.trim() && !newLead.phoneNumber.trim())) return;

    setIsSavingLead(true);
    try {
      const res = await axios.post('/api/contacts', {
        workspaceId: activeWorkspace.id,
        name: newLead.name,
        phoneNumber: newLead.phoneNumber,
        listNames: newLead.listNames,
        pipelineStage: newLead.pipelineStage,
      });
      setContacts(prev => [res.data, ...prev]);
      setNewLead({ name: '', phoneNumber: '', listNames: [], pipelineStage: 'NEW_LEAD' });
      await fetchLists();
      setShowAddLead(false);
      toast.success('Lead saved');
    } catch (error) {
      console.error('Failed to create lead', error);
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.error || 'Could not save lead');
      } else {
        toast.error('Could not save lead');
      }
    } finally {
      setIsSavingLead(false);
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
          <button
            onClick={() => {
              fetchLists();
              setShowAddLead(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white text-sm font-bold rounded-xl hover:bg-[#128C7E] transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Lead
          </button>
        </div>
      </div>

      {showAddLead && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/35 p-4">
          <form onSubmit={createLead} className="w-full max-w-md rounded-3xl border border-gray-100 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Add New Lead</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Save a customer into the CRM so their number and stage stay in your database.
              </p>
            </div>

            <div className="space-y-4">
              <input
                type="text"
                placeholder="Customer name"
                value={newLead.name}
                onChange={(e) => setNewLead(prev => ({ ...prev, name: e.target.value }))}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <input
                type="text"
                placeholder="Phone number"
                value={newLead.phoneNumber}
                onChange={(e) => setNewLead(prev => ({ ...prev, phoneNumber: e.target.value }))}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <ContactListPicker
                options={lists}
                value={newLead.listNames}
                onChange={(value) => setNewLead(prev => ({ ...prev, listNames: value }))}
                placeholder="Add custom lists like Abu Dhabi, VIP, Ramadan"
              />
              <select
                value={newLead.pipelineStage}
                onChange={(e) => setNewLead(prev => ({ ...prev, pipelineStage: e.target.value }))}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700 outline-none focus:border-[#25D366] dark:border-slate-700 dark:bg-slate-800 dark:text-gray-200"
              >
                {STAGES.map((stage) => (
                  <option key={stage.id} value={stage.id}>{stage.label}</option>
                ))}
              </select>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAddLead(false)}
                className="rounded-2xl px-4 py-2 text-sm font-semibold text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingLead || (!newLead.name.trim() && !newLead.phoneNumber.trim())}
                className="rounded-2xl bg-[#25D366] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#128C7E] disabled:opacity-50"
              >
                {isSavingLead ? 'Saving...' : 'Save Lead'}
              </button>
            </div>
          </form>
        </div>
      )}

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
                      {(() => {
                        const stageIndex = STAGES.findIndex(s => s.id === stage.id);
                        const previousStage = stageIndex > 0 ? STAGES[stageIndex - 1] : null;
                        const nextStage = stageIndex < STAGES.length - 1 ? STAGES[stageIndex + 1] : null;

                        return (
                          <>
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-8 h-8 bg-gray-50 dark:bg-slate-700 rounded-full flex items-center justify-center text-gray-400">
                          <User className="w-4 h-4" />
                        </div>
                        <div className="flex items-center gap-1">
                          {previousStage && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                updateStage(contact.id, previousStage.id);
                              }}
                              className="p-1 hover:bg-gray-50 dark:hover:bg-slate-700 rounded text-gray-300 hover:text-[#25D366] transition-colors"
                              title={`Move to ${previousStage.label}`}
                            >
                              <ArrowLeft className="w-3 h-3" />
                            </button>
                          )}
                          {nextStage && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                updateStage(contact.id, nextStage.id);
                              }}
                              className="p-1 hover:bg-gray-50 dark:hover:bg-slate-700 rounded text-gray-300 hover:text-[#25D366] transition-colors"
                              title={`Move to ${nextStage.label}`}
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
                          </>
                        );
                      })()}
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
