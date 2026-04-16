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
    <div className="h-12 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-6 flex items-center justify-between shrink-0">
      {/* Left: Page title */}
      <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
        {title}
      </h1>

      {/* Right: Language toggle + User avatar */}
      <div className="flex items-center gap-3">
        {/* Language toggle */}
        <button
          onClick={toggleLanguage}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Globe className="w-4 h-4" />
          <span className="font-medium">{isRtl ? 'EN' : 'عربي'}</span>
        </button>

        {/* User avatar */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center text-white text-sm font-semibold">
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
