import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useApp } from '../contexts/AppContext';
import { 
  Loader2, 
  Phone, 
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
import TawaselLoader from '../components/TawaselLoader';
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

const getLeadInitials = (contact: Contact) => {
  const source = contact.name?.trim() || contact.phoneNumber || '?';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
};

const leadToneClasses = [
  'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
  'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
  'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
];

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

  const stageSummaries = useMemo(
    () =>
      pipelineStages.map((stage) => {
        const stageContacts = filteredContacts.filter((contact) => contact.pipelineStage === stage.key);
        const value = stageContacts.reduce((sum, contact) => sum + Number(contact.estimatedValue || 0), 0);

        return {
          ...stage,
          contacts: stageContacts,
          value,
        };
      }),
    [filteredContacts, pipelineStages]
  );

  const pipelineSummary = useMemo(() => {
    const getStage = (contact: Contact) =>
      pipelineStages.find((stage) => stage.key === contact.pipelineStage);
    const activeDeals = filteredContacts.filter((contact) => {
      const stage = getStage(contact);
      return !stage?.isTerminal || stage.terminalType === 'OPEN';
    });
    const wonDeals = filteredContacts.filter((contact) => getStage(contact)?.terminalType === 'WON');
    const totalValue = activeDeals.reduce((sum, contact) => sum + Number(contact.estimatedValue || 0), 0);
    const wonValue = wonDeals.reduce((sum, contact) => sum + Number(contact.estimatedValue || 0), 0);
    const missingValue = filteredContacts.filter((contact) => Number(contact.estimatedValue || 0) <= 0).length;
    const activeChatCount = filteredContacts.filter((contact) => contact.conversations?.[0]).length;

    return {
      activeDeals: activeDeals.length,
      totalValue,
      wonValue,
      missingValue,
      activeChatCount,
      averageDealValue: activeDeals.length > 0 ? totalValue / activeDeals.length : 0,
    };
  }, [filteredContacts, pipelineStages]);

  const hasActiveFilters =
    searchQuery.trim().length > 0 || chatFilter !== 'ALL' || valueFilter !== 'ALL';
  const activeMobileStage = pipelineStages.find((stage) => stage.key === activeMobileStageKey) || pipelineStages[0];
  const mobileStageContacts = activeMobileStage
    ? filteredContacts.filter((contact) => contact.pipelineStage === activeMobileStage.key)
    : [];

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <TawaselLoader variant="pulse" label={t('common.loading', { defaultValue: 'Loading CRM...' })} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#F7F5EF] text-slate-950 transition-colors dark:bg-slate-950 dark:text-white">
      <div className="shrink-0 border-b border-slate-200/70 bg-[#F7F5EF]/95 px-4 py-5 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 md:px-8 md:py-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-[#25D366]" />
              <span>
                {pipelineSummary.activeDeals} {t('crm.activeDeals', { defaultValue: 'active deals' })}
              </span>
              <span className="text-slate-300 dark:text-slate-700">/</span>
              <span>{formatAed(pipelineSummary.totalValue)} {t('crm.inFlight', { defaultValue: 'in flight' })}</span>
              {hasActiveFilters && (
                <>
                  <span className="text-slate-300 dark:text-slate-700">/</span>
                  <span>{filteredContacts.length} {t('crm.matchingLeads', { defaultValue: 'matching leads' })}</span>
                </>
              )}
            </div>
            <h1 className="font-serif text-4xl leading-none tracking-tight text-slate-950 dark:text-white md:text-5xl">
              {t('crm.pipelineTitle', { defaultValue: 'Pipeline.' })}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
              {t('crm.pipelineSubtitle', {
                defaultValue:
                  'Keep every WhatsApp lead moving with clear stages, live deal value, and quick follow-up ownership.',
              })}
            </p>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 lg:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={t('crm.searchLeads')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white/80 pl-10 pr-4 text-sm font-medium text-slate-900 outline-none transition focus:border-[#25D366] focus:ring-4 focus:ring-[#25D366]/10 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden rounded-2xl bg-white/70 p-1 text-sm font-semibold text-slate-500 shadow-sm ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800 md:flex">
                <button type="button" className="rounded-xl bg-slate-950 px-3 py-2 text-white shadow-sm dark:bg-white dark:text-slate-950">
                  {t('crm.board', { defaultValue: 'Board' })}
                </button>
                <button type="button" onClick={() => setShowManageStages(true)} className="rounded-xl px-3 py-2 transition hover:text-slate-900 dark:hover:text-white">
                  {t('crm.stages', { defaultValue: 'Stages' })}
                </button>
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowFilters((prev) => !prev)}
                  className={cn(
                    'inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition-colors',
                    hasActiveFilters
                      ? 'border-[#25D366]/40 bg-[#25D366]/10 text-[#128C7E] dark:text-[#4ADE80]'
                      : 'border-slate-200 bg-white/80 text-slate-500 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-white'
                  )}
                >
                  <Filter className="h-4 w-4" />
                </button>
                {showFilters && (
                  <div className="absolute right-0 top-14 z-10 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                    <div className="mb-4">
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
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
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                            )}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="mb-4">
                      <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
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
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
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
                        className="text-sm font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
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
                className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white/80 px-3 text-sm font-bold text-slate-700 transition hover:border-[#25D366] hover:text-[#128C7E] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 md:hidden"
              >
                <Settings2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  fetchLists();
                  setShowAddLead(true);
                }}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-black dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              >
                <Plus className="h-4 w-4" />
                <span>{t('crm.addLead')}</span>
              </button>
            </div>
          </div>
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
        <div className="mb-4 grid grid-cols-2 gap-3">
          {[
            {
              label: t('crm.pipelineValue', { defaultValue: 'Pipeline value' }),
              value: formatAed(pipelineSummary.totalValue),
            },
            {
              label: t('crm.activeChats', { defaultValue: 'Active chats' }),
              value: String(pipelineSummary.activeChatCount),
            },
            {
              label: t('crm.avgDealSize', { defaultValue: 'Avg deal size' }),
              value: formatAed(pipelineSummary.averageDealValue),
            },
            {
              label: t('crm.needsValue', { defaultValue: 'Needs value' }),
              value: String(pipelineSummary.missingValue),
            },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                {item.label}
              </p>
              <p className="mt-2 text-lg font-black text-slate-950 dark:text-white">{item.value}</p>
            </div>
          ))}
        </div>
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {stageSummaries.map((stage) => (
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
                {stage.contacts.length}
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
          {mobileStageContacts.map((contact, contactIndex) => (
            <div key={contact.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-xs font-black', leadToneClasses[contactIndex % leadToneClasses.length])}>
                    {getLeadInitials(contact)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate font-bold text-gray-900 dark:text-white">{contact.name || t('crm.unknown')}</h3>
                    <div className="mt-1 flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{contact.phoneNumber}</span>
                    </div>
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
            <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white/60 p-6 text-center dark:border-slate-800 dark:bg-slate-900/40">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                {hasActiveFilters ? t('crm.noMatchingLeads') : t('crm.noLeadsHere')}
              </p>
              {!hasActiveFilters && filteredContacts.length === 0 && (
                <>
                  <p className="mx-auto mt-2 max-w-xs text-sm text-gray-500 dark:text-gray-400">
                    Leads arrive from WhatsApp chats, manual contact creation, imports, or campaign links.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      fetchLists();
                      setShowAddLead(true);
                    }}
                    className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#128C7E]"
                  >
                    <Plus className="h-4 w-4" />
                    Add first lead
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="hidden flex-1 overflow-y-auto p-8 md:block">
        <div className="grid grid-cols-4 gap-3">
          {[
            {
              label: t('crm.pipelineValue', { defaultValue: 'Pipeline value' }),
              value: formatAed(pipelineSummary.totalValue),
              helper: `${pipelineSummary.activeDeals} ${t('crm.activeDeals', { defaultValue: 'active deals' })}`,
            },
            {
              label: t('crm.avgDealSize', { defaultValue: 'Avg deal size' }),
              value: formatAed(pipelineSummary.averageDealValue),
              helper: t('crm.activePipelineAverage', { defaultValue: 'Open pipeline average' }),
            },
            {
              label: t('crm.needsValue', { defaultValue: 'Needs value' }),
              value: String(pipelineSummary.missingValue),
              helper: t('crm.addValueToForecast', { defaultValue: 'Add value to improve forecast' }),
            },
            {
              label: t('crm.wonValue', { defaultValue: 'Won value' }),
              value: formatAed(pipelineSummary.wonValue),
              helper: t('crm.closedWonDeals', { defaultValue: 'Closed won in this view' }),
            },
          ].map((item) => (
            <div key={item.label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                {item.label}
              </p>
              <p className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white">{item.value}</p>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{item.helper}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 overflow-x-auto pb-2">
          <div
            className="grid min-h-[580px] gap-4"
            style={{
              gridTemplateColumns: `repeat(${stageSummaries.length}, minmax(15rem, 1fr))`,
              minWidth: stageSummaries.length > 5 ? `${stageSummaries.length * 17}rem` : '100%',
            }}
          >
            {stageSummaries.map((stage) => (
              <div key={stage.id} className="flex min-h-0 flex-col rounded-3xl border border-slate-200 bg-white/45 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/45">
                <div className="border-b border-slate-200 px-2 pb-3 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} />
                      <h3 className="truncate text-sm font-black text-slate-950 dark:text-white">{stage.name}</h3>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-slate-500 ring-1 ring-slate-200 dark:bg-slate-950 dark:text-slate-400 dark:ring-slate-800">
                        {stage.contacts.length}
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 px-0.5 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                    {formatAed(stage.value)}
                  </p>
                </div>

                <div className="mt-3 flex-1 space-y-2 overflow-y-auto pr-1">
                  {stage.contacts.map((contact, contactIndex) => (
                    <motion.div
                      layoutId={contact.id}
                      key={contact.id}
                      className="group rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition-all hover:border-[#25D366]/50 hover:shadow-md dark:border-slate-800 dark:bg-slate-950"
                    >
                      {(() => {
                        const stageIndex = pipelineStages.findIndex((item) => item.key === stage.key);
                        const previousStage = stageIndex > 0 ? pipelineStages[stageIndex - 1] : null;
                        const nextStage = stageIndex < pipelineStages.length - 1 ? pipelineStages[stageIndex + 1] : null;

                        return (
                          <>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex min-w-0 items-center gap-2">
                                <div className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-2xl text-[10px] font-black', leadToneClasses[contactIndex % leadToneClasses.length])}>
                                  {getLeadInitials(contact)}
                                </div>
                                <div className="min-w-0">
                                  <h4 className="truncate text-sm font-black text-slate-950 dark:text-white">{contact.name || t('crm.unknown')}</h4>
                                  <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                                    <Phone className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{contact.phoneNumber}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100">
                                {previousStage && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateStage(contact.id, previousStage.key);
                                    }}
                                    className="rounded-lg p-1 text-slate-300 transition hover:bg-slate-100 hover:text-[#128C7E] dark:hover:bg-slate-800"
                                    title={t('crm.moveToStage', { name: previousStage.name })}
                                  >
                                    <ArrowLeft className="h-3.5 w-3.5" />
                                  </button>
                                )}
                                {nextStage && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateStage(contact.id, nextStage.key);
                                    }}
                                    className="rounded-lg p-1 text-slate-300 transition hover:bg-slate-100 hover:text-[#128C7E] dark:hover:bg-slate-800"
                                    title={t('crm.moveToStage', { name: nextStage.name })}
                                  >
                                    <ArrowRight className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="mt-3 rounded-2xl border border-slate-200 bg-[#F7F5EF]/70 p-2.5 dark:border-slate-800 dark:bg-slate-900/70">
                              <div className="mb-1 flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                  {t('crm.dealValue')}
                                </span>
                                {(contact.estimatedValue ?? 0) > 0 && (
                                  <span className="text-[10px] font-black text-[#128C7E] dark:text-[#4ADE80]">
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
                                  className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 outline-none focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
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

                            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
                              <span className={cn(
                                'rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wider',
                                contact.conversations?.[0]
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                              )}>
                                {contact.conversations?.[0] ? t('crm.active') : t('crm.noChatStatus')}
                              </span>
                              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">AI</span>
                            </div>
                          </>
                        );
                      })()}
                    </motion.div>
                  ))}
                  {stage.contacts.length === 0 && (
                    <div className="flex min-h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/50 p-4 text-center dark:border-slate-800 dark:bg-slate-950/40">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                        {hasActiveFilters ? t('crm.noMatchingLeads') : t('crm.noLeadsHere')}
                      </p>
                      {!hasActiveFilters && filteredContacts.length === 0 && stage.key === activeMobileStage?.key && (
                        <button
                          type="button"
                          onClick={() => {
                            fetchLists();
                            setShowAddLead(true);
                          }}
                          className="mt-3 rounded-xl bg-[#25D366] px-3 py-2 text-xs font-bold text-white hover:bg-[#128C7E]"
                        >
                          {t('crm.addFirstLead', { defaultValue: 'Add first lead' })}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
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
