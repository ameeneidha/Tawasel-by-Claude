import { Link, useLocation } from 'react-router-dom';
import {
  MessageSquare,
  Send,
  Radio,
  FileText,
  Bot,
  Zap,
  Hash,
  LayoutGrid,
  BarChart3,
  Users,
  Settings,
  LogOut,
  ChevronRight,
  Plus,
  UserCircle,
  Lightbulb,
  AlertCircle,
  MessageCircle,
  ShieldAlert,
  Lock,
  Sun,
  Moon,
  ContactRound,
  CalendarCheck,
  Route,
  RefreshCw,
  Link2,
  Languages
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSidebar } from '../contexts/SidebarContext';
import { cn, getDisplayName } from '../lib/utils';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { motion } from 'motion/react';
import AppTooltip from './AppTooltip';
import { useTranslation } from 'react-i18next';

const navItems = [
  { icon: BarChart3, labelKey: 'sidebar.dashboard', path: '/app/dashboard', minRole: 'USER' as const },
  { icon: MessageSquare, labelKey: 'sidebar.inbox', path: '/app/inbox', minRole: 'USER' as const },
  { icon: LayoutGrid, labelKey: 'sidebar.crmPipeline', path: '/app/crm', minRole: 'USER' as const },
  { icon: ContactRound, labelKey: 'sidebar.contacts', path: '/app/contacts', minRole: 'USER' as const },
  { icon: CalendarCheck, labelKey: 'sidebar.appointments', path: '/app/appointments', minRole: 'USER' as const },
  { icon: Send, labelKey: 'sidebar.compose', path: '/app/compose', minRole: 'USER' as const },
  { icon: Radio, labelKey: 'sidebar.broadcast', path: '/app/broadcast', minRole: 'ADMIN' as const },
  { icon: FileText, labelKey: 'sidebar.templates', path: '/app/templates', minRole: 'ADMIN' as const },
  { icon: Bot, labelKey: 'sidebar.aiChatbots', path: '/app/chatbots', minRole: 'ADMIN' as const },
  { icon: Link2, labelKey: 'sidebar.campaigns', path: '/app/campaigns', minRole: 'ADMIN' as const },
  { icon: Route, labelKey: 'sidebar.autoAssign', path: '/app/auto-assign', minRole: 'ADMIN' as const },
  { icon: RefreshCw, labelKey: 'sidebar.followUps', path: '/app/follow-ups', minRole: 'ADMIN' as const },
  { icon: Zap, labelKey: 'sidebar.integrations', path: '/app/integrations', minRole: 'ADMIN' as const },
  { icon: Hash, labelKey: 'sidebar.channels', path: '/app/channels', minRole: 'ADMIN' as const },
];

const roleLevel: Record<string, number> = { USER: 1, ADMIN: 2, OWNER: 3 };

