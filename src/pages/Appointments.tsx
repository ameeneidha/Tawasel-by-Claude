import React, { useEffect, useState, useMemo, useCallback } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useApp } from '../contexts/AppContext';
import {
  CalendarCheck,
  Clock,
  Loader2,
  Plus,
  Search,
  Scissors,
  User,
  Trash2,
  Edit3,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  List,
  Calendar,
  Copy,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { Calendar as BigCalendar, dateFnsLocalizer, Views, type View } from 'react-big-calendar';
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';

// ─── Calendar setup ──────────────────────────────────────────────────────────

const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });
const DnDCalendar = withDragAndDrop(BigCalendar as any);

// ─── Types ──────────────────────────────────────────────────────────────────

interface Service {
  id: string;
  name: string;
  description?: string;
  durationMin: number;
  price: number;
  currency: string;
  color: string;
  enabled: boolean;
}

interface StaffMember {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  avatar?: string;
  workingHours: string;
  enabled: boolean;
  staffServices: { serviceId: string }[];
}

interface Contact {
  id: string;
  name?: string;
  phoneNumber?: string;
}

interface Appointment {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  notes?: string;
  contactId: string;
  serviceId: string;
  staffId: string;
  contact: { id: string; name?: string; phoneNumber?: string };
  service: { id: string; name: string; color: string; durationMin: number };
  staff: { id: string; name: string };
  createdAt: string;
}

interface ReminderRule {
  id: string;
  name: string;
  triggerType: 'BEFORE_START' | 'AFTER_END';
  offsetMinutes: number;
  templateName?: string | null;
  messageBody?: string | null;
  enabled: boolean;
}

type Tab = 'appointments' | 'services' | 'staff' | 'reminders';

const STATUS_OPTIONS = ['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] as const;

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  CONFIRMED: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  COMPLETED: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  NO_SHOW: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
};

const DAY_LABELS = [
  { key: 'sun', label: 'Sun' },
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
];

