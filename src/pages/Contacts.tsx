import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useApp } from '../contexts/AppContext';
import { Loader2, Search, Plus, Users, Phone, Tags, CheckSquare, Square } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import ContactListPicker from '../components/ContactListPicker';

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

export default function Contacts() {
  const { activeWorkspace, hasFullAccess } = useApp();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [lists, setLists] = useState<ContactList[]>([]);
  const [selectedListId, setSelectedListId] = useState<'ALL' | string>('ALL');
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [bulkListNames, setBulkListNames] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showListModal, setShowListModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [contactForm, setContactForm] = useState({
    name: '',
    phoneNumber: '',
    pipelineStage: 'NEW_LEAD',
    leadSource: '',
    listNames: [] as string[]
  });
  const [listName, setListName] = useState('');

  useEffect(() => {
    if (activeWorkspace) {
      Promise.all([fetchContacts(), fetchLists()]).finally(() => setIsLoading(false));
    }
  }, [activeWorkspace]);

  const fetchContacts = async () => {
    const res = await axios.get(`/api/contacts?workspaceId=${activeWorkspace?.id}`);
    setContacts(Array.isArray(res.data) ? res.data : []);
  };

  const fetchLists = async () => {
    const res = await axios.get(`/api/contact-lists?workspaceId=${activeWorkspace?.id}`);
    setLists(Array.isArray(res.data) ? res.data : []);
  };

  const filteredContacts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return contacts.filter((contact) => {
      if (!contact.phoneNumber) return false;

      const matchesSearch =
        !query ||
        (contact.name || '').toLowerCase().includes(query) ||
        (contact.phoneNumber || '').toLowerCase().includes(query) ||
        (contact.instagramUsername || '').toLowerCase().includes(query) ||
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
      setContactForm({ name: '', phoneNumber: '', pipelineStage: 'NEW_LEAD', leadSource: '', listNames: [] });
      setShowContactModal(false);
      await fetchLists();
      toast.success('Contact saved');
    } catch (error) {
      toast.error('Could not save contact');
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
      toast.success('Contact list created');
    } catch (error) {
      toast.error('Could not create contact list');
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
      toast.success(action === 'add' ? 'Contacts added to list' : 'Contacts removed from list');
    } catch (error) {
      toast.error(action === 'add' ? 'Could not add contacts to list' : 'Could not remove contacts from list');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#25D366]" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden bg-[#F8F9FA] dark:bg-slate-950 transition-colors">
      <div className="flex h-full">
        <aside className="w-72 border-r border-gray-100 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <button
            disabled={!hasFullAccess}
            onClick={() => {
              fetchLists();
              setShowListModal(true);
            }}
            className="mb-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#128C7E] disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            New Contact List
          </button>

          <div className="space-y-2">
            <button
              onClick={() => setSelectedListId('ALL')}
              className={cn(
                "flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors",
                selectedListId === 'ALL'
                  ? "bg-[#25D366]/10 text-[#128C7E]"
                  : "text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-slate-800"
              )}
            >
              <span>All Contacts</span>
              <span className="text-xs font-bold">{contacts.filter((contact) => contact.phoneNumber).length}</span>
            </button>
            {lists.map((list) => (
              <button
                key={list.id}
                onClick={() => setSelectedListId(list.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors",
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

        <main className="flex-1 overflow-auto p-6">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Contacts</h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Save customers here, group them into lists, and use those lists later for broadcasts.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                disabled={!hasFullAccess}
                onClick={() => toast.info('CSV import can be the next step. For now, add contacts manually or from inbox.')}
                className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:border-[#25D366] hover:text-[#25D366] dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300 disabled:opacity-60"
              >
                Import Contacts
              </button>
              <button
                disabled={!hasFullAccess}
                onClick={() => {
                  fetchLists();
                  setShowContactModal(true);
                }}
                className="flex items-center gap-2 rounded-2xl bg-[#25D366] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#128C7E] disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                New Contact
              </button>
            </div>
          </div>

          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by name, number, list, or source..."
                className="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm text-gray-900 outline-none focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {filteredContacts.length} records
            </div>
          </div>

          {selectedContactIds.length > 0 && (
            <div className="mb-4 rounded-3xl border border-[#25D366]/15 bg-white p-4 shadow-sm dark:border-[#25D366]/20 dark:bg-slate-900">
              <div className="mb-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {selectedContactIds.length} contacts selected
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Add them to a list or remove them from an existing list.
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
                  Clear selection
                </button>
              </div>

              <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
                <ContactListPicker
                  options={lists}
                  value={bulkListNames}
                  onChange={setBulkListNames}
                  disabled={!hasFullAccess || isBulkUpdating}
                  placeholder="Type or pick list names like Abu Dhabi, VIP, Follow Up"
                />
                <button
                  type="button"
                  disabled={!hasFullAccess || isBulkUpdating || bulkListNames.length === 0}
                  onClick={() => applyBulkListAction('add')}
                  className="rounded-2xl bg-[#25D366] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#128C7E] disabled:opacity-50"
                >
                  {isBulkUpdating ? 'Saving...' : 'Add To List'}
                </button>
                <button
                  type="button"
                  disabled={!hasFullAccess || isBulkUpdating || bulkListNames.length === 0}
                  onClick={() => applyBulkListAction('remove')}
                  className="rounded-2xl border border-red-200 px-4 py-3 text-sm font-bold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900/40 dark:text-red-300 dark:hover:bg-red-900/20"
                >
                  Remove From List
                </button>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
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
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Phone Number</th>
                  <th className="px-4 py-3">Lead Source</th>
                  <th className="px-4 py-3">Contact Lists</th>
                  <th className="px-4 py-3">Status</th>
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
                    <td className="px-4 py-4">{contact.phoneNumber || contact.instagramUsername || '-'}</td>
                    <td className="px-4 py-4">{contact.leadSource || 'Direct Search'}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        {contact.listMemberships?.length ? contact.listMemberships.map((membership) => (
                          <span
                            key={membership.list.id}
                            className="rounded-full bg-sky-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-sky-700"
                          >
                            {membership.list.name}
                          </span>
                        )) : <span className="text-xs text-gray-400">No list</span>}
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
          <form onSubmit={createContact} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900">
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
                <option value="NEW_LEAD">New Lead</option>
                <option value="CONTACTED">Contacted</option>
                <option value="QUALIFIED">Qualified</option>
                <option value="QUOTE_SENT">Quote Sent</option>
                <option value="WON">Won</option>
                <option value="LOST">Lost</option>
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
          <form onSubmit={createList} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900">
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
    </div>
  );
}
