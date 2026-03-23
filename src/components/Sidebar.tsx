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
  CalendarCheck
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useTheme } from '../contexts/ThemeContext';
import { cn, getDisplayName } from '../lib/utils';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { motion } from 'motion/react';
import AppTooltip from './AppTooltip';

const navItems = [
  { icon: BarChart3, label: 'Dashboard', path: '/app/dashboard' },
  { icon: MessageSquare, label: 'Inbox', path: '/app/inbox' },
  { icon: LayoutGrid, label: 'CRM Pipeline', path: '/app/crm' },
  { icon: ContactRound, label: 'Contacts', path: '/app/contacts' },
  { icon: CalendarCheck, label: 'Appointments', path: '/app/appointments' },
  { icon: Send, label: 'Compose', path: '/app/compose' },
  { icon: Radio, label: 'Broadcast', path: '/app/broadcast' },
  { icon: FileText, label: 'Templates', path: '/app/templates' },
  { icon: Bot, label: 'AI Chatbots', path: '/app/chatbots' },
  { icon: Zap, label: 'Integrations', path: '/app/integrations' },
  { icon: Hash, label: 'Channels', path: '/app/channels' },
];

export default function Sidebar() {
  const location = useLocation();
  const { user, workspaces, activeWorkspace, setActiveWorkspace, logout, hasFullAccess, isSuperadmin } = useApp();
  const { theme, toggleTheme } = useTheme();
  const displayName = getDisplayName(user?.name, user?.email);
  const visibleNavItems = isSuperadmin
    ? [{ icon: ShieldAlert, label: 'Superadmin', path: '/app/superadmin' }]
    : navItems;

  return (
    <div className="w-20 bg-white dark:bg-slate-900 border-r border-gray-100 dark:border-slate-800 flex flex-col items-center py-6 h-screen sticky top-0 transition-colors">
      <div className="mb-8">
        <div className="w-10 h-10 bg-[#25D366] rounded-xl flex items-center justify-center text-white font-bold text-xl">
          T
        </div>
      </div>

      <nav className="flex-1 flex flex-col gap-4">
        {visibleNavItems.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          const isLocked = !isSuperadmin && !hasFullAccess && item.path !== '/app/inbox';
          return (
            <div key={item.path}>
              <AppTooltip content={isLocked ? `${item.label} locked until subscription` : item.label}>
                <Link
                  to={isLocked ? '/app/settings/billing/plans' : item.path}
                  className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center transition-all relative",
                    isActive 
                      ? "bg-[#25D366]/10 text-[#25D366]" 
                      : "text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-600 dark:hover:text-gray-300",
                    isLocked && "opacity-60"
                  )}
                >
                  <item.icon className="w-6 h-6" />
                  {isLocked && <Lock className="absolute -right-0.5 -top-0.5 w-3.5 h-3.5 text-amber-500 bg-white rounded-full p-[1px]" />}
                </Link>
              </AppTooltip>
            </div>
          );
        })}

      </nav>

      <div className="mt-auto flex flex-col gap-4">
        <AppTooltip content={theme === 'light' ? 'Dark Mode' : 'Light Mode'}>
          <button 
            onClick={toggleTheme}
            className="w-12 h-12 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-600 dark:hover:text-gray-300 transition-all"
          >
            {theme === 'light' ? <Moon className="w-6 h-6" /> : <Sun className="w-6 h-6" />}
          </button>
        </AppTooltip>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <div>
              <AppTooltip content="Account Menu">
                <button className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors overflow-hidden">
                  {displayName[0] || 'U'}
                </button>
              </AppTooltip>
            </div>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content 
              className="min-w-[240px] bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-gray-100 dark:border-slate-800 p-2 z-50 animate-in fade-in zoom-in-95"
              side="right"
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
                    Workspaces
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
                      New Workspace
                    </Link>
                  </DropdownMenu.Item>

                  <DropdownMenu.Separator className="h-px bg-gray-100 dark:bg-slate-800 my-1" />
                </>
              )}

              {!isSuperadmin && (
                <DropdownMenu.Item asChild>
                  <Link to="/app/settings/personal" className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 rounded-lg cursor-pointer outline-none hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                    <Settings className="w-4 h-4" />
                    Settings
                  </Link>
                </DropdownMenu.Item>
              )}

              {!isSuperadmin && (
                <DropdownMenu.Item asChild>
                  <Link to="/app/team" className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 rounded-lg cursor-pointer outline-none hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                    <Users className="w-4 h-4" />
                    Team
                  </Link>
                </DropdownMenu.Item>
              )}

              {!isSuperadmin && (
                <DropdownMenu.Item asChild>
                  <Link to="/app/switch-account" className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 rounded-lg cursor-pointer outline-none hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                    <UserCircle className="w-4 h-4" />
                    Switch Account
                  </Link>
                </DropdownMenu.Item>
              )}

              {!isSuperadmin && <DropdownMenu.Separator className="h-px bg-gray-100 dark:bg-slate-800 my-1" />}

              {!isSuperadmin && (
                <DropdownMenu.Item asChild>
                  <Link to="/app/web-chat-widget" className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 rounded-lg cursor-pointer outline-none hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                    <MessageCircle className="w-4 h-4" />
                    Web Chat Widget
                  </Link>
                </DropdownMenu.Item>
              )}

              {!isSuperadmin && (
                <DropdownMenu.Item asChild>
                  <Link to="/app/feature-request" className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 rounded-lg cursor-pointer outline-none hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                    <Lightbulb className="w-4 h-4" />
                    Feature Request
                  </Link>
                </DropdownMenu.Item>
              )}

              {!isSuperadmin && (
                <DropdownMenu.Item asChild>
                  <Link to="/app/report-issue" className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 rounded-lg cursor-pointer outline-none hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                    <AlertCircle className="w-4 h-4" />
                    Report Issue
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
                Logout
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </div>
  );
}
