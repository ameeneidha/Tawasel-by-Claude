import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
type BookingLanguage = 'en' | 'ar';

const BOOKING_COPY = {
  en: {
    languageToggle: 'العربية',
    bookAt: 'Book an appointment at',
    notFoundTitle: 'Booking page not found',
    notFoundBody: 'This booking link is invalid or has been removed.',
    failedBook: 'Failed to book. Please try again.',
    bookedTitle: "You're booked!",
    bookedSubtitle: "We'll send you a WhatsApp confirmation shortly.",
    poweredBy: 'Powered by',
    back: 'Back',
    serviceTitle: 'What would you like?',
    noServices: 'No services available at this time.',
    free: 'Free',
    minutes: 'min',
    staffTitle: 'Who would you like?',
    anyAvailable: 'Any Available',
    anyAvailableDesc: "We'll assign the first available staff.",
    datetimeTitle: 'Pick a date & time',
    checking: 'Checking availability...',
    noSlots: 'No available slots for this date. Try another day.',
    continueWith: 'Continue with',
    detailsTitle: 'Your details',
    yourName: 'Your Name',
    namePlaceholder: 'e.g. Layla Al Mansouri',
    whatsappNumber: 'WhatsApp Number',
    whatsappPlaceholder: '+971 50 123 4567',
    whatsappHelp: "We'll send your confirmation and reminders via WhatsApp.",
    confirming: 'Confirming...',
    confirmBooking: 'Confirm Booking',
    steps: [
      { key: 'service', label: 'Service' },
      { key: 'staff', label: 'Staff' },
      { key: 'datetime', label: 'Date & Time' },
      { key: 'details', label: 'Your Info' },
    ],
  },
  ar: {
    languageToggle: 'English',
    bookAt: 'احجز موعداً لدى',
    notFoundTitle: 'رابط الحجز غير موجود',
    notFoundBody: 'رابط الحجز غير صالح أو تمت إزالته.',
    failedBook: 'تعذر تأكيد الحجز. يرجى المحاولة مرة أخرى.',
    bookedTitle: 'تم حجز موعدك!',
    bookedSubtitle: 'سنرسل لك تأكيد الحجز عبر واتساب قريباً.',
    poweredBy: 'مدعوم من',
    back: 'رجوع',
    serviceTitle: 'ما الخدمة التي تريدها؟',
    noServices: 'لا توجد خدمات متاحة حالياً.',
    free: 'مجاني',
    minutes: 'دقيقة',
    staffTitle: 'من تفضل أن يخدمك؟',
    anyAvailable: 'أي موظف متاح',
    anyAvailableDesc: 'سنختار أول موظف متاح.',
    datetimeTitle: 'اختر التاريخ والوقت',
    checking: 'جارٍ التحقق من المواعيد...',
    noSlots: 'لا توجد أوقات متاحة في هذا التاريخ. جرّب يوماً آخر.',
    continueWith: 'المتابعة مع',
    detailsTitle: 'بياناتك',
    yourName: 'اسمك',
    namePlaceholder: 'مثال: ليلى المنصوري',
    whatsappNumber: 'رقم واتساب',
    whatsappPlaceholder: '+971 50 123 4567',
    whatsappHelp: 'سنرسل تأكيد الحجز والتذكيرات عبر واتساب.',
    confirming: 'جارٍ التأكيد...',
    confirmBooking: 'تأكيد الحجز',
    steps: [
      { key: 'service', label: 'الخدمة' },
      { key: 'staff', label: 'الموظف' },
      { key: 'datetime', label: 'التاريخ والوقت' },
      { key: 'details', label: 'بياناتك' },
    ],
  },
} as const;

const STEP_ORDER: Step[] = ['service', 'staff', 'datetime', 'details', 'confirmed'];

function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function formatDisplayDate(dateStr: string, locale: string) {
  const value = dateStr.includes('T') ? new Date(dateStr) : new Date(`${dateStr}T00:00:00`);
  return value.toLocaleDateString(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Dubai',
  });
}

function formatDisplayTime(slot: string, locale: string) {
  const [h, m] = slot.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatIsoTime(dateStr: string, locale: string) {
  return new Date(dateStr).toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Dubai',
  });
}

