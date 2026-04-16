import { Link } from 'react-router-dom';
import {
  ArrowRight,
  MessageSquare,
  Bot,
  Users,
  Megaphone,
  Calendar,
  TrendingUp,
  Check,
  Shield,
  Zap,
  Globe2,
} from 'lucide-react';

const features = [
  {
    icon: MessageSquare,
    title: 'Shared WhatsApp inbox',
    desc: 'Every conversation in one place. Assign, reply, and collaborate as a team without juggling personal phones.',
  },
  {
    icon: Bot,
    title: 'AI auto-replies (Arabic + English)',
    desc: 'Answer FAQs, qualify leads, and book appointments 24/7 with GPT-powered chatbots trained on your business.',
  },
  {
    icon: Users,
    title: 'CRM + lead routing',
    desc: 'Track leads through custom pipelines. Auto-assign by region, keyword, or round-robin — never miss a hot lead.',
  },
  {
    icon: Megaphone,
    title: 'Broadcast campaigns',
    desc: 'Send approved WhatsApp templates to thousands of contacts with scheduling, segmentation, and delivery reports.',
  },
  {
    icon: Calendar,
    title: 'Appointment booking',
    desc: 'Let customers book with staff directly via WhatsApp. Automatic 24-hour reminders reduce no-shows.',
  },
  {
    icon: TrendingUp,
    title: 'Revenue analytics',
    desc: 'See conversion rates, response times, and campaign ROI. Track which ads actually drive WhatsApp leads.',
  },
];

const metrics = [
  { value: '<30s', label: 'Average first reply' },
  { value: '+42%', label: 'Lead conversion lift' },
  { value: '60%', label: 'Less time on manual follow-up' },
  { value: '24/7', label: 'AI availability' },
];

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50/50 to-white">
        <div className="container-tight py-20 lg:py-28 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-100 text-brand-700 text-sm font-medium mb-6">
            <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
            Official Meta Business Partner
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold leading-[1.05] max-w-4xl mx-auto">
            The WhatsApp CRM built for{' '}
            <span className="text-brand-600">UAE teams</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-slate-600 max-w-2xl mx-auto">
            Shared inbox, AI automation, lead routing, and broadcasts — all in one workspace.
            Reply faster, convert more, and save hours every week on manual follow-ups.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <a href="https://app.tawasel.io/register" className="btn-primary">
              Start free trial
              <ArrowRight className="w-4 h-4" />
            </a>
            <Link to="/features" className="btn-secondary">
              See how it works
            </Link>
          </div>

          <p className="mt-6 text-sm text-slate-500">
            Free 14-day trial · No credit card · Arabic &amp; English
          </p>
        </div>
      </section>

      {/* Metrics */}
      <section className="border-y border-slate-100 bg-white">
        <div className="container-tight py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {metrics.map((m) => (
              <div key={m.label} className="text-center">
                <div className="text-3xl md:text-4xl font-extrabold text-slate-900">{m.value}</div>
                <div className="mt-2 text-sm text-slate-600">{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="container-tight">
          <div className="max-w-2xl">
            <span className="text-brand-600 font-semibold text-sm uppercase tracking-wide">
              Everything in one place
            </span>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold">
              Replace 5 tools with one WhatsApp workspace
            </h2>
            <p className="mt-4 text-slate-600">
              Stop paying for a CRM, a chatbot, a broadcaster, and a booking tool separately. Tawasel
              runs your entire WhatsApp operation from a single login.
            </p>
          </div>

          <div className="mt-14 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="p-6 rounded-2xl border border-slate-200 bg-white hover:border-brand-300 hover:shadow-lg hover:shadow-brand-100/50 transition"
              >
                <div className="w-11 h-11 rounded-xl bg-brand-50 text-brand-600 grid place-items-center">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="mt-4 font-semibold text-lg">{title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Value strip */}
      <section className="bg-slate-950 text-white py-20">
        <div className="container-tight grid md:grid-cols-3 gap-10">
          <div>
            <Shield className="w-8 h-8 text-brand-400" />
            <h3 className="mt-4 font-semibold text-lg">Official WhatsApp Business API</h3>
            <p className="mt-2 text-sm text-slate-400">
              Built on Meta's Cloud API with green-tick verification support. No unofficial workarounds.
            </p>
          </div>
          <div>
            <Zap className="w-8 h-8 text-brand-400" />
            <h3 className="mt-4 font-semibold text-lg">Set up in under 30 minutes</h3>
            <p className="mt-2 text-sm text-slate-400">
              Connect your WhatsApp number with Embedded Signup. Keep your existing customer-facing number.
            </p>
          </div>
          <div>
            <Globe2 className="w-8 h-8 text-brand-400" />
            <h3 className="mt-4 font-semibold text-lg">Arabic &amp; English ready</h3>
            <p className="mt-2 text-sm text-slate-400">
              Full RTL interface, bilingual AI, and UAE-based support. Built for how Gulf teams actually work.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20">
        <div className="container-tight">
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-brand-600 font-semibold text-sm uppercase tracking-wide">
              How it works
            </span>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold">
              From first message to closed deal
            </h2>
          </div>

          <div className="mt-14 grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Connect your WhatsApp',
                desc: 'Use Meta Embedded Signup to link your existing WhatsApp Business number in minutes.',
              },
              {
                step: '02',
                title: 'Set up automation',
                desc: 'Build an AI assistant, create routing rules, and set up follow-up sequences — no code needed.',
              },
              {
                step: '03',
                title: 'Convert more leads',
                desc: 'Your team replies from a shared inbox while AI handles the rest. Watch response times drop.',
              },
            ].map((s) => (
              <div key={s.step} className="relative">
                <div className="text-5xl font-black text-brand-100">{s.step}</div>
                <h3 className="mt-4 font-semibold text-xl">{s.title}</h3>
                <p className="mt-2 text-slate-600">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-brand-50 py-20">
        <div className="container-tight text-center">
          <h2 className="text-3xl md:text-4xl font-bold max-w-2xl mx-auto">
            Ready to stop losing WhatsApp leads?
          </h2>
          <p className="mt-4 text-slate-600 max-w-xl mx-auto">
            Join UAE teams using Tawasel to reply faster, automate the boring stuff, and close more deals.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <a href="https://app.tawasel.io/register" className="btn-primary">
              Start free trial
              <ArrowRight className="w-4 h-4" />
            </a>
            <Link to="/pricing" className="btn-secondary">
              View pricing
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-600">
            {['14-day free trial', 'No credit card', 'Cancel anytime', 'UAE support'].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5">
                <Check className="w-4 h-4 text-brand-600" /> {t}
              </span>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
