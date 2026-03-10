import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { 
  MessageSquare, 
  Send, 
  Radio, 
  FileText, 
  Bot, 
  Zap, 
  Hash, 
  LayoutGrid,
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
  Sun,
  Moon
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../lib/utils';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { motion } from 'motion/react';

const navItems = [
  { icon: MessageSquare, label: 'Inbox', path: '/app/inbox' },
  { icon: LayoutGrid, label: 'CRM Pipeline', path: '/app/crm' },
  { icon: Send, label: 'Compose', path: '/app/compose' },
  { icon: Radio, label: 'Broadcast', path: '/app/broadcast' },
  { icon: FileText, label: 'Templates', path: '/app/templates' },
  { icon: Bot, label: 'AI Chatbots', path: '/app/chatbots' },
  { icon: Zap, label: 'Integrations', path: '/app/integrations' },
  { icon: Hash, label: 'Channels', path: '/app/channels' },
];

export default function Sidebar() {
  const location = useLocation();
  const { user, workspaces, activeWorkspace, setActiveWorkspace, setUser } = useApp();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="w-20 bg-white dark:bg-slate-900 border-r border-gray-100 dark:border-slate-800 flex flex-col items-center py-6 h-screen sticky top-0 transition-colors">
      <div className="mb-8">
        <div className="w-10 h-10 bg-[#25D366] rounded-xl flex items-center justify-center text-white font-bold text-xl">
          O
        </div>
      </div>

      <nav className="flex-1 flex flex-col gap-4">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center transition-all group relative",
                isActive 
                  ? "bg-[#25D366]/10 text-[#25D366]" 
                  : "text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-600 dark:hover:text-gray-300"
              )}
            >
              <item.icon className="w-6 h-6" />
              <div className="absolute left-full ml-4 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                {item.label}
              </div>
            </Link>
          );
        })}

        {user?.email === 'ameeneidha@gmail.com' && (
          <Link
            to="/app/superadmin"
            className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center transition-all group relative",
              location.pathname.startsWith('/app/superadmin') 
                ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400" 
                : "text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-600 dark:hover:text-red-400"
            )}
          >
            <ShieldAlert className="w-6 h-6" />
            <div className="absolute left-full ml-4 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
              Superadmin
            </div>
          </Link>
        )}
      </nav>

      <div className="mt-auto flex flex-col gap-4">
        <button 
          onClick={toggleTheme}
          className="w-12 h-12 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-600 dark:hover:text-gray-300 transition-all group relative"
        >
          {theme === 'light' ? <Moon className="w-6 h-6" /> : <Sun className="w-6 h-6" />}
          <div className="absolute left-full ml-4 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
            {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
          </div>
        </button>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors overflow-hidden">
              {user?.name?.[0] || 'U'}
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content 
              className="min-w-[240px] bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-gray-100 dark:border-slate-800 p-2 z-50 animate-in fade-in zoom-in-95"
              side="right"
              align="end"
              sideOffset={10}
            >
              <div className="px-3 py-2 border-bottom border-gray-50 dark:border-slate-800 mb-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
              </div>

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

              <DropdownMenu.Item asChild>
                <Link to="/app/settings/personal" className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 rounded-lg cursor-pointer outline-none hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                  <Settings className="w-4 h-4" />
                  Settings
                </Link>
              </DropdownMenu.Item>

              <DropdownMenu.Item asChild>
                <Link to="/app/team" className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 rounded-lg cursor-pointer outline-none hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                  <Users className="w-4 h-4" />
                  Team
                </Link>
              </DropdownMenu.Item>

              <DropdownMenu.Item asChild>
                <Link to="/app/switch-account" className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 rounded-lg cursor-pointer outline-none hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                  <UserCircle className="w-4 h-4" />
                  Switch Account
                </Link>
              </DropdownMenu.Item>

              <DropdownMenu.Separator className="h-px bg-gray-100 dark:bg-slate-800 my-1" />

              <DropdownMenu.Item asChild>
                <Link to="/app/web-chat-widget" className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 rounded-lg cursor-pointer outline-none hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                  <MessageCircle className="w-4 h-4" />
                  Web Chat Widget
                </Link>
              </DropdownMenu.Item>

              <DropdownMenu.Item asChild>
                <Link to="/app/feature-request" className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 rounded-lg cursor-pointer outline-none hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                  <Lightbulb className="w-4 h-4" />
                  Feature Request
                </Link>
              </DropdownMenu.Item>

              <DropdownMenu.Item asChild>
                <Link to="/app/report-issue" className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 rounded-lg cursor-pointer outline-none hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                  <AlertCircle className="w-4 h-4" />
                  Report Issue
                </Link>
              </DropdownMenu.Item>

              <DropdownMenu.Separator className="h-px bg-gray-100 dark:bg-slate-800 my-1" />

              <DropdownMenu.Item 
                onClick={() => setUser(null)}
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
