import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock3,
  Gauge,
  Hash,
  Loader2,
  MessageSquare,
  RefreshCw,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../contexts/AppContext';
import { cn } from '../lib/utils';

type DashboardRange = 'today' | '7d' | '30d' | 'custom';

type DashboardSummary = {
  meta: {
    range: DashboardRange;
    start: string;
    end: string;
    generatedAt: string;
    availableFilters: {
      agents: Array<{ id: string; name: string }>;
      leadSources: string[];
    };
  };
  overview: {
    newLeads: number;
    openChats: number;
    overdueChats: number;
    avgFirstReplyMinutes: number;
    dealsWon: number;
    pipelineValue: number;
    unreadMessages: number;
    botHandledRate: number;
  };
  pipeline: {
    stages: Array<{ id: string; label: string; count: number; value: number }>;
    winRate: number;
    staleLeadCount: number;
    lostDeals: number;
    sourceBreakdown: Array<{ source: string; count: number }>;
    lostReasons: Array<{ reason: string; count: number }>;
  };
  inbox: {
    unreadMessages: number;
    openChats: number;
    overdueChats: number;
    slaComplianceRate: number;
    waitingForCustomer: number;
    waitingForInternal: number;
    avgFirstReplyMinutes: number;
  };
  team: {
    workload: Array<{
      id: string;
      name: string;
      email: string;
      role: string;
      openChats: number;
      overdueChats: number;
      resolvedConversations: number;
      unreadAssigned: number;
      avgFirstReplyMinutes: number;
    }>;
  };
  campaigns: {
    totals: {
      campaigns: number;
      delivered: number;
      read: number;
      replied: number;
    };
    recent: Array<{
      id: string;
      name: string;
      status: string;
      senderName: string;
      senderPhoneNumber: string;
      createdAt: string;
      deliveredCount: number;
      readCount: number;
      repliedCount: number;
      recipientCount: number;
      deliveryRate: number;
      readRate: number;
      replyRate: number;
    }>;
  };
  chatbot: {
    enabledBots: number;
    assignedChannels: number;
    aiMessagesSent: number;
    botHandledRate: number;
    handoffRate: number;
  };
  adPerformance: {
    totalAdLeads: number;
    adSourceBreakdown: Array<{ source: string; count: number }>;
    conversionFunnel: {
      newLeads: number;
      contacted: number;
      contactedRate: number;
      qualified: number;
      qualifiedRate: number;
      won: number;
      wonRate: number;
    };
    responseTimeBySource: Array<{ source: string; avgMinutes: number }>;
  };
  channels: {
    whatsappConnected: number;
    whatsappDisconnected: number;
    usage: Array<{
      key: string;
      label: string;
      used: number;
      limit: number;
      percent: number;
    }>;
    aiSpend: number;
    creditBalance: number;
  };
  alerts: Array<{
    id: string;
    severity: 'critical' | 'warning' | 'info';
    title: string;
    description: string;
    href: string;
  }>;
};

type MetricCardProps = {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'emerald' | 'blue' | 'amber' | 'red' | 'violet' | 'teal';
  helper: string;
};

const RANGE_OPTIONS: Array<{ value: DashboardRange; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: 'custom', label: 'Custom' },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    maximumFractionDigits: 0,
  }).format(value || 0);

const formatPercent = (value: number) => `${Number(value || 0).toFixed(1)}%`;
const formatMinutes = (value: number) => `${Number(value || 0).toFixed(1)} min`;

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Just now';
  return new Intl.DateTimeFormat('en-AE', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
};

