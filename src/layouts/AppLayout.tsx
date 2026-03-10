import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useApp } from '../contexts/AppContext';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useState } from 'react';

export default function AppLayout() {
  const { user, isLoading, verifyEmail } = useApp();
  const [isVerifying, setIsVerifying] = useState(false);

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#F8F9FA] dark:bg-slate-950 transition-colors">
        <div className="w-12 h-12 border-4 border-[#25D366]/20 border-t-[#25D366] rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      await verifyEmail();
    } catch (err) {
      console.error(err);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#F8F9FA] dark:bg-slate-950 overflow-hidden transition-colors">
      <Sidebar />
      <main className="flex-1 overflow-hidden relative flex flex-col">
        {!user.emailVerified && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-900/30 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm font-medium">
              <AlertCircle className="w-4 h-4" />
              <span>Please verify your email address to access all features.</span>
            </div>
            <button
              onClick={handleVerify}
              disabled={isVerifying}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {isVerifying ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
              Verify Now
            </button>
          </div>
        )}
        <div className="flex-1 overflow-hidden relative">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
