import { Mail, MessageCircle, MapPin } from 'lucide-react';

export default function Contact() {
  return (
    <section className="py-20">
      <div className="container-tight max-w-3xl">
        <h1 className="text-4xl md:text-5xl font-extrabold">Talk to us</h1>
        <p className="mt-4 text-lg text-slate-600">
          Questions about plans, onboarding, or WhatsApp Business API? We reply within one business day.
        </p>

        <div className="mt-12 grid sm:grid-cols-2 gap-5">
          <a
            href="mailto:info@quantops.ae"
            className="p-6 rounded-2xl border border-slate-200 hover:border-brand-300 hover:shadow-md transition"
          >
            <Mail className="w-6 h-6 text-brand-600" />
            <h3 className="mt-3 font-semibold">Email</h3>
            <p className="mt-1 text-sm text-slate-600">info@quantops.ae</p>
          </a>

          <a
            href="https://wa.me/971566666203"
            target="_blank"
            rel="noreferrer"
            className="p-6 rounded-2xl border border-slate-200 hover:border-brand-300 hover:shadow-md transition"
          >
            <MessageCircle className="w-6 h-6 text-brand-600" />
            <h3 className="mt-3 font-semibold">WhatsApp</h3>
            <p className="mt-1 text-sm text-slate-600">+971 56 666 6203</p>
          </a>

          <div className="p-6 rounded-2xl border border-slate-200 sm:col-span-2">
            <MapPin className="w-6 h-6 text-brand-600" />
            <h3 className="mt-3 font-semibold">Location</h3>
            <p className="mt-1 text-sm text-slate-600">United Arab Emirates</p>
          </div>
        </div>
      </div>
    </section>
  );
}
