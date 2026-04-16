import { Link } from 'react-router-dom';
import {
  MessageSquare,
  Bot,
  Users,
  Megaphone,
  Calendar,
  TrendingUp,
  Workflow,
  Link2,
  BarChart3,
  ArrowRight,
} from 'lucide-react';

const sections = [
  {
    icon: MessageSquare,
    title: 'Shared WhatsApp Inbox',
    copy: 'Every message from every number lands in one team inbox. Assign to the right agent, leave internal notes, and keep full conversation history.',
    bullets: [
      'Unlimited team members (on Pro)',
      'Quote replies, image previews, voice notes',
      'Internal notes invisible to customer',
      'Role-based access (Owner, Admin, Agent)',
    ],
  },
  {
    icon: Bot,
    title: 'AI chatbots that actually work',
    copy: 'Powered by GPT-4 with function calling. Bots can answer questions, qualify leads, and book appointments — then hand off to humans when stuck.',
    bullets: [
      'Trained on your FAQs and knowledge base',
      'Arabic + English native support',
      'Books appointments via function calling',
      'Escalates to agents automatically when needed',
    ],
  },
  {
    icon: Users,
    title: 'CRM + Lead Routing',
    copy: 'Every contact gets a profile with full history, custom fields, and pipeline stage. Route new leads to the right agent automatically.',
    bullets: [
      'Round-robin, keyword, and source-based routing',
      'Lead scoring and deal value tracking',
      'Multiple pipelines for sales, support, and onboarding',
      'Custom fields and tags',
    ],
  },
  {
    icon: Megaphone,
    title: 'Broadcast campaigns',
    copy: 'Send approved WhatsApp templates to thousands of contacts. Schedule, segment, and track delivery + reply rates.',
    bullets: [
      'Meta-approved templates with media',
      'Audience segmentation by tag or field',
      'Scheduled sends in the right timezone',
      'Opt-out handling and compliance',
    ],
  },
  {
    icon: Calendar,
    title: 'Appointment booking',
    copy: 'Customers book services with your staff directly in the chat. Automatic 24-hour reminders cut no-shows in half.',
    bullets: [
      'Services × staff × availability',
      'Booking via chat or public link',
      '24-hour WhatsApp reminders',
      'Reschedule and cancel from chat',
    ],
  },
  {
    icon: Workflow,
    title: 'Automations & follow-ups',
    copy: 'Trigger messages when leads go cold, fill forms, or cross pipeline stages. Build sequences without code.',
    bullets: [
      'Follow-up sequences for unresponsive leads',
      'Auto-assign rules (round-robin, keyword, source)',
      'AI-to-human escalation',
      'After-hours AI auto-replies',
    ],
  },
  {
    icon: Link2,
    title: 'Click-to-WhatsApp ads',
    copy: 'Generate trackable wa.me links for every ad platform. Know exactly which campaign drove each lead.',
    bullets: [
      '12 platform prefixes (SC, GG, TT, FB, IG, TW, YT, LI, EM, WB, QR, RF)',
      'Auto-tags leads from Meta referral data',
      'Campaign performance on dashboard',
      'Conversion funnel by source',
    ],
  },
  {
    icon: BarChart3,
    title: 'Analytics you actually read',
    copy: 'Response times, conversion rates, agent workload, and revenue attribution. No spreadsheets needed.',
    bullets: [
      'Campaign ROI and ad performance',
      'Agent response time and volume',
      'Revenue and deal close reports',
      'Export to CSV (Pro)',
    ],
  },
  {
    icon: TrendingUp,
    title: 'Built on the official WhatsApp Business API',
    copy: 'Direct integration with Meta Cloud API. No unofficial bridges, no account bans.',
    bullets: [
      'Meta Business verification support',
      'Green-tick eligible',
      'Templates synced from Meta Graph API',
      'Embedded Signup for fast onboarding',
    ],
  },
];

export default function Features() {
  return (
    <>
      <section className="py-20 bg-gradient-to-b from-brand-50/50 to-white">
        <div className="container-tight text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold max-w-3xl mx-auto">
            Everything you need to run WhatsApp operations
          </h1>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
            Tawasel replaces your CRM, chatbot, broadcaster, and booking tool with one tightly integrated workspace.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="container-tight space-y-20">
          {sections.map(({ icon: Icon, title, copy, bullets }, i) => (
            <div
              key={title}
              className={`grid md:grid-cols-2 gap-10 items-center ${
                i % 2 === 1 ? 'md:flex-row-reverse' : ''
              }`}
            >
              <div className={i % 2 === 1 ? 'md:order-2' : ''}>
                <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 grid place-items-center">
                  <Icon className="w-6 h-6" />
                </div>
                <h2 className="mt-4 text-2xl md:text-3xl font-bold">{title}</h2>
                <p className="mt-3 text-slate-600">{copy}</p>
                <ul className="mt-5 space-y-2">
                  {bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
              <div
                className={`aspect-[4/3] rounded-2xl bg-gradient-to-br from-brand-100 to-brand-50 border border-brand-200/50 grid place-items-center ${
                  i % 2 === 1 ? 'md:order-1' : ''
                }`}
              >
                <Icon className="w-24 h-24 text-brand-500/60" strokeWidth={1.2} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-20 bg-brand-50">
        <div className="container-tight text-center">
          <h2 className="text-3xl md:text-4xl font-bold">See the price that fits your team</h2>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/pricing" className="btn-primary">
              View pricing
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="https://app.tawasel.io/register" className="btn-secondary">
              Start free trial
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
