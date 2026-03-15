import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Shield, LogOut, ChevronRight, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useApp } from '../contexts/AppContext';
import { cn } from '../lib/utils';

export default function SwitchAccount() {
  const navigate = useNavigate();
  const { user, connectedAccounts, switchAccount, signOutAllAccounts } = useApp();
  const [isSwitchingId, setIsSwitchingId] = useState<string | null>(null);

  const accounts = useMemo(
    () =>
      connectedAccounts.map((account) => ({
        ...account,
        current: account.id === user?.id,
      })),
    [connectedAccounts, user?.id]
  );

  const handleSwitch = async (accountId: string) => {
    if (accountId === user?.id) return;
    setIsSwitchingId(accountId);
    try {
      await switchAccount(accountId);
      toast.success('Account switched');
      navigate('/app/dashboard', { replace: true });
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Could not switch to that account');
    } finally {
      setIsSwitchingId(null);
    }
  };

  const handleAddAccount = () => {
    navigate('/login?addAccount=1');
  };

  const handleSignOutAll = () => {
    signOutAllAccounts();
    navigate('/login', { replace: true });
  };

  return (
    <div className="mx-auto max-w-2xl p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Switch Account</h1>
        <p className="mt-1 text-gray-500 dark:text-gray-400">Manage and switch between your connected accounts.</p>
      </div>

      <div className="space-y-4">
        {accounts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500 dark:border-slate-800 dark:bg-slate-900 dark:text-gray-400">
            No saved accounts yet. Add another account to keep multiple workspaces signed in on this device.
          </div>
        ) : (
          accounts.map((account) => {
            const isSwitching = isSwitchingId === account.id;
            return (
              <motion.button
                key={account.id}
                type="button"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => handleSwitch(account.id)}
                disabled={account.current || isSwitching}
                className={cn(
                  'w-full rounded-2xl border p-4 transition-all flex items-center justify-between group text-left disabled:cursor-default',
                  account.current
                    ? 'bg-[#25D366]/5 dark:bg-[#25D366]/10 border-[#25D366]/20 ring-1 ring-[#25D366]/20'
                    : 'bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800 hover:border-gray-200 dark:hover:border-slate-700 hover:shadow-sm'
                )}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      'flex h-12 w-12 items-center justify-center rounded-xl font-semibold text-lg',
                      account.current
                        ? 'bg-[#25D366] text-white'
                        : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400'
                    )}
                  >
                    {(account.name || account.email)[0]?.toUpperCase() || 'A'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900 dark:text-white">{account.name}</h3>
                      {account.current ? (
                        <span className="rounded-full bg-[#25D366]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#25D366]">
                          Current
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{account.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="hidden text-right sm:block">
                    <p className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                      {account.emailVerified ? 'Verified' : 'Pending'}
                    </p>
                  </div>
                  {isSwitching ? (
                    <Loader2 className="h-5 w-5 animate-spin text-[#25D366]" />
                  ) : !account.current ? (
                    <ChevronRight className="h-5 w-5 text-gray-300 transition-colors group-hover:text-gray-400 dark:text-gray-600 dark:group-hover:text-gray-400" />
                  ) : null}
                </div>
              </motion.button>
            );
          })
        )}

        <button
          type="button"
          onClick={handleAddAccount}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-200 p-4 font-medium text-gray-500 transition-all hover:border-[#25D366] hover:bg-[#25D366]/5 hover:text-[#25D366] dark:border-slate-800 dark:text-gray-400 dark:hover:bg-[#25D366]/10"
        >
          <Shield className="h-5 w-5" />
          Add another account
        </button>

        <div className="mt-8 border-t border-gray-100 pt-8 dark:border-slate-800">
          <button
            type="button"
            onClick={handleSignOutAll}
            className="flex items-center gap-2 font-medium text-red-600 transition-colors hover:text-red-700"
          >
            <LogOut className="h-5 w-5" />
            Sign out of all accounts
          </button>
        </div>
      </div>
    </div>
  );
}
