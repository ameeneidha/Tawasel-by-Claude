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

type WhatsAppTemplate = {
  id: string;
  name: string;
  content: string;
  category: string;
  language?: string | null;
  status?: string | null;
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

export default function Templates() {
  const { activeWorkspace } = useApp();
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

  useEffect(() => {
    if (activeWorkspace?.id) {
      fetchTemplates();
    } else {
      setWaTemplates([]);
      setSessionTemplates([]);
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
        toast.success(`Synced ${synced} template${synced !== 1 ? 's' : ''} from WhatsApp`);
      } else {
        const [waResponse, sessionResponse] = await Promise.all([
          axios.get(`/api/templates/whatsapp?workspaceId=${activeWorkspace.id}`),
          axios.get(`/api/templates/session?workspaceId=${activeWorkspace.id}`),
        ]);
        setWaTemplates(Array.isArray(waResponse.data) ? waResponse.data : []);
        setSessionTemplates(Array.isArray(sessionResponse.data) ? sessionResponse.data : []);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Could not load templates');
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
      toast.error('Choose a workspace before creating templates');
      return;
    }

    const name = editingTemplate.name.trim();
    const content = editingTemplate.content.trim();

    if (name.length < 2) {
      toast.error('Template name must be at least 2 characters');
      return;
    }

    if (!content) {
      toast.error('Template content is required');
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
        toast.success('Template updated');
      } else {
        const response = await axios.post('/api/templates/session', {
          workspaceId: activeWorkspace.id,
          name,
          content,
        });

        setSessionTemplates((current) =>
          [...current, response.data].sort((a, b) => a.name.localeCompare(b.name))
        );
        toast.success('Template created');
      }

      closeEditor();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Could not save template');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTemplate = async (template: SessionTemplate) => {
    const confirmed = window.confirm(`Delete "${template.name}"?`);
    if (!confirmed) {
      return;
    }

    try {
      await axios.delete(`/api/templates/session/${template.id}`);
      setSessionTemplates((current) => current.filter((item) => item.id !== template.id));
      toast.success('Template deleted');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Could not delete template');
    }
  };

  const handleDuplicateTemplate = async (template: SessionTemplate) => {
    if (!activeWorkspace?.id) {
      toast.error('Choose a workspace before duplicating templates');
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
      toast.success('Template duplicated');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Could not duplicate template');
    }
  };

  const handleCopyTemplate = async (template: { content: string }) => {
    try {
      await navigator.clipboard.writeText(template.content);
      toast.success('Template copied');
    } catch {
      toast.error('Could not copy template');
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
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Message Templates</h1>
              <p className="mt-1 text-gray-500 dark:text-gray-400">
                Manage reusable message structures for your business.
              </p>
            </div>
            <Tabs.List className="flex gap-1 rounded-xl border border-gray-100 bg-white p-1 transition-colors dark:border-slate-800 dark:bg-slate-900">
              <Tabs.Trigger
                value="whatsapp"
                className="rounded-lg px-4 py-1.5 text-sm font-medium text-gray-500 transition-all data-[state=active]:bg-[#25D366] data-[state=active]:text-white dark:text-gray-400"
              >
                WhatsApp
              </Tabs.Trigger>
              <Tabs.Trigger
                value="session"
                className="rounded-lg px-4 py-1.5 text-sm font-medium text-gray-500 transition-all data-[state=active]:bg-[#25D366] data-[state=active]:text-white dark:text-gray-400"
              >
                Session
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
                  placeholder="Search WhatsApp templates..."
                  className="w-full rounded-xl border border-gray-100 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 outline-none transition-colors focus:ring-2 focus:ring-[#25D366]/10 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:placeholder:text-gray-600"
                />
              </div>
              <button
                type="button"
                onClick={() => fetchTemplates('refresh')}
                disabled={isRefreshing || !activeWorkspace?.id}
                className="flex items-center gap-2 rounded-xl border border-gray-100 bg-white px-4 py-2 font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 disabled:cursor-wait disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:text-gray-300 dark:hover:bg-slate-800"
              >
                <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
                Sync from WhatsApp
              </button>
            </div>

            <TemplatesGrid
              isLoading={isLoading}
              isEmpty={filteredWaTemplates.length === 0}
              emptyTitle="No WhatsApp templates yet"
              emptyDescription="Sync approved WhatsApp templates from Meta to see them here."
            >
              {filteredWaTemplates.map((template) => (
                <React.Fragment key={template.id}>
                  <TemplateCard
                    template={template}
                    type="whatsapp"
                    onCopy={() => handleCopyTemplate(template)}
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
                  placeholder="Search session templates..."
                  className="w-full rounded-xl border border-gray-100 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 outline-none transition-colors focus:ring-2 focus:ring-[#25D366]/10 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:placeholder:text-gray-600"
                />
              </div>
              <button
                type="button"
                onClick={openCreateModal}
                disabled={!activeWorkspace?.id}
                className="flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2 font-medium text-white shadow-sm transition-all hover:bg-[#128C7E] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                New Template
              </button>
            </div>

            <TemplatesGrid
              isLoading={isLoading}
              isEmpty={filteredSessionTemplates.length === 0}
              emptyTitle="No session templates yet"
              emptyDescription="Create quick-reply session templates for your team and reuse them in the inbox."
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

      {isEditorOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="w-full max-w-lg rounded-3xl border border-gray-100 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {editingTemplate.id ? 'Edit session template' : 'Create session template'}
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Save reusable replies for common WhatsApp conversations.
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
                  Template name
                </label>
                <input
                  type="text"
                  value={editingTemplate.name}
                  onChange={(event) =>
                    setEditingTemplate((current) => ({ ...current, name: event.target.value }))
                  }
                  maxLength={80}
                  placeholder="Example: Pricing Follow Up"
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition-colors focus:ring-2 focus:ring-[#25D366]/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-4">
                  <label className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                    Message content
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
                  placeholder="Type the reusable message your team should send."
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
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTemplate}
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#25D366] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#128C7E] disabled:cursor-wait disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {isSaving ? 'Saving...' : editingTemplate.id ? 'Save Changes' : 'Create Template'}
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
            className="h-[280px] animate-pulse rounded-2xl border border-gray-100 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
          />
        ))}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
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
  const content =
    typeof template.content === 'string' && template.content.trim().length > 0
      ? template.content
      : 'No content added yet.';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="group rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="rounded-xl bg-gray-50 p-2 text-gray-600 transition-colors dark:bg-slate-800 dark:text-gray-400">
          <FileText className="h-5 w-5" />
        </div>
        {type === 'whatsapp' ? (
          <span className="rounded bg-green-50 px-2 py-0.5 text-[10px] font-bold uppercase text-green-600 dark:bg-green-900/20 dark:text-green-400">
            {'status' in template ? template.status || 'Approved' : 'Approved'}
          </span>
        ) : (
          <span className="rounded bg-[#25D366]/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[#128C7E]">
            Session
          </span>
        )}
      </div>

      <h3 className="mb-2 truncate font-semibold text-gray-900 dark:text-white">{template.name}</h3>

      <div className="mb-4 min-h-[88px] rounded-xl bg-gray-50 p-3 transition-colors dark:bg-slate-800">
        <p className="line-clamp-4 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{content}</p>
      </div>

      <div className="flex items-center justify-between border-t border-gray-50 pt-4 transition-colors dark:border-slate-800">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            {type === 'whatsapp' ? (template as WhatsAppTemplate).category : 'Session'}
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
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
