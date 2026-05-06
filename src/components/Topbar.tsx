import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../contexts/AppContext';
import { getDisplayName } from '../lib/utils';

interface TopbarProps {
  title: string;
}

export default function Topbar({ title }: TopbarProps) {
  const { t, i18n } = useTranslation();
  const { user } = useApp();
  const displayName = getDisplayName(user?.name, user?.email);
  const isRtl = i18n.language === 'ar';

  const toggleLanguage = () => {
    i18n.changeLanguage(isRtl ? 'en' : 'ar');
  };

  return (
    <div className="h-14 border-b border-slate-200/70 bg-[#F7F5EF]/95 px-6 flex items-center justify-between shrink-0 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
      {/* Left: Page title */}
      <h1 className="font-serif text-2xl font-normal tracking-normal text-slate-950 dark:text-white truncate">
        {title}
      </h1>

      {/* Right: Language toggle + User avatar */}
      <div className="flex items-center gap-3">
        {/* Language toggle */}
        <button
          onClick={toggleLanguage}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:text-slate-950 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white"
        >
          <Globe className="w-4 h-4" />
          <span className="font-medium">{isRtl ? 'EN' : 'عربي'}</span>
        </button>

        {/* User avatar */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-2xl bg-[#25D366] flex items-center justify-center text-white text-sm font-semibold shadow-sm shadow-[#25D366]/20">
            {displayName?.[0]?.toUpperCase() || 'U'}
          </div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200 hidden sm:inline truncate max-w-[120px]">
            {displayName}
          </span>
        </div>
      </div>
    </div>
  );
}
