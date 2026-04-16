export default function About() {
  return (
    <section className="py-20">
      <div className="container-tight max-w-3xl">
        <span className="text-brand-600 font-semibold text-sm uppercase tracking-wide">
          About Tawasel
        </span>
        <h1 className="mt-3 text-4xl md:text-5xl font-extrabold">
          WhatsApp operations, done right
        </h1>

        <div className="mt-8 prose prose-slate max-w-none">
          <p className="text-lg text-slate-600 leading-relaxed">
            Tawasel was built because WhatsApp runs business in the Gulf — and the tools for managing
            it at scale were either clunky international platforms or unofficial gateways at risk of
            account bans.
          </p>

          <p className="mt-5 text-slate-700 leading-relaxed">
            We built Tawasel from the ground up on Meta's official WhatsApp Business Cloud API, with
            one belief: WhatsApp operations deserve software as serious as your CRM. That means a
            shared inbox, AI that actually converts, automation that saves hours, and analytics that
            tell you where your revenue comes from.
          </p>

          <p className="mt-5 text-slate-700 leading-relaxed">
            Everything is designed for how Gulf teams actually work — bilingual Arabic and English,
            UAE business hours, and local support that understands your market.
          </p>

          <h2 className="mt-12 text-2xl font-bold">What we believe</h2>
          <ul className="mt-4 space-y-3 text-slate-700">
            <li>
              <strong>Official beats unofficial.</strong> We only use Meta's sanctioned Cloud API.
              Your account is safe.
            </li>
            <li>
              <strong>Speed is a feature.</strong> Reply in seconds, not hours. Automation handles
              the rest.
            </li>
            <li>
              <strong>Arabic is a first-class citizen.</strong> Not an afterthought — full RTL, AI
              fluency, bilingual team workflows.
            </li>
            <li>
              <strong>One workspace, not five tools.</strong> Inbox, CRM, chatbot, broadcaster, and
              booking in one login.
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
