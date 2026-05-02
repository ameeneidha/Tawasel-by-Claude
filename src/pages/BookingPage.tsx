import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import {
  CalendarCheck,
  Clock,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle2,
  User,
  Phone,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '../lib/utils';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Service {
  id: string;
  name: string;
  description?: string;
  durationMin: number;
  price: number;
  currency: string;
  color: string;
}

interface StaffMember {
  id: string;
  name: string;
  avatar?: string;
  staffServices: { serviceId: string }[];
}

interface WorkspaceInfo {
  id: string;
  name: string;
  services: Service[];
  staff: StaffMember[];
}

type Step = 'service' | 'staff' | 'datetime' | 'details' | 'confirmed';

function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function formatDisplayDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function formatDisplayTime(slot: string) {
  const [h, m] = slot.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}

// ─── Step indicator ──────────────────────────────────────────────────────────

const STEPS: { key: Step; label: string }[] = [
  { key: 'service', label: 'Service' },
  { key: 'staff', label: 'Staff' },
  { key: 'datetime', label: 'Date & Time' },
  { key: 'details', label: 'Your Info' },
];

const STEP_ORDER: Step[] = ['service', 'staff', 'datetime', 'details', 'confirmed'];

function StepIndicator({ current }: { current: Step }) {
  const currentIdx = STEP_ORDER.indexOf(current);
  if (current === 'confirmed') return null;
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((s, i) => {
        const idx = STEP_ORDER.indexOf(s.key);
        const done = idx < currentIdx;
        const active = idx === currentIdx;
        return (
          <React.Fragment key={s.key}>
            <div className="flex flex-col items-center gap-1">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors',
                done   ? 'bg-[#25D366] text-white' :
                active ? 'bg-[#25D366] text-white ring-4 ring-[#25D366]/20' :
                         'bg-gray-100 text-gray-400'
              )}>
                {done ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
              </div>
              <span className={cn(
                'text-[10px] font-medium hidden sm:block',
                active ? 'text-[#25D366]' : done ? 'text-gray-500' : 'text-gray-400'
              )}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn('h-px flex-1 max-w-[48px] transition-colors', done ? 'bg-[#25D366]' : 'bg-gray-200')} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function BookingPage() {
  const { slug } = useParams<{ slug: string }>();

  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selections
  const [step, setStep] = useState<Step>('service');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | 'any' | null>(null);
  const [selectedDate, setSelectedDate] = useState(toInputDate(new Date()));
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Slots
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<{
    serviceName: string; staffName: string; startTime: string;
  } | null>(null);

  // ─── Load workspace ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    axios.get(`/api/public/book/${slug}`)
      .then(res => setWorkspace(res.data))
      .catch(err => setError(err.response?.data?.error || 'Booking page not found'))
      .finally(() => setLoading(false));
  }, [slug]);

  // ─── Load slots when date / staff / service changes ───────────────────────

  useEffect(() => {
    if (!slug || !selectedService || !selectedDate) { setSlots([]); return; }
    setLoadingSlots(true);
    setSelectedSlot(null);
    const staffId = selectedStaff === 'any' || !selectedStaff ? 'any' : selectedStaff.id;
    axios.get(`/api/public/book/${slug}/availability`, {
      params: { serviceId: selectedService.id, staffId, date: selectedDate },
    })
      .then(res => setSlots(res.data.slots || []))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [slug, selectedService, selectedDate, selectedStaff]);

  // ─── Staff eligible for selected service ──────────────────────────────────

  const eligibleStaff = useMemo(() => {
    if (!workspace || !selectedService) return workspace?.staff || [];
    return workspace.staff.filter(s =>
      s.staffServices.length === 0 || s.staffServices.some(ss => ss.serviceId === selectedService.id)
    );
  }, [workspace, selectedService]);

  // ─── Navigate date ─────────────────────────────────────────────────────────

  const navigateDate = (delta: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    if (d < new Date(new Date().setHours(0, 0, 0, 0))) return; // no past dates
    setSelectedDate(toInputDate(d));
  };

  // ─── Submit booking ────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!customerPhone.trim()) return;
    setSubmitting(true);
    try {
      const staffId = selectedStaff === 'any' || !selectedStaff ? 'any' : selectedStaff.id;
      const res = await axios.post(`/api/public/book/${slug}`, {
        serviceId: selectedService!.id,
        staffId,
        date: selectedDate,
        slot: selectedSlot,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim(),
      });
      setConfirmed(res.data);
      setStep('confirmed');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to book. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Loading / Error states ────────────────────────────────────────────────

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-[#25D366]" />
    </div>
  );

  if (error || !workspace) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
      <CalendarCheck className="w-14 h-14 text-gray-300 mb-4" />
      <h1 className="text-xl font-semibold text-gray-700 mb-2">Booking page not found</h1>
      <p className="text-gray-500 text-sm">{error || 'This booking link is invalid or has been removed.'}</p>
    </div>
  );

  // ─── Confirmed screen ──────────────────────────────────────────────────────

  if (step === 'confirmed' && confirmed) return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-[#25D366] px-6 py-4 text-white text-center">
        <p className="text-sm opacity-80">Book an appointment at</p>
        <h1 className="text-xl font-bold">{workspace.name}</h1>
      </header>
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-[#25D366]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-[#25D366]" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">You're booked!</h2>
          <p className="text-sm text-gray-500 mb-6">We'll send you a WhatsApp confirmation shortly.</p>
          <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2 text-sm">
            <div className="flex items-center gap-2 text-gray-700">
              <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: selectedService?.color }} />
              <span className="font-medium">{confirmed.serviceName}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <User className="w-4 h-4 text-gray-400 shrink-0" />
              {confirmed.staffName}
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <CalendarCheck className="w-4 h-4 text-gray-400 shrink-0" />
              {formatDisplayDate(confirmed.startTime)}
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Clock className="w-4 h-4 text-gray-400 shrink-0" />
              {new Date(confirmed.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-4">Powered by <span className="text-[#25D366] font-semibold">Tawasel</span></p>
        </div>
      </div>
    </div>
  );

  // ─── Booking flow ──────────────────────────────────────────────────────────

  const canGoBack = STEP_ORDER.indexOf(step) > 0;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-[#25D366] px-6 py-4 text-white text-center">
        <p className="text-sm opacity-80">Book an appointment at</p>
        <h1 className="text-xl font-bold">{workspace.name}</h1>
      </header>

      <div className="flex-1 px-4 py-6 max-w-lg mx-auto w-full">
        <StepIndicator current={step} />

        {/* Back button */}
        {canGoBack && (
          <button
            onClick={() => setStep(STEP_ORDER[STEP_ORDER.indexOf(step) - 1])}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        )}

        {/* ── STEP 1: Service ── */}
        {step === 'service' && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">What would you like?</h2>
            {workspace.services.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">No services available at this time.</p>
            ) : (
              workspace.services.map(svc => (
                <button
                  key={svc.id}
                  onClick={() => { setSelectedService(svc); setStep('staff'); }}
                  className="w-full flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 hover:border-[#25D366] hover:shadow-sm transition-all text-left"
                >
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: svc.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{svc.name}</p>
                    {svc.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{svc.description}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-gray-900">
                      {svc.price > 0 ? `${svc.price} ${svc.currency}` : 'Free'}
                    </p>
                    <p className="text-xs text-gray-400 flex items-center gap-1 justify-end">
                      <Clock className="w-3 h-3" />{svc.durationMin} min
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {/* ── STEP 2: Staff ── */}
        {step === 'staff' && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Who would you like?</h2>

            {/* Any available option */}
            <button
              onClick={() => { setSelectedStaff('any'); setStep('datetime'); }}
              className="w-full flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 hover:border-[#25D366] hover:shadow-sm transition-all text-left"
            >
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-gray-400" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Any Available</p>
                <p className="text-xs text-gray-400">We'll assign the first available staff</p>
              </div>
            </button>

            {eligibleStaff.map(member => (
              <button
                key={member.id}
                onClick={() => { setSelectedStaff(member); setStep('datetime'); }}
                className="w-full flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 hover:border-[#25D366] hover:shadow-sm transition-all text-left"
              >
                <div className="w-10 h-10 rounded-full bg-[#25D366]/10 flex items-center justify-center text-[#25D366] font-semibold shrink-0 overflow-hidden">
                  {member.avatar
                    ? <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                    : member.name.charAt(0).toUpperCase()
                  }
                </div>
                <p className="font-medium text-gray-900">{member.name}</p>
              </button>
            ))}
          </div>
        )}

        {/* ── STEP 3: Date & Time ── */}
        {step === 'datetime' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Pick a date & time</h2>

            {/* Date navigator */}
            <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-200 p-3">
              <button
                onClick={() => navigateDate(-1)}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-gray-500" />
              </button>
              <input
                type="date"
                value={selectedDate}
                min={toInputDate(new Date())}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="flex-1 text-center text-sm font-medium text-gray-900 bg-transparent border-0 outline-none cursor-pointer"
              />
              <button
                onClick={() => navigateDate(1)}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <p className="text-xs text-gray-500 text-center">{formatDisplayDate(selectedDate)}</p>

            {/* Time slots */}
            <div>
              {loadingSlots ? (
                <div className="flex items-center justify-center gap-2 py-10 text-gray-400 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Checking availability…
                </div>
              ) : slots.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">
                  <CalendarCheck className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  No available slots for this date. Try another day.
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {slots.map(s => (
                    <button
                      key={s}
                      onClick={() => setSelectedSlot(s)}
                      className={cn(
                        'py-2.5 text-sm rounded-xl border transition-all font-medium',
                        selectedSlot === s
                          ? 'bg-[#25D366] border-[#25D366] text-white shadow-sm'
                          : 'bg-white border-gray-200 text-gray-700 hover:border-[#25D366]'
                      )}
                    >
                      {formatDisplayTime(s)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedSlot && (
              <button
                onClick={() => setStep('details')}
                className="w-full py-3 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-semibold transition-colors"
              >
                Continue with {formatDisplayTime(selectedSlot)}
              </button>
            )}
          </div>
        )}

        {/* ── STEP 4: Customer Details ── */}
        {step === 'details' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Your details</h2>

            {/* Booking summary */}
            <div className="bg-[#25D366]/5 border border-[#25D366]/20 rounded-xl p-4 text-sm space-y-1.5">
              <div className="flex items-center gap-2 text-gray-700">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: selectedService?.color }} />
                <span className="font-medium">{selectedService?.name}</span>
                <span className="text-gray-400 ml-auto">{selectedService?.durationMin} min</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                {selectedStaff === 'any' ? 'Any Available' : selectedStaff?.name}
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <CalendarCheck className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                {formatDisplayDate(selectedDate)} · {selectedSlot && formatDisplayTime(selectedSlot)}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Your Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="e.g. Layla Al Mansouri"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 caret-[#25D366] focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20 outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                WhatsApp Number <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  placeholder="+971 50 123 4567"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 caret-[#25D366] focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20 outline-none transition-all"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">We'll send your confirmation and reminders via WhatsApp</p>
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting || !customerPhone.trim()}
              className="w-full py-3.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? 'Confirming…' : 'Confirm Booking'}
            </button>

            <p className="text-xs text-gray-400 text-center">
              Powered by <span className="text-[#25D366] font-semibold">Tawasel</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
