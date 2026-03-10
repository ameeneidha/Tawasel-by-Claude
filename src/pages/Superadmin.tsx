import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Users, 
  Building2, 
  MessageSquare, 
  CreditCard, 
  TrendingUp, 
  Activity,
  ShieldAlert,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Loader2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

export default function Superadmin() {
  const [stats, setStats] = useState<any>(null);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    console.log('Superadmin component mounted');
    fetchSuperadminData();
  }, []);

  const fetchSuperadminData = async () => {
    console.log('Fetching superadmin data...');
    setIsLoading(true);
    try {
      const [statsRes, wsRes] = await Promise.all([
        axios.get('/api/superadmin/stats'),
        axios.get('/api/superadmin/workspaces')
      ]);
      console.log('Superadmin data fetched:', { stats: statsRes.data, workspaces: wsRes.data });
      setStats(statsRes.data);
      setWorkspaces(wsRes.data);
    } catch (error) {
      console.error('Failed to fetch superadmin data', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#F8F9FA] dark:bg-slate-950 transition-colors">
        <Loader2 className="w-8 h-8 text-[#25D366] animate-spin" />
      </div>
    );
  }

  const filteredWorkspaces = workspaces.filter(ws => 
    ws.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ws.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full bg-[#F8F9FA] dark:bg-slate-950 p-8 overflow-y-auto relative transition-colors">
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 text-[#25D366] mb-1">
              <ShieldAlert className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-widest">System Administration</span>
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Superadmin Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
              <input 
                type="text"
                placeholder="Search workspaces..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#25D366]/20 w-64 shadow-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 transition-colors"
              />
            </div>
            <button 
              onClick={fetchSuperadminData}
              className="p-2 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 shadow-sm transition-colors"
            >
              <Activity className="w-5 h-5" />
            </button>
            <button 
              onClick={async () => {
                console.log('Repair button clicked');
                try {
                  const res = await axios.post('/api/dev/bootstrap');
                  console.log('Bootstrap response:', res.data);
                  alert("System repaired! User and workspace ensured.");
                  fetchSuperadminData();
                } catch (e) {
                  console.error('Repair error:', e);
                  alert("Repair failed");
                }
              }}
              className="px-4 py-2 bg-[#25D366] text-white text-sm font-bold rounded-xl hover:bg-[#128C7E] transition-all shadow-sm relative z-20 cursor-pointer"
            >
              Repair System
            </button>
            <button 
              onClick={async () => {
                console.log('Seed button clicked');
                const wsId = workspaces[0]?.id;
                const uId = workspaces[0]?.members?.[0]?.userId;
                console.log('Seeding with:', { wsId, uId });
                if (!wsId || !uId) return alert("No workspace/user found to seed into. Make sure you have at least one workspace.");
                try {
                  const res = await axios.post('/api/dev/seed', { workspaceId: wsId, userId: uId });
                  console.log('Seeding response:', res.data);
                  alert("Seeding successful!");
                  fetchSuperadminData();
                } catch (e) {
                  console.error('Seeding error:', e);
                  alert("Seeding failed");
                }
              }}
              className="px-4 py-2 bg-gray-900 dark:bg-slate-800 text-white text-sm font-bold rounded-xl hover:bg-gray-800 dark:hover:bg-slate-700 transition-all shadow-sm relative z-20 cursor-pointer"
            >
              Seed Dev Data
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard 
            icon={Users} 
            label="Total Users" 
            value={stats?.totalUsers || 0} 
            trend="+12%" 
            trendUp={true}
          />
          <StatCard 
            icon={Building2} 
            label="Active Workspaces" 
            value={stats?.totalWorkspaces || 0} 
            trend="+5%" 
            trendUp={true}
          />
          <StatCard 
            icon={MessageSquare} 
            label="Total Messages" 
            value={stats?.totalMessages || 0} 
            trend="+24%" 
            trendUp={true}
          />
          <StatCard 
            icon={CreditCard} 
            label="Total Revenue" 
            value={`$${(stats?.totalRevenue || 0).toLocaleString()}`} 
            trend="+18%" 
            trendUp={true}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Workspace List */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
              <div className="p-6 border-b border-gray-50 dark:border-slate-800 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-white">Recent Workspaces</h3>
                <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">{filteredWorkspaces.length} total</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gray-50/50 dark:bg-slate-800/50">
                      <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Workspace</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Plan</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Users</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Created</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                    {filteredWorkspaces.map((ws) => (
                      <tr key={ws.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gray-100 dark:bg-slate-800 rounded-lg flex items-center justify-center text-gray-600 dark:text-gray-400 font-bold text-xs uppercase">
                              {ws.name[0]}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{ws.name}</p>
                              <p className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">/{ws.slug}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                            ws.plan === 'ENTERPRISE' ? "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400" :
                            ws.plan === 'PRO' ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" : "bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-400"
                          )}>
                            {ws.plan}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                          {ws._count?.members || 0}
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-500 dark:text-gray-500">
                          {format(new Date(ws.createdAt), 'MMM dd, yyyy')}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-600 dark:text-green-400 uppercase">
                            <div className="w-1 h-1 bg-green-600 dark:bg-green-400 rounded-full" />
                            Active
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* System Health / Activity */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-6 transition-colors">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-6">System Health</h3>
              <div className="space-y-6">
                <HealthItem label="API Gateway" status="Operational" />
                <HealthItem label="Database Cluster" status="Operational" />
                <HealthItem label="WhatsApp Webhook" status="Operational" />
                <HealthItem label="AI Inference Engine" status="Operational" />
              </div>
            </div>

            <div className="bg-gray-900 dark:bg-slate-900 rounded-2xl p-6 text-white shadow-lg border dark:border-slate-800 transition-colors">
              <div className="flex items-center gap-3 mb-6">
                <TrendingUp className="w-5 h-5 text-[#25D366]" />
                <h3 className="font-semibold">Growth Insights</h3>
              </div>
              <p className="text-sm text-gray-400 dark:text-gray-400 leading-relaxed mb-6">
                Workspace creation is up <span className="text-[#25D366] font-bold">15%</span> this week. Most new users are coming from the UAE region.
              </p>
              <button className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition-all uppercase tracking-wider">
                View Full Report
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, trend, trendUp }: any) {
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 bg-gray-50 dark:bg-slate-800 rounded-xl text-gray-600 dark:text-gray-400 transition-colors">
          <Icon className="w-5 h-5" />
        </div>
        <div className={cn(
          "flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full",
          trendUp ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400" : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
        )}>
          {trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {trend}
        </div>
      </div>
      <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

function HealthItem({ label, status }: { label: string; status: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase">{status}</span>
        <div className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full animate-pulse" />
      </div>
    </div>
  );
}
