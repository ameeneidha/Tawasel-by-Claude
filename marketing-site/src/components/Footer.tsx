import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="border-t border-slate-100 bg-slate-50">
      <div className="container-tight py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2 font-bold text-lg">
              <span className="w-8 h-8 rounded-lg bg-brand-500 text-white grid place-items-center font-black">
                T
              </span>
              <span>Tawasel</span>
            </Link>
            <p className="mt-3 text-sm text-slate-600 max-w-xs">
              WhatsApp CRM built for UAE teams. Shared inbox, AI automation, and CRM — all in one.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-slate-900 mb-3 text-sm">Product</h4>
            <ul className="space-y-2 text-sm text-slate-600">
              <li><Link to="/features" className="hover:text-slate-900">Features</Link></li>
              <li><Link to="/pricing" className="hover:text-slate-900">Pricing</Link></li>
              <li><a href="https://app.tawasel.io/register" className="hover:text-slate-900">Start free</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-slate-900 mb-3 text-sm">Company</h4>
            <ul className="space-y-2 text-sm text-slate-600">
              <li><Link to="/about" className="hover:text-slate-900">About</Link></li>
              <li><Link to="/contact" className="hover:text-slate-900">Contact</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-slate-900 mb-3 text-sm">Legal</h4>
            <ul className="space-y-2 text-sm text-slate-600">
              <li><a href="https://app.tawasel.io/privacy" className="hover:text-slate-900">Privacy</a></li>
              <li><a href="https://app.tawasel.io/terms" className="hover:text-slate-900">Terms</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            &copy; {new Date().getFullYear()} Tawasel. Built in the UAE.
          </p>
          <p className="text-sm text-slate-500">info@quantops.ae</p>
        </div>
      </div>
    </footer>
  );
}
