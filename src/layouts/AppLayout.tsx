import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { useApp } from '../contexts/AppContext';

export default function AppLayout() {
  const { user, isLoading } = useApp();

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#F8F9FA]">
        <div className="w-12 h-12 border-4 border-[#25D366]/20 border-t-[#25D366] rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen bg-[#F8F9FA] overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-hidden relative">
        <Outlet />
      </main>
    </div>
  );
}
