import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const nav = [
  { to: '/features', label: 'Features' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
];

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-100">
      <div className="container-tight flex items-center justify-between h-16">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg">
          <span className="w-8 h-8 rounded-lg bg-brand-500 text-white grid place-items-center font-black">
            T
          </span>
          <span>Tawasel</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `text-sm font-medium transition ${
                  isActive ? 'text-brand-600' : 'text-slate-600 hover:text-slate-900'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <a
            href="https://app.tawasel.io/login"
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Sign in
          </a>
          <a href="https://app.tawasel.io/register" className="btn-primary text-sm py-2 px-4">
            Start free
          </a>
        </div>

        <button
          className="md:hidden p-2 rounded-lg hover:bg-slate-100"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-slate-100 bg-white">
          <div className="container-tight py-4 flex flex-col gap-3">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="text-slate-700 font-medium py-2"
              >
                {item.label}
              </Link>
            ))}
            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <a
                href="https://app.tawasel.io/login"
                className="btn-secondary flex-1 text-sm py-2"
              >
                Sign in
              </a>
              <a
                href="https://app.tawasel.io/register"
                className="btn-primary flex-1 text-sm py-2"
              >
                Start free
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
