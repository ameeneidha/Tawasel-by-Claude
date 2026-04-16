import { useState } from 'react';
import { Check, ArrowRight } from 'lucide-react';
import { MARKETING_PLANS, TRUST_SIGNALS, FAQ } from '../data/plans';

export default function Pricing() {
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('monthly');

  return (
    <>
      <section className="py-20 bg-gradient-to-b from-brand-50/50 to-white">
        <div className="container-tight text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold">Simple, predictable pricing</h1>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
            Pick the plan that fits your team today. Upgrade anytime as you grow.
          </p>

          {/* Toggle */}
          <div className="mt-8 inline-flex items-center bg-slate-100 rounded-full p-1">
            <button
              onClick={() => setCycle('monthly')}
              className={`px-5 py-2 rounded-full text-sm font-medium transition ${
                cycle === 'monthly' ? 'bg-white text-slate-900 shadow' : 'text-slate-600'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setCycle('annual')}
              className={`px-5 py-2 rounded-full text-sm font-medium transition ${
                cycle === 'annual' ? 'bg-white text-slate-900 shadow' : 'text-slate-600'
              }`}
            >
              Annual <span className="text-brand-600 ml-1">−20%</span>
            </button>
          </div>
        </div>
      </section>

      {/* Cards */}
      <section className="pb-20">
        <div className="container-tight">
          <div className="grid md:grid-cols-3 gap-6">
            {MARKETING_PLANS.map((plan) => {
              const price = cycle === 'annual' ? plan.annualAED : plan.priceAED;
              return (
                <div
                  key={plan.id}
                  className={`relative rounded-3xl border p-8 bg-white ${
                    plan.highlight
                      ? 'border-brand-500 shadow-2xl shadow-brand-200/40 md:-translate-y-2'
                      : 'border-slate-200'
                  }`}
                >
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-brand-600 text-white text-xs font-semibold">
                      Most popular
                    </div>
                  )}

                  <h3 className="text-xl font-bold">{plan.name}</h3>
                  <p className="mt-1 text-sm text-slate-600">{plan.tagline}</p>

                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-sm text-slate-500">AED</span>
                    <span className="text-5xl font-extrabold">{price}</span>
                    <span className="text-slate-500">/mo</span>
                  </div>
                  {cycle === 'annual' && (
                    <p className="text-xs text-slate-500 mt-1">billed annually</p>
                  )}

                  <a
                    href="https://app.tawasel.io/register"
                    className={`mt-6 w-full block text-center py-3 rounded-full font-semibold transition ${
                      plan.highlight
                        ? 'bg-brand-600 text-white hover:bg-brand-700'
                        : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    {plan.cta}
                  </a>

                  <ul className="mt-8 space-y-3">
                    {plan.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-brand-600 mt-0.5 shrink-0" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          {/* Trust */}
          <div className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-600">
            {TRUST_SIGNALS.map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5">
                <Check className="w-4 h-4 text-brand-600" /> {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-slate-50 border-t border-slate-100">
        <div className="container-tight max-w-3xl">
          <h2 className="text-3xl font-bold text-center">Frequently asked questions</h2>
          <div className="mt-10 space-y-4">
            {FAQ.map((item) => (
              <details
                key={item.question}
                className="group bg-white rounded-2xl border border-slate-200 p-6 open:shadow-sm"
              >
                <summary className="cursor-pointer font-semibold list-none flex items-center justify-between">
                  {item.question}
                  <span className="text-brand-600 group-open:rotate-45 transition text-2xl leading-none">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-slate-600 text-sm leading-relaxed">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-brand-600 text-white">
        <div className="container-tight text-center">
          <h2 className="text-3xl md:text-4xl font-bold">Start your 14-day free trial</h2>
          <p className="mt-4 text-brand-50/90">No credit card required. Cancel anytime.</p>
          <a
            href="https://app.tawasel.io/register"
            className="mt-8 inline-flex items-center gap-2 bg-white text-brand-700 px-8 py-3 rounded-full font-semibold hover:bg-brand-50 transition"
          >
            Create account
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>
    </>
  );
}
