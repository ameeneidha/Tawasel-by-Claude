import { useState, useEffect } from 'react';
import axios from 'axios';
import { useApp } from '../contexts/AppContext';
import { 
  Users, 
  Plus, 
  Search, 
  Mail, 
  Shield, 
  MoreVertical, 
  Clock,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export default function Team() {
  const { activeWorkspace } = useApp();
  const [members, setMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
    <div className="h-full bg-[#F8F9FA] p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Team Members</h1>
            <p className="text-gray-500 mt-1">Manage your team and their access levels.</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white font-medium rounded-xl hover:bg-[#128C7E] transition-all shadow-sm">
            <Plus className="w-5 h-5" />
            Invite Member
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search by name or email..."
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#25D366]/10"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Member</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Activity</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center">
                      <Loader2 className="w-8 h-8 text-[#25D366] animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : (
                  members.map((member) => (
                    <tr key={member.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 font-medium">
                            {member.user.name?.[0] || 'U'}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{member.user.name}</p>
                            <p className="text-xs text-gray-500">{member.user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-gray-400" />
                          <span className="text-xs font-medium text-gray-700">{member.role}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                          member.status === 'ACTIVE' ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"
                        )}>
                          {member.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Clock className="w-3.5 h-3.5" />
                          Last seen 2h ago
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
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
