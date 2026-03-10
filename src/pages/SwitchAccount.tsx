import React from 'react';
import { motion } from 'motion/react';
import { User, Shield, LogOut, ChevronRight } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { cn } from '../lib/utils';

export default function SwitchAccount() {
  const { user, setUser } = useApp();

  const accounts = [
    { id: '1', name: 'Ameen Eidha', email: 'ameeneidha@gmail.com', role: 'Owner', current: true },
    { id: '2', name: 'Ameen (Work)', email: 'ameen@company.com', role: 'Admin', current: false },
    { id: '3', name: 'Marketing Team', email: 'marketing@company.com', role: 'Member', current: false },
  ];

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Switch Account</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Manage and switch between your connected accounts.</p>
      </div>

      <div className="space-y-4">
        {accounts.map((account) => (
          <motion.div
            key={account.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group",
              account.current 
                ? "bg-[#25D366]/5 dark:bg-[#25D366]/10 border-[#25D366]/20 ring-1 ring-[#25D366]/20" 
                : "bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800 hover:border-gray-200 dark:hover:border-slate-700 hover:shadow-sm"
            )}
          >
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center font-semibold text-lg",
                account.current ? "bg-[#25D366] text-white" : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400"
              )}>
                {account.name[0]}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-gray-900 dark:text-white">{account.name}</h3>
                  {account.current && (
                    <span className="px-2 py-0.5 bg-[#25D366]/10 text-[#25D366] text-[10px] font-bold uppercase tracking-wider rounded-full">
                      Current
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{account.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">{account.role}</p>
              </div>
              {!account.current && (
                <ChevronRight className="w-5 h-5 text-gray-300 dark:text-gray-600 group-hover:text-gray-400 dark:group-hover:text-gray-400 transition-colors" />
              )}
            </div>
          </motion.div>
        ))}

        <button className="w-full p-4 rounded-2xl border border-dashed border-gray-200 dark:border-slate-800 text-gray-500 dark:text-gray-400 hover:border-[#25D366] hover:text-[#25D366] hover:bg-[#25D366]/5 dark:hover:bg-[#25D366]/10 transition-all flex items-center justify-center gap-2 font-medium">
          <Shield className="w-5 h-5" />
          Add another account
        </button>

        <div className="pt-8 border-t border-gray-100 dark:border-slate-800 mt-8">
          <button 
            onClick={() => setUser(null)}
            className="flex items-center gap-2 text-red-600 hover:text-red-700 font-medium transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sign out of all accounts
          </button>
        </div>
      </div>
    </div>
  );
}