const DEFAULT_WORKING_HOURS: Record<string, { start: string; end: string } | null> = {
  sun: { start: '09:00', end: '17:00' },
  mon: { start: '09:00', end: '17:00' },
  tue: { start: '09:00', end: '17:00' },
  wed: { start: '09:00', end: '17:00' },
  thu: { start: '09:00', end: '17:00' },
  fri: null,
  sat: null,
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function Appointments() {
  const { t } = useTranslation();
  const { activeWorkspace } = useApp();
  const wsId = activeWorkspace?.id;

  const [tab, setTab] = useState<Tab>('appointments');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [calendarView, setCalendarView] = useState<View>(Views.WEEK);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [loading, setLoading] = useState(true);

  // Reminder rules
  const [reminderRules, setReminderRules] = useState<ReminderRule[]>([]);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<Partial<ReminderRule> | null>(null);
  const [savingRule, setSavingRule] = useState(false);
  const [ruleForm, setRuleForm] = useState({ name: '', triggerType: 'BEFORE_START', offsetMinutes: 60, templateName: '', messageBody: '' });

  // Data
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);

  // Filters
  const [filterDate, setFilterDate] = useState(toInputDate(new Date()));
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterStaff, setFilterStaff] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  // Template setup
  const [templateStatus, setTemplateStatus] = useState<'unknown' | 'missing' | 'pending' | 'ready'>('unknown');
  const [settingUpTemplates, setSettingUpTemplates] = useState(false);
  const [waNumbers, setWaNumbers] = useState<{ id: string; phoneNumber: string; metaWabaId: string | null }[]>([]);
  const [selectedNumberId, setSelectedNumberId] = useState<string>('');

  // Modals
  const [showBooking, setShowBooking] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [saving, setSaving] = useState(false);

  // ─── Fetch helpers ──────────────────────────────────────────────────────

  const fetchAll = async () => {
    if (!wsId) return;
    setLoading(true);
    try {
      const [apptRes, svcRes, staffRes, contactRes, tplRes, rulesRes, numbersRes] = await Promise.allSettled([
        axios.get(`/api/appointments?workspaceId=${wsId}`),
        axios.get(`/api/services?workspaceId=${wsId}`),
        axios.get(`/api/staff?workspaceId=${wsId}`),
        axios.get(`/api/contacts?workspaceId=${wsId}`),
        axios.get(`/api/templates/whatsapp?workspaceId=${wsId}`),
        axios.get(`/api/reminder-rules?workspaceId=${wsId}`),
        axios.get(`/api/numbers?workspaceId=${wsId}`),
      ]);

      setAppointments(apptRes.status === 'fulfilled' ? apptRes.value.data : []);
      setServices(svcRes.status === 'fulfilled' ? svcRes.value.data : []);
      setStaff(staffRes.status === 'fulfilled' ? staffRes.value.data : []);
      setContacts(contactRes.status === 'fulfilled' ? contactRes.value.data : []);
      setReminderRules(rulesRes.status === 'fulfilled' ? rulesRes.value.data : []);

      const nums = numbersRes.status === 'fulfilled' && Array.isArray(numbersRes.value.data) ? numbersRes.value.data : [];
      const realNums = nums.filter((n: any) => n.metaWabaId);
      setWaNumbers(realNums);
      if (realNums.length > 0 && !selectedNumberId) setSelectedNumberId(realNums[0].id);

      // Check whether the 3 appointment templates exist and are approved
      const rawTpl = tplRes.status === 'fulfilled' ? tplRes.value.data : [];
      const templates: { name: string; status: string }[] = Array.isArray(rawTpl) ? rawTpl : [];
      const needed = ['tawasel_booking_confirmation', 'tawasel_reminder_24h', 'tawasel_reminder_1h'];
      const approved = needed.filter(n => templates.some(t => t.name === n && t.status === 'APPROVED'));
      const pending  = needed.filter(n => templates.some(t => t.name === n && t.status !== 'APPROVED'));
      if (approved.length === 3) setTemplateStatus('ready');
      else if (pending.length > 0) setTemplateStatus('pending');
      else setTemplateStatus('missing');

      // Log which endpoint failed (helps debugging) but don't block the UI
      const failures = [
        ['appointments', apptRes], ['services', svcRes], ['staff', staffRes],
        ['contacts', contactRes], ['templates', tplRes], ['reminder-rules', rulesRes],
      ].filter(([_, r]: any) => r.status === 'rejected');
      if (failures.length > 0) {
        console.warn('[Appointments] Partial load failures:', failures.map(([n, r]: any) => ({ n, err: r.reason?.response?.data || r.reason?.message })));
      }
    } catch {
      toast.error(t('appointments.failedToLoad'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, [wsId]);

  // ─── Filtered appointments ─────────────────────────────────────────────

  const filtered = useMemo(() => {
    return appointments.filter((a) => {
      const apptDate = new Date(a.startTime).toISOString().slice(0, 10);
      if (filterDate && apptDate !== filterDate) return false;
      if (filterStatus !== 'ALL' && a.status !== filterStatus) return false;
      if (filterStaff !== 'ALL' && a.staffId !== filterStaff) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !(a.contact?.name || '').toLowerCase().includes(q) &&
          !(a.contact?.phoneNumber || '').includes(q) &&
          !(a.service?.name || '').toLowerCase().includes(q) &&
          !(a.staff?.name || '').toLowerCase().includes(q)
        ) return false;
      }
      return true;
    }).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [appointments, filterDate, filterStatus, filterStaff, search]);

  // ─── Appointment actions ───────────────────────────────────────────────

  const updateAppointmentStatus = async (id: string, status: string) => {
    try {
      await axios.patch(`/api/appointments/${id}`, { status });
      setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
      toast.success(t('appointments.appointmentStatusUpdated', { status: status.toLowerCase() }));
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('appointments.failedToUpdate'));
    }
  };

  const deleteAppointment = async (id: string) => {
    if (!confirm(t('appointments.confirmCancelAppointment'))) return;
    try {
      await axios.delete(`/api/appointments/${id}`);
      setAppointments((prev) => prev.filter((a) => a.id !== id));
      toast.success(t('appointments.appointmentDeleted'));
    } catch {
      toast.error(t('appointments.failedToDeleteAppointment'));
    }
  };

  // ─── Service CRUD ──────────────────────────────────────────────────────

  const deleteService = async (id: string) => {
    if (!confirm(t('appointments.confirmDeleteService'))) return;
    try {
      await axios.delete(`/api/services/${id}`);
      setServices((prev) => prev.filter((s) => s.id !== id));
      toast.success(t('appointments.serviceDeleted'));
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('appointments.failedToDelete'));
    }
  };

  // ─── Staff CRUD ────────────────────────────────────────────────────────

  const deleteStaffMember = async (id: string) => {
    if (!confirm(t('appointments.confirmDeleteStaff'))) return;
    try {
      await axios.delete(`/api/staff/${id}`);
      setStaff((prev) => prev.filter((s) => s.id !== id));
      toast.success(t('appointments.staffDeleted'));
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('appointments.failedToDelete'));
    }
  };

  // ─── Calendar drag reschedule ──────────────────────────────────────────────

  const handleEventDrop = useCallback(async ({ event, start, end }: any) => {
    const appt: Appointment = event.resource;
    try {
      await axios.patch(`/api/appointments/${appt.id}`, {
        startTime: new Date(start).toISOString(),
        endTime: new Date(end).toISOString(),
      });
      setAppointments(prev => prev.map(a =>
        a.id === appt.id
          ? { ...a, startTime: new Date(start).toISOString(), endTime: new Date(end).toISOString() }
          : a
      ));
      toast.success('Appointment rescheduled');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to reschedule');
    }
  }, []);

  // ─── Template setup ────────────────────────────────────────────────────

  const setupTemplates = async () => {
    if (!wsId) return;
    setSettingUpTemplates(true);
    try {
      const res = await axios.post('/api/appointments/setup-templates', { workspaceId: wsId, whatsAppNumberId: selectedNumberId || undefined });
      const results: { name: string; status: string; detail?: string }[] = res.data?.results || [];
      const errors = results.filter(r => r.status === 'error');
      if (errors.length > 0) {
        toast.error(`Template error: ${errors[0].detail || 'Unknown error from Meta'}`);
      } else {
        setTemplateStatus('pending');
        toast.success('Templates submitted to Meta! They\'ll be active within a few minutes.');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to submit templates');
    } finally {
      setSettingUpTemplates(false);
    }
  };

  // ─── Reminder Rules CRUD ─────────────────────────────────────────

  const openNewRule = () => {
    setEditingRule(null);
    setRuleForm({ name: '', triggerType: 'BEFORE_START', offsetMinutes: 60, templateName: '', messageBody: '' });
    setShowRuleModal(true);
  };

  const openEditRule = (rule: ReminderRule) => {
    setEditingRule(rule);
    setRuleForm({
      name: rule.name,
      triggerType: rule.triggerType,
      offsetMinutes: rule.offsetMinutes,
      templateName: rule.templateName || '',
      messageBody: rule.messageBody || '',
    });
    setShowRuleModal(true);
  };

  const saveRule = async () => {
    if (!wsId || !ruleForm.name || ruleForm.offsetMinutes < 5) return;
    setSavingRule(true);
    try {
      if (editingRule?.id) {
        const res = await axios.patch(`/api/reminder-rules/${editingRule.id}`, { workspaceId: wsId, ...ruleForm });
        setReminderRules(prev => prev.map(r => r.id === editingRule.id ? res.data : r));
        toast.success('Reminder rule updated');
      } else {
        const res = await axios.post('/api/reminder-rules', { workspaceId: wsId, ...ruleForm });
        setReminderRules(prev => [...prev, res.data]);
        toast.success('Reminder rule created');
      }
      setShowRuleModal(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save rule');
    } finally {
      setSavingRule(false);
    }
  };

  const toggleRule = async (rule: ReminderRule) => {
    try {
      const res = await axios.patch(`/api/reminder-rules/${rule.id}`, { workspaceId: wsId, enabled: !rule.enabled });
      setReminderRules(prev => prev.map(r => r.id === rule.id ? res.data : r));
      toast.success(res.data.enabled ? 'Rule enabled' : 'Rule disabled');
    } catch {
      toast.error('Failed to update rule');
    }
  };

  const deleteRule = async (rule: ReminderRule) => {
    if (!confirm(`Delete reminder rule "${rule.name}"?`)) return;
    try {
      await axios.delete(`/api/reminder-rules/${rule.id}?workspaceId=${wsId}`);
      setReminderRules(prev => prev.filter(r => r.id !== rule.id));
      toast.success('Rule deleted');
    } catch {
      toast.error('Failed to delete rule');
    }
  };

  const formatOffset = (rule: ReminderRule) => {
    const h = Math.floor(rule.offsetMinutes / 60);
    const m = rule.offsetMinutes % 60;
    const label = h > 0 && m > 0 ? `${h}h ${m}m` : h > 0 ? `${h}h` : `${m}m`;
    return rule.triggerType === 'BEFORE_START' ? `${label} before appointment` : `${label} after appointment ends`;
  };

  // ─── Navigation helpers ────────────────────────────────────────────────

  const navigateDate = (delta: number) => {
    const d = new Date(filterDate);
    d.setDate(d.getDate() + delta);
    setFilterDate(toInputDate(d));
  };

  // ─── Render ────────────────────────────────────────────────────────────

  if (!wsId) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        {t('appointments.selectWorkspace')}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-[#25D366]" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <CalendarCheck className="w-6 h-6 text-[#25D366]" />
            {t('appointments.title')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('appointments.subtitle')}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {(['appointments', 'services', 'staff', 'reminders'] as Tab[]).map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
              tab === tabKey
                ? 'border-[#25D366] text-[#25D366]'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            )}
          >
            {t(`appointments.tabs.${tabKey}`)}
          </button>
        ))}
      </div>

      {/* ═══════════════ TEMPLATE SETUP BANNER ═══════════════ */}
      {templateStatus === 'missing' && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <Sparkles className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              Set up WhatsApp templates to enable automatic confirmations & reminders
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              Booking confirmations, 24h reminders, and 1h reminders require approved WhatsApp templates.
              We'll create them in your account automatically.
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            {waNumbers.length >= 1 ? (
              <select
                value={selectedNumberId}
                onChange={e => setSelectedNumberId(e.target.value)}
                className="text-xs border border-amber-300 dark:border-amber-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-amber-400"
              >
                {waNumbers.map(n => (
                  <option key={n.id} value={n.id}>{n.phoneNumber}</option>
                ))}
              </select>
            ) : (
              <span className="text-xs text-amber-600 dark:text-amber-400">No number connected</span>
            )}
            <button
              onClick={setupTemplates}
              disabled={settingUpTemplates || waNumbers.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium disabled:opacity-60 transition-colors"
            >
              {settingUpTemplates ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {settingUpTemplates ? 'Submitting…' : 'Set Up Now'}
            </button>
          </div>
        </div>
      )}

      {templateStatus === 'pending' && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />
          <p className="text-sm text-blue-700 dark:text-blue-300">
            WhatsApp templates are pending Meta approval — usually takes a few minutes. Confirmations & reminders will start sending automatically once approved.
          </p>
          <button onClick={fetchAll} className="shrink-0 text-xs text-blue-600 dark:text-blue-400 underline hover:no-underline">
            Refresh
          </button>
        </div>
      )}

      {templateStatus === 'ready' && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-xs text-green-700 dark:text-green-300">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          WhatsApp templates active — booking confirmations, 24h reminders, and 1h reminders are enabled.
        </div>
      )}

      {/* ═══════════════ APPOINTMENTS TAB ═══════════════ */}
      {tab === 'appointments' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            {/* List / Calendar toggle */}
            <div className="flex items-center rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors',
                  viewMode === 'list'
                    ? 'bg-[#25D366] text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800'
                )}
              >
                <List className="w-3.5 h-3.5" /> List
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors',
                  viewMode === 'calendar'
                    ? 'bg-[#25D366] text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800'
                )}
              >
                <Calendar className="w-3.5 h-3.5" /> Calendar
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button onClick={() => navigateDate(-1)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-white"
              />
              <button onClick={() => navigateDate(1)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setFilterDate(toInputDate(new Date()))}
                className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
              >
                {t('appointments.today')}
              </button>
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-white"
            >
              <option value="ALL">{t('appointments.allStatuses')}</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s.replace('_', ' ')}</option>
              ))}
            </select>

            <select
              value={filterStaff}
              onChange={(e) => setFilterStaff(e.target.value)}
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:text-white"
            >
              <option value="ALL">{t('appointments.allStaff')}</option>
              {staff.filter((s) => s.enabled).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('appointments.searchPlaceholder')}
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-white"
              />
            </div>

            <button
              onClick={() => setShowBooking(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#25D366] hover:bg-[#20bd5a] text-white text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t('appointments.bookAppointment')}
            </button>
          </div>

          {/* ── LIST VIEW ── */}
          {viewMode === 'list' && (
            filtered.length === 0 ? (
              <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                <CalendarCheck className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="font-medium">{t('appointments.noAppointmentsFound')}</p>
                <p className="text-sm mt-1">{t('appointments.noAppointmentsHint')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">{t('appointments.time')}</th>
                      <th className="text-left px-4 py-3 font-medium">{t('appointments.customer')}</th>
                      <th className="text-left px-4 py-3 font-medium">{t('appointments.service')}</th>
                      <th className="text-left px-4 py-3 font-medium">{t('appointments.staffLabel')}</th>
                      <th className="text-left px-4 py-3 font-medium">{t('appointments.status')}</th>
                      <th className="text-right px-4 py-3 font-medium">{t('appointments.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {filtered.map((appt) => (
                      <tr key={appt.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {formatTime(appt.startTime)} – {formatTime(appt.endTime)}
                          </div>
                          <div className="text-xs text-gray-500">{formatDate(appt.startTime)}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-gray-900 dark:text-white">{appt.contact?.name || t('appointments.unknown')}</div>
                          <div className="text-xs text-gray-500">{appt.contact?.phoneNumber}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: appt.service?.color }} />
                            {appt.service?.name}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{appt.staff?.name}</td>
                        <td className="px-4 py-3">
                          <select
                            value={appt.status}
                            onChange={(e) => updateAppointmentStatus(appt.id, e.target.value)}
                            className={cn(
                              'text-xs font-medium rounded-full px-2.5 py-1 border-0 cursor-pointer',
                              STATUS_COLORS[appt.status] || 'bg-gray-100 text-gray-600'
                            )}
                          >
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s}>{s.replace('_', ' ')}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => deleteAppointment(appt.id)}
                            className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* ── CALENDAR VIEW ── */}
          {viewMode === 'calendar' && (
            <AppointmentCalendar
              appointments={appointments}
              calendarDate={calendarDate}
              calendarView={calendarView}
              onNavigate={setCalendarDate}
              onView={setCalendarView}
              onEventDrop={handleEventDrop}
              onStatusChange={updateAppointmentStatus}
              onDelete={deleteAppointment}
            />
          )}
        </div>
      )}

      {/* ═══════════════ SERVICES TAB ═══════════════ */}
      {tab === 'services' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('appointments.serviceCount', { count: services.length })}</p>
            <button
              onClick={() => { setEditingService(null); setShowServiceModal(true); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#25D366] hover:bg-[#20bd5a] text-white text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              {t('appointments.addService')}
            </button>
          </div>

          {services.length === 0 ? (
            <div className="text-center py-16 text-gray-500 dark:text-gray-400">
              <Scissors className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">{t('appointments.noServicesYet')}</p>
              <p className="text-sm mt-1">{t('appointments.noServicesHint')}</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((svc) => (
                <div
                  key={svc.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-white dark:bg-gray-900 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: svc.color }} />
                      <h3 className="font-semibold text-gray-900 dark:text-white">{svc.name}</h3>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => { setEditingService(svc); setShowServiceModal(true); }}
                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteService(svc.id)}
                        className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {svc.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{svc.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-3 text-xs text-gray-600 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {svc.durationMin} min
                    </span>
                    <span className="font-medium">
                      {svc.price > 0 ? `${svc.price} ${svc.currency}` : 'Free'}
                    </span>
                    {!svc.enabled && (
                      <span className="text-yellow-600 dark:text-yellow-400 font-medium">Disabled</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ STAFF TAB ═══════════════ */}
      {tab === 'staff' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">{staff.length} staff member(s)</p>
            <button
              onClick={() => { setEditingStaff(null); setShowStaffModal(true); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#25D366] hover:bg-[#20bd5a] text-white text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Staff
            </button>
          </div>

          {staff.length === 0 ? (
            <div className="text-center py-16 text-gray-500 dark:text-gray-400">
              <User className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No staff members yet</p>
              <p className="text-sm mt-1">Add staff to assign appointments</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {staff.map((member) => {
                const hours = JSON.parse(member.workingHours || '{}');
                const assignedServices = services.filter((s) =>
                  member.staffServices?.some((ss) => ss.serviceId === s.id)
                );
                return (
                  <div
                    key={member.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-white dark:bg-gray-900 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#25D366]/10 text-[#25D366] flex items-center justify-center font-semibold text-sm">
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white">{member.name}</h3>
                          {member.phone && (
                            <p className="text-xs text-gray-500">{member.phone}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => { setEditingStaff(member); setShowStaffModal(true); }}
                          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteStaffMember(member.id)}
                          className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Working days */}
                    <div className="flex gap-1 mt-3">
                      {DAY_LABELS.map(({ key, label }) => (
                        <span
                          key={key}
                          className={cn(
                            'w-8 h-6 rounded text-[10px] font-medium flex items-center justify-center',
                            hours[key]
                              ? 'bg-[#25D366]/10 text-[#25D366]'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                          )}
                        >
                          {label}
                        </span>
                      ))}
                    </div>

                    {/* Assigned services */}
                    {assignedServices.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {assignedServices.map((s) => (
                          <span
                            key={s.id}
                            className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                          >
                            {s.name}
                          </span>
                        ))}
                      </div>
                    )}

                    {!member.enabled && (
                      <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2 font-medium">Disabled</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ BOOKING MODAL ═══════════════ */}
      {showBooking && (
        <BookingModal
          wsId={wsId}
          contacts={contacts}
          services={services.filter((s) => s.enabled)}
          staff={staff.filter((s) => s.enabled)}
          onClose={() => setShowBooking(false)}
          onBooked={(appt) => {
            setAppointments((prev) => [appt, ...prev]);
            setShowBooking(false);
          }}
        />
      )}

      {/* ═══════════════ SERVICE MODAL ═══════════════ */}
      {showServiceModal && (
        <ServiceModal
          wsId={wsId}
          service={editingService}
          onClose={() => setShowServiceModal(false)}
          onSaved={(svc) => {
            if (editingService) {
              setServices((prev) => prev.map((s) => (s.id === svc.id ? svc : s)));
            } else {
              setServices((prev) => [...prev, svc]);
            }
            setShowServiceModal(false);
          }}
        />
      )}

      {/* ═══════════════ STAFF MODAL ═══════════════ */}
      {showStaffModal && (
        <StaffModal
          wsId={wsId}
          member={editingStaff}
          services={services}
          onClose={() => setShowStaffModal(false)}
          onSaved={(m) => {
            if (editingStaff) {
              setStaff((prev) => prev.map((s) => (s.id === m.id ? m : s)));
            } else {
              setStaff((prev) => [...prev, m]);
            }
            setShowStaffModal(false);
          }}
        />
      )}

      {/* ═══════════════ REMINDERS TAB ═══════════════ */}
      {tab === 'reminders' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{reminderRules.length} rule(s) configured</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                Rules-based reminders replace the default 24h + 1h reminders for this workspace.
              </p>
            </div>
            <button
              onClick={openNewRule}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#25D366] hover:bg-[#128C7E] text-white text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Rule
            </button>
          </div>

          {reminderRules.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-10 text-center">
              <Clock className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No reminder rules yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-sm mx-auto">
                Default reminders (24h + 1h before) fire automatically. Add a rule to customise timing — e.g. 2h, 12h, 48h before, or a follow-up after.
              </p>
              <button
                onClick={openNewRule}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#25D366] hover:bg-[#128C7E] text-white text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" /> Add First Rule
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {reminderRules.map(rule => (
                <div key={rule.id} className={cn(
                  'flex items-center gap-4 p-4 rounded-xl border transition-all',
                  rule.enabled
                    ? 'border-gray-200 bg-white dark:border-gray-700 dark:bg-slate-900'
                    : 'border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-slate-900/50 opacity-60'
                )}>
                  {/* Toggle */}
                  <button
                    onClick={() => toggleRule(rule)}
                    className={cn(
                      'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
                      rule.enabled ? 'bg-[#25D366]' : 'bg-gray-300 dark:bg-gray-600'
                    )}
                  >
                    <span className={cn(
                      'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200',
                      rule.enabled ? 'translate-x-4' : 'translate-x-0'
                    )} />
                  </button>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{rule.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{formatOffset(rule)}</p>
                    {rule.templateName && (
                      <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-medium text-[#128C7E] bg-[#25D366]/10 px-2 py-0.5 rounded-full">
                        Template: {rule.templateName}
                      </span>
                    )}
                    {!rule.templateName && rule.messageBody && (
                      <p className="text-[10px] text-gray-400 mt-1 truncate max-w-md">{rule.messageBody}</p>
                    )}
                    {!rule.templateName && !rule.messageBody && (
                      <span className="text-[10px] text-gray-400">Auto-generated message</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button onClick={() => openEditRule(rule)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors">
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deleteRule(rule)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Info box */}
          <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 text-xs text-blue-700 dark:text-blue-300 space-y-1">
            <p className="font-semibold">How reminder rules work:</p>
            <ul className="list-disc list-inside space-y-0.5 text-blue-600 dark:text-blue-400">
              <li>Rules fire once per appointment (no duplicates)</li>
              <li>If a template is set, it must be approved in Meta first</li>
              <li>Without a template, a plain-text message is sent (works within 24h session)</li>
              <li>Custom message: use <code>{'{{customer_name}}'}</code>, <code>{'{{service}}'}</code>, <code>{'{{staff}}'}</code>, <code>{'{{time}}'}</code>, <code>{'{{date}}'}</code>, <code>{'{{business}}'}</code></li>
              <li>Max 5 active rules per workspace</li>
            </ul>
          </div>
        </div>
      )}

      {/* ═══════════════ REMINDER RULE MODAL ═══════════════ */}
      {showRuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingRule ? 'Edit Reminder Rule' : 'New Reminder Rule'}
              </h3>
              <button onClick={() => setShowRuleModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Rule Name</label>
                <input
                  type="text"
                  value={ruleForm.name}
                  onChange={e => setRuleForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. 2 hours before"
                  className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-slate-950 px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#25D366]/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Trigger</label>
                  <select
                    value={ruleForm.triggerType}
                    onChange={e => setRuleForm(f => ({ ...f, triggerType: e.target.value }))}
                    className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-slate-950 px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#25D366]/20"
                  >
                    <option value="BEFORE_START">Before start</option>
                    <option value="AFTER_END">After end</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Offset (minutes)</label>
                  <input
                    type="number"
                    min={5}
                    max={10080}
                    value={ruleForm.offsetMinutes}
                    onChange={e => setRuleForm(f => ({ ...f, offsetMinutes: Number(e.target.value) }))}
                    className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-slate-950 px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#25D366]/20"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Common: 60=1h, 120=2h, 720=12h, 1440=24h, 2880=48h
                  </p>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Template Name <span className="font-normal normal-case tracking-normal text-gray-400">(optional — must be APPROVED in Meta)</span>
                </label>
                <input
                  type="text"
                  value={ruleForm.templateName}
                  onChange={e => setRuleForm(f => ({ ...f, templateName: e.target.value }))}
                  placeholder="e.g. my_reminder_2h"
                  className="mt-1.5 w-full rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-slate-950 px-3 py-2.5 text-sm font-mono text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#25D366]/20"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Custom Message <span className="font-normal normal-case tracking-normal text-gray-400">(if no template — plain text)</span>
                </label>
                <textarea
                  value={ruleForm.messageBody}
                  onChange={e => setRuleForm(f => ({ ...f, messageBody: e.target.value }))}
                  rows={3}
                  placeholder="Hi {{customer_name}}, your {{service}} is in 2 hours at {{time}}. See you soon! — {{business}}"
                  className="mt-1.5 w-full resize-none rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-slate-950 px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#25D366]/20"
                />
                <p className="text-[10px] text-gray-400 mt-1">Leave empty for auto-generated message</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button onClick={() => setShowRuleModal(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 transition-colors">
                Cancel
              </button>
              <button
                onClick={saveRule}
                disabled={savingRule || !ruleForm.name || ruleForm.offsetMinutes < 5}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#25D366] hover:bg-[#128C7E] text-white text-sm font-medium transition-colors disabled:opacity-60"
              >
                {savingRule ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {editingRule ? 'Save Changes' : 'Create Rule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// APPOINTMENT CALENDAR (react-big-calendar + drag-and-drop)
// ═══════════════════════════════════════════════════════════════════════════

function AppointmentCalendar({
  appointments,
  calendarDate,
  calendarView,
  onNavigate,
  onView,
  onEventDrop,
  onStatusChange,
  onDelete,
}: {
  appointments: Appointment[];
  calendarDate: Date;
  calendarView: View;
  onNavigate: (date: Date) => void;
  onView: (view: View) => void;
  onEventDrop: (args: any) => void;
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
}) {
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);

  // Map appointments to rbc event objects
  const events = useMemo(() => appointments.map(a => ({
    id: a.id,
    title: `${a.service?.name} — ${a.contact?.name || a.contact?.phoneNumber || 'Unknown'}`,
    start: new Date(a.startTime),
    end: new Date(a.endTime),
    resource: a,
  })), [appointments]);

  // Color each event by service color
  const eventPropGetter = useCallback((event: any) => {
    const color = event.resource?.service?.color || '#25D366';
    return {
      style: {
        backgroundColor: color,
        borderColor: color,
        color: '#fff',
        borderRadius: '6px',
        fontSize: '12px',
        padding: '2px 6px',
      },
    };
  }, []);

  const handleSelectEvent = useCallback((event: any, e: React.SyntheticEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setPopoverPos({ top: rect.bottom + window.scrollY + 4, left: rect.left + window.scrollX });
    setSelectedAppt(event.resource as Appointment);
  }, []);

  return (
    <div className="relative">
      {/* Calendar styles override for dark mode compatibility */}
      <style>{`
        .rbc-calendar { font-family: inherit; }
        .rbc-toolbar button { font-size: 13px; padding: 4px 12px; border-radius: 8px; }
        .rbc-toolbar button.rbc-active { background-color: #25D366; border-color: #25D366; color: #fff; }
        .rbc-today { background-color: #25D36610; }
        .rbc-event:focus { outline: none; }
        .rbc-show-more { color: #25D366; font-size: 11px; }
      `}</style>

      <div style={{ height: 620 }}>
        <DnDCalendar
          localizer={localizer}
          events={events}
          date={calendarDate}
          view={calendarView}
          onNavigate={onNavigate}
          onView={onView}
          onEventDrop={onEventDrop}
          onEventResize={onEventDrop}
          onSelectEvent={handleSelectEvent}
          eventPropGetter={eventPropGetter}
          resizable
          draggableAccessor={() => true}
          views={[Views.MONTH, Views.WEEK, Views.DAY]}
          defaultView={Views.WEEK}
          step={30}
          timeslots={1}
          popup
        />
      </div>

      {/* Detail popover on event click */}
      {selectedAppt && popoverPos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setSelectedAppt(null)} />
          <div
            className="fixed z-50 w-72 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-gray-200 dark:border-slate-700 p-4"
            style={{ top: Math.min(popoverPos.top, window.innerHeight - 260), left: Math.min(popoverPos.left, window.innerWidth - 300) }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: selectedAppt.service?.color }} />
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{selectedAppt.service?.name}</p>
                  <p className="text-xs text-gray-500">{selectedAppt.staff?.name}</p>
                </div>
              </div>
              <button onClick={() => setSelectedAppt(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400 mb-3">
              <p><span className="font-medium text-gray-900 dark:text-white">{selectedAppt.contact?.name || 'Unknown'}</span></p>
              {selectedAppt.contact?.phoneNumber && <p>{selectedAppt.contact.phoneNumber}</p>}
              <p>{formatTime(selectedAppt.startTime)} – {formatTime(selectedAppt.endTime)}</p>
              <p>{formatDate(selectedAppt.startTime)}</p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedAppt.status}
                onChange={(e) => {
                  onStatusChange(selectedAppt.id, e.target.value);
                  setSelectedAppt(prev => prev ? { ...prev, status: e.target.value } : null);
                }}
                className={cn(
                  'flex-1 text-xs font-medium rounded-lg px-2 py-1.5 border-0 cursor-pointer',
                  STATUS_COLORS[selectedAppt.status] || 'bg-gray-100 text-gray-600'
                )}
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
              <button
                onClick={() => { onDelete(selectedAppt.id); setSelectedAppt(null); }}
                className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-[10px] text-gray-400 mt-2">Drag the event on the calendar to reschedule</p>
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BOOKING MODAL
// ═══════════════════════════════════════════════════════════════════════════

function BookingModal({
  wsId,
  contacts,
  services,
  staff,
  onClose,
  onBooked,
}: {
  wsId: string;
  contacts: Contact[];
  services: Service[];
  staff: StaffMember[];
  onClose: () => void;
  onBooked: (appt: Appointment) => void;
}) {
  const [contactId, setContactId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [date, setDate] = useState(toInputDate(new Date()));
  const [slot, setSlot] = useState('');
  const [notes, setNotes] = useState('');
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);
  const [contactSearch, setContactSearch] = useState('');

  // Filter staff by selected service — show all if staff has no service assignments
  const eligibleStaff = useMemo(() => {
    if (!serviceId) return staff;
    return staff.filter(
      (s) =>
        !s.staffServices ||
        s.staffServices.length === 0 ||
        s.staffServices.some((ss) => ss.serviceId === serviceId)
    );
  }, [staff, serviceId]);

  // Fetch available slots
  useEffect(() => {
    if (!staffId || !serviceId || !date) {
      setSlots([]);
      return;
    }
    let cancelled = false;
    const fetchSlots = async () => {
      setLoadingSlots(true);
      try {
        const res = await axios.get(
          `/api/appointments/availability?workspaceId=${wsId}&staffId=${staffId}&serviceId=${serviceId}&date=${date}`
        );
        if (!cancelled) setSlots(res.data.slots || []);
      } catch {
        if (!cancelled) setSlots([]);
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    };
    fetchSlots();
    return () => { cancelled = true; };
  }, [staffId, serviceId, date, wsId]);

  const filteredContacts = useMemo(() => {
    if (!contactSearch) return contacts.slice(0, 50);
    const q = contactSearch.toLowerCase();
    return contacts.filter(
      (c) =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.phoneNumber || '').includes(q)
    ).slice(0, 50);
  }, [contacts, contactSearch]);

  const handleSubmit = async () => {
    if (!contactId || !serviceId || !staffId || !slot) {
      toast.error('Please fill all required fields');
      return;
    }
    setSaving(true);
    try {
      const res = await axios.post('/api/appointments', {
        workspaceId: wsId,
        contactId,
        serviceId,
        staffId,
        startTime: slot,
        notes: notes.trim() || undefined,
      });
      toast.success('Appointment booked!');
      onBooked(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to book appointment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Book Appointment</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Contact */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Customer *</label>
            <input
              type="text"
              value={contactSearch}
              onChange={(e) => setContactSearch(e.target.value)}
              placeholder="Search contacts..."
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white mb-2"
            />
            <select
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white"
            >
              <option value="">Select a contact</option>
              {filteredContacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || c.phoneNumber || c.id}
                </option>
              ))}
            </select>
          </div>

          {/* Service */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Service *</label>
            <select
              value={serviceId}
              onChange={(e) => { setServiceId(e.target.value); setStaffId(''); setSlot(''); }}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white"
            >
              <option value="">Select a service</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.durationMin}min – {s.price > 0 ? `${s.price} ${s.currency}` : 'Free'})
                </option>
              ))}
            </select>
          </div>

          {/* Staff */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Staff *</label>
            <select
              value={staffId}
              onChange={(e) => { setStaffId(e.target.value); setSlot(''); }}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white"
            >
              <option value="">Select staff</option>
              {eligibleStaff.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date *</label>
            <input
              type="date"
              value={date}
              onChange={(e) => { setDate(e.target.value); setSlot(''); }}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white"
            />
          </div>

          {/* Time Slots */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Time Slot *</label>
            {loadingSlots ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading slots...
              </div>
            ) : !staffId || !serviceId ? (
              <p className="text-xs text-gray-400 py-2">Select a service, staff, and date first</p>
            ) : slots.length === 0 ? (
              <p className="text-xs text-gray-500 py-2">No available slots for this date</p>
            ) : (
              <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                {slots.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSlot(s)}
                    className={cn(
                      'px-2 py-1.5 text-xs rounded-lg border transition-colors',
                      slot === s
                        ? 'border-[#25D366] bg-[#25D366]/10 text-[#25D366] font-medium'
                        : 'border-gray-200 dark:border-gray-700 hover:border-[#25D366] text-gray-700 dark:text-gray-300'
                    )}
                  >
                    {new Date(s).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional notes..."
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !contactId || !serviceId || !staffId || !slot}
            className="px-4 py-2 text-sm rounded-lg bg-[#25D366] hover:bg-[#20bd5a] text-white font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Book Appointment
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SERVICE MODAL
// ═══════════════════════════════════════════════════════════════════════════

function ServiceModal({
  wsId,
  service,
  onClose,
  onSaved,
}: {
  wsId: string;
  service: Service | null;
  onClose: () => void;
  onSaved: (svc: Service) => void;
}) {
  const [name, setName] = useState(service?.name || '');
  const [description, setDescription] = useState(service?.description || '');
  const [durationMin, setDurationMin] = useState(service?.durationMin || 30);
  const [price, setPrice] = useState(service?.price || 0);
  const [currency, setCurrency] = useState(service?.currency || 'AED');
  const [color, setColor] = useState(service?.color || '#25D366');
  const [enabled, setEnabled] = useState(service?.enabled ?? true);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Service name is required'); return; }
    setSaving(true);
    try {
      const payload = { workspaceId: wsId, name: name.trim(), description: description.trim() || undefined, durationMin, price, currency, color, enabled };
      let res;
      if (service) {
        res = await axios.patch(`/api/services/${service.id}`, payload);
      } else {
        res = await axios.post('/api/services', payload);
      }
      toast.success(service ? 'Service updated' : 'Service created');
      onSaved(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save service');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {service ? 'Edit Service' : 'Add Service'}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Haircut, Consultation"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Duration (min)</label>
              <input
                type="number"
                min={5}
                step={5}
                value={durationMin}
                onChange={(e) => setDurationMin(Number(e.target.value))}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Price</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white"
                />
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white"
                >
                  <option value="AED">AED</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="SAR">SAR</option>
                </select>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Color</label>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-full h-9 rounded-lg cursor-pointer border border-gray-300 dark:border-gray-600"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-[#25D366] focus:ring-[#25D366]"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Enabled</span>
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-[#25D366] hover:bg-[#20bd5a] text-white font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {service ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STAFF MODAL
// ═══════════════════════════════════════════════════════════════════════════

function StaffModal({
  wsId,
  member,
  services,
  onClose,
  onSaved,
}: {
  wsId: string;
  member: StaffMember | null;
  services: Service[];
  onClose: () => void;
  onSaved: (m: StaffMember) => void;
}) {
  const [name, setName] = useState(member?.name || '');
  const [phone, setPhone] = useState(member?.phone || '');
  const [email, setEmail] = useState(member?.email || '');
  const [enabled, setEnabled] = useState(member?.enabled ?? true);
  const [workingHours, setWorkingHours] = useState<Record<string, { start: string; end: string } | null>>(() => {
    if (member?.workingHours) {
      try { return JSON.parse(member.workingHours); } catch { /* fallback */ }
    }
    return { ...DEFAULT_WORKING_HOURS };
  });
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(
    member?.staffServices?.map((ss) => ss.serviceId) || []
  );
  const [saving, setSaving] = useState(false);

  const toggleDay = (key: string) => {
    setWorkingHours((prev) => ({
      ...prev,
      [key]: prev[key] ? null : { start: '09:00', end: '17:00' },
    }));
  };

  const updateHour = (key: string, field: 'start' | 'end', value: string) => {
    setWorkingHours((prev) => ({
      ...prev,
      [key]: prev[key] ? { ...prev[key]!, [field]: value } : { start: '09:00', end: '17:00', [field]: value },
    }));
  };

  const toggleService = (id: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const payload = {
        workspaceId: wsId,
        name: name.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        enabled,
        workingHours: JSON.stringify(workingHours),
        serviceIds: selectedServiceIds,
      };
      let res;
      if (member) {
        res = await axios.patch(`/api/staff/${member.id}`, payload);
      } else {
        res = await axios.post('/api/staff', payload);
      }
      toast.success(member ? 'Staff updated' : 'Staff member added');
      onSaved(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save staff');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {member ? 'Edit Staff' : 'Add Staff Member'}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Staff member name"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+971..."
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white"
              />
            </div>
          </div>

          {/* Working Hours */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Working Hours</label>
            <div className="space-y-2">
              {DAY_LABELS.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3">
                  <button
                    onClick={() => toggleDay(key)}
                    className={cn(
                      'w-12 text-xs font-medium py-1 rounded-lg transition-colors',
                      workingHours[key]
                        ? 'bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/30'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-400 border border-transparent'
                    )}
                  >
                    {label}
                  </button>
                  {workingHours[key] ? (
                    <div className="flex items-center gap-2 text-sm">
                      <input
                        type="time"
                        value={workingHours[key]!.start}
                        onChange={(e) => updateHour(key, 'start', e.target.value)}
                        className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs bg-white dark:bg-gray-800 dark:text-white"
                      />
                      <span className="text-gray-400">–</span>
                      <input
                        type="time"
                        value={workingHours[key]!.end}
                        onChange={(e) => updateHour(key, 'end', e.target.value)}
                        className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-xs bg-white dark:bg-gray-800 dark:text-white"
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">Off</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Assigned Services */}
          {services.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Assigned Services
              </label>
              <div className="flex flex-wrap gap-2">
                {services.map((svc) => (
                  <button
                    key={svc.id}
                    onClick={() => toggleService(svc.id)}
                    className={cn(
                      'text-xs px-3 py-1.5 rounded-full border transition-colors',
                      selectedServiceIds.includes(svc.id)
                        ? 'border-[#25D366] bg-[#25D366]/10 text-[#25D366]'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                    )}
                  >
                    {svc.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-[#25D366] focus:ring-[#25D366]"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Enabled</span>
          </label>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-[#25D366] hover:bg-[#20bd5a] text-white font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {member ? 'Update' : 'Add Staff'}
          </button>
        </div>
      </div>
    </div>
  );
}