export default function Dashboard() {
  const { activeWorkspace } = useApp();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filters, setFilters] = useState({
    range: '7d' as DashboardRange,
    from: '',
    to: '',
    agentId: '',
    channelType: '',
    leadSource: '',
    priority: '',
  });

  const fetchDashboard = async (mode: 'load' | 'refresh' = 'load') => {
    if (!activeWorkspace) return;
    if (mode === 'load') setIsLoading(true);
    if (mode === 'refresh') setIsRefreshing(true);
    const refreshStartedAt = mode === 'refresh' ? Date.now() : 0;

    try {
      const response = await axios.get('/api/dashboard/summary', {
        params: {
          workspaceId: activeWorkspace.id,
          range: filters.range,
          from: filters.range === 'custom' ? filters.from || undefined : undefined,
          to: filters.range === 'custom' ? filters.to || undefined : undefined,
          agentId: filters.agentId || undefined,
          channelType: filters.channelType || undefined,
          leadSource: filters.leadSource || undefined,
          priority: filters.priority || undefined,
        },
      });
      setSummary(response.data);
      if (mode === 'refresh') {
        const elapsed = Date.now() - refreshStartedAt;
        if (elapsed < 350) {
          await new Promise((resolve) => setTimeout(resolve, 350 - elapsed));
        }
        toast.success('Dashboard refreshed');
      }
    } catch (error) {
      console.error('Failed to load dashboard summary', error);
      if (mode === 'refresh') {
        toast.error('Could not refresh the dashboard');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [activeWorkspace, filters.range, filters.from, filters.to, filters.agentId, filters.channelType, filters.leadSource, filters.priority]);

  if (!activeWorkspace) {
    return (
      <div className="h-full flex items-center justify-center bg-[#F8F9FA] dark:bg-slate-950 text-gray-500 dark:text-gray-400">
        Select a workspace to load the dashboard.
      </div>
    );
  }

  if (isLoading || !summary) {
    return (
      <div className="h-full flex items-center justify-center bg-[#F8F9FA] dark:bg-slate-950">
        <Loader2 className="w-8 h-8 text-[#25D366] animate-spin" />
      </div>
    );
  }

  const topMetrics: MetricCardProps[] = [
    { label: 'New Leads', value: summary.overview.newLeads, icon: TrendingUp, tone: 'emerald', helper: `Created in ${summary.meta.range === 'today' ? 'today' : 'selected period'}` },
    { label: 'Open Chats', value: summary.overview.openChats, icon: MessageSquare, tone: 'blue', helper: 'Current active conversations' },
    { label: 'Overdue Chats', value: summary.overview.overdueChats, icon: AlertTriangle, tone: summary.overview.overdueChats > 0 ? 'red' : 'emerald', helper: 'Need agent attention now' },
    { label: 'Avg First Reply', value: formatMinutes(summary.overview.avgFirstReplyMinutes), icon: Clock3, tone: 'amber', helper: 'Customer first-response speed' },
    { label: 'Deals Won', value: summary.overview.dealsWon, icon: CheckCircle2, tone: 'emerald', helper: 'Won stage changes in range' },
    { label: 'Pipeline Value', value: formatCurrency(summary.overview.pipelineValue), icon: Wallet, tone: 'violet', helper: 'Needs deal values on contacts' },
    { label: 'Unread Messages', value: summary.overview.unreadMessages, icon: MessageSquare, tone: 'amber', helper: 'Inbound messages still unread' },
    { label: 'Bot Handled', value: formatPercent(summary.overview.botHandledRate), icon: Bot, tone: 'teal', helper: 'AI-only resolved conversations' },
  ];

  return (
    <div className="h-full overflow-y-auto bg-[#F8F9FA] dark:bg-slate-950 transition-colors">
      <div className="max-w-[1600px] mx-auto p-8">
        <div className="flex flex-col gap-6">
          <div className="relative z-20 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[#25D366] mb-1">
                <Gauge className="w-5 h-5" />
                <span className="text-xs font-bold uppercase tracking-[0.2em]">Business Dashboard</span>
              </div>
              <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">Tawasel Performance Center</h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                Revenue, conversations, campaigns, and workspace health for {activeWorkspace.name}.
              </p>
            </div>

            <button
              type="button"
              onClick={() => fetchDashboard('refresh')}
              disabled={isRefreshing}
              aria-label="Refresh dashboard metrics"
              className="relative z-20 inline-flex shrink-0 cursor-pointer pointer-events-auto items-center gap-2 rounded-xl border border-gray-100 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:border-[#25D366]/40 disabled:cursor-wait disabled:opacity-70 dark:border-slate-800 dark:bg-slate-900 dark:text-gray-200"
            >
              <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          <SectionCard className="p-5">
            <div className="flex flex-col xl:flex-row gap-4 xl:items-end">
              <div className="flex flex-wrap gap-2">
                {RANGE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setFilters((prev) => ({ ...prev, range: option.value }))}
                    className={cn(
                      'px-4 py-2 rounded-xl text-sm font-semibold transition-colors',
                      filters.range === option.value
                        ? 'bg-[#25D366] text-white shadow-sm'
                        : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {filters.range === 'custom' && (
                <div className="flex flex-col sm:flex-row gap-3">
                  <input type="date" value={filters.from} onChange={(event) => setFilters((prev) => ({ ...prev, from: event.target.value }))} className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-gray-900 dark:text-white" />
                  <input type="date" value={filters.to} onChange={(event) => setFilters((prev) => ({ ...prev, to: event.target.value }))} className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-gray-900 dark:text-white" />
                </div>
              )}

              <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 flex-1">
                <select value={filters.agentId} onChange={(event) => setFilters((prev) => ({ ...prev, agentId: event.target.value }))} className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-gray-900 dark:text-white">
                  <option value="">All agents</option>
                  {summary.meta.availableFilters.agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
                </select>
                <select value={filters.channelType} onChange={(event) => setFilters((prev) => ({ ...prev, channelType: event.target.value }))} className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-gray-900 dark:text-white">
                  <option value="">All channels</option>
                  <option value="WHATSAPP">WhatsApp</option>
                </select>
                <select value={filters.leadSource} onChange={(event) => setFilters((prev) => ({ ...prev, leadSource: event.target.value }))} className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-gray-900 dark:text-white">
                  <option value="">All lead sources</option>
                  {summary.meta.availableFilters.leadSources.map((source) => <option key={source} value={source}>{source}</option>)}
                </select>
                <select value={filters.priority} onChange={(event) => setFilters((prev) => ({ ...prev, priority: event.target.value }))} className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-gray-900 dark:text-white">
                  <option value="">All priorities</option>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
            </div>
          </SectionCard>

          <div className="grid xl:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 2xl:grid-cols-4 gap-4">
                {topMetrics.map((metric) => (
                  <MetricCard
                    key={metric.label}
                    label={metric.label}
                    value={metric.value}
                    icon={metric.icon}
                    tone={metric.tone}
                    helper={metric.helper}
                  />
                ))}
              </div>

              <div className="grid 2xl:grid-cols-[1.25fr_0.95fr] gap-6">
                <SectionCard>
                  <SectionHeader title="Sales & Pipeline" description="See where revenue is building and where leads are getting stuck." />
                  <div className="space-y-4">
                    {summary.pipeline.stages.map((stage) => {
                      const maxCount = Math.max(...summary.pipeline.stages.map((item) => item.count), 1);
                      return (
                        <div key={stage.id} className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <div>
                              <p className="font-semibold text-gray-900 dark:text-white">{stage.label}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{stage.count} lead{stage.count === 1 ? '' : 's'} - {formatCurrency(stage.value)}</p>
                            </div>
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{stage.count}</p>
                          </div>
                          <div className="h-2 rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden">
                            <div className="h-full rounded-full bg-gradient-to-r from-[#25D366] to-[#128C7E]" style={{ width: `${Math.max(8, (stage.count / maxCount) * 100)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-6 grid sm:grid-cols-3 gap-3">
                    <StatPill label="Win Rate" value={formatPercent(summary.pipeline.winRate)} />
                    <StatPill label="Stale Leads" value={summary.pipeline.staleLeadCount} tone={summary.pipeline.staleLeadCount > 0 ? 'warning' : 'neutral'} />
                    <StatPill label="Lost Deals" value={summary.pipeline.lostDeals} tone={summary.pipeline.lostDeals > 0 ? 'warning' : 'neutral'} />
                  </div>
                </SectionCard>

                <SectionCard>
                  <SectionHeader title="Inbox & SLA" description="Response speed and unread pressure across your support workload." />
                  <div className="grid sm:grid-cols-2 gap-3">
                    <StatTile label="SLA Compliance" value={formatPercent(summary.inbox.slaComplianceRate)} />
                    <StatTile label="Waiting for Customer" value={summary.inbox.waitingForCustomer} />
                    <StatTile label="Waiting for Internal" value={summary.inbox.waitingForInternal} />
                    <StatTile label="Unread Messages" value={summary.inbox.unreadMessages} />
                  </div>

                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">Lead Source Mix</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{summary.pipeline.sourceBreakdown.length} source{summary.pipeline.sourceBreakdown.length === 1 ? '' : 's'}</p>
                    </div>
                    <div className="space-y-3">
                      {summary.pipeline.sourceBreakdown.length > 0 ? summary.pipeline.sourceBreakdown.map((item) => {
                        const total = summary.pipeline.sourceBreakdown.reduce((sum, source) => sum + source.count, 0) || 1;
                        const width = (item.count / total) * 100;
                        return (
                          <div key={item.source}>
                            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                              <span>{item.source}</span>
                              <span>{item.count}</span>
                            </div>
                            <div className="h-2 rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden">
                              <div className="h-full rounded-full bg-[#25D366]" style={{ width: `${Math.max(6, width)}%` }} />
                            </div>
                          </div>
                        );
                      }) : <EmptyState message="Lead source data will appear here once contacts are coming in." />}
                    </div>
                  </div>
                </SectionCard>
              </div>

              <div className="grid 2xl:grid-cols-[1.1fr_0.9fr] gap-6">
                <SectionCard>
                  <SectionHeader title="Team Performance" description="Which agents are carrying the workload and who needs support." />
                  <div className="space-y-3">
                    {summary.team.workload.length > 0 ? summary.team.workload.map((member) => (
                      <div key={member.id} className="rounded-2xl border border-gray-100 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 px-4 py-3">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">{member.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{member.role}</p>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 min-w-[260px]">
                            <MiniMetric label="Open" value={member.openChats} />
                            <MiniMetric label="Overdue" value={member.overdueChats} tone={member.overdueChats > 0 ? 'danger' : 'neutral'} />
                            <MiniMetric label="Resolved" value={member.resolvedConversations} />
                            <MiniMetric label="Avg Reply" value={formatMinutes(member.avgFirstReplyMinutes)} />
                          </div>
                        </div>
                      </div>
                    )) : <EmptyState message="Team workload will appear as soon as conversations are assigned." />}
                  </div>
                </SectionCard>

                <SectionCard>
                  <SectionHeader title="AI & Channel Health" description="Automation ROI, connected lines, and subscription usage." />
                  <div className="grid sm:grid-cols-2 gap-3">
                    <StatTile label="Enabled Bots" value={summary.chatbot.enabledBots} icon={Bot} />
                    <StatTile label="AI Messages" value={summary.chatbot.aiMessagesSent} icon={Bot} />
                    <StatTile label="Bot Handled" value={formatPercent(summary.chatbot.botHandledRate)} icon={Bot} />
                    <StatTile label="Handoff Rate" value={formatPercent(summary.chatbot.handoffRate)} icon={Users} />
                    <StatTile label="WhatsApp Online" value={summary.channels.whatsappConnected} icon={Hash} />
                  </div>

                  <div className="mt-6 space-y-3">
                    {summary.channels.usage.filter((item) => item.key !== 'instagram').map((item) => (
                      <div key={item.key}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="font-medium text-gray-700 dark:text-gray-200">{item.label}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{item.used}/{item.limit}</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              item.percent >= 90 ? 'bg-red-500' : item.percent >= 70 ? 'bg-amber-500' : 'bg-[#25D366]'
                            )}
                            style={{ width: `${Math.max(4, item.percent)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3 mt-6">
                    <StatPill label="AI Spend" value={`AED ${summary.channels.aiSpend.toFixed(3)}`} />
                    <StatPill label="Credit Balance" value={`AED ${summary.channels.creditBalance.toFixed(3)}`} />
                  </div>
                </SectionCard>
              </div>

              {/* Ad Performance & Conversion Funnel */}
              <SectionCard>
                <SectionHeader title="Ad Performance & Conversion" description="Track leads from ads and measure your conversion funnel." />
                <div className="grid sm:grid-cols-4 gap-3 mb-5">
                  <StatPill label="Ad Leads" value={summary.adPerformance?.totalAdLeads ?? 0} />
                  <StatPill label="Contacted" value={summary.adPerformance?.conversionFunnel?.contacted ?? 0} />
                  <StatPill label="Qualified" value={summary.adPerformance?.conversionFunnel?.qualified ?? 0} />
                  <StatPill label="Won" value={summary.adPerformance?.conversionFunnel?.won ?? 0} />
                </div>

                {/* Conversion Funnel */}
                {summary.adPerformance?.conversionFunnel && summary.adPerformance.conversionFunnel.newLeads > 0 && (
                  <div className="mb-5">
                    <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">Conversion Funnel</h4>
                    <div className="space-y-2">
                      {[
                        { label: 'New Leads', count: summary.adPerformance.conversionFunnel.newLeads, rate: 100 },
                        { label: 'Contacted', count: summary.adPerformance.conversionFunnel.contacted, rate: summary.adPerformance.conversionFunnel.contactedRate },
                        { label: 'Qualified', count: summary.adPerformance.conversionFunnel.qualified, rate: summary.adPerformance.conversionFunnel.qualifiedRate },
                        { label: 'Won', count: summary.adPerformance.conversionFunnel.won, rate: summary.adPerformance.conversionFunnel.wonRate },
                      ].map((step) => (
                        <div key={step.label} className="flex items-center gap-3">
                          <span className="text-xs w-20 text-gray-500 dark:text-gray-400">{step.label}</span>
                          <div className="flex-1 h-6 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#25D366] rounded-full transition-all flex items-center justify-end pr-2"
                              style={{ width: `${Math.max(step.rate, 2)}%` }}
                            >
                              {step.rate >= 15 && (
                                <span className="text-[10px] text-white font-medium">{step.count}</span>
                              )}
                            </div>
                          </div>
                          <span className="text-xs w-10 text-right text-gray-500 dark:text-gray-400">{step.rate}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ad Source Breakdown */}
                {summary.adPerformance?.adSourceBreakdown?.length > 0 && (
                  <div className="mb-5">
                    <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">Leads by Ad Campaign</h4>
                    <div className="space-y-2">
                      {summary.adPerformance.adSourceBreakdown.map((item) => (
                        <div key={item.source} className="flex items-center justify-between">
                          <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">{item.source}</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white ml-2">{item.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Response Time by Source */}
                {summary.adPerformance?.responseTimeBySource?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">Avg Response Time by Source</h4>
                    <div className="space-y-2">
                      {summary.adPerformance.responseTimeBySource.slice(0, 5).map((item) => (
                        <div key={item.source} className="flex items-center justify-between">
                          <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">{item.source}</span>
                          <span className={`text-sm font-medium ml-2 ${
                            (item.avgMinutes ?? 0) <= 5 ? 'text-green-600' : (item.avgMinutes ?? 0) <= 30 ? 'text-amber-600' : 'text-red-600'
                          }`}>
                            {item.avgMinutes != null ? `${Math.round(item.avgMinutes)}min` : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </SectionCard>

              <SectionCard>
                <SectionHeader title="Broadcast & Campaigns" description="See which campaigns landed, got read, and generated replies." />
                <div className="grid sm:grid-cols-4 gap-3 mb-5">
                  <StatPill label="Campaigns" value={summary.campaigns.totals.campaigns} />
                  <StatPill label="Delivered" value={summary.campaigns.totals.delivered} />
                  <StatPill label="Read" value={summary.campaigns.totals.read} />
                  <StatPill label="Replied" value={summary.campaigns.totals.replied} />
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-slate-800 text-[11px] uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        <th className="py-3 pr-4">Campaign</th>
                        <th className="py-3 pr-4">Sender</th>
                        <th className="py-3 pr-4">Recipients</th>
                        <th className="py-3 pr-4">Delivered</th>
                        <th className="py-3 pr-4">Read</th>
                        <th className="py-3 pr-4">Replied</th>
                        <th className="py-3">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                      {summary.campaigns.recent.length > 0 ? summary.campaigns.recent.map((campaign) => (
                        <tr key={campaign.id}>
                          <td className="py-3 pr-4">
                            <p className="font-semibold text-gray-900 dark:text-white">{campaign.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{campaign.status.toLowerCase()}</p>
                          </td>
                          <td className="py-3 pr-4 text-sm text-gray-600 dark:text-gray-300">{campaign.senderName}</td>
                          <td className="py-3 pr-4 text-sm text-gray-900 dark:text-white">{campaign.recipientCount}</td>
                          <td className="py-3 pr-4 text-sm text-gray-900 dark:text-white">{campaign.deliveredCount} <span className="text-xs text-gray-500 dark:text-gray-400">({formatPercent(campaign.deliveryRate)})</span></td>
                          <td className="py-3 pr-4 text-sm text-gray-900 dark:text-white">{campaign.readCount} <span className="text-xs text-gray-500 dark:text-gray-400">({formatPercent(campaign.readRate)})</span></td>
                          <td className="py-3 pr-4 text-sm text-gray-900 dark:text-white">{campaign.repliedCount} <span className="text-xs text-gray-500 dark:text-gray-400">({formatPercent(campaign.replyRate)})</span></td>
                          <td className="py-3 text-xs text-gray-500 dark:text-gray-400">{formatDateTime(campaign.createdAt)}</td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={7} className="py-10">
                            <EmptyState message="Broadcast performance will appear here after campaigns are launched." />
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </div>

            <div className="xl:sticky xl:top-8 space-y-6">
              <SectionCard>
                <SectionHeader title="Alerts & Action Center" description="What needs attention right now." />
                <div className="space-y-3">
                  {summary.alerts.length > 0 ? summary.alerts.map((alert) => (
                    <Link key={alert.id} to={alert.href} className={cn('block rounded-2xl border px-4 py-3 transition-colors', alert.severity === 'critical' && 'border-red-200 bg-red-50/80 dark:border-red-900/30 dark:bg-red-950/40', alert.severity === 'warning' && 'border-amber-200 bg-amber-50/80 dark:border-amber-900/30 dark:bg-amber-950/30', alert.severity === 'info' && 'border-blue-200 bg-blue-50/80 dark:border-blue-900/30 dark:bg-blue-950/30')}>
                      <div className="flex items-start gap-3">
                        <div className={cn('mt-0.5 rounded-full p-1.5', alert.severity === 'critical' && 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300', alert.severity === 'warning' && 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300', alert.severity === 'info' && 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300')}>
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">{alert.title}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{alert.description}</p>
                        </div>
                      </div>
                    </Link>
                  )) : <EmptyState message="No urgent alerts right now. This workspace looks healthy." />}
                </div>
              </SectionCard>

              <SectionCard>
                <SectionHeader title="Lost Deal Reasons" description="Why opportunities are falling out of the funnel." />
                <div className="space-y-3">
                  {summary.pipeline.lostReasons.length > 0 ? summary.pipeline.lostReasons.map((reason) => {
                    const total = summary.pipeline.lostReasons.reduce((sum, item) => sum + item.count, 0) || 1;
                    const width = (reason.count / total) * 100;
                    return (
                      <div key={reason.reason}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="font-medium text-gray-700 dark:text-gray-200">{reason.reason}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">{reason.count}</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden">
                          <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.max(8, width)}%` }} />
                        </div>
                      </div>
                    );
                  }) : <EmptyState message="Lost reason reporting will appear after the team starts tagging lost deals." />}
                </div>
              </SectionCard>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, icon: Icon, tone, helper }) => {
  const toneClasses: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300',
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300',
    red: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300',
    violet: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300',
    teal: 'bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-300',
  };

  return (
    <SectionCard className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">{label}</p>
          <p className="mt-3 text-3xl font-semibold text-gray-900 dark:text-white">{value}</p>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{helper}</p>
        </div>
        <div className={cn('rounded-2xl p-3', toneClasses[tone])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </SectionCard>
  );
};

function SectionCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('rounded-3xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-6 transition-colors', className)}>{children}</div>;
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>
    </div>
  );
}

function StatTile({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-2xl border border-gray-100 dark:border-slate-800 bg-gray-50/80 dark:bg-slate-950/50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">{label}</p>
          <p className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">{value}</p>
        </div>
        {Icon ? <div className="rounded-xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 p-2 text-[#25D366]"><Icon className="w-4 h-4" /></div> : null}
      </div>
    </div>
  );
}

function StatPill({ label, value, tone = 'neutral' }: { label: string; value: React.ReactNode; tone?: 'neutral' | 'warning' }) {
  return (
    <div className={cn('rounded-2xl px-4 py-3 border', tone === 'warning' ? 'border-amber-200 bg-amber-50/80 dark:border-amber-900/30 dark:bg-amber-950/20' : 'border-gray-100 bg-gray-50/80 dark:border-slate-800 dark:bg-slate-950/30')}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

function MiniMetric({ label, value, tone = 'neutral' }: { label: string; value: React.ReactNode; tone?: 'neutral' | 'danger' }) {
  return (
    <div className={cn('rounded-xl border px-3 py-2 text-center', tone === 'danger' ? 'border-red-200 bg-red-50 dark:border-red-900/30 dark:bg-red-950/20' : 'border-gray-100 bg-gray-50 dark:border-slate-800 dark:bg-slate-950/40')}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>;
}
