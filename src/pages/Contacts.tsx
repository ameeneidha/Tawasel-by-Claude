import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useApp } from '../contexts/AppContext';
import { Loader2, Search, Plus, Users, Tags, CheckSquare, Square, Upload, Download, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { Skeleton, SkeletonTable } from '../components/ui/Skeleton';
import ContactListPicker from '../components/ContactListPicker';
import {
  DEFAULT_PIPELINE_STAGE_KEY,
  getFallbackPipelineStageKey,
  getPipelineStageLabel,
  PipelineStage,
} from '../lib/pipelineStages';

interface ContactList {
  id: string;
  name: string;
  members: { contactId: string }[];
}

interface Contact {
  id: string;
  name?: string;
  phoneNumber?: string;
  instagramUsername?: string;
  leadSource?: string;
  pipelineStage: string;
  permission?: string;
  listMemberships?: {
    list: {
      id: string;
      name: string;
    };
  }[];
}

type CsvImportRow = Record<string, string>;

const CSV_TEMPLATE = `name,phone,lead_source,pipeline_stage,custom_lists
Ahmed Hassan,+971551112222,Website,NEW_LEAD,"Abu Dhabi, VIP"
Sarah Miller,+971553334444,WhatsApp Referral,CONTACTED,"Dubai"`;

const normalizeColumnKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/^\ufeff/, '')
    .replace(/[^a-z0-9]+/g, '');

const parseCsvText = (text: string) => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = '';
  let inQuotes = false;

  const pushValue = () => {
    currentRow.push(currentValue);
    currentValue = '';
  };

  const pushRow = () => {
    if (currentRow.length === 0 && !currentValue) return;
    pushValue();
    const hasValue = currentRow.some((cell) => cell.trim().length > 0);
    if (hasValue) {
      rows.push(currentRow);
    }
    currentRow = [];
  };

  const source = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentValue += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      pushValue();
      continue;
    }

    if (char === '\n' && !inQuotes) {
      pushRow();
      continue;
    }

    currentValue += char;
  }

  if (currentValue.length > 0 || currentRow.length > 0) {
    pushRow();
  }

  return rows;
};

const guessColumnMapping = (headers: string[]) => {
  const normalizedHeaders = headers.map((header) => ({
    raw: header,
    key: normalizeColumnKey(header),
  }));

  const findHeader = (aliases: string[]) =>
    normalizedHeaders.find((header) => aliases.includes(header.key))?.raw || '';

  return {
    name: findHeader(['name', 'fullname', 'contactname', 'customername']),
    phoneNumber: findHeader(['phone', 'phonenumber', 'mobile', 'mobilenumber', 'whatsapp', 'whatsappnumber', 'number']),
    leadSource: findHeader(['leadsource', 'source']),
    pipelineStage: findHeader(['pipelinestage', 'stage', 'status']),
    listNames: findHeader(['list', 'lists', 'contactlist', 'contactlists', 'customlist', 'customlists', 'segment', 'segments']),
  };
};

