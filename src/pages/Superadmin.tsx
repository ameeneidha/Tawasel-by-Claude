import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  AlertTriangle,
  Building2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  ExternalLink,
  Loader2,
  MessageSquare,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { cn } from '../lib/utils';

type SuperadminTab = 'overview' | 'workspaces' | 'users';

type SuperadminStats = {
  totalUsers: number;
  totalWorkspaces: number;
  totalMessages: number;
  totalRevenue: number;
  recentSignups: number;
  activeSubscribers: number;
  suspendedCount: number;
  planBreakdown: Record<string, number>;
};

type WorkspaceMember = {
  id?: string;
  role?: string;
  user?: {
    id: string;
    name?: string | null;
    email: string;
    emailVerified?: boolean;
    createdAt?: string;
  };
};

type WorkspaceCounts = {
  members?: number;
  contacts?: number;
  conversations?: number;
  chatbots?: number;
  campaigns?: number;
  numbers?: number;
  activities?: number;
  tasks?: number;
  messages?: number;
};

type SuperadminWorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  suspended?: boolean;
  subscriptionStatus?: string | null;
  createdAt: string;
  members: WorkspaceMember[];
  _count?: WorkspaceCounts;
};

type TimelineItem = {
  id: string;
  title?: string | null;
  description?: string | null;
  type?: string | null;
  amount?: number | null;
  status?: string | null;
  createdAt: string;
};

type SuperadminWorkspaceDetail = SuperadminWorkspaceSummary & {
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  subscriptionCurrentPeriodEnd?: string | null;
  subscriptionCancelAtPeriodEnd?: boolean;
  counts?: WorkspaceCounts;
  ledgerEntries?: TimelineItem[];
  usageLogs?: TimelineItem[];
  featureRequests?: TimelineItem[];
  issueReports?: TimelineItem[];
};

type SuperadminUser = {
  id: string;
  name?: string | null;
  email: string;
  emailVerified: boolean;
  createdAt: string;
  memberships: Array<{
    id?: string;
    role?: string;
    workspace: {
      id: string;
      name: string;
      plan: string;
    };
  }>;
};

type SuperadminUsersResponse = {
  total: number;
  page: number;
  limit: number;
  users: SuperadminUser[];
};

const tabs: Array<{ id: SuperadminTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'workspaces', label: 'Workspaces' },
  { id: 'users', label: 'Users' },
];

const currencyFormatter = new Intl.NumberFormat('en-AE', {
  style: 'currency',
  currency: 'AED',
  maximumFractionDigits: 0,
});

