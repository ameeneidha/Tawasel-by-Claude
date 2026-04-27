import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
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
  ArrowRight,
  Check,
  ArrowUp,
  ArrowDown,
  Settings2,
  Trash2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import ContactListPicker from '../components/ContactListPicker';
import {
  DEFAULT_PIPELINE_STAGE_KEY,
  getFallbackPipelineStageKey,
  getPipelineStageLabel,
  PipelineStage,
  PIPELINE_STAGE_COLOR_OPTIONS,
} from '../lib/pipelineStages';

interface Contact {
  id: string;
  name: string;
  phoneNumber?: string;
  pipelineStage: string;
  estimatedValue?: number | null;
  conversations: any[];
}

interface ContactList {
  id: string;
  name: string;
}

const formatAed = (value?: number | null) =>
  new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    maximumFractionDigits: 0,
  }).format(value ?? 0);

export default function CRM() {
  const { t } = useTranslation();
  const { activeWorkspace } = useApp();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [lists, setLists] = useState<ContactList[]>([]);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);
  const [showManageStages, setShowManageStages] = useState(false);
  const [isSavingStages, setIsSavingStages] = useState(false);
  const [newStage, setNewStage] = useState({ name: '', color: PIPELINE_STAGE_COLOR_OPTIONS[0] });
  const [stageDrafts, setStageDrafts] = useState<Record<string, { name: string; color: string }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [showAddLead, setShowAddLead] = useState(false);
  const [isSavingLead, setIsSavingLead] = useState(false);
  const [newLead, setNewLead] = useState({
    name: '',
    phoneNumber: '',
    listNames: [] as string[],
    pipelineStage: DEFAULT_PIPELINE_STAGE_KEY,
    estimatedValue: ''
  });
  const [valueDrafts, setValueDrafts] = useState<Record<string, string>>({});
  const [savingValueId, setSavingValueId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [chatFilter, setChatFilter] = useState<'ALL' | 'ACTIVE' | 'NO_CHAT'>('ALL');
  const [valueFilter, setValueFilter] = useState<'ALL' | 'WITH_VALUE' | 'NO_VALUE'>('ALL');
  const [activeMobileStageKey, setActiveMobileStageKey] = useState('');

  useEffect(() => {
    if (!activeWorkspace) {
      setContacts([]);
      setLists([]);
      setPipelineStages([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    Promise.all([fetchContacts(), fetchLists(), fetchPipelineStages()]).finally(() => setIsLoading(false));
  }, [activeWorkspace]);

  const fetchContacts = async () => {
    try {
      const res = await axios.get(`/api/contacts?workspaceId=${activeWorkspace?.id}`);
      setContacts(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Failed to fetch contacts', error);
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
    if (pipelineStages.length > 0) {
      const fallbackStageKey = getFallbackPipelineStageKey(pipelineStages);
      setNewLead((prev) =>
        pipelineStages.some((stage) => stage.key === prev.pipelineStage)
          ? prev
          : { ...prev, pipelineStage: fallbackStageKey }
      );
      setActiveMobileStageKey((prev) =>
        pipelineStages.some((stage) => stage.key === prev) ? prev : fallbackStageKey
      );
    }
  }, [pipelineStages]);

  const fetchPipelineStages = async () => {
    try {
      const res = await axios.get(`/api/pipeline-stages?workspaceId=${activeWorkspace?.id}`);
      const nextStages = Array.isArray(res.data) ? res.data : [];
      setPipelineStages(nextStages);
      setStageDrafts(
        nextStages.reduce<Record<string, { name: string; color: string }>>((acc, stage) => {
          acc[stage.id] = {
            name: stage.name,
            color: stage.color,
          };
          return acc;
        }, {})
      );
    } catch (error) {
      console.error('Failed to fetch pipeline stages', error);
      toast.error(t('crm.couldNotLoadStages'));
    }
  };

  useEffect(() => {
    setValueDrafts((prev) => {
      const next = { ...prev };
      for (const contact of contacts) {
        if (next[contact.id] === undefined) {
          next[contact.id] = contact.estimatedValue ? String(contact.estimatedValue) : '';
        }
      }
      return next;
    });
  }, [contacts]);

  const updateStage = async (contactId: string, newStage: string) => {
    try {
      await axios.patch(`/api/contacts/${contactId}`, { pipelineStage: newStage });
      setContacts(prev => prev.map(c => c.id === contactId ? { ...c, pipelineStage: newStage } : c));
      toast.success(t('crm.leadMoved'));
    } catch (error) {
      console.error('Failed to update stage', error);
      toast.error(t('crm.couldNotMoveLead'));
    }
  };

  const saveEstimatedValue = async (contactId: string) => {
    const rawValue = valueDrafts[contactId] ?? '';
    const nextValue = rawValue.trim() ? Number(rawValue) : 0;

    if (Number.isNaN(nextValue) || nextValue < 0) {
      toast.error(t('crm.invalidEstimatedValue'));
      return;
    }

    setSavingValueId(contactId);
    try {
      await axios.patch(`/api/contacts/${contactId}`, { estimatedValue: nextValue });
      setContacts((prev) =>
        prev.map((contact) =>
          contact.id === contactId ? { ...contact, estimatedValue: nextValue } : contact
        )
      );
      setValueDrafts((prev) => ({ ...prev, [contactId]: nextValue > 0 ? String(nextValue) : '' }));
      toast.success(t('crm.dealValueUpdated'));
    } catch (error) {
      console.error('Failed to update estimated value', error);
      toast.error(t('crm.couldNotUpdateDealValue'));
    } finally {
      setSavingValueId(null);
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
        estimatedValue: newLead.estimatedValue.trim() ? Number(newLead.estimatedValue) : undefined,
      });
      setContacts(prev => [res.data, ...prev]);
      setNewLead({
        name: '',
        phoneNumber: '',
        listNames: [],
        pipelineStage: getFallbackPipelineStageKey(pipelineStages),
        estimatedValue: '',
      });
      await fetchLists();
      setShowAddLead(false);
      toast.success(t('crm.leadSaved'));
    } catch (error) {
      console.error('Failed to create lead', error);
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.error || t('crm.couldNotSaveLead'));
      } else {
        toast.error(t('crm.couldNotSaveLead'));
      }
    } finally {
      setIsSavingLead(false);
    }
  };

  const filteredContacts = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return contacts.filter((contact) => {
      const matchesSearch =
        !normalizedQuery ||
        contact.name?.toLowerCase().includes(normalizedQuery) ||
        contact.phoneNumber?.toLowerCase().includes(normalizedQuery) ||
        getPipelineStageLabel(pipelineStages, contact.pipelineStage).toLowerCase().includes(normalizedQuery);

      const hasChat = Boolean(contact.conversations?.[0]);
      const matchesChat =
        chatFilter === 'ALL' ||
        (chatFilter === 'ACTIVE' && hasChat) ||
        (chatFilter === 'NO_CHAT' && !hasChat);

      const hasValue = Number(contact.estimatedValue || 0) > 0;
      const matchesValue =
        valueFilter === 'ALL' ||
        (valueFilter === 'WITH_VALUE' && hasValue) ||
        (valueFilter === 'NO_VALUE' && !hasValue);

      return matchesSearch && matchesChat && matchesValue;
    });
  }, [chatFilter, contacts, pipelineStages, searchQuery, valueFilter]);

  const hasActiveFilters =
    searchQuery.trim().length > 0 || chatFilter !== 'ALL' || valueFilter !== 'ALL';
  const activeMobileStage = pipelineStages.find((stage) => stage.key === activeMobileStageKey) || pipelineStages[0];
  const mobileStageContacts = activeMobileStage
    ? filteredContacts.filter((contact) => contact.pipelineStage === activeMobileStage.key)
    : [];

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#25D366] animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#F8F9FA] dark:bg-slate-950 transition-colors">
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 py-3 md:px-8 md:h-16 md:py-0 flex flex-col gap-3 md:flex-row md:items-center md:justify-between shrink-0 transition-colors">
        <div className="flex items-center justify-between gap-4 md:justify-start">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">{t('crm.title')}</h1>
          <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 dark:bg-slate-800 rounded-full border border-gray-200 dark:border-slate-700">
            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              {hasActiveFilters ? t('crm.matchingLeads') : t('crm.totalLeads')}
            </span>
            <span className="text-xs font-bold text-[#25D366]">{filteredContacts.length}</span>
          </div>
        </div>
        <div className="grid grid-cols-[1fr_auto_auto] gap-2 md:flex md:items-center md:gap-3">
          <div className="relative min-w-0">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder={t('crm.searchLeads')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 md:py-2 bg-gray-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-[#25D366]/20 dark:focus:ring-[#25D366]/10 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600 transition-all md:w-64"
            />
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowFilters((prev) => !prev)}
              className={cn(
                'p-2 rounded-xl border transition-colors',
                hasActiveFilters
                  ? 'border-[#25D366]/30 bg-[#25D366]/10 text-[#128C7E] dark:text-[#4ADE80]'
                  : 'text-gray-400 border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800'
              )}
            >
              <Filter className="w-4 h-4" />
            </button>
            {showFilters && (
              <div className="absolute right-0 top-12 z-10 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-gray-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                <div className="mb-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                    {t('crm.conversation')}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[
                      { id: 'ALL', label: t('crm.allChats') },
                      { id: 'ACTIVE', label: t('crm.activeChat') },
                      { id: 'NO_CHAT', label: t('crm.noChat') },
                    ].map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setChatFilter(option.id as typeof chatFilter)}
                        className={cn(
                          'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                          chatFilter === option.id
                            ? 'bg-[#25D366] text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-800 dark:text-gray-300'
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mb-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                    {t('crm.dealValue')}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[
                      { id: 'ALL', label: t('crm.allValues') },
                      { id: 'WITH_VALUE', label: t('crm.withValue') },
                      { id: 'NO_VALUE', label: t('crm.noValue') },
                    ].map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setValueFilter(option.id as typeof valueFilter)}
                        className={cn(
                          'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                          valueFilter === option.id
                            ? 'bg-[#25D366] text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-800 dark:text-gray-300'
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setChatFilter('ALL');
                      setValueFilter('ALL');
                    }}
                    className="text-sm font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    {t('crm.clearFilters')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowFilters(false)}
                    className="rounded-xl bg-[#25D366] px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-[#128C7E]"
                  >
                    {t('crm.apply')}
                  </button>
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowManageStages(true)}
            className="hidden md:flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-200 text-sm font-bold rounded-xl hover:border-[#25D366] hover:text-[#25D366] transition-colors bg-white dark:bg-slate-900"
          >
            <Settings2 className="w-4 h-4" />
            {t('crm.manageStages')}
          </button>
          <button
            onClick={() => {
              fetchLists();
              setShowAddLead(true);
            }}
            className="flex items-center justify-center gap-2 px-3 py-2.5 md:px-4 md:py-2 bg-[#25D366] text-white text-sm font-bold rounded-xl hover:bg-[#128C7E] transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{t('crm.addLead')}</span>
          </button>
        </div>
      </div>

      {showAddLead && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/35 p-4">
          <form onSubmit={createLead} className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t('crm.addNewLead')}</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {t('crm.addNewLeadDescription')}
              </p>
            </div>

            <div className="space-y-4">
              <input
                type="text"
                placeholder={t('crm.customerName')}
                value={newLead.name}
                onChange={(e) => setNewLead(prev => ({ ...prev, name: e.target.value }))}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <input
                type="text"
                placeholder={t('crm.phoneNumber')}
                value={newLead.phoneNumber}
                onChange={(e) => setNewLead(prev => ({ ...prev, phoneNumber: e.target.value }))}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <input
                type="number"
                min="0"
                step="1"
                placeholder={t('crm.estimatedValueAed')}
                value={newLead.estimatedValue}
                onChange={(e) => setNewLead(prev => ({ ...prev, estimatedValue: e.target.value }))}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <ContactListPicker
                options={lists}
                value={newLead.listNames}
                onChange={(value) => setNewLead(prev => ({ ...prev, listNames: value }))}
                placeholder={t('crm.addCustomLists')}
              />
              <select
                value={newLead.pipelineStage}
                onChange={(e) => setNewLead(prev => ({ ...prev, pipelineStage: e.target.value }))}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700 outline-none focus:border-[#25D366] dark:border-slate-700 dark:bg-slate-800 dark:text-gray-200"
              >
                {pipelineStages.map((stage) => (
                  <option key={stage.id} value={stage.key}>{stage.name}</option>
                ))}
              </select>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAddLead(false)}
                className="rounded-2xl px-4 py-2 text-sm font-semibold text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-800"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={isSavingLead || (!newLead.name.trim() && !newLead.phoneNumber.trim())}
                className="rounded-2xl bg-[#25D366] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#128C7E] disabled:opacity-50"
              >
                {isSavingLead ? t('crm.saving') : t('crm.saveLead')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 md:hidden">
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {pipelineStages.map((stage) => (
            <button
              key={stage.id}
              type="button"
              onClick={() => setActiveMobileStageKey(stage.key)}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition-colors',
                activeMobileStage?.key === stage.key
                  ? 'border-[#25D366] bg-[#25D366]/10 text-[#128C7E]'
                  : 'border-gray-200 bg-white text-gray-600 dark:border-slate-800 dark:bg-slate-900 dark:text-gray-300'
              )}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.color }} />
              {stage.name}
              <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-500 dark:bg-slate-800 dark:text-gray-400">
                {filteredContacts.filter((contact) => contact.pipelineStage === stage.key).length}
              </span>
            </button>
          ))}
        </div>

        {activeMobileStage && (
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-gray-900 dark:text-white">{activeMobileStage.name}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {mobileStageContacts.length} {mobileStageContacts.length === 1 ? 'lead' : 'leads'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowManageStages(true)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600 dark:border-slate-800 dark:bg-slate-900 dark:text-gray-300"
            >
              {t('crm.manageStages')}
            </button>
          </div>
        )}

        <div className="space-y-3">
          {mobileStageContacts.map((contact) => (
            <div key={contact.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-bold text-gray-900 dark:text-white">{contact.name || t('crm.unknown')}</h3>
                  <div className="mt-1 flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{contact.phoneNumber}</span>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-[10px] font-bold uppercase text-gray-500 dark:bg-slate-800 dark:text-gray-400">
                  {contact.conversations?.[0] ? t('crm.active') : t('crm.noChatStatus')}
                </span>
              </div>

              <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50/80 p-3 dark:border-slate-700 dark:bg-slate-950/50">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                    {t('crm.dealValue')}
                  </span>
                  {(contact.estimatedValue ?? 0) > 0 && (
                    <span className="text-xs font-bold text-[#128C7E] dark:text-[#4ADE80]">
                      {formatAed(contact.estimatedValue)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={valueDrafts[contact.id] ?? ''}
                    onChange={(e) => setValueDrafts((prev) => ({ ...prev, [contact.id]: e.target.value }))}
                    placeholder="0"
                    className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-900 outline-none focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => void saveEstimatedValue(contact.id)}
                    disabled={savingValueId === contact.id}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#25D366] text-white transition-colors hover:bg-[#128C7E] disabled:opacity-60"
                  >
                    {savingValueId === contact.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="mt-4">
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                  {t('crm.moveStage')}
                </label>
                <select
                  value={contact.pipelineStage}
                  onChange={(e) => updateStage(contact.id, e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 outline-none focus:border-[#25D366] dark:border-slate-700 dark:bg-slate-800 dark:text-gray-200"
                >
                  {pipelineStages.map((stage) => (
                    <option key={stage.id} value={stage.key}>{stage.name}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}

          {activeMobileStage && mobileStageContacts.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white/60 p-10 text-center dark:border-slate-800 dark:bg-slate-900/40">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                {hasActiveFilters ? t('crm.noMatchingLeads') : t('crm.noLeadsHere')}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="hidden flex-1 overflow-x-auto p-8 md:block">
        <div className="flex gap-6 h-full min-w-max">
          {pipelineStages.map((stage) => (
            <div key={stage.id} className="w-72 flex flex-col gap-4">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                  <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">{stage.name}</h3>
                  <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-slate-800 px-1.5 py-0.5 rounded transition-colors">
                    {filteredContacts.filter(c => c.pipelineStage === stage.key).length}
                  </span>
                </div>
                <button className="text-gray-300 hover:text-gray-500">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 bg-gray-100/50 dark:bg-slate-900/50 rounded-2xl p-3 space-y-3 overflow-y-auto border border-dashed border-gray-200 dark:border-slate-800 transition-colors">
                {filteredContacts
                  .filter(c => c.pipelineStage === stage.key)
                  .map((contact) => (
                    <motion.div
                      layoutId={contact.id}
                      key={contact.id}
                      className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 group hover:border-[#25D366]/30 transition-all cursor-pointer"
                    >
                      {(() => {
                        const stageIndex = pipelineStages.findIndex(s => s.key === stage.key);
                        const previousStage = stageIndex > 0 ? pipelineStages[stageIndex - 1] : null;
                        const nextStage = stageIndex < pipelineStages.length - 1 ? pipelineStages[stageIndex + 1] : null;

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
                                updateStage(contact.id, previousStage.key);
                              }}
                              className="p-1 hover:bg-gray-50 dark:hover:bg-slate-700 rounded text-gray-300 hover:text-[#25D366] transition-colors"
                              title={t('crm.moveTo', { stage: previousStage.name })}
                            >
                              <ArrowLeft className="w-3 h-3" />
                            </button>
                          )}
                          {nextStage && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                updateStage(contact.id, nextStage.key);
                              }}
                              className="p-1 hover:bg-gray-50 dark:hover:bg-slate-700 rounded text-gray-300 hover:text-[#25D366] transition-colors"
                              title={t('crm.moveTo', { stage: nextStage.name })}
                            >
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1">{contact.name || t('crm.unknown')}</h4>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-3">
                        <Phone className="w-3 h-3" />
                        {contact.phoneNumber}
                      </div>
                      <div className="mb-3 rounded-2xl border border-gray-200 bg-gray-50/80 p-2.5 dark:border-slate-700 dark:bg-slate-900/70">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                            {t('crm.dealValue')}
                          </span>
                          {(contact.estimatedValue ?? 0) > 0 && (
                            <span className="text-[10px] font-bold text-[#128C7E] dark:text-[#4ADE80]">
                              {formatAed(contact.estimatedValue)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={valueDrafts[contact.id] ?? ''}
                            onChange={(e) =>
                              setValueDrafts((prev) => ({ ...prev, [contact.id]: e.target.value }))
                            }
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                void saveEstimatedValue(contact.id);
                              }
                            }}
                            placeholder="0"
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 outline-none focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void saveEstimatedValue(contact.id);
                            }}
                            disabled={savingValueId === contact.id}
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#25D366] text-white transition-colors hover:bg-[#128C7E] disabled:opacity-60"
                            title={t('crm.saveDealValue')}
                          >
                            {savingValueId === contact.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="pt-3 border-t border-gray-50 dark:border-slate-700 flex items-center justify-between">
                        <div className="flex -space-x-1">
                          <div className="w-5 h-5 rounded-full bg-gray-100 dark:bg-slate-700 border border-white dark:border-slate-800 flex items-center justify-center text-[8px] font-bold text-gray-400">
                            AI
                          </div>
                        </div>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">
                          {contact.conversations?.[0] ? t('crm.active') : t('crm.noChatStatus')}
                        </span>
                      </div>
                          </>
                        );
                      })()}
                    </motion.div>
                  ))}
                {filteredContacts.filter(c => c.pipelineStage === stage.key).length === 0 && (
                  <div className="h-32 flex flex-col items-center justify-center text-center p-4 border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-xl">
                    <p className="text-[10px] font-medium text-gray-400 dark:text-gray-600 uppercase tracking-tighter">
                      {hasActiveFilters ? t('crm.noMatchingLeads') : t('crm.noLeadsHere')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showManageStages && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/35 p-4">
          <div className="w-full max-w-4xl rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{t('crm.manageStagesTitle')}</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {t('crm.manageStagesDescription')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowManageStages(false)}
                className="rounded-2xl px-3 py-2 text-sm font-semibold text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                Close
              </button>
            </div>

            <div className="mt-6 max-h-[60vh] overflow-y-auto rounded-2xl border border-gray-200 dark:border-slate-800">
              <div className="divide-y divide-gray-100 dark:divide-slate-800">
                {pipelineStages.map((stage, index) => (
                  <div key={stage.id} className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_120px_auto_auto] md:items-center">
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <span className="inline-flex h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stageDrafts[stage.id]?.color || stage.color }} />
                        <span className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                          {stage.isSystem ? 'Default stage' : 'Custom stage'}
                        </span>
                        {stage.isTerminal && (
                          <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:bg-slate-800 dark:text-gray-300">
                            {stage.terminalType}
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={stageDrafts[stage.id]?.name || stage.name}
                        onChange={(e) =>
                          setStageDrafts((prev) => ({
                            ...prev,
                            [stage.id]: {
                              name: e.target.value,
                              color: prev[stage.id]?.color || stage.color,
                            },
                          }))
                        }
                        className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                    <input
                      type="color"
                      value={stageDrafts[stage.id]?.color || stage.color}
                      onChange={(e) =>
                        setStageDrafts((prev) => ({
                          ...prev,
                          [stage.id]: {
                            name: prev[stage.id]?.name || stage.name,
                            color: e.target.value,
                          },
                        }))
                      }
                      className="h-12 w-full rounded-2xl border border-gray-200 bg-white px-2 py-2 dark:border-slate-700 dark:bg-slate-900"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isSavingStages || index === 0}
                        onClick={async () => {
                          setIsSavingStages(true);
                          try {
                            const orderedStageIds = [...pipelineStages];
                            [orderedStageIds[index - 1], orderedStageIds[index]] = [orderedStageIds[index], orderedStageIds[index - 1]];
                            await axios.post('/api/pipeline-stages/reorder', {
                              workspaceId: activeWorkspace?.id,
                              orderedStageIds: orderedStageIds.map((item) => item.id),
                            });
                            await fetchPipelineStages();
                          } catch (error: any) {
                            toast.error(error?.response?.data?.error || 'Could not move stage');
                          } finally {
                            setIsSavingStages(false);
                          }
                        }}
                        className="rounded-xl border border-gray-200 p-2 text-gray-500 transition-colors hover:border-[#25D366] hover:text-[#25D366] disabled:opacity-40 dark:border-slate-700"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        disabled={isSavingStages || index === pipelineStages.length - 1}
                        onClick={async () => {
                          setIsSavingStages(true);
                          try {
                            const orderedStageIds = [...pipelineStages];
                            [orderedStageIds[index], orderedStageIds[index + 1]] = [orderedStageIds[index + 1], orderedStageIds[index]];
                            await axios.post('/api/pipeline-stages/reorder', {
                              workspaceId: activeWorkspace?.id,
                              orderedStageIds: orderedStageIds.map((item) => item.id),
                            });
                            await fetchPipelineStages();
                          } catch (error: any) {
                            toast.error(error?.response?.data?.error || 'Could not move stage');
                          } finally {
                            setIsSavingStages(false);
                          }
                        }}
                        className="rounded-xl border border-gray-200 p-2 text-gray-500 transition-colors hover:border-[#25D366] hover:text-[#25D366] disabled:opacity-40 dark:border-slate-700"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        disabled={isSavingStages}
                        onClick={async () => {
                          setIsSavingStages(true);
                          try {
                            await axios.patch(`/api/pipeline-stages/${stage.id}`, {
                              workspaceId: activeWorkspace?.id,
                              name: stageDrafts[stage.id]?.name || stage.name,
                              color: stageDrafts[stage.id]?.color || stage.color,
                            });
                            await fetchPipelineStages();
                            toast.success('Stage updated');
                          } catch (error: any) {
                            toast.error(error?.response?.data?.error || 'Could not update stage');
                          } finally {
                            setIsSavingStages(false);
                          }
                        }}
                        className="rounded-xl bg-[#25D366] px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-[#128C7E] disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        disabled={isSavingStages}
                        onClick={async () => {
                          setIsSavingStages(true);
                          try {
                            const res = await axios.delete(`/api/pipeline-stages/${stage.id}`, {
                              data: { workspaceId: activeWorkspace?.id },
                            });
                            await fetchPipelineStages();
                            if (res.data?.reassignedCount > 0) {
                              toast.success(`Stage removed. ${res.data.reassignedCount} lead${res.data.reassignedCount === 1 ? '' : 's'} moved to ${res.data.replacementStageName}.`);
                            } else {
                              toast.success('Stage removed');
                            }
                          } catch (error: any) {
                            toast.error(error?.response?.data?.error || 'Could not remove stage');
                          } finally {
                            setIsSavingStages(false);
                          }
                        }}
                        className="rounded-xl border border-red-200 p-2 text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900/40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 dark:border-slate-700 dark:bg-slate-950/50">
              <p className="text-sm font-bold text-gray-900 dark:text-white">Add custom stage</p>
              <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_120px_auto]">
                <input
                  type="text"
                  value={newStage.name}
                  onChange={(e) => setNewStage((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="For example: Follow Up Needed"
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <input
                  type="color"
                  value={newStage.color}
                  onChange={(e) => setNewStage((prev) => ({ ...prev, color: e.target.value }))}
                  className="h-12 w-full rounded-2xl border border-gray-200 bg-white px-2 py-2 dark:border-slate-700 dark:bg-slate-900"
                />
                <button
                  type="button"
                  disabled={isSavingStages || !newStage.name.trim()}
                  onClick={async () => {
                    setIsSavingStages(true);
                    try {
                      await axios.post('/api/pipeline-stages', {
                        workspaceId: activeWorkspace?.id,
                        name: newStage.name,
                        color: newStage.color,
                      });
                      setNewStage({ name: '', color: PIPELINE_STAGE_COLOR_OPTIONS[0] });
                      await fetchPipelineStages();
                      toast.success('Stage added');
                    } catch (error: any) {
                      toast.error(error?.response?.data?.error || 'Could not add stage');
                    } finally {
                      setIsSavingStages(false);
                    }
                  }}
                  className="rounded-2xl bg-[#25D366] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#128C7E] disabled:opacity-50"
                >
                  Add Stage
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