export default function Contacts() {
  const { t } = useTranslation();
  const { activeWorkspace, hasFullAccess } = useApp();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [lists, setLists] = useState<ContactList[]>([]);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);
  const [selectedListId, setSelectedListId] = useState<'ALL' | string>('ALL');
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [bulkListNames, setBulkListNames] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showListModal, setShowListModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importFileName, setImportFileName] = useState('');
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importRows, setImportRows] = useState<CsvImportRow[]>([]);
  const [importError, setImportError] = useState('');
  const [importMapping, setImportMapping] = useState({
    name: '',
    phoneNumber: '',
    leadSource: '',
    pipelineStage: '',
    listNames: '',
  });
  const [importDefaults, setImportDefaults] = useState({
    pipelineStage: DEFAULT_PIPELINE_STAGE_KEY,
    leadSource: '',
    listNames: [] as string[],
    duplicateMode: 'merge' as 'merge' | 'skip',
  });
  const [contactForm, setContactForm] = useState({
    name: '',
    phoneNumber: '',
    pipelineStage: DEFAULT_PIPELINE_STAGE_KEY,
    leadSource: '',
    listNames: [] as string[]
  });
  const [listName, setListName] = useState('');

  useEffect(() => {
    if (!activeWorkspace) {
      setContacts([]);
      setLists([]);
      setPipelineStages([]);
      setSelectedContactIds([]);
      setSelectedListId('ALL');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    Promise.all([fetchContacts(), fetchLists(), fetchPipelineStages()])
      .catch((loadError: any) => {
        const message =
          loadError?.response?.data?.error ||
          t('contacts.couldNotLoad');
        setError(message);
      })
      .finally(() => setIsLoading(false));
  }, [activeWorkspace]);

  useEffect(() => {
    if (pipelineStages.length === 0) return;
    const fallbackStageKey = getFallbackPipelineStageKey(pipelineStages);
    setContactForm((prev) =>
      pipelineStages.some((stage) => stage.key === prev.pipelineStage)
        ? prev
        : { ...prev, pipelineStage: fallbackStageKey }
    );
    setImportDefaults((prev) =>
      pipelineStages.some((stage) => stage.key === prev.pipelineStage)
        ? prev
        : { ...prev, pipelineStage: fallbackStageKey }
    );
  }, [pipelineStages]);

  const fetchContacts = async () => {
    const res = await axios.get(`/api/contacts?workspaceId=${activeWorkspace?.id}`);
    const nextContacts = (Array.isArray(res.data) ? res.data : []).map((contact: any) => ({
      ...contact,
      listMemberships: Array.isArray(contact?.listMemberships)
        ? contact.listMemberships.filter((membership: any) => membership?.list?.id && membership?.list?.name)
        : [],
    }));
    setContacts(nextContacts);
    setSelectedContactIds((prev) => prev.filter((id) => nextContacts.some((contact: Contact) => contact.id === id)));
  };

  const fetchLists = async () => {
    const res = await axios.get(`/api/contact-lists?workspaceId=${activeWorkspace?.id}`);
    setLists(
      (Array.isArray(res.data) ? res.data : []).map((list: any) => ({
        ...list,
        members: Array.isArray(list?.members) ? list.members : [],
      }))
    );
  };

  const fetchPipelineStages = async () => {
    const res = await axios.get(`/api/pipeline-stages?workspaceId=${activeWorkspace?.id}`);
    setPipelineStages(Array.isArray(res.data) ? res.data : []);
  };

  const filteredContacts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return contacts.filter((contact) => {
      if (!contact.phoneNumber) return false;

      const matchesSearch =
        !query ||
        (contact.name || '').toLowerCase().includes(query) ||
        (contact.phoneNumber || '').toLowerCase().includes(query) ||
        (contact.leadSource || '').toLowerCase().includes(query) ||
        contact.listMemberships?.some((membership) => membership.list.name.toLowerCase().includes(query));

      const matchesList =
        selectedListId === 'ALL' ||
        contact.listMemberships?.some((membership) => membership.list.id === selectedListId);

      return matchesSearch && matchesList;
    });
  }, [contacts, search, selectedListId]);

  const createContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace || (!contactForm.name.trim() && !contactForm.phoneNumber.trim())) return;

    setSaving(true);
    try {
      const res = await axios.post('/api/contacts', {
        workspaceId: activeWorkspace.id,
        ...contactForm
      });
      setContacts((prev) => [res.data, ...prev]);
      setContactForm({
        name: '',
        phoneNumber: '',
        pipelineStage: getFallbackPipelineStageKey(pipelineStages),
        leadSource: '',
        listNames: [],
      });
      setShowContactModal(false);
      await fetchLists();
      toast.success(t('contacts.contactSaved'));
    } catch (error) {
      toast.error(t('contacts.couldNotSaveContact'));
    } finally {
      setSaving(false);
    }
  };

  const createList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace || !listName.trim()) return;

    setSaving(true);
    try {
      const res = await axios.post('/api/contact-lists', {
        workspaceId: activeWorkspace.id,
        name: listName,
        contactIds: selectedContactIds
      });
      setLists((prev) => [...prev, res.data]);
      setListName('');
      setSelectedContactIds([]);
      setShowListModal(false);
      await fetchContacts();
      toast.success(t('contacts.listCreated'));
    } catch (error) {
      toast.error(t('contacts.couldNotCreateList'));
    } finally {
      setSaving(false);
    }
  };

  const toggleContactSelection = (contactId: string) => {
    setSelectedContactIds((prev) =>
      prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId]
    );
  };

  const applyBulkListAction = async (action: 'add' | 'remove') => {
    if (!activeWorkspace || selectedContactIds.length === 0 || bulkListNames.length === 0) return;

    setIsBulkUpdating(true);
    try {
      await axios.post('/api/contacts/bulk-lists', {
        workspaceId: activeWorkspace.id,
        contactIds: selectedContactIds,
        listNames: bulkListNames,
        action
      });
      await Promise.all([fetchContacts(), fetchLists()]);
      setBulkListNames([]);
      setSelectedContactIds([]);
      toast.success(action === 'add' ? t('contacts.contactsAddedToList') : t('contacts.contactsRemovedFromList'));
    } catch (error) {
      toast.error(action === 'add' ? t('contacts.couldNotAddToList') : t('contacts.couldNotRemoveFromList'));
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const resetImportState = () => {
    setImportFileName('');
    setImportHeaders([]);
    setImportRows([]);
    setImportError('');
    setImportMapping({
      name: '',
      phoneNumber: '',
      leadSource: '',
      pipelineStage: '',
      listNames: '',
    });
    setImportDefaults({
      pipelineStage: getFallbackPipelineStageKey(pipelineStages),
      leadSource: '',
      listNames: [],
      duplicateMode: 'merge',
    });
  };

  const openImportModal = async () => {
    await fetchLists();
    resetImportState();
    setShowImportModal(true);
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseCsvText(text);

      if (parsed.length < 2) {
        setImportError(t('contacts.csvNeedHeaderAndData'));
        setImportFileName(file.name);
        setImportHeaders([]);
        setImportRows([]);
        return;
      }

      const rawHeaders = parsed[0].map((header, index) => header.trim().replace(/^\ufeff/, '') || `Column ${index + 1}`);
      const headers = rawHeaders.map((header, index) => {
        const duplicateCount = rawHeaders.slice(0, index).filter((value) => value === header).length;
        return duplicateCount > 0 ? `${header} (${duplicateCount + 1})` : header;
      });

      const rows = parsed
        .slice(1)
        .filter((row) => row.some((cell) => cell.trim().length > 0))
        .map((row) =>
          headers.reduce<CsvImportRow>((result, header, index) => {
            result[header] = row[index]?.trim() || '';
            return result;
          }, {})
        );

      if (rows.length === 0) {
        setImportError(t('contacts.csvOnlyEmptyRows'));
        setImportFileName(file.name);
        setImportHeaders([]);
        setImportRows([]);
        return;
      }

      setImportFileName(file.name);
      setImportHeaders(headers);
      setImportRows(rows);
      setImportMapping(guessColumnMapping(headers));
      setImportError('');
    } catch (error) {
      setImportError(t('contacts.csvReadError'));
      setImportFileName(file.name);
      setImportHeaders([]);
      setImportRows([]);
    } finally {
      event.target.value = '';
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tawasel-contacts-template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const previewRows = useMemo(() => {
    return importRows.slice(0, 5).map((row) => ({
      name: importMapping.name ? row[importMapping.name] || '' : '',
      phoneNumber: importMapping.phoneNumber ? row[importMapping.phoneNumber] || '' : '',
      leadSource: importMapping.leadSource ? row[importMapping.leadSource] || importDefaults.leadSource : importDefaults.leadSource,
      pipelineStage: importMapping.pipelineStage ? row[importMapping.pipelineStage] || importDefaults.pipelineStage : importDefaults.pipelineStage,
      listNames: importMapping.listNames ? row[importMapping.listNames] || importDefaults.listNames.join(', ') : importDefaults.listNames.join(', '),
    }));
  }, [importRows, importMapping, importDefaults]);

  const submitCsvImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace || importRows.length === 0 || !importMapping.phoneNumber) return;

    setIsImporting(true);
    try {
      const response = await axios.post('/api/contacts/import', {
        workspaceId: activeWorkspace.id,
        rows: importRows,
        mappings: importMapping,
        defaults: {
          pipelineStage: importDefaults.pipelineStage,
          leadSource: importDefaults.leadSource,
          listNames: importDefaults.listNames,
        },
        duplicateMode: importDefaults.duplicateMode,
      });

      await Promise.all([fetchContacts(), fetchLists()]);
      setShowImportModal(false);
      resetImportState();

      const { created, updated, skipped, errors } = response.data;
      toast.success(t('contacts.csvImportSuccess', { created, updated, skipped }));
      if (Array.isArray(errors) && errors.length > 0) {
        toast.info(errors[0]);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.error || t('contacts.couldNotImport'));
    } finally {
      setIsImporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full overflow-hidden bg-[#F8F9FA] dark:bg-slate-950 transition-colors">
        <div className="flex h-full">
          {/* Sidebar skeleton */}
          <aside className="w-72 border-r border-gray-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <Skeleton className="h-11 w-full rounded-2xl mb-5" />
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full rounded-xl" />
              ))}
            </div>
          </aside>

          {/* Main content skeleton */}
          <main className="flex-1 overflow-auto p-6">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div className="space-y-2">
                <Skeleton className="h-7 w-40" />
                <Skeleton className="h-4 w-56" />
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-36 rounded-2xl" />
                <Skeleton className="h-10 w-36 rounded-2xl" />
              </div>
            </div>

            <div className="mb-4">
              <Skeleton className="h-11 w-full max-w-md rounded-2xl" />
            </div>

            <SkeletonTable rows={8} columns={6} />
          </main>
        </div>
      </div>
    );
  }

  if (!activeWorkspace) {
    return (
      <div className="h-full flex items-center justify-center bg-[#F8F9FA] dark:bg-slate-950 transition-colors p-6">
        <div className="max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 dark:bg-slate-800">
            <Users className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('contacts.noWorkspaceSelected')}</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {t('contacts.pickWorkspaceFirst')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden bg-[#F8F9FA] dark:bg-slate-950 transition-colors">
      <div className="flex h-full flex-col md:flex-row">
        <aside className="w-full shrink-0 border-b border-gray-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 md:w-72 md:border-b-0 md:border-r md:p-5">
          <button
            disabled={!hasFullAccess}
            onClick={() => {
              fetchLists();
              setShowListModal(true);
            }}
            className="mb-3 inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-[#128C7E] disabled:opacity-60 md:mb-5 md:flex md:w-full md:rounded-2xl md:px-4 md:py-3"
            title={t('contacts.newContactList')}
          >
            <Plus className="h-4 w-4" />
            <span className="md:hidden">List</span>
            <span className="hidden md:inline">{t('contacts.newContactList')}</span>
          </button>

          <div className="flex gap-2 overflow-x-auto pb-1 md:block md:space-y-2 md:overflow-visible md:pb-0">
            <button
              onClick={() => setSelectedListId('ALL')}
              className={cn(
                "flex shrink-0 items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm transition-colors md:w-full",
                selectedListId === 'ALL'
                  ? "bg-[#25D366]/10 text-[#128C7E]"
                  : "text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-slate-800"
              )}
            >
              <span>{t('contacts.allContacts')}</span>
              <span className="text-xs font-bold">{contacts.filter((contact) => contact.phoneNumber).length}</span>
            </button>
            {lists.map((list) => (
              <button
                key={list.id}
                onClick={() => setSelectedListId(list.id)}
                className={cn(
                  "flex max-w-[180px] shrink-0 items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors md:w-full md:max-w-none",
                  selectedListId === list.id
                    ? "bg-[#25D366]/10 text-[#128C7E]"
                    : "text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-slate-800"
                )}
              >
                <span className="truncate">{list.name}</span>
                <span className="text-xs font-bold">{list.members.length}</span>
              </button>
            ))}
          </div>
        </aside>

        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{t('contacts.title')}</h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {t('contacts.subtitle')}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 md:flex md:items-center md:gap-3">
              <button
                disabled={!hasFullAccess}
                onClick={openImportModal}
                className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-600 transition-colors hover:border-[#25D366] hover:text-[#25D366] dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300 disabled:opacity-60 md:py-2"
              >
                {t('contacts.importContacts')}
              </button>
              <button
                disabled={!hasFullAccess}
                onClick={() => {
                  fetchLists();
                  setShowContactModal(true);
                }}
                className="flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#128C7E] disabled:opacity-60 md:py-2"
              >
                <Plus className="h-4 w-4" />
                {t('contacts.newContact')}
              </button>
            </div>
          </div>

          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-4">
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('contacts.searchPlaceholder')}
                className="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm text-gray-900 outline-none focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {t('contacts.records', { count: filteredContacts.length })}
            </div>
          </div>

          {error && (
            <div className="mb-4 flex items-center justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => {
                  setIsLoading(true);
                  setError(null);
                  Promise.all([fetchContacts(), fetchLists()])
                    .catch((loadError: any) => {
                      setError(loadError?.response?.data?.error || t('contacts.couldNotLoad'));
                    })
                    .finally(() => setIsLoading(false));
                }}
                className="rounded-xl border border-red-200 px-3 py-1 text-xs font-semibold transition-colors hover:bg-red-100 dark:border-red-900/40 dark:hover:bg-red-900/30"
              >
                {t('common.retry')}
              </button>
            </div>
          )}

          {selectedContactIds.length > 0 && (
            <div className="mb-4 rounded-2xl border border-[#25D366]/15 bg-white p-4 shadow-sm dark:border-[#25D366]/20 dark:bg-slate-900">
              <div className="mb-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {t('contacts.contactsSelected', { count: selectedContactIds.length })}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('contacts.bulkListHint')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedContactIds([]);
                    setBulkListNames([]);
                  }}
                  className="text-xs font-semibold text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  {t('contacts.clearSelection')}
                </button>
              </div>

              <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
                <ContactListPicker
                  options={lists}
                  value={bulkListNames}
                  onChange={setBulkListNames}
                  disabled={!hasFullAccess || isBulkUpdating}
                  placeholder={t('contacts.bulkListPlaceholder')}
                />
                <button
                  type="button"
                  disabled={!hasFullAccess || isBulkUpdating || bulkListNames.length === 0}
                  onClick={() => applyBulkListAction('add')}
                  className="rounded-2xl bg-[#25D366] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#128C7E] disabled:opacity-50"
                >
                  {isBulkUpdating ? t('contacts.saving') : t('contacts.addToList')}
                </button>
                <button
                  type="button"
                  disabled={!hasFullAccess || isBulkUpdating || bulkListNames.length === 0}
                  onClick={() => applyBulkListAction('remove')}
                  className="rounded-2xl border border-red-200 px-4 py-3 text-sm font-bold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900/40 dark:text-red-300 dark:hover:bg-red-900/20"
                >
                  {t('contacts.removeFromList')}
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3 md:hidden">
            {filteredContacts.map((contact) => {
              const selected = selectedContactIds.includes(contact.id);
              return (
                <div key={contact.id} className={cn(
                  "rounded-2xl border bg-white p-4 shadow-sm dark:bg-slate-900",
                  selected ? "border-[#25D366] ring-2 ring-[#25D366]/10" : "border-gray-200 dark:border-slate-800"
                )}>
                  <div className="flex items-start gap-3">
                    <button type="button" onClick={() => toggleContactSelection(contact.id)} className="mt-1 shrink-0">
                      {selected ? (
                        <CheckSquare className="h-5 w-5 text-[#25D366]" />
                      ) : (
                        <Square className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-slate-800">
                      <Users className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-gray-900 dark:text-white">{contact.name || contact.phoneNumber || '-'}</p>
                          <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-gray-500 dark:text-gray-400">
                            <Phone className="h-3.5 w-3.5 shrink-0" />
                            {contact.phoneNumber || '-'}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider",
                            contact.permission === 'BLOCKED'
                              ? "bg-red-100 text-red-600"
                              : "bg-green-100 text-green-600"
                          )}
                        >
                          {contact.permission === 'BLOCKED' ? 'Blocked' : 'Active'}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{t('contacts.leadSourceColumn')}</p>
                          <p className="truncate font-medium text-gray-800 dark:text-gray-200">{contact.leadSource || t('contacts.directSearch')}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{t('contacts.statusColumn')}</p>
                          <p className="truncate font-medium text-gray-800 dark:text-gray-200">
                            {getPipelineStageLabel(pipelineStages, contact.pipelineStage)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {contact.listMemberships?.length ? contact.listMemberships.map((membership) => (
                          <span
                            key={membership.list.id}
                            className="rounded-full bg-sky-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-sky-700"
                          >
                            {membership.list.name}
                          </span>
                        )) : <span className="text-xs text-gray-400">{t('contacts.noList')}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredContacts.length === 0 && (
              <div className="rounded-2xl border border-gray-200 bg-white px-4 py-12 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 dark:bg-slate-800">
                  <Users className="h-5 w-5" />
                </div>
                <p className="font-medium text-gray-700 dark:text-gray-200">No contacts yet</p>
                <p className="mt-1 text-sm text-gray-400">Save customers from Inbox or add them manually here.</p>
              </div>
            )}
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 md:block">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-slate-800">
              <thead className="bg-gray-50 dark:bg-slate-950/50">
                <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedContactIds(
                          selectedContactIds.length === filteredContacts.length ? [] : filteredContacts.map((contact) => contact.id)
                        )
                      }
                    >
                      {selectedContactIds.length === filteredContacts.length && filteredContacts.length > 0 ? (
                        <CheckSquare className="h-4 w-4 text-[#25D366]" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3">{t('contacts.nameColumn')}</th>
                  <th className="px-4 py-3">{t('contacts.phoneColumn')}</th>
                  <th className="px-4 py-3">{t('contacts.leadSourceColumn')}</th>
                  <th className="px-4 py-3">{t('contacts.contactListsColumn')}</th>
                  <th className="px-4 py-3">{t('contacts.statusColumn')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {filteredContacts.map((contact) => (
                  <tr key={contact.id} className="text-sm text-gray-700 dark:text-gray-200">
                    <td className="px-4 py-4">
                      <button type="button" onClick={() => toggleContactSelection(contact.id)}>
                        {selectedContactIds.includes(contact.id) ? (
                          <CheckSquare className="h-4 w-4 text-[#25D366]" />
                        ) : (
                          <Square className="h-4 w-4 text-gray-400" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-4 font-medium">{contact.name || '-'}</td>
                    <td className="px-4 py-4">{contact.phoneNumber || '-'}</td>
                    <td className="px-4 py-4">{contact.leadSource || t('contacts.directSearch')}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        {contact.listMemberships?.length ? contact.listMemberships.map((membership) => (
                          <span
                            key={membership.list.id}
                            className="rounded-full bg-sky-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-sky-700"
                          >
                            {membership.list.name}
                          </span>
                        )) : <span className="text-xs text-gray-400">{t('contacts.noList')}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={cn(
                          "rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider",
                          contact.permission === 'BLOCKED'
                            ? "bg-red-100 text-red-600"
                            : "bg-green-100 text-green-600"
                        )}
                      >
                        {contact.permission === 'BLOCKED' ? 'Blocked' : 'Active'}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredContacts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 dark:bg-slate-800">
                        <Users className="h-5 w-5" />
                      </div>
                      <p className="font-medium text-gray-700 dark:text-gray-200">No contacts yet</p>
                      <p className="mt-1 text-sm text-gray-400">Save customers from Inbox or add them manually here.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>

      {showContactModal && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/35 p-4">
          <form onSubmit={createContact} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">New Contact</h2>
            <div className="mt-5 space-y-4">
              <input
                value={contactForm.name}
                onChange={(e) => setContactForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Customer name"
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-[#25D366] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <input
                value={contactForm.phoneNumber}
                onChange={(e) => setContactForm((prev) => ({ ...prev, phoneNumber: e.target.value }))}
                placeholder="Phone number"
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-[#25D366] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <input
                value={contactForm.leadSource}
                onChange={(e) => setContactForm((prev) => ({ ...prev, leadSource: e.target.value }))}
                placeholder="Lead source"
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-[#25D366] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <ContactListPicker
                options={lists}
                value={contactForm.listNames}
                onChange={(value) => setContactForm((prev) => ({ ...prev, listNames: value }))}
                placeholder="Add custom lists like Abu Dhabi, VIP, Follow Up"
              />
              <select
                value={contactForm.pipelineStage}
                onChange={(e) => setContactForm((prev) => ({ ...prev, pipelineStage: e.target.value }))}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold outline-none focus:border-[#25D366] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {pipelineStages.map((stage) => (
                  <option key={stage.id} value={stage.key}>{stage.name}</option>
                ))}
              </select>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setShowContactModal(false)} className="rounded-2xl px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="rounded-2xl bg-[#25D366] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Contact'}
              </button>
            </div>
          </form>
        </div>
      )}

      {showListModal && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/35 p-4">
          <form onSubmit={createList} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">New Contact List</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Create a reusable list from the contacts you selected.
            </p>
            <div className="mt-5 space-y-4">
              <input
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                placeholder="List name"
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-[#25D366] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <div className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-600 dark:bg-slate-800 dark:text-gray-300">
                <div className="mb-2 flex items-center gap-2 font-semibold">
                  <Tags className="h-4 w-4" />
                  {selectedContactIds.length} contacts selected
                </div>
                <p>Select rows in the table first, then create the list.</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setShowListModal(false)} className="rounded-2xl px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800">
                Cancel
              </button>
              <button type="submit" disabled={saving || selectedContactIds.length === 0} className="rounded-2xl bg-[#25D366] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                {saving ? 'Saving...' : 'Create List'}
              </button>
            </div>
          </form>
        </div>
      )}

      {showImportModal && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/35 p-4">
          <form onSubmit={submitCsvImport} className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Import Contacts from CSV</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Upload a CSV, map the columns, choose duplicate handling, and optionally add every imported row to one or more custom lists.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  resetImportState();
                }}
                className="rounded-2xl px-3 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-5">
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5 dark:border-slate-700 dark:bg-slate-950/40">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">Upload CSV file</p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Use columns like name, phone, lead source, stage, and custom lists.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={downloadTemplate}
                      className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition-colors hover:border-[#25D366] hover:text-[#25D366] dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300"
                    >
                      <Download className="h-4 w-4" />
                      Download Template
                    </button>
                  </div>

                  <label className="mt-4 flex cursor-pointer items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-4 text-sm font-semibold text-gray-700 transition-colors hover:border-[#25D366] hover:text-[#25D366] dark:border-slate-700 dark:bg-slate-900 dark:text-gray-200">
                    <Upload className="h-4 w-4" />
                    {importFileName ? `Replace ${importFileName}` : 'Choose CSV file'}
                    <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportFile} />
                  </label>

                  {importFileName && (
                    <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                      Loaded <span className="font-semibold text-gray-700 dark:text-gray-200">{importFileName}</span>
                      {importRows.length > 0 ? ` • ${importRows.length} rows detected` : ''}
                    </p>
                  )}

                  {importError && (
                    <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
                      {importError}
                    </div>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
                    <span>Name column</span>
                    <select
                      value={importMapping.name}
                      onChange={(e) => setImportMapping((prev) => ({ ...prev, name: e.target.value }))}
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium outline-none focus:border-[#25D366] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="">Ignore</option>
                      {importHeaders.map((header) => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
                    <span>Phone number column</span>
                    <select
                      value={importMapping.phoneNumber}
                      onChange={(e) => setImportMapping((prev) => ({ ...prev, phoneNumber: e.target.value }))}
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium outline-none focus:border-[#25D366] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="">Select required column</option>
                      {importHeaders.map((header) => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
                    <span>Lead source column</span>
                    <select
                      value={importMapping.leadSource}
                      onChange={(e) => setImportMapping((prev) => ({ ...prev, leadSource: e.target.value }))}
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium outline-none focus:border-[#25D366] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="">Use default below</option>
                      {importHeaders.map((header) => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
                    <span>Pipeline stage column</span>
                    <select
                      value={importMapping.pipelineStage}
                      onChange={(e) => setImportMapping((prev) => ({ ...prev, pipelineStage: e.target.value }))}
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium outline-none focus:border-[#25D366] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="">Use default below</option>
                      {importHeaders.map((header) => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2 text-sm font-semibold text-gray-700 dark:text-gray-200 md:col-span-2">
                    <span>Custom list column</span>
                    <select
                      value={importMapping.listNames}
                      onChange={(e) => setImportMapping((prev) => ({ ...prev, listNames: e.target.value }))}
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium outline-none focus:border-[#25D366] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="">No list column</option>
                      {importHeaders.map((header) => (
                        <option key={header} value={header}>{header}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
                    <span>Default pipeline stage</span>
                    <select
                      value={importDefaults.pipelineStage}
                      onChange={(e) => setImportDefaults((prev) => ({ ...prev, pipelineStage: e.target.value }))}
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium outline-none focus:border-[#25D366] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      {pipelineStages.map((stage) => (
                        <option key={stage.id} value={stage.key}>{stage.name}</option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
                    <span>Duplicate handling</span>
                    <select
                      value={importDefaults.duplicateMode}
                      onChange={(e) => setImportDefaults((prev) => ({ ...prev, duplicateMode: e.target.value as 'merge' | 'skip' }))}
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium outline-none focus:border-[#25D366] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="merge">Merge into existing phone numbers</option>
                      <option value="skip">Skip duplicates</option>
                    </select>
                  </label>

                  <label className="space-y-2 text-sm font-semibold text-gray-700 dark:text-gray-200 md:col-span-2">
                    <span>Default lead source</span>
                    <input
                      value={importDefaults.leadSource}
                      onChange={(e) => setImportDefaults((prev) => ({ ...prev, leadSource: e.target.value }))}
                      placeholder="Website, Meta Ad, Referral..."
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-[#25D366] dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </label>

                  <div className="space-y-2 md:col-span-2">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Add all imported contacts to these lists</span>
                    <ContactListPicker
                      options={lists}
                      value={importDefaults.listNames}
                      onChange={(value) => setImportDefaults((prev) => ({ ...prev, listNames: value }))}
                      placeholder="Optional default lists like Abu Dhabi, VIP, Ramadan"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-5 dark:border-slate-800 dark:bg-slate-950/40">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Import preview</h3>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Previewing the first {Math.min(previewRows.length, 5)} rows after mapping.
                  </p>

                  <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                    <table className="min-w-full divide-y divide-gray-100 dark:divide-slate-800">
                      <thead className="bg-gray-50 dark:bg-slate-950/50">
                        <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                          <th className="px-3 py-2">Name</th>
                          <th className="px-3 py-2">Phone</th>
                          <th className="px-3 py-2">Source</th>
                          <th className="px-3 py-2">Stage</th>
                          <th className="px-3 py-2">Lists</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                        {previewRows.length > 0 ? previewRows.map((row, index) => (
                          <tr key={`${row.phoneNumber}-${index}`} className="text-xs text-gray-700 dark:text-gray-200">
                            <td className="px-3 py-2">{row.name || '-'}</td>
                            <td className="px-3 py-2">{row.phoneNumber || '-'}</td>
                            <td className="px-3 py-2">{row.leadSource || '-'}</td>
                            <td className="px-3 py-2">{row.pipelineStage ? getPipelineStageLabel(pipelineStages, row.pipelineStage) : '-'}</td>
                            <td className="px-3 py-2">{row.listNames || (importDefaults.listNames.length > 0 ? importDefaults.listNames.join(', ') : '-')}</td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan={5} className="px-3 py-10 text-center text-sm text-gray-400">
                              Upload a CSV to preview imported contacts here.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-xs text-gray-500 dark:bg-slate-900 dark:text-gray-400">
                    <p className="font-semibold text-gray-700 dark:text-gray-200">Import rules</p>
                    <ul className="mt-2 space-y-1">
                      <li>Phone number is required for each imported contact.</li>
                      <li>Duplicate detection is based on phone number.</li>
                      <li>Custom list names from CSV are created automatically if they do not exist yet.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  resetImportState();
                }}
                className="rounded-2xl px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isImporting || importRows.length === 0 || !importMapping.phoneNumber}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#25D366] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                {isImporting ? 'Importing...' : 'Import Contacts'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