function formatDate(value?: string | null) {
  if (!value) return '-';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';

  return parsed.toLocaleDateString('en-AE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';

  return parsed.toLocaleString('en-AE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getPlanTone(plan: string) {
  switch (String(plan || '').toUpperCase()) {
    case 'PRO':
      return 'bg-slate-900 text-white';
    case 'GROWTH':
      return 'bg-emerald-100 text-emerald-700';
    case 'STARTER':
      return 'bg-blue-100 text-blue-700';
    case 'NONE':
      return 'bg-amber-100 text-amber-700';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

function getStatusTone(status?: string | null, suspended?: boolean) {
  if (suspended) {
    return 'bg-rose-100 text-rose-700';
  }

  switch (String(status || '').toLowerCase()) {
    case 'active':
    case 'trialing':
      return 'bg-emerald-100 text-emerald-700';
    case 'past_due':
      return 'bg-amber-100 text-amber-700';
    case 'canceled':
    case 'cancelled':
      return 'bg-slate-200 text-slate-700';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

function SuperadminStatCard({
  label,
  value,
  icon,
  helper,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  helper: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <h3 className="mt-3 text-4xl font-bold tracking-tight text-slate-900">{value}</h3>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#25D366]/10 text-[#25D366]">
          {icon}
        </div>
      </div>
      <p className="text-sm text-slate-500">{helper}</p>
    </div>
  );
}

function TimelineSection({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: TimelineItem[] | undefined;
  emptyLabel: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-slate-50/60 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">{title}</h4>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500">
          {items?.length || 0}
        </span>
      </div>
      {items && items.length > 0 ? (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-white bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">
                    {item.title || item.type || item.description || 'Activity'}
                  </p>
                  {item.description ? <p className="mt-1 text-sm text-slate-500">{item.description}</p> : null}
                </div>
                <span className="text-xs font-medium text-slate-400">{formatDateTime(item.createdAt)}</span>
              </div>
              {typeof item.amount === 'number' ? (
                <p className="mt-3 text-sm font-semibold text-emerald-600">{currencyFormatter.format(item.amount)}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-sm text-slate-400">
          {emptyLabel}
        </div>
      )}
    </div>
  );
}

export default function Superadmin() {
  const { user } = useApp();
  const [activeTab, setActiveTab] = useState<SuperadminTab>('overview');
  const [stats, setStats] = useState<SuperadminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [workspaces, setWorkspaces] = useState<SuperadminWorkspaceSummary[]>([]);
  const [workspacesLoading, setWorkspacesLoading] = useState(true);
  const [workspaceQuery, setWorkspaceQuery] = useState('');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [selectedWorkspace, setSelectedWorkspace] = useState<SuperadminWorkspaceDetail | null>(null);
  const [workspaceDetailLoading, setWorkspaceDetailLoading] = useState(false);
  const [users, setUsers] = useState<SuperadminUsersResponse | null>(null);
  const [usersLoading, setUsersLoading] = useState(true);
  const [userQuery, setUserQuery] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadInitial = async () => {
      setError(null);
      try {
        const [statsRes, workspacesRes] = await Promise.all([
          axios.get<SuperadminStats>('/api/superadmin/stats'),
          axios.get<SuperadminWorkspaceSummary[]>('/api/superadmin/workspaces'),
        ]);

        setStats(statsRes.data);
        setWorkspaces(workspacesRes.data);
      } catch (err: any) {
        setError(err?.response?.data?.error || 'Failed to load the superadmin dashboard.');
      } finally {
        setStatsLoading(false);
        setWorkspacesLoading(false);
      }
    };

    loadInitial();
  }, []);

  useEffect(() => {
    const loadUsers = async () => {
      setUsersLoading(true);
      setError(null);
      try {
        const response = await axios.get<SuperadminUsersResponse>('/api/superadmin/users', {
          params: {
            search: userQuery,
            page: userPage,
            limit: 12,
          },
        });
        setUsers(response.data);
      } catch (err: any) {
        setError(err?.response?.data?.error || 'Failed to load users.');
        setUsers({
          total: 0,
          page: 1,
          limit: 12,
          users: [],
        });
      } finally {
        setUsersLoading(false);
      }
    };

    loadUsers();
  }, [userPage, userQuery]);

  const filteredWorkspaces = useMemo(() => {
    const term = workspaceQuery.trim().toLowerCase();
    if (!term) return workspaces;

    return workspaces.filter((workspace) => {
      const memberEmails = workspace.members
        .map((member) => member.user?.email || member.user?.name || '')
        .join(' ')
        .toLowerCase();

      return [workspace.name, workspace.slug, workspace.plan, workspace.subscriptionStatus || '', memberEmails]
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  }, [workspaceQuery, workspaces]);

  const fetchWorkspaceDetail = async (workspaceId: string) => {
    setSelectedWorkspaceId(workspaceId);
    setWorkspaceDetailLoading(true);
    try {
      const response = await axios.get<SuperadminWorkspaceDetail>(`/api/superadmin/workspaces/${workspaceId}`);
      setSelectedWorkspace(response.data);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load workspace details.');
      setSelectedWorkspace(null);
    } finally {
      setWorkspaceDetailLoading(false);
    }
  };

  const closeWorkspacePanel = () => {
    setSelectedWorkspaceId(null);
    setSelectedWorkspace(null);
  };

  const totalUserPages = users ? Math.max(1, Math.ceil(users.total / users.limit)) : 1;
  const planBreakdownEntries = (Object.entries(stats?.planBreakdown || {}) as Array<[string, number]>).sort(
    (a, b) => b[1] - a[1]
  );

  return (
    <div className="h-full overflow-y-auto bg-[#f7f8fa]">
      <div className="mx-auto max-w-[1600px] px-6 py-8 lg:px-10">
        <div className="mb-8 flex flex-col gap-5 rounded-[32px] bg-[linear-gradient(135deg,#111827_0%,#1f2937_55%,#0f172a_100%)] p-8 text-white shadow-[0_20px_60px_rgba(15,23,42,0.22)]">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-white/80">
                <ShieldCheck className="h-4 w-4" />
                Superadmin Mode
              </div>
              <h1 className="text-3xl font-bold tracking-tight lg:text-4xl">Owner Control Panel</h1>
              <p className="mt-3 text-sm leading-6 text-white/70 lg:text-base">
                Monitor subscribers, revenue, workspace health, and growth signals without stepping into the customer-facing app.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Signed in as</p>
              <p className="mt-2 text-lg font-semibold">{user?.name || 'Owner'}</p>
              <p className="text-sm text-white/70">{user?.email || 'ameeneidha@gmail.com'}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'rounded-full px-5 py-2.5 text-sm font-semibold transition',
                  activeTab === tab.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'bg-white/5 text-white/75 hover:bg-white/10 hover:text-white'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {activeTab === 'overview' ? (
          <div className="space-y-6">
            {statsLoading || !stats ? (
              <div className="flex min-h-[280px] items-center justify-center rounded-[32px] border border-slate-100 bg-white">
                <Loader2 className="h-7 w-7 animate-spin text-[#25D366]" />
              </div>
            ) : (
              <>
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                  <SuperadminStatCard
                    label="Subscribers"
                    value={String(stats.activeSubscribers)}
                    icon={<UserCheck className="h-6 w-6" />}
                    helper="Active or trialing workspaces currently paying for access."
                  />
                  <SuperadminStatCard
                    label="Total Revenue"
                    value={currencyFormatter.format(stats.totalRevenue)}
                    icon={<Wallet className="h-6 w-6" />}
                    helper="Total recorded credit ledger amount across paid workspaces."
                  />
                  <SuperadminStatCard
                    label="Workspaces"
                    value={String(stats.totalWorkspaces)}
                    icon={<Building2 className="h-6 w-6" />}
                    helper="Every tenant created in the platform, including unpaid setups."
                  />
                  <SuperadminStatCard
                    label="Messages"
                    value={String(stats.totalMessages)}
                    icon={<MessageSquare className="h-6 w-6" />}
                    helper="Total message records currently stored across all tenants."
                  />
                </div>

                <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-[32px] border border-slate-100 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
                    <div className="mb-6 flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-xl font-bold text-slate-900">Growth Snapshot</h2>
                        <p className="mt-1 text-sm text-slate-500">
                          A quick read on platform growth, plan mix, and accounts that need attention.
                        </p>
                      </div>
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
                        <CreditCard className="h-6 w-6" />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Last 30 Days</p>
                        <p className="mt-3 text-3xl font-bold text-slate-900">{stats.recentSignups}</p>
                        <p className="mt-2 text-sm text-slate-500">New workspace signups in the last 30 days.</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Suspended</p>
                        <p className="mt-3 text-3xl font-bold text-slate-900">{stats.suspendedCount}</p>
                        <p className="mt-2 text-sm text-slate-500">Accounts marked suspended and likely needing review.</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">All Users</p>
                        <p className="mt-3 text-3xl font-bold text-slate-900">{stats.totalUsers}</p>
                        <p className="mt-2 text-sm text-slate-500">Total user records across every workspace membership.</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[32px] border border-slate-100 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
                    <div className="mb-6 flex items-start justify-between">
                      <div>
                        <h2 className="text-xl font-bold text-slate-900">Plan Mix</h2>
                        <p className="mt-1 text-sm text-slate-500">How current workspaces are distributed across packages.</p>
                      </div>
                      <div className="rounded-2xl bg-[#25D366]/10 p-3 text-[#25D366]">
                        <Users className="h-5 w-5" />
                      </div>
                    </div>

                    <div className="space-y-3">
                      {planBreakdownEntries.length > 0 ? (
                        planBreakdownEntries.map(([plan, count]) => {
                          const percentage = stats.totalWorkspaces > 0 ? Math.round((count / stats.totalWorkspaces) * 100) : 0;
                          return (
                            <div key={plan} className="rounded-2xl bg-slate-50 p-4">
                              <div className="mb-2 flex items-center justify-between gap-3">
                                <span className={cn('rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]', getPlanTone(plan))}>
                                  {plan}
                                </span>
                                <span className="text-sm font-semibold text-slate-700">
                                  {count} workspace{count === 1 ? '' : 's'}
                                </span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-white">
                                <div className="h-full rounded-full bg-[#25D366]" style={{ width: `${percentage}%` }} />
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-400">
                          No plan data yet.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : null}

        {activeTab === 'workspaces' ? (
          <div className="rounded-[32px] border border-slate-100 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Workspace Directory</h2>
                <p className="mt-1 text-sm text-slate-500">Inspect subscribers, subscription status, and workspace usage from one place.</p>
              </div>

              <div className="relative w-full max-w-md">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={workspaceQuery}
                  onChange={(event) => setWorkspaceQuery(event.target.value)}
                  placeholder="Search workspace, slug, plan, or member email"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm outline-none transition focus:border-[#25D366] focus:bg-white"
                />
              </div>
            </div>

            {workspacesLoading ? (
              <div className="flex min-h-[300px] items-center justify-center">
                <Loader2 className="h-7 w-7 animate-spin text-[#25D366]" />
              </div>
            ) : (
              <div className="overflow-hidden rounded-3xl border border-slate-100">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50">
                      <tr className="text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        <th className="px-5 py-4">Workspace</th>
                        <th className="px-5 py-4">Plan</th>
                        <th className="px-5 py-4">Status</th>
                        <th className="px-5 py-4">Members</th>
                        <th className="px-5 py-4">Usage</th>
                        <th className="px-5 py-4">Created</th>
                        <th className="px-5 py-4 text-right">Open</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredWorkspaces.length > 0 ? (
                        filteredWorkspaces.map((workspace) => (
                          <tr
                            key={workspace.id}
                            className="cursor-pointer transition hover:bg-slate-50"
                            onClick={() => fetchWorkspaceDetail(workspace.id)}
                          >
                            <td className="px-5 py-4">
                              <div>
                                <p className="font-semibold text-slate-900">{workspace.name}</p>
                                <p className="mt-1 text-sm text-slate-500">{workspace.slug}</p>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <span className={cn('rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]', getPlanTone(workspace.plan))}>
                                {workspace.plan}
                              </span>
                            </td>
                            <td className="px-5 py-4">
                              <span
                                className={cn(
                                  'rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]',
                                  getStatusTone(workspace.subscriptionStatus, workspace.suspended)
                                )}
                              >
                                {workspace.suspended ? 'Suspended' : workspace.subscriptionStatus || 'inactive'}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-sm text-slate-600">
                              {workspace._count?.members ?? workspace.members.length}
                            </td>
                            <td className="px-5 py-4 text-sm text-slate-600">
                              {workspace._count?.conversations ?? 0} chats / {workspace._count?.numbers ?? 0} numbers
                            </td>
                            <td className="px-5 py-4 text-sm text-slate-600">{formatDate(workspace.createdAt)}</td>
                            <td className="px-5 py-4 text-right">
                              <button
                                type="button"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-900 hover:text-white"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  fetchWorkspaceDetail(workspace.id);
                                }}
                              >
                                <ChevronRight className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-400">
                            No workspaces matched your search.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {activeTab === 'users' ? (
          <div className="rounded-[32px] border border-slate-100 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Platform Users</h2>
                <p className="mt-1 text-sm text-slate-500">Find users, confirm verification state, and see which workspaces they belong to.</p>
              </div>

              <div className="relative w-full max-w-md">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={userQuery}
                  onChange={(event) => {
                    setUserQuery(event.target.value);
                    setUserPage(1);
                  }}
                  placeholder="Search by name or email"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm outline-none transition focus:border-[#25D366] focus:bg-white"
                />
              </div>
            </div>

            {usersLoading || !users ? (
              <div className="flex min-h-[280px] items-center justify-center">
                <Loader2 className="h-7 w-7 animate-spin text-[#25D366]" />
              </div>
            ) : (
              <>
                <div className="overflow-hidden rounded-3xl border border-slate-100">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100">
                      <thead className="bg-slate-50">
                        <tr className="text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                          <th className="px-5 py-4">User</th>
                          <th className="px-5 py-4">Verified</th>
                          <th className="px-5 py-4">Workspaces</th>
                          <th className="px-5 py-4">Joined</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {users.users.length > 0 ? (
                          users.users.map((platformUser) => (
                            <tr key={platformUser.id}>
                              <td className="px-5 py-4">
                                <div>
                                  <p className="font-semibold text-slate-900">{platformUser.name || 'Unnamed user'}</p>
                                  <p className="mt-1 text-sm text-slate-500">{platformUser.email}</p>
                                </div>
                              </td>
                              <td className="px-5 py-4">
                                <span
                                  className={cn(
                                    'rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]',
                                    platformUser.emailVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                  )}
                                >
                                  {platformUser.emailVerified ? 'Verified' : 'Pending'}
                                </span>
                              </td>
                              <td className="px-5 py-4">
                                <div className="flex flex-wrap gap-2">
                                  {platformUser.memberships.filter((membership) => membership.workspace).length > 0 ? (
                                    platformUser.memberships.filter((membership) => membership.workspace).map((membership) => (
                                      <span
                                        key={`${platformUser.id}-${membership.workspace.id}`}
                                        className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
                                      >
                                        {membership.workspace.name} · {membership.workspace.plan}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-sm text-slate-400">No workspace membership</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-5 py-4 text-sm text-slate-600">{formatDate(platformUser.createdAt)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="px-5 py-12 text-center text-sm text-slate-400">
                              No users matched your search.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-500">
                    Showing page {users.page} of {totalUserPages} · {users.total} total user{users.total === 1 ? '' : 's'}
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setUserPage((page) => Math.max(1, page - 1))}
                      disabled={users.page <= 1}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => setUserPage((page) => Math.min(totalUserPages, page + 1))}
                      disabled={users.page >= totalUserPages}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>

      {(selectedWorkspaceId || workspaceDetailLoading) && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30 backdrop-blur-[2px]">
          <button type="button" className="h-full flex-1" onClick={closeWorkspacePanel} aria-label="Close workspace panel" />

          <aside className="h-full w-full max-w-2xl overflow-y-auto bg-white shadow-[0_0_40px_rgba(15,23,42,0.2)]">
            <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-6 py-5 backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Workspace Detail</p>
                  <h2 className="mt-2 text-2xl font-bold text-slate-900">
                    {selectedWorkspace?.name || 'Loading workspace...'}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">{selectedWorkspace?.slug || 'Preparing workspace summary'}</p>
                </div>
                <button
                  type="button"
                  onClick={closeWorkspacePanel}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-900 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {workspaceDetailLoading || !selectedWorkspace ? (
              <div className="flex min-h-[320px] items-center justify-center">
                <Loader2 className="h-7 w-7 animate-spin text-[#25D366]" />
              </div>
            ) : (
              <div className="space-y-6 px-6 py-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Plan</p>
                    <div className="mt-3 flex items-center gap-3">
                      <span className={cn('rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]', getPlanTone(selectedWorkspace.plan))}>
                        {selectedWorkspace.plan}
                      </span>
                      <span
                        className={cn(
                          'rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]',
                          getStatusTone(selectedWorkspace.subscriptionStatus, selectedWorkspace.suspended)
                        )}
                      >
                        {selectedWorkspace.suspended ? 'Suspended' : selectedWorkspace.subscriptionStatus || 'inactive'}
                      </span>
                    </div>
                    <p className="mt-4 text-sm text-slate-500">Created {formatDate(selectedWorkspace.createdAt)}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Renewal {formatDate(selectedWorkspace.subscriptionCurrentPeriodEnd)}
                    </p>
                  </div>

                  <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Billing Links</p>
                    <div className="mt-4 space-y-3 text-sm text-slate-600">
                      <p>Customer: {selectedWorkspace.stripeCustomerId || '-'}</p>
                      <p>Subscription: {selectedWorkspace.stripeSubscriptionId || '-'}</p>
                      <p>Cancel at period end: {selectedWorkspace.subscriptionCancelAtPeriodEnd ? 'Yes' : 'No'}</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  {[
                    { label: 'Members', value: String(selectedWorkspace.counts?.members ?? selectedWorkspace.members.length), icon: <Users className="h-5 w-5" /> },
                    { label: 'Contacts', value: String(selectedWorkspace.counts?.contacts ?? 0), icon: <UserCheck className="h-5 w-5" /> },
                    { label: 'Messages', value: String(selectedWorkspace.counts?.messages ?? 0), icon: <MessageSquare className="h-5 w-5" /> },
                    { label: 'Conversations', value: String(selectedWorkspace.counts?.conversations ?? 0), icon: <MessageSquare className="h-5 w-5" /> },
                    { label: 'Chatbots', value: String(selectedWorkspace.counts?.chatbots ?? 0), icon: <ShieldCheck className="h-5 w-5" /> },
                    { label: 'Channels', value: String(selectedWorkspace.counts?.numbers ?? 0), icon: <ExternalLink className="h-5 w-5" /> },
                  ].map((item) => (
                    <div key={item.label} className="rounded-3xl border border-slate-100 bg-white p-5">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-500">{item.label}</p>
                        <div className="rounded-2xl bg-[#25D366]/10 p-2 text-[#25D366]">{item.icon}</div>
                      </div>
                      <p className="text-3xl font-bold text-slate-900">{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-3xl border border-slate-100 bg-white p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-slate-900">Members</h3>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                      {selectedWorkspace.members.length}
                    </span>
                  </div>
                  {selectedWorkspace.members.length > 0 ? (
                    <div className="space-y-3">
                      {selectedWorkspace.members.map((member, index) => (
                        <div key={`${member.user?.id || index}-${member.role || 'member'}`} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                          <div>
                            <p className="font-semibold text-slate-900">{member.user?.name || member.user?.email || 'Workspace member'}</p>
                            <p className="mt-1 text-sm text-slate-500">{member.user?.email || '-'}</p>
                          </div>
                          <div className="text-right">
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                              {member.role || 'member'}
                            </span>
                            <p className="mt-2 text-xs text-slate-400">
                              {member.user?.emailVerified ? 'Verified' : 'Unverified'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-400">
                      No workspace members found.
                    </div>
                  )}
                </div>

                <div className="grid gap-4">
                  <TimelineSection
                    title="Recent Payments"
                    items={selectedWorkspace.ledgerEntries}
                    emptyLabel="No billing ledger activity recorded for this workspace yet."
                  />
                  <TimelineSection
                    title="Usage Logs"
                    items={selectedWorkspace.usageLogs}
                    emptyLabel="No usage log activity recorded yet."
                  />
                  <TimelineSection
                    title="Feature Requests"
                    items={selectedWorkspace.featureRequests}
                    emptyLabel="No feature requests from this workspace."
                  />
                  <TimelineSection
                    title="Issue Reports"
                    items={selectedWorkspace.issueReports}
                    emptyLabel="No issue reports from this workspace."
                  />
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
