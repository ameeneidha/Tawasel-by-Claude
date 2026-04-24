import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useApp } from '../contexts/AppContext';
import {
  Copy,
  Edit,
  FileText,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import * as Tabs from '@radix-ui/react-tabs';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

type WhatsAppTemplate = {
  id: string;
  name: string;
  content: string;
  category: string;
  language?: string | null;
  status?: string | null;
  rejectedReason?: string | null;
};

type SessionTemplate = {
  id: string;
  name: string;
  content: string;
};

type TemplateEditorState = {
  id?: string;
  name: string;
  content: string;
};

const EMPTY_EDITOR_STATE: TemplateEditorState = {
  name: '',
  content: '',
};

type WaBuilderState = {
  name: string;
  category: string;
  language: string;
  bodyText: string;
  whatsAppNumberId: string;
};

const EMPTY_WA_BUILDER: WaBuilderState = {
  name: '',
  category: 'UTILITY',
  language: 'en_US',
  bodyText: '',
  whatsAppNumberId: '',
};

type WaNumberOption = {
  id: string;
  phoneNumber: string;
  metaWabaId: string | null;
  metaAccessToken?: string | null;
};

const VARIABLE_TAGS = [
  { label: 'Customer Name', token: '{{customer_name}}' },
  { label: 'Service', token: '{{service}}' },
  { label: 'Staff', token: '{{staff}}' },
  { label: 'Date', token: '{{date}}' },
  { label: 'Time', token: '{{time}}' },
  { label: 'Business', token: '{{business}}' },
];

const WA_CATEGORIES = ['UTILITY', 'MARKETING', 'AUTHENTICATION'];
const WA_LANGUAGES  = [
  { code: 'en_US', label: 'English (US)' },
  { code: 'en_GB', label: 'English (UK)' },
  { code: 'ar',    label: 'Arabic' },
];

export default function Templates() {
  const { activeWorkspace } = useApp();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'whatsapp' | 'session'>('whatsapp');
  const [waTemplates, setWaTemplates] = useState<WhatsAppTemplate[]>([]);
  const [sessionTemplates, setSessionTemplates] = useState<SessionTemplate[]>([]);
  const [whatsAppSearch, setWhatsAppSearch] = useState('');
  const [sessionSearch, setSessionSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateEditorState>(EMPTY_EDITOR_STATE);

  // WhatsApp Template Builder
  const [isWaBuilderOpen, setIsWaBuilderOpen] = useState(false);
  const [waBuilder, setWaBuilder] = useState<WaBuilderState>(EMPTY_WA_BUILDER);
  const [isWaBuilderSaving, setIsWaBuilderSaving] = useState(false);
  const [waBodyRef, setWaBodyRef] = useState<HTMLTextAreaElement | null>(null);
  const [waNumbers, setWaNumbers] = useState<WaNumberOption[]>([]);

  useEffect(() => {
    if (activeWorkspace?.id) {
      fetchTemplates();
      // Fetch connected numbers so the builder can pick which WABA to target
      axios.get(`/api/numbers?workspaceId=${activeWorkspace.id}`)
        .then((r) => setWaNumbers(Array.isArray(r.data) ? r.data : []))
        .catch(() => setWaNumbers([]));
    } else {
      setWaTemplates([]);
      setSessionTemplates([]);
      setWaNumbers([]);
      setIsLoading(false);
    }
  }, [activeWorkspace?.id]);

  const fetchTemplates = async (mode: 'initial' | 'refresh' = 'initial') => {
    if (!activeWorkspace?.id) {
      return;
    }

    if (mode === 'refresh') {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      if (mode === 'refresh') {
        // Sync from Meta API first, then load both
        const [syncResponse, sessionResponse] = await Promise.all([
          axios.post('/api/templates/whatsapp/sync', { workspaceId: activeWorkspace.id }),
          axios.get(`/api/templates/session?workspaceId=${activeWorkspace.id}`),
        ]);
        const synced = syncResponse.data.synced || 0;
        setWaTemplates(Array.isArray(syncResponse.data.templates) ? syncResponse.data.templates : []);
        setSessionTemplates(Array.isArray(sessionResponse.data) ? sessionResponse.data : []);
        toast.success(t('broadcast.syncedTemplates', { count: synced }));
      } else {
        const [waResponse, sessionResponse] = await Promise.all([
          axios.get(`/api/templates/whatsapp?workspaceId=${activeWorkspace.id}`),
          axios.get(`/api/templates/session?workspaceId=${activeWorkspace.id}`),
        ]);
        const waList = Array.isArray(waResponse.data) ? waResponse.data : [];
        setWaTemplates(waList);
        setSessionTemplates(Array.isArray(sessionResponse.data) ? sessionResponse.data : []);
        // If any templates are still PENDING, auto-sync with Meta in the background
        // so their real status (APPROVED/REJECTED) shows up without a manual refresh
        if (waList.some((t: WhatsAppTemplate) => t.status === 'PENDING')) {
          axios.post('/api/templates/whatsapp/sync', { workspaceId: activeWorkspace.id })
            .then((r) => {
              if (Array.isArray(r.data?.templates)) setWaTemplates(r.data.templates);
            })
            .catch(() => { /* silent — the refresh button is still available */ });
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('templates.couldNotLoad'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const filteredWaTemplates = useMemo(() => {
    const query = whatsAppSearch.trim().toLowerCase();
    if (!query) {
      return waTemplates;
    }

    return waTemplates.filter((template) =>
      [template.name, template.content, template.category, template.language || '']
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [waTemplates, whatsAppSearch]);

  const filteredSessionTemplates = useMemo(() => {
    const query = sessionSearch.trim().toLowerCase();
    if (!query) {
      return sessionTemplates;
    }

    return sessionTemplates.filter((template) =>
      [template.name, template.content].join(' ').toLowerCase().includes(query)
    );
  }, [sessionTemplates, sessionSearch]);

  const openCreateModal = () => {
    setEditingTemplate(EMPTY_EDITOR_STATE);
    setIsEditorOpen(true);
  };

  const openEditModal = (template: SessionTemplate) => {
    setEditingTemplate({
      id: template.id,
      name: template.name,
      content: template.content,
    });
    setIsEditorOpen(true);
  };

  const closeEditor = () => {
    if (isSaving) {
      return;
    }
    setIsEditorOpen(false);
    setEditingTemplate(EMPTY_EDITOR_STATE);
  };

  const handleSaveTemplate = async () => {
    if (!activeWorkspace?.id) {
      toast.error(t('templates.chooseWorkspace'));
      return;
    }

    const name = editingTemplate.name.trim();
    const content = editingTemplate.content.trim();

    if (name.length < 2) {
      toast.error(t('templates.nameMinLength'));
      return;
    }

    if (!content) {
      toast.error(t('templates.contentRequired'));
      return;
    }

    setIsSaving(true);

    try {
      if (editingTemplate.id) {
        const response = await axios.patch(`/api/templates/session/${editingTemplate.id}`, {
          name,
          content,
        });

        setSessionTemplates((current) =>
          current.map((template) => (template.id === editingTemplate.id ? response.data : template))
        );
        toast.success(t('templates.templateUpdated'));
      } else {
        const response = await axios.post('/api/templates/session', {
          workspaceId: activeWorkspace.id,
          name,
          content,
        });

        setSessionTemplates((current) =>
          [...current, response.data].sort((a, b) => a.name.localeCompare(b.name))
        );
        toast.success(t('templates.templateCreated'));
      }

      closeEditor();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('templates.couldNotSave'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTemplate = async (template: SessionTemplate) => {
    const confirmed = window.confirm(t('templates.deleteConfirm', { name: template.name }));
    if (!confirmed) {
      return;
    }

    try {
      await axios.delete(`/api/templates/session/${template.id}`);
      setSessionTemplates((current) => current.filter((item) => item.id !== template.id));
      toast.success(t('templates.templateDeleted'));
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('templates.couldNotDelete'));
    }
  };

  const handleDeleteWaTemplate = async (template: WhatsAppTemplate) => {
    if (!activeWorkspace?.id) return;
    const confirmed = window.confirm(
      `Delete WhatsApp template "${template.name}"?\n\nThis will remove it from Meta and from Tawasel. This cannot be undone.`
    );
    if (!confirmed) return;

    try {
      const r = await axios.delete(
        `/api/templates/whatsapp/${template.id}?workspaceId=${activeWorkspace.id}`
      );
      setWaTemplates((cur) => cur.filter((t) => t.id !== template.id));
      if (r.data?.metaDeleted) {
        toast.success('Template deleted from WhatsApp');
      } else {
        toast.success('Removed locally — check WhatsApp Manager if Meta still shows it');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Could not delete template');
    }
  };

  const handleDuplicateTemplate = async (template: SessionTemplate) => {
    if (!activeWorkspace?.id) {
      toast.error(t('templates.chooseWorkspaceDuplicate'));
      return;
    }

    try {
      const response = await axios.post('/api/templates/session', {
        workspaceId: activeWorkspace.id,
        name: `${template.name} Copy`,
        content: template.content,
      });

      setSessionTemplates((current) =>
        [...current, response.data].sort((a, b) => a.name.localeCompare(b.name))
      );
      toast.success(t('templates.templateDuplicated'));
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('templates.couldNotDuplicate'));
    }
  };

  const insertToken = (token: string) => {
    if (!waBodyRef) {
      setWaBuilder(b => ({ ...b, bodyText: b.bodyText + token }));
      return;
    }
    const start = waBodyRef.selectionStart;
    const end   = waBodyRef.selectionEnd;
    const text  = waBuilder.bodyText;
    const next  = text.slice(0, start) + token + text.slice(end);
    setWaBuilder(b => ({ ...b, bodyText: next }));
    setTimeout(() => {
      waBodyRef.selectionStart = waBodyRef.selectionEnd = start + token.length;
      waBodyRef.focus();
    }, 0);
  };

  const handleCreateWaTemplate = async () => {
    if (!activeWorkspace?.id) return;
    const name = waBuilder.name.trim().toLowerCase().replace(/\s+/g, '_');
    if (!name) return toast.error('Template name is required');
    if (!/^[a-z0-9_]+$/.test(name)) return toast.error('Name must be lowercase letters, numbers, underscores only');
    if (!waBuilder.bodyText.trim()) return toast.error('Template body is required');
    if (waBuilder.bodyText.length > 1024) return toast.error('Body text must be under 1024 characters');

    setIsWaBuilderSaving(true);
    try {
      const res = await axios.post('/api/templates/whatsapp/create', {
        workspaceId: activeWorkspace.id,
        name,
        category: waBuilder.category,
        language: waBuilder.language,
        bodyText: waBuilder.bodyText,
        whatsAppNumberId: waBuilder.whatsAppNumberId || undefined,
      });
      setWaTemplates(prev => [res.data.template, ...prev]);
      setIsWaBuilderOpen(false);
      setWaBuilder(EMPTY_WA_BUILDER);
      toast.success('Template submitted to Meta for approval! Will be active in a few minutes.');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create template');
    } finally {
      setIsWaBuilderSaving(false);
    }
  };

  const handleCopyTemplate = async (template: { content: string }) => {
    try {
      await navigator.clipboard.writeText(template.content);
      toast.success(t('templates.templateCopied'));
    } catch {
      toast.error(t('templates.couldNotCopy'));
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-[#F8F9FA] p-8 transition-colors dark:bg-slate-950">
      <div className="mx-auto max-w-6xl">
        <Tabs.Root
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as 'whatsapp' | 'session')}
          className="space-y-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{t('templates.title')}</h1>
              <p className="mt-1 text-gray-500 dark:text-gray-400">
                {t('templates.subtitleAlt')}
              </p>
            </div>
            <Tabs.List className="flex gap-1 rounded-xl border border-gray-200 bg-white p-1 transition-colors dark:border-slate-800 dark:bg-slate-900">
              <Tabs.Trigger
                value="whatsapp"
                className="rounded-lg px-4 py-1.5 text-sm font-medium text-gray-500 transition-all data-[state=active]:bg-[#25D366] data-[state=active]:text-white dark:text-gray-400"
              >
                {t('templates.whatsappTab')}
              </Tabs.Trigger>
              <Tabs.Trigger
                value="session"
                className="rounded-lg px-4 py-1.5 text-sm font-medium text-gray-500 transition-all data-[state=active]:bg-[#25D366] data-[state=active]:text-white dark:text-gray-400"
              >
                {t('templates.sessionTab')}
              </Tabs.Trigger>
            </Tabs.List>
          </div>

          <Tabs.Content value="whatsapp" className="space-y-6 outline-none">
            <div className="flex items-center justify-between gap-4">
              <div className="relative max-w-md flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  value={whatsAppSearch}
                  onChange={(event) => setWhatsAppSearch(event.target.value)}
                  placeholder={t('templates.searchWhatsApp')}
                  className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 outline-none transition-colors focus:ring-2 focus:ring-[#25D366]/10 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:placeholder:text-gray-600"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const preferred = waNumbers.find(n => n.metaWabaId && n.metaAccessToken) || waNumbers[0];
                    setWaBuilder({ ...EMPTY_WA_BUILDER, whatsAppNumberId: preferred?.id || '' });
                    setIsWaBuilderOpen(true);
                  }}
                  disabled={!activeWorkspace?.id}
                  className="flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2 font-medium text-white shadow-sm transition-all hover:bg-[#128C7E] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" />
                  New Template
                </button>
                <button
                  type="button"
                  onClick={() => fetchTemplates('refresh')}
                  disabled={isRefreshing || !activeWorkspace?.id}
                  className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 disabled:cursor-wait disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:text-gray-300 dark:hover:bg-slate-800"
                >
                  <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
                  {t('templates.syncFromWhatsApp')}
                </button>
              </div>
            </div>

            <TemplatesGrid
              isLoading={isLoading}
              isEmpty={filteredWaTemplates.length === 0}
              emptyTitle={t('templates.noWhatsAppTemplates')}
              emptyDescription={t('templates.noWhatsAppTemplatesDesc')}
            >
              {filteredWaTemplates.map((template) => (
                <React.Fragment key={template.id}>
                  <TemplateCard
                    template={template}
                    type="whatsapp"
                    onCopy={() => handleCopyTemplate(template)}
                    onDelete={() => handleDeleteWaTemplate(template)}
                  />
                </React.Fragment>
              ))}
            </TemplatesGrid>
          </Tabs.Content>

          <Tabs.Content value="session" className="space-y-6 outline-none">
            <div className="flex items-center justify-between gap-4">
              <div className="relative max-w-md flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  value={sessionSearch}
                  onChange={(event) => setSessionSearch(event.target.value)}
                  placeholder={t('templates.searchSession')}
                  className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 outline-none transition-colors focus:ring-2 focus:ring-[#25D366]/10 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:placeholder:text-gray-600"
                />
              </div>
              <button
                type="button"
                onClick={openCreateModal}
                disabled={!activeWorkspace?.id}
                className="flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2 font-medium text-white shadow-sm transition-all hover:bg-[#128C7E] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                {t('templates.newTemplate')}
              </button>
            </div>

            <TemplatesGrid
              isLoading={isLoading}
              isEmpty={filteredSessionTemplates.length === 0}
              emptyTitle={t('templates.noSessionTemplates')}
              emptyDescription={t('templates.noSessionTemplatesDesc')}
            >
              {filteredSessionTemplates.map((template) => (
                <React.Fragment key={template.id}>
                  <TemplateCard
                    template={template}
                    type="session"
                    onCopy={() => handleCopyTemplate(template)}
                    onEdit={() => openEditModal(template)}
                    onDelete={() => handleDeleteTemplate(template)}
                    onDuplicate={() => handleDuplicateTemplate(template)}
                  />
                </React.Fragment>
              ))}
            </TemplatesGrid>
          </Tabs.Content>
        </Tabs.Root>
      </div>

      {/* WhatsApp Template Builder Modal */}
      {isWaBuilderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Create WhatsApp Template</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Template will be submitted to Meta for approval — usually takes a few minutes.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsWaBuilderOpen(false)}
                disabled={isWaBuilderSaving}
                className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {/* WhatsApp Number (target WABA) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                  WhatsApp Number <span className="text-gray-400 font-normal normal-case tracking-normal">(template will be created on this WABA)</span>
                </label>
                {waNumbers.length === 0 ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                    No WhatsApp numbers connected. Connect one in Channels first.
                  </div>
                ) : (
                  <select
                    value={waBuilder.whatsAppNumberId}
                    onChange={e => setWaBuilder(b => ({ ...b, whatsAppNumberId: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#25D366]/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  >
                    <option value="">Auto-pick (first connected)</option>
                    {waNumbers.map(n => (
                      <option key={n.id} value={n.id} disabled={!n.metaWabaId || !n.metaAccessToken}>
                        {n.phoneNumber}
                        {n.metaWabaId ? ` — WABA ${n.metaWabaId}` : ' — not connected'}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                  Template Name <span className="text-gray-400 font-normal normal-case tracking-normal">(lowercase, underscores only)</span>
                </label>
                <input
                  type="text"
                  value={waBuilder.name}
                  onChange={e => setWaBuilder(b => ({ ...b, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') }))}
                  placeholder="e.g. appointment_reminder_3h"
                  maxLength={60}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 font-mono outline-none focus:ring-2 focus:ring-[#25D366]/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>

              {/* Category + Language */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Category</label>
                  <select
                    value={waBuilder.category}
                    onChange={e => setWaBuilder(b => ({ ...b, category: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#25D366]/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  >
                    {WA_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <p className="text-xs text-gray-400">Use UTILITY for reminders, MARKETING for promotions</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">Language</label>
                  <select
                    value={waBuilder.language}
                    onChange={e => setWaBuilder(b => ({ ...b, language: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#25D366]/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  >
                    {WA_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Body */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                    Message Body
                  </label>
                  <span className="text-xs text-gray-400">{waBuilder.bodyText.length}/1024</span>
                </div>
                {/* Variable tags */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {VARIABLE_TAGS.map(v => (
                    <button
                      key={v.token}
                      type="button"
                      onClick={() => insertToken(v.token)}
                      className="rounded-lg border border-[#25D366]/30 bg-[#25D366]/5 px-2 py-0.5 text-xs font-medium text-[#128C7E] hover:bg-[#25D366]/15 transition-colors dark:border-[#25D366]/20 dark:text-[#25D366]"
                    >
                      + {v.label}
                    </button>
                  ))}
                </div>
                <textarea
                  ref={el => setWaBodyRef(el)}
                  value={waBuilder.bodyText}
                  onChange={e => setWaBuilder(b => ({ ...b, bodyText: e.target.value.slice(0, 1024) }))}
                  rows={6}
                  placeholder="Hi {{customer_name}}! Your {{service}} with {{staff}} is tomorrow at {{time}}. See you then! — {{business}}"
                  className="w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm leading-6 text-gray-900 outline-none focus:ring-2 focus:ring-[#25D366]/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
                <p className="text-xs text-gray-400">
                  Click a variable tag above to insert it at the cursor. Variables are auto-filled by Tawasel when the reminder fires.
                </p>
              </div>

              {/* Preview */}
              {waBuilder.bodyText && (
                <div className="rounded-xl bg-[#DCF8C6] p-4 dark:bg-green-900/20">
                  <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Preview</p>
                  <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                    {waBuilder.bodyText
                      .replace(/\{\{customer_name\}\}/g, 'Layla')
                      .replace(/\{\{service\}\}/g, 'Haircut')
                      .replace(/\{\{staff\}\}/g, 'Ahmed')
                      .replace(/\{\{date\}\}/g, 'Monday, April 28')
                      .replace(/\{\{time\}\}/g, '3:00 PM')
                      .replace(/\{\{business\}\}/g, 'Glamour Salon')}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsWaBuilderOpen(false)}
                disabled={isWaBuilderSaving}
                className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateWaTemplate}
                disabled={isWaBuilderSaving || !waBuilder.name || !waBuilder.bodyText}
                className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#128C7E] disabled:cursor-wait disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {isWaBuilderSaving ? 'Submitting...' : 'Submit to Meta'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {isEditorOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {editingTemplate.id ? t('templates.editSessionTemplate') : t('templates.createSessionTemplate')}
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {t('templates.editorSubtitle')}
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-slate-800 dark:hover:text-gray-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                  {t('templates.templateName')}
                </label>
                <input
                  type="text"
                  value={editingTemplate.name}
                  onChange={(event) =>
                    setEditingTemplate((current) => ({ ...current, name: event.target.value }))
                  }
                  maxLength={80}
                  placeholder={t('templates.templateNamePlaceholder')}
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition-colors focus:ring-2 focus:ring-[#25D366]/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-4">
                  <label className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                    {t('templates.messageContent')}
                  </label>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {editingTemplate.content.length}/2000
                  </span>
                </div>
                <textarea
                  value={editingTemplate.content}
                  onChange={(event) =>
                    setEditingTemplate((current) => ({
                      ...current,
                      content: event.target.value.slice(0, 2000),
                    }))
                  }
                  rows={7}
                  placeholder={t('templates.messagePlaceholder')}
                  className="w-full resize-none rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm leading-6 text-gray-900 outline-none transition-colors focus:ring-2 focus:ring-[#25D366]/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeEditor}
                disabled={isSaving}
                className="rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-gray-300 dark:hover:bg-slate-800"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleSaveTemplate}
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#25D366] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#128C7E] disabled:cursor-wait disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {isSaving ? t('templates.saving') : editingTemplate.id ? t('templates.saveChanges') : t('templates.createTemplate')}
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </div>
  );
}

function TemplatesGrid({
  isLoading,
  isEmpty,
  emptyTitle,
  emptyDescription,
  children,
}: {
  isLoading: boolean;
  isEmpty: boolean;
  emptyTitle: string;
  emptyDescription: string;
  children: React.ReactNode;
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-[280px] animate-pulse rounded-2xl border border-gray-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
          />
        ))}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#25D366]/10 text-[#128C7E]">
          <FileText className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">{emptyTitle}</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500 dark:text-gray-400">
          {emptyDescription}
        </p>
      </div>
    );
  }

  return <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

function TemplateCard({
  template,
  type,
  onCopy,
  onEdit,
  onDelete,
  onDuplicate,
}: {
  template: WhatsAppTemplate | SessionTemplate;
  type: 'whatsapp' | 'session';
  onCopy: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
}) {
  const { t } = useTranslation();

  const content =
    typeof template.content === 'string' && template.content.trim().length > 0
      ? template.content
      : t('templates.noContent');

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="rounded-xl bg-gray-50 p-2 text-gray-600 transition-colors dark:bg-slate-800 dark:text-gray-400">
          <FileText className="h-5 w-5" />
        </div>
        {type === 'whatsapp' ? (() => {
          const status = (template as WhatsAppTemplate).status || 'APPROVED';
          const cls =
            status === 'APPROVED' ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
            : status === 'PENDING' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
            : status === 'REJECTED' ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
            : 'bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-300';
          return (
            <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${cls}`}>
              {status}
            </span>
          );
        })() : (
          <span className="rounded bg-[#25D366]/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[#128C7E]">
            {t('templates.session')}
          </span>
        )}
      </div>

      <h3 className="mb-2 truncate font-semibold text-gray-900 dark:text-white">{template.name}</h3>

      {type === 'whatsapp' && (template as WhatsAppTemplate).status === 'REJECTED' && (template as WhatsAppTemplate).rejectedReason && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          <span className="font-semibold">Rejected:</span> {(template as WhatsAppTemplate).rejectedReason}
        </div>
      )}

      <div className="mb-4 min-h-[88px] rounded-xl bg-gray-50 p-3 transition-colors dark:bg-slate-800">
        <p className="line-clamp-4 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{content}</p>
      </div>

      <div className="flex items-center justify-between border-t border-gray-50 pt-4 transition-colors dark:border-slate-800">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            {type === 'whatsapp' ? (template as WhatsAppTemplate).category : t('templates.session')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCopy}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-[#25D366]/5 hover:text-[#25D366] dark:text-gray-500"
          >
            <Copy className="h-4 w-4" />
          </button>
          {type === 'session' ? (
            <>
              <button
                type="button"
                onClick={onDuplicate}
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-gray-500 dark:hover:bg-slate-800 dark:hover:text-gray-300"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onEdit}
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600 dark:text-gray-500 dark:hover:bg-blue-900/20"
              >
                <Edit className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-gray-500 dark:hover:bg-red-900/20"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          ) : onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              title="Delete template"
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-gray-500 dark:hover:bg-red-900/20"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
