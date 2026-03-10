import { useState, useEffect } from 'react';
import axios from 'axios';
import { useApp } from '../contexts/AppContext';
import { PLANS, PlanType } from '../constants/plans';
import { 
  Users, 
  Plus, 
  Search, 
  Mail, 
  Shield, 
  MoreVertical, 
  Clock,
  CheckCircle2,
  Loader2,
  ShieldCheck
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

export default function Team() {
  const { activeWorkspace } = useApp();
  const [members, setMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const currentPlan = (activeWorkspace?.plan || 'STARTER') as PlanType;
  const planInfo = PLANS[currentPlan];
  const limitReached = members.length >= planInfo.userLimit;

  useEffect(() => {
    if (activeWorkspace) {
      fetchTeam();
    } else {
      setIsLoading(false);
    }
  }, [activeWorkspace]);

  const fetchTeam = async () => {
    try {
      const res = await axios.get(`/api/team?workspaceId=${activeWorkspace?.id}`);
      const data = Array.isArray(res.data) ? res.data : [];
      setMembers(data);
    } catch (error) {
      console.error('Failed to fetch team', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full bg-[#F8F9FA] dark:bg-slate-950 p-8 overflow-y-auto transition-colors">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Team Members</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your team and their access levels.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end mr-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#25D366] uppercase tracking-wider bg-[#25D366]/5 px-3 py-1 rounded-full border border-[#25D366]/10">
                <ShieldCheck className="w-3 h-3" />
                {planInfo.name} Plan
              </div>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                Users: {members.length}/{planInfo.userLimit}
              </p>
            </div>
            <button 
              disabled={limitReached}
              onClick={() => limitReached ? toast.error(`User limit reached for ${planInfo.name} plan`) : null}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-white font-medium rounded-xl transition-all shadow-sm",
                limitReached ? "bg-gray-300 dark:bg-slate-800 cursor-not-allowed" : "bg-[#25D366] hover:bg-[#128C7E]"
              )}
            >
              <Plus className="w-5 h-5" />
              Invite Member
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden transition-colors">
          <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-gray-50/50 dark:bg-slate-800/50 transition-colors">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search by name or email..."
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#25D366]/10 transition-colors"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-800">
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Member</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Activity</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-800 transition-colors">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center">
                      <Loader2 className="w-8 h-8 text-[#25D366] animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : (
                  members.map((member) => (
                    <tr key={member.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 font-medium">
                            {member.user.name?.[0] || 'U'}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{member.user.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{member.user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-gray-400" />
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{member.role}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                          member.status === 'ACTIVE' ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400" : "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"
                        )}>
                          {member.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                          <Clock className="w-3.5 h-3.5" />
                          Last seen 2h ago
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg transition-colors">
                          <MoreVertical className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
