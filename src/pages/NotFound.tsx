import { ArrowLeft, Home, LifeBuoy } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
      <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-white/5 p-10 text-center shadow-[0_30px_100px_rgba(15,23,42,0.45)]">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#25D366]/15">
          <LifeBuoy className="h-7 w-7 text-[#25D366]" />
        </div>
        <div className="mb-2 text-sm font-semibold uppercase tracking-[0.28em] text-[#7AE89A]">404</div>
        <h1 className="text-4xl font-semibold tracking-tight">This page could not be found</h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-300">
          The link may be outdated, or the page may have moved during the recent onboarding and billing updates.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#128C7E]"
          >
            <Home className="h-4 w-4" />
            Go to homepage
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-medium text-slate-200 transition hover:border-white/30 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Go to login
          </Link>
        </div>
      </div>
    </div>
  );
}
