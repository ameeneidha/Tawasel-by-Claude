import { ArrowLeft, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';

type PublicSection = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

type PublicPageLayoutProps = {
  eyebrow: string;
  title: string;
  description: string;
  sections: PublicSection[];
  ctaLabel?: string;
  ctaHref?: string;
};

export default function PublicPageLayout({
  eyebrow,
  title,
  description,
  sections,
  ctaLabel = 'Create account',
  ctaHref = '/register',
}: PublicPageLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#25D366]">
              <MessageSquare className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-lg font-semibold tracking-tight">WABA Hub</div>
              <div className="text-xs text-slate-400">WhatsApp-first customer operations</div>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:text-white"
            >
              Sign in
            </Link>
            <Link
              to={ctaHref}
              className="rounded-full bg-[#25D366] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#128C7E]"
            >
              {ctaLabel}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-12 max-w-3xl">
          <div className="mb-4 inline-flex rounded-full border border-[#25D366]/30 bg-[#25D366]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[#7AE89A]">
            {eyebrow}
          </div>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
          <p className="mt-5 text-lg leading-8 text-slate-300">{description}</p>
          <div className="mt-8">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-[#7AE89A] transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to homepage
            </Link>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {sections.map((section) => (
            <section
              key={section.title}
              className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_20px_80px_rgba(15,23,42,0.35)]"
            >
              <h2 className="text-2xl font-semibold tracking-tight">{section.title}</h2>
              <div className="mt-4 space-y-4 text-sm leading-7 text-slate-300 sm:text-base">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
              {section.bullets && section.bullets.length > 0 && (
                <ul className="mt-5 space-y-3 text-sm leading-7 text-slate-200 sm:text-base">
                  {section.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-3">
                      <span className="mt-2 h-2 w-2 flex-none rounded-full bg-[#25D366]" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
