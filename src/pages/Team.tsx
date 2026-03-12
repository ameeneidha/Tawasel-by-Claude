import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useApp } from '../contexts/AppContext';
import { PLANS, PlanType } from '../constants/plans';
import {
  Plus,
  Search,
  Shield,
  Clock,
  Loader2,
  ShieldCheck,
  X,
  PencilLine,
  Trash2,
} from 'lucide-react';
import { cn, getDisplayName } from '../lib/utils';
import { toast } from 'sonner';

type TeamRole = 'OWNER' | 'ADMIN' | 'USER';

interface TeamMember {
  id: string;
  role: TeamRole;
  status: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

const INITIAL_INVITE_FORM = {
  name: '',
  email: '',
  password: '',
  role: 'USER' as Exclude<TeamRole, 'OWNER'>,
};

export default function Team() {
  const { activeWorkspace, user } = useApp();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState(INITIAL_INVITE_FORM);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    role: 'USER' as Exclude<TeamRole, 'OWNER'>,
    status: 'ACTIVE',
  });
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  const currentPlan = (activeWorkspace?.plan || 'STARTER') as PlanType;
  const planInfo = PLANS[currentPlan];
  const limitReached = members.length >= planInfo.userLimit;
  const currentMembership = members.find((member) => member.user.id === user?.id) || null;
  const canInviteMembers = ['OWNER', 'ADMIN'].includes(currentMembership?.role || '');

  useEffect(() => {
    if (activeWorkspace) {
      fetchTeam();
    } else {
      setIsLoading(false);
    }
  }, [activeWorkspace]);

  const filteredMembers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return members;
    }

    return members.filter((member) =>
      getDisplayName(member.user.name, member.user.email).toLowerCase().includes(query) ||
      member.user.email?.toLowerCase().includes(query)
    );
  }, [members, searchQuery]);

  const fetchTeam = async () => {
    try {
      const res = await axios.get(`/api/team?workspaceId=${activeWorkspace?.id}`);
      const data = Array.isArray(res.data) ? res.data : [];
      setMembers(data);
    } catch (error) {
      console.error('Failed to fetch team', error);
      toast.error('Could not load team members');
    } finally {
      setIsLoading(false);
    }
  };

  const openInviteModal = () => {
    if (!canInviteMembers) {
      toast.error('Only owners and admins can add members');
      return;
    }

    if (limitReached) {
      toast.error(`User limit reached for ${planInfo.name} plan`);
      return;
    }

    setInviteForm(INITIAL_INVITE_FORM);
    setIsInviteOpen(true);
  };

  const handleInviteMember = async () => {
    if (!activeWorkspace?.id) {
      toast.error('No active workspace selected');
      return;
    }

    if (!inviteForm.name.trim() || !inviteForm.email.trim() || !inviteForm.password.trim()) {
      toast.error('Fill in name, email, and password');
      return;
    }

    setIsSubmittingInvite(true);
    try {
      const res = await axios.post('/api/team', {
        workspaceId: activeWorkspace.id,
        name: inviteForm.name.trim(),
        email: inviteForm.email.trim(),
        password: inviteForm.password,
        role: inviteForm.role,
      });

      setMembers((prev) => [...prev, res.data]);
      setIsInviteOpen(false);
      setInviteForm(INITIAL_INVITE_FORM);
      toast.success('Team member added');
    } catch (error) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.error || 'Could not add team member');
      } else {
        toast.error('Could not add team member');
      }
    } finally {
      setIsSubmittingInvite(false);
    }
  };

  const canManageMember = (member: TeamMember) => {
    if (!currentMembership || !user?.id) {
      return false;
    }

    if (currentMembership.role !== 'OWNER') {
      return false;
    }

    if (member.user.id === user.id) {
      return false;
    }

    if (member.role === 'OWNER') {
      return false;
    }

    return true;
  };

  const openEditModal = (member: TeamMember) => {
    if (!canManageMember(member)) {
      toast.error('You cannot edit this team member');
      return;
    }

    setEditingMember(member);
    setEditForm({
      name: getDisplayName(member.user.name, member.user.email),
      role: (member.role === 'OWNER' ? 'USER' : member.role) as Exclude<TeamRole, 'OWNER'>,
      status: member.status || 'ACTIVE',
    });
  };

  const handleUpdateMember = async () => {
    if (!editingMember || !activeWorkspace?.id) {
      toast.error('No member selected');
      return;
    }

    if (!editForm.name.trim()) {
      toast.error('Name is required');
      return;
    }

    setIsSavingEdit(true);
    try {
      const res = await axios.patch(`/api/team/${editingMember.id}`, {
        workspaceId: activeWorkspace.id,
        name: editForm.name.trim(),
        role: editForm.role,
        status: editForm.status,
      });

      setMembers((prev) =>
        prev.map((member) => (member.id === editingMember.id ? res.data : member))
      );
      setEditingMember(null);
      toast.success('Team member updated');
    } catch (error) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.error || 'Could not update team member');
      } else {
        toast.error('Could not update team member');
      }
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleRemoveMember = async (member: TeamMember) => {
    if (!activeWorkspace?.id) {
      toast.error('No active workspace selected');
      return;
    }

    if (!canManageMember(member)) {
      toast.error('You cannot remove this team member');
      return;
    }

    const confirmed = window.confirm(`Remove ${getDisplayName(member.user.name, member.user.email)} from this workspace?`);
    if (!confirmed) {
      return;
    }

    setRemovingMemberId(member.id);
    try {
      await axios.delete(`/api/team/${member.id}`, {
        data: { workspaceId: activeWorkspace.id },
      });

      setMembers((prev) => prev.filter((item) => item.id !== member.id));
      toast.success('Team member removed');
    } catch (error) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.error || 'Could not remove team member');
      } else {
        toast.error('Could not remove team member');
      }
    } finally {
      setRemovingMemberId(null);
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
              disabled={limitReached || !canInviteMembers}
              onClick={openInviteModal}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-white font-medium rounded-xl transition-all shadow-sm',
                limitReached || !canInviteMembers ? 'bg-gray-300 dark:bg-slate-800 cursor-not-allowed' : 'bg-[#25D366] hover:bg-[#128C7E]'
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
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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
                ) : filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center text-sm text-gray-500 dark:text-gray-400">
                      No team members match your search.
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((member) => (
                    <tr key={member.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 font-medium">
                            {getDisplayName(member.user.name, member.user.email)[0] || 'U'}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{getDisplayName(member.user.name, member.user.email)}</p>
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
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider',
                            member.status === 'ACTIVE'
                              ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                              : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                          )}
                        >
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
                        {canManageMember(member) ? (
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(member)}
                              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 dark:border-slate-700 dark:text-gray-300 dark:hover:bg-slate-800"
                            >
                              <PencilLine className="h-3.5 w-3.5" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(member)}
                              disabled={removingMemberId === member.id}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/40 dark:hover:bg-red-900/20"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              {removingMemberId === member.id ? 'Removing...' : 'Remove'}
                            </button>
                          </div>
                        ) : (
                          <div className="text-xs text-gray-400 dark:text-gray-500">
                            {member.role === 'OWNER'
                              ? 'Protected'
                              : member.user.id === user?.id
                                ? 'Self'
                                : 'Owner only'}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isInviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-gray-100 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5 dark:border-slate-800">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Invite Team Member</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Add a teammate directly to this workspace.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsInviteOpen(false)}
                className="rounded-xl p-2 text-gray-400 transition hover:bg-gray-50 hover:text-gray-600 dark:hover:bg-slate-800 dark:hover:text-gray-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 px-6 py-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Full Name</label>
                  <input
                    type="text"
                    value={inviteForm.name}
                    onChange={(e) => setInviteForm((prev) => ({ ...prev, name: e.target.value }))}
                    autoComplete="off"
                    name="invite-member-name"
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#25D366]/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    placeholder="Team member name"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Role</label>
                  <select
                    value={inviteForm.role}
                    onChange={(e) => setInviteForm((prev) => ({ ...prev, role: e.target.value as Exclude<TeamRole, 'OWNER'> }))}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#25D366]/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  >
                    <option value="USER">User</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Email</label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm((prev) => ({ ...prev, email: e.target.value }))}
                  autoComplete="off"
                  name="invite-member-email"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#25D366]/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  placeholder="member@example.com"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Password</label>
                <input
                  type="password"
                  value={inviteForm.password}
                  onChange={(e) => setInviteForm((prev) => ({ ...prev, password: e.target.value }))}
                  autoComplete="new-password"
                  name="invite-member-password"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#25D366]/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  placeholder="At least 6 characters"
                />
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  If this email already has an account, the existing password stays unchanged.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-gray-100 px-6 py-5 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsInviteOpen(false)}
                className="rounded-xl px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleInviteMember}
                disabled={isSubmittingInvite}
                className="rounded-xl bg-[#25D366] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#128C7E] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmittingInvite ? 'Adding...' : 'Add Member'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-gray-100 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5 dark:border-slate-800">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Edit Team Member</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Update workspace access for {getDisplayName(editingMember.user.name, editingMember.user.email)}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingMember(null)}
                className="rounded-xl p-2 text-gray-400 transition hover:bg-gray-50 hover:text-gray-600 dark:hover:bg-slate-800 dark:hover:text-gray-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 px-6 py-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Full Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                  autoComplete="off"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#25D366]/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Email</label>
                <input
                  type="email"
                  value={editingMember.user.email}
                  disabled
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-gray-400"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Role</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, role: e.target.value as Exclude<TeamRole, 'OWNER'> }))}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#25D366]/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  >
                    <option value="USER">User</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#25D366]/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-gray-100 px-6 py-5 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEditingMember(null)}
                className="rounded-xl px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateMember}
                disabled={isSavingEdit}
                className="rounded-xl bg-[#25D366] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#128C7E] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSavingEdit ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