function StepIndicator({
  current,
  steps,
}: {
  current: Step;
  steps: readonly { key: Exclude<Step, 'confirmed'>; label: string }[];
}) {
  const currentIdx = STEP_ORDER.indexOf(current);
  if (current === 'confirmed') return null;

  return (
    <div className="mb-8 flex items-center justify-center gap-2">
      {steps.map((s, i) => {
        const idx = STEP_ORDER.indexOf(s.key);
        const done = idx < currentIdx;
        const active = idx === currentIdx;

        return (
          <React.Fragment key={s.key}>
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors',
                  done
                    ? 'bg-[#25D366] text-white'
                    : active
                      ? 'bg-[#25D366] text-white ring-4 ring-[#25D366]/20'
                      : 'bg-gray-100 text-gray-400',
                )}
              >
                {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={cn(
                  'hidden text-[10px] font-medium sm:block',
                  active ? 'text-[#25D366]' : done ? 'text-gray-500' : 'text-gray-400',
                )}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn('h-px max-w-[48px] flex-1 transition-colors', done ? 'bg-[#25D366]' : 'bg-gray-200')} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function BookingPage() {
  const { slug } = useParams<{ slug: string }>();
  const { i18n } = useTranslation();
  const lang: BookingLanguage = i18n.language?.startsWith('ar') ? 'ar' : 'en';
  const isArabic = lang === 'ar';
  const copy = BOOKING_COPY[lang];
  const locale = isArabic ? 'ar-AE' : 'en-US';

  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>('service');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | 'any' | null>(null);
  const [selectedDate, setSelectedDate] = useState(toInputDate(new Date()));
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<{
    serviceName: string;
    staffName: string;
    startTime: string;
  } | null>(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    axios
      .get(`/api/public/book/${slug}`)
      .then((res) => setWorkspace(res.data))
      .catch((err) => setError(err.response?.data?.error || copy.notFoundTitle))
      .finally(() => setLoading(false));
  }, [copy.notFoundTitle, slug]);

  useEffect(() => {
    if (!slug || !selectedService || !selectedDate) {
      setSlots([]);
      return;
    }

    setLoadingSlots(true);
    setSelectedSlot(null);
    const staffId = selectedStaff === 'any' || !selectedStaff ? 'any' : selectedStaff.id;

    axios
      .get(`/api/public/book/${slug}/availability`, {
        params: { serviceId: selectedService.id, staffId, date: selectedDate },
      })
      .then((res) => setSlots(res.data.slots || []))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [slug, selectedService, selectedDate, selectedStaff]);

  const eligibleStaff = useMemo(() => {
    if (!workspace || !selectedService) return workspace?.staff || [];
    return workspace.staff.filter(
      (s) => s.staffServices.length === 0 || s.staffServices.some((ss) => ss.serviceId === selectedService.id),
    );
  }, [workspace, selectedService]);

  const navigateDate = (delta: number) => {
    const d = new Date(`${selectedDate}T00:00:00`);
    d.setDate(d.getDate() + delta);
    if (d < new Date(new Date().setHours(0, 0, 0, 0))) return;
    setSelectedDate(toInputDate(d));
  };

  const toggleLanguage = () => {
    i18n.changeLanguage(isArabic ? 'en' : 'ar');
  };

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
      alert(err.response?.data?.error || copy.failedBook);
    } finally {
      setSubmitting(false);
    }
  };

  const canGoBack = STEP_ORDER.indexOf(step) > 0;
  const summaryStaffName = selectedStaff === 'any' ? copy.anyAvailable : selectedStaff?.name;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-[#25D366]" />
      </div>
    );
  }

  if (error || !workspace) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6 text-center" dir={isArabic ? 'rtl' : 'ltr'}>
        <CalendarCheck className="mb-4 h-14 w-14 text-gray-300" />
        <h1 className="mb-2 text-xl font-semibold text-gray-700">{copy.notFoundTitle}</h1>
        <p className="text-sm text-gray-500">{error || copy.notFoundBody}</p>
      </div>
    );
  }

  if (step === 'confirmed' && confirmed) {
    return (
      <div className="flex min-h-screen flex-col bg-gray-50" dir={isArabic ? 'rtl' : 'ltr'}>
        <header className="bg-[#25D366] px-6 py-4 text-center text-white">
          <div className="mx-auto flex max-w-lg items-start justify-between gap-3">
            <div className="flex-1">
              <p className="text-sm opacity-80">{copy.bookAt}</p>
              <h1 className="text-xl font-bold">{workspace.name}</h1>
            </div>
            <button
              type="button"
              onClick={toggleLanguage}
              className="rounded-full border border-white/30 px-3 py-1 text-xs font-semibold text-white/95 transition hover:bg-white/10"
            >
              {copy.languageToggle}
            </button>
          </div>
        </header>

        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#25D366]/10">
              <CheckCircle2 className="h-8 w-8 text-[#25D366]" />
            </div>
            <h2 className="mb-1 text-xl font-bold text-gray-900">{copy.bookedTitle}</h2>
            <p className="mb-6 text-sm text-gray-500">{copy.bookedSubtitle}</p>

            <div className="space-y-2 rounded-xl bg-gray-50 p-4 text-start text-sm">
              <div className="flex items-center gap-2 text-gray-700">
                <span className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: selectedService?.color }} />
                <span className="font-medium">{confirmed.serviceName}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <User className="h-4 w-4 shrink-0 text-gray-400" />
                {confirmed.staffName}
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <CalendarCheck className="h-4 w-4 shrink-0 text-gray-400" />
                {formatDisplayDate(confirmed.startTime, locale)}
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Clock className="h-4 w-4 shrink-0 text-gray-400" />
                {formatIsoTime(confirmed.startTime, locale)}
              </div>
            </div>

            <p className="mt-4 text-xs text-gray-400">
              {copy.poweredBy} <span className="font-semibold text-[#25D366]">Tawasel</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50" dir={isArabic ? 'rtl' : 'ltr'}>
      <header className="bg-[#25D366] px-6 py-4 text-center text-white">
        <div className="mx-auto flex max-w-lg items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-sm opacity-80">{copy.bookAt}</p>
            <h1 className="text-xl font-bold">{workspace.name}</h1>
          </div>
          <button
            type="button"
            onClick={toggleLanguage}
            className="rounded-full border border-white/30 px-3 py-1 text-xs font-semibold text-white/95 transition hover:bg-white/10"
          >
            {copy.languageToggle}
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg flex-1 px-4 py-6">
        <StepIndicator current={step} steps={copy.steps} />

        {canGoBack && (
          <button
            onClick={() => setStep(STEP_ORDER[STEP_ORDER.indexOf(step) - 1])}
            className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className={cn('h-4 w-4', isArabic && 'rotate-180')} />
            {copy.back}
          </button>
        )}

        {step === 'service' && (
          <div className="space-y-3">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">{copy.serviceTitle}</h2>
            {workspace.services.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">{copy.noServices}</p>
            ) : (
              workspace.services.map((svc) => (
                <button
                  key={svc.id}
                  onClick={() => {
                    setSelectedService(svc);
                    setStep('staff');
                  }}
                  className="flex w-full items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 text-start transition-all hover:border-[#25D366] hover:shadow-sm"
                >
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: svc.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900">{svc.name}</p>
                    {svc.description && <p className="mt-0.5 truncate text-xs text-gray-500">{svc.description}</p>}
                  </div>
                  <div className="shrink-0 text-end">
                    <p className="text-sm font-semibold text-gray-900">
                      {svc.price > 0 ? `${svc.price} ${svc.currency}` : copy.free}
                    </p>
                    <p className="flex items-center justify-end gap-1 text-xs text-gray-400">
                      <Clock className="h-3 w-3" />
                      {svc.durationMin} {copy.minutes}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {step === 'staff' && (
          <div className="space-y-3">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">{copy.staffTitle}</h2>

            <button
              onClick={() => {
                setSelectedStaff('any');
                setStep('datetime');
              }}
              className="flex w-full items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 text-start transition-all hover:border-[#25D366] hover:shadow-sm"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100">
                <User className="h-5 w-5 text-gray-400" />
              </div>
              <div>
                <p className="font-medium text-gray-900">{copy.anyAvailable}</p>
                <p className="text-xs text-gray-400">{copy.anyAvailableDesc}</p>
              </div>
            </button>

            {eligibleStaff.map((member) => (
              <button
                key={member.id}
                onClick={() => {
                  setSelectedStaff(member);
                  setStep('datetime');
                }}
                className="flex w-full items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 text-start transition-all hover:border-[#25D366] hover:shadow-sm"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#25D366]/10 font-semibold text-[#25D366]">
                  {member.avatar ? (
                    <img src={member.avatar} alt={member.name} className="h-full w-full object-cover" />
                  ) : (
                    member.name.charAt(0).toUpperCase()
                  )}
                </div>
                <p className="font-medium text-gray-900">{member.name}</p>
              </button>
            ))}
          </div>
        )}

        {step === 'datetime' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">{copy.datetimeTitle}</h2>

            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-3">
              <button onClick={() => navigateDate(-1)} className="rounded-lg p-1.5 transition-colors hover:bg-gray-100">
                <ChevronLeft className={cn('h-4 w-4 text-gray-500', isArabic && 'rotate-180')} />
              </button>
              <input
                type="date"
                value={selectedDate}
                min={toInputDate(new Date())}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="flex-1 cursor-pointer border-0 bg-transparent text-center text-sm font-medium text-gray-900 outline-none"
              />
              <button onClick={() => navigateDate(1)} className="rounded-lg p-1.5 transition-colors hover:bg-gray-100">
                <ChevronRight className={cn('h-4 w-4 text-gray-500', isArabic && 'rotate-180')} />
              </button>
            </div>

            <p className="text-center text-xs text-gray-500">{formatDisplayDate(selectedDate, locale)}</p>

            <div>
              {loadingSlots ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {copy.checking}
                </div>
              ) : slots.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-400">
                  <CalendarCheck className="mx-auto mb-2 h-10 w-10 opacity-30" />
                  {copy.noSlots}
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {slots.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSelectedSlot(s)}
                      className={cn(
                        'rounded-xl border py-2.5 text-sm font-medium transition-all',
                        selectedSlot === s
                          ? 'border-[#25D366] bg-[#25D366] text-white shadow-sm'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-[#25D366]',
                      )}
                    >
                      {formatDisplayTime(s, locale)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedSlot && (
              <button
                onClick={() => setStep('details')}
                className="w-full rounded-xl bg-[#25D366] py-3 font-semibold text-white transition-colors hover:bg-[#20bd5a]"
              >
                {copy.continueWith} {formatDisplayTime(selectedSlot, locale)}
              </button>
            )}
          </div>
        )}

        {step === 'details' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">{copy.detailsTitle}</h2>

            <div className="space-y-1.5 rounded-xl border border-[#25D366]/20 bg-[#25D366]/5 p-4 text-sm">
              <div className="flex items-center gap-2 text-gray-700">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: selectedService?.color }} />
                <span className="font-medium">{selectedService?.name}</span>
                <span className="ms-auto text-gray-400">
                  {selectedService?.durationMin} {copy.minutes}
                </span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <User className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                {summaryStaffName}
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <CalendarCheck className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                {formatDisplayDate(selectedDate, locale)} · {selectedSlot && formatDisplayTime(selectedSlot, locale)}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">{copy.yourName}</label>
              <div className="relative">
                <User className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder={copy.namePlaceholder}
                  className="w-full rounded-xl border border-gray-200 bg-white py-3 pe-4 ps-10 text-sm text-gray-900 caret-[#25D366] outline-none transition-all placeholder:text-gray-400 focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                {copy.whatsappNumber} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Phone className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder={copy.whatsappPlaceholder}
                  className="w-full rounded-xl border border-gray-200 bg-white py-3 pe-4 ps-10 text-sm text-gray-900 caret-[#25D366] outline-none transition-all placeholder:text-gray-400 focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20"
                />
              </div>
              <p className="mt-1 text-xs text-gray-400">{copy.whatsappHelp}</p>
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting || !customerPhone.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3.5 font-semibold text-white transition-colors hover:bg-[#20bd5a] disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? copy.confirming : copy.confirmBooking}
            </button>

            <p className="text-center text-xs text-gray-400">
              {copy.poweredBy} <span className="font-semibold text-[#25D366]">Tawasel</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
