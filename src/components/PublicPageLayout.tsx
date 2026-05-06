import { ArrowLeft } from 'lucide-react';
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
    <div className="tawasel-app-shell min-h-screen text-slate-950 dark:text-white">
      <header className="border-b border-slate-200/70 bg-[#F7F5EF]/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <img src="/tawasel-logo.png" alt="Tawasel" className="h-10 w-10 rounded-2xl object-contain" />
            <div>
              <div className="text-lg font-black tracking-tight">Tawasel App</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">WhatsApp-first customer operations</div>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-2 text-sm font-bold text-slate-700 transition hover:text-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:text-white"
            >
              Sign in
            </Link>
            <Link
              to={ctaHref}
              className="tawasel-primary px-4 py-2 text-sm font-bold transition"
            >
              {ctaLabel}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-12 max-w-3xl">
          <div className="tawasel-kicker mb-4">
            {eyebrow}
          </div>
          <h1 className="font-serif text-5xl leading-none tracking-normal sm:text-6xl">{title}</h1>
          <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">{description}</p>
          <div className="mt-8">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm font-bold text-[#128C7E] transition hover:text-slate-950 dark:text-[#7AE89A] dark:hover:text-white"
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
              className="tawasel-card p-8"
            >
              <h2 className="font-serif text-3xl font-normal tracking-normal">{section.title}</h2>
              <div className="mt-4 space-y-4 text-sm leading-7 text-slate-600 dark:text-slate-300 sm:text-base">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
              {section.bullets && section.bullets.length > 0 && (
                <ul className="mt-5 space-y-3 text-sm leading-7 text-slate-700 dark:text-slate-200 sm:text-base">
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