export default function Sidebar() {
  const location = useLocation();
  const { user, workspaces, activeWorkspace, setActiveWorkspace, logout, hasFullAccess, isSuperadmin, workspaceRole } = useApp();
  const { theme, toggleTheme } = useTheme();
  const { isOpen, close } = useSidebar();
  const { t, i18n } = useTranslation();
  const displayName = getDisplayName(user?.name, user?.email);
  const userRoleLevel = roleLevel[workspaceRole] || 1;
  const isRtl = i18n.language === 'ar';
  const toggleLanguage = () => i18n.changeLanguage(isRtl ? 'en' : 'ar');
  const visibleNavItems = isSuperadmin
    ? [{ icon: ShieldAlert, labelKey: 'sidebar.superadmin', path: '/app/superadmin', minRole: 'USER' as const }]
    : navItems.filter(item => userRoleLevel >= (roleLevel[item.minRole] || 1));

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={close}
        />
      )}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-16 bg-white dark:bg-slate-900 border-r border-gray-200 dark:border-slate-800 flex flex-col items-center py-4 h-screen transition-all duration-300",
        "md:relative md:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
      <div className="mb-4">
        <div className="w-9 h-9 bg-[#25D366] rounded-xl flex items-center justify-center text-white font-bold text-lg">
          T
        </div>
      </div>

      <nav className="flex-1 flex flex-col gap-1 overflow-y-auto overflow-x-hidden scrollbar-hide min-h-0">
        {visibleNavItems.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          const isLocked = !isSuperadmin && !hasFullAccess && item.path !== '/app/inbox';
          const label = t(item.labelKey);
          return (
            <div key={item.path}>
              <AppTooltip content={isLocked ? t('sidebar.lockedUntilSubscription', { label }) : label}>
                <Link
                  to={isLocked ? '/app/settings/billing/plans' : item.path}
                  onClick={close}
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center transition-all relative",
                    isActive
                      ? "bg-[#25D366]/10 text-[#25D366]"
                      : "text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-600 dark:hover:text-gray-300",
                    isLocked && "opacity-60"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {isLocked && <Lock className="absolute -right-0.5 -top-0.5 w-3.5 h-3.5 text-amber-500 bg-white rounded-full p-[1px]" />}
                </Link>
              </AppTooltip>
            </div>
          );
        })}

      </nav>

      <div className="mt-auto flex flex-col gap-1 pt-2 border-t border-gray-200 dark:border-slate-800">
        <AppTooltip content={isRtl ? 'English' : 'العربية'}>
          <button
            onClick={toggleLanguage}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-600 dark:hover:text-gray-300 transition-all text-xs font-bold"
          >
            {isRtl ? 'EN' : 'ع'}
          </button>
        </AppTooltip>

        <AppTooltip content={theme === 'light' ? t('sidebar.darkMode') : t('sidebar.lightMode')}>
          <button
            onClick={toggleTheme}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-600 dark:hover:text-gray-300 transition-all"
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>
        </AppTooltip>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <div>
              <AppTooltip content={t('sidebar.accountMenu')}>
                <button className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors overflow-hidden text-sm">
                  {displayName[0] || 'U'}
                </button>
              </AppTooltip>
            </div>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content 
              className="min-w-[240px] bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-gray-200 dark:border-slate-800 p-2 z-50 animate-in fade-in zoom-in-95"
              side={isRtl ? 'left' : 'right'}
              align="end"
              sideOffset={10}
            >
              <div className="px-3 py-2 border-bottom border-gray-50 dark:border-slate-800 mb-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{displayName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
              </div>

              {!isSuperadmin && (
                <>
                  <DropdownMenu.Label className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    {t('sidebar.workspaces')}
                  </DropdownMenu.Label>
                  
                  {workspaces.map((ws) => (
                    <DropdownMenu.Item 
                      key={ws.id}
                      onClick={() => setActiveWorkspace(ws)}
                      className={cn(
                        "flex items-center justify-between px-3 py-2 text-sm rounded-lg cursor-pointer outline-none transition-colors",
                        activeWorkspace?.id === ws.id ? "bg-[#25D366]/10 text-[#25D366]" : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800"
                      )}
                    >
                      {ws.name}
                      {activeWorkspace?.id === ws.id && <ChevronRight className="w-4 h-4" />}
                    </DropdownMenu.Item>
                  ))}

                  <DropdownMenu.Item asChild>
                    <Link to="/app/inbox" className="flex items-center gap-2 px-3 py-2 text-sm text-[#25D366] font-medium rounded-lg cursor-pointer outline-none hover:bg-[#25D366]/5 transition-colors">
                      <Plus className="w-4 h-4" />
                      {t('sidebar.newWorkspace')}
                    </Link>
                  </DropdownMenu.Item>

                  <DropdownMenu.Separator className="h-px bg-gray-100 dark:bg-slate-800 my-1" />
                </>
              )}

              {!isSuperadmin && (
                <DropdownMenu.Item asChild>
                  <Link to="/app/settings/personal" className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 rounded-lg cursor-pointer outline-none hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                    <Settings className="w-4 h-4" />
                    {t('common.settings')}
                  </Link>
                </DropdownMenu.Item>
              )}

              {!isSuperadmin && userRoleLevel >= roleLevel.ADMIN && (
                <DropdownMenu.Item asChild>
                  <Link to="/app/team" className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 rounded-lg cursor-pointer outline-none hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                    <Users className="w-4 h-4" />
                    {t('sidebar.team')}
                  </Link>
                </DropdownMenu.Item>
              )}

              {!isSuperadmin && (
                <DropdownMenu.Item asChild>
                  <Link to="/app/switch-account" className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 rounded-lg cursor-pointer outline-none hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                    <UserCircle className="w-4 h-4" />
                    {t('sidebar.switchAccount')}
                  </Link>
                </DropdownMenu.Item>
              )}

              {!isSuperadmin && <DropdownMenu.Separator className="h-px bg-gray-100 dark:bg-slate-800 my-1" />}

              {!isSuperadmin && (
                <DropdownMenu.Item asChild>
                  <Link to="/app/web-chat-widget" className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 rounded-lg cursor-pointer outline-none hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                    <MessageCircle className="w-4 h-4" />
                    {t('sidebar.webChatWidget')}
                  </Link>
                </DropdownMenu.Item>
              )}

              {!isSuperadmin && (
                <DropdownMenu.Item asChild>
                  <Link to="/app/feature-request" className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 rounded-lg cursor-pointer outline-none hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                    <Lightbulb className="w-4 h-4" />
                    {t('sidebar.featureRequest')}
                  </Link>
                </DropdownMenu.Item>
              )}

              {!isSuperadmin && (
                <DropdownMenu.Item asChild>
                  <Link to="/app/report-issue" className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 rounded-lg cursor-pointer outline-none hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                    <AlertCircle className="w-4 h-4" />
                    {t('sidebar.reportIssue')}
                  </Link>
                </DropdownMenu.Item>
              )}

              <DropdownMenu.Separator className="h-px bg-gray-100 dark:bg-slate-800 my-1" />

              <div className="px-3 py-2 text-[10px] text-gray-400 text-center">
                <p>© {new Date().getFullYear()} Tawasel App</p>
                <p>Created by <a href="https://tawasel.io" target="_blank" rel="noopener noreferrer" className="text-[#25D366] hover:underline">tawasel.io</a></p>
              </div>

              <DropdownMenu.Separator className="h-px bg-gray-100 dark:bg-slate-800 my-1" />

              <DropdownMenu.Item 
                onClick={logout}
                className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 rounded-lg cursor-pointer outline-none hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                {t('common.logout')}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </div>
    </>
  );
}
