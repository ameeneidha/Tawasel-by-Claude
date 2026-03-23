import prisma from "../../src/lib/prisma.js";
import { INSTAGRAM_INTEGRATION_ENABLED } from "../config.js";
import {
  startOfDay,
  endOfDay,
  addDays,
  normalizePipelineStageKey,
  getWorkspacePipelineStages,
  parseStageChangeMetadata,
  sanitizeDisplayName,
} from "../utils/helpers.js";
import { getWorkspaceBillingSummary, getPlanLimitSnapshot } from "./ai.js";

// ── Dashboard Helpers ──────────────────────────────────────────────

const isWithinRange = (
  value: Date | string | null | undefined,
  start: Date,
  end: Date
) => {
  if (!value) return false;
  const date = value instanceof Date ? value : new Date(value);
  return date >= start && date <= end;
};

const toPercent = (value: number, total: number) => {
  if (!total) return 0;
  return Math.round((value / total) * 1000) / 10;
};

const toCurrency = (value: number) =>
  Math.round((value || 0) * 100) / 100;

const average = (values: number[]) => {
  if (values.length === 0) return 0;
  return (
    Math.round(
      (values.reduce((sum, value) => sum + value, 0) / values.length) * 10
    ) / 10
  );
};

const differenceInMinutesSafe = (
  later?: Date | string | null,
  earlier?: Date | string | null
) => {
  if (!later || !earlier) return null;
  const laterDate = later instanceof Date ? later : new Date(later);
  const earlierDate =
    earlier instanceof Date ? earlier : new Date(earlier);
  const diffMs = laterDate.getTime() - earlierDate.getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return null;
  return diffMs / (1000 * 60);
};

export const parseDashboardDateRange = (query: any) => {
  const now = new Date();
  const range = String(query.range || "7d")
    .trim()
    .toLowerCase();
  let start = startOfDay(addDays(now, -6));
  let end = endOfDay(now);

  if (range === "today") {
    start = startOfDay(now);
    end = endOfDay(now);
  } else if (range === "30d") {
    start = startOfDay(addDays(now, -29));
    end = endOfDay(now);
  } else if (range === "custom") {
    const from = query.from ? new Date(String(query.from)) : null;
    const to = query.to ? new Date(String(query.to)) : null;

    if (from && !Number.isNaN(from.getTime())) {
      start = startOfDay(from);
    }

    if (to && !Number.isNaN(to.getTime())) {
      end = endOfDay(to);
    }
  }

  return { range, start, end };
};

function buildConversationWhere(workspaceId: string, query: any) {
  return {
    workspaceId,
    ...(query.agentId ? { assignedToId: String(query.agentId) } : {}),
    ...(query.channelType
      ? { channelType: String(query.channelType).toUpperCase() }
      : {}),
    ...(query.priority
      ? { priority: String(query.priority).toUpperCase() }
      : {}),
    ...(query.leadSource
      ? {
          contact: {
            leadSource: String(query.leadSource),
          },
        }
      : {}),
  };
}

function buildContactWhere(workspaceId: string, query: any) {
  return {
    workspaceId,
    ...(query.agentId
      ? { assignedToId: String(query.agentId) }
      : {}),
    ...(query.leadSource
      ? { leadSource: String(query.leadSource) }
      : {}),
  };
}

// ── Main Dashboard Function ────────────────────────────────────────

export async function getDashboardSections(
  workspaceId: string,
  query: any
) {
  const { range, start, end } = parseDashboardDateRange(query);
  const now = new Date();
  const staleThreshold = addDays(now, -7);
  const conversationWhere = buildConversationWhere(workspaceId, query);
  const contactWhere = buildContactWhere(workspaceId, query);
  const messageConversationWhere = { ...conversationWhere };

  const [
    workspace,
    workspacePipelineStages,
    contacts,
    conversations,
    unreadMessagesCount,
    failedMessagesCount,
    stageActivities,
    campaigns,
    billingSummary,
  ] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: { include: { user: true } },
        numbers: true,
        instagramAccounts: true,
        chatbots: true,
        automationRules: { where: { enabled: true } },
      },
    }),
    getWorkspacePipelineStages(workspaceId),
    prisma.contact.findMany({
      where: contactWhere,
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        pipelineStage: true,
        leadSource: true,
        createdAt: true,
        lastActivityAt: true,
        estimatedValue: true,
        lostReason: true,
        assignedToId: true,
      },
    }),
    prisma.conversation.findMany({
      where: conversationWhere,
      select: {
        id: true,
        status: true,
        internalStatus: true,
        channelType: true,
        aiPaused: true,
        lastMessageAt: true,
        firstResponseAt: true,
        resolvedAt: true,
        priority: true,
        assignedToId: true,
        slaDeadline: true,
        slaStatus: true,
        contactId: true,
        contact: { select: { leadSource: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        messages: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            createdAt: true,
            direction: true,
            senderType: true,
            isInternal: true,
            readAt: true,
            status: true,
          },
        },
      },
    }),
    prisma.message.count({
      where: {
        direction: "INCOMING",
        isInternal: false,
        readAt: null,
        conversation: messageConversationWhere,
      },
    }),
    prisma.message.count({
      where: {
        direction: "OUTGOING",
        status: "FAILED",
        createdAt: { gte: start, lte: end },
        conversation: messageConversationWhere,
      },
    }),
    prisma.activityLog.findMany({
      where: {
        workspaceId,
        type: "STAGE_CHANGE",
        createdAt: { gte: start, lte: end },
      },
      select: {
        id: true,
        content: true,
        metadata: true,
        createdAt: true,
      },
    }),
    prisma.broadcastCampaign.findMany({
      where: {
        workspaceId,
        createdAt: { gte: start, lte: end },
      },
      include: {
        number: true,
        _count: { select: { recipients: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    getWorkspaceBillingSummary(workspaceId),
  ]);

  if (!workspace) {
    throw new Error("Workspace not found");
  }

  const wonStageKeys = new Set(
    workspacePipelineStages
      .filter(
        (s) =>
          String(s.terminalType || "").toUpperCase() === "WON"
      )
      .map((s) => normalizePipelineStageKey(s.key))
  );
  const lostStageKeys = new Set(
    workspacePipelineStages
      .filter(
        (s) =>
          String(s.terminalType || "").toUpperCase() === "LOST"
      )
      .map((s) => normalizePipelineStageKey(s.key))
  );
  const terminalStageKeys = new Set(
    workspacePipelineStages
      .filter(
        (s) =>
          s.isTerminal ||
          ["WON", "LOST"].includes(
            String(s.terminalType || "").toUpperCase()
          )
      )
      .map((s) => normalizePipelineStageKey(s.key))
  );

  const contactsCreatedInRange = contacts.filter((c) =>
    isWithinRange(c.createdAt, start, end)
  );
  const activePipelineContacts = contacts.filter(
    (c) =>
      !terminalStageKeys.has(normalizePipelineStageKey(c.pipelineStage))
  );
  const staleContacts = activePipelineContacts.filter(
    (c) =>
      !c.lastActivityAt ||
      new Date(c.lastActivityAt) < staleThreshold
  );

  const openConversations = conversations.filter(
    (c) =>
      c.status === "ACTIVE" && c.internalStatus !== "RESOLVED"
  );
  const overdueConversations = openConversations.filter(
    (c) =>
      c.slaStatus === "BREACHED" ||
      (c.slaDeadline ? new Date(c.slaDeadline) < now : false)
  );
  const conversationsInRange = conversations.filter((c) =>
    c.messages.some((m) => isWithinRange(m.createdAt, start, end))
  );

  const firstReplyDurations = conversationsInRange
    .map((c) => {
      const first = c.messages.find(
        (m) => m.direction === "INCOMING" && !m.isInternal
      );
      return differenceInMinutesSafe(c.firstResponseAt, first?.createdAt);
    })
    .filter((v): v is number => typeof v === "number");

  const dealsWon = stageActivities.filter((a) =>
    wonStageKeys.has(parseStageChangeMetadata(a).nextStageKey)
  ).length;
  const lostDealsInRange = stageActivities.filter((a) =>
    lostStageKeys.has(parseStageChangeMetadata(a).nextStageKey)
  ).length;
  const pipelineValue = activePipelineContacts.reduce(
    (sum, c) => sum + Number(c.estimatedValue || 0),
    0
  );

  const botHandledConversations = conversationsInRange.filter((c) => {
    const hasAiReply = c.messages.some(
      (m) => m.direction === "OUTGOING" && m.senderType === "AI_BOT"
    );
    const hasHumanReply = c.messages.some(
      (m) =>
        m.direction === "OUTGOING" &&
        m.senderType === "USER" &&
        !m.isInternal
    );
    return hasAiReply && !hasHumanReply;
  });

  const aiTouchedConversations = conversationsInRange.filter((c) =>
    c.messages.some(
      (m) => m.direction === "OUTGOING" && m.senderType === "AI_BOT"
    )
  );

  const pipelineStages = workspacePipelineStages.map((stage) => {
    const stageContacts = contacts.filter(
      (c) =>
        normalizePipelineStageKey(c.pipelineStage) ===
        normalizePipelineStageKey(stage.key)
    );
    return {
      id: stage.key,
      label: stage.name,
      count: stageContacts.length,
      value: toCurrency(
        stageContacts.reduce(
          (sum, c) => sum + Number(c.estimatedValue || 0),
          0
        )
      ),
    };
  });

  const sourceMap = new Map<string, number>();
  for (const c of contactsCreatedInRange) {
    const key = c.leadSource?.trim() || "Unknown";
    sourceMap.set(key, (sourceMap.get(key) || 0) + 1);
  }

  const lostReasonMap = new Map<string, number>();
  for (const c of contacts.filter((item) =>
    lostStageKeys.has(normalizePipelineStageKey(item.pipelineStage))
  )) {
    const key = c.lostReason?.trim() || "Unknown";
    lostReasonMap.set(key, (lostReasonMap.get(key) || 0) + 1);
  }

  const teamMembers = workspace.members.map((membership) => {
    const assignedConversations = conversations.filter(
      (c) => c.assignedToId === membership.userId
    );
    const assignedOpenConversations = assignedConversations.filter(
      (c) =>
        c.status === "ACTIVE" && c.internalStatus !== "RESOLVED"
    );
    const assignedOverdueConversations = overdueConversations.filter(
      (c) => c.assignedToId === membership.userId
    );
    const resolvedConversations = assignedConversations.filter((c) =>
      isWithinRange(c.resolvedAt, start, end)
    );
    const unreadAssigned = assignedOpenConversations.reduce(
      (sum, c) =>
        sum +
        c.messages.filter(
          (m) =>
            m.direction === "INCOMING" && !m.isInternal && !m.readAt
        ).length,
      0
    );
    const memberFirstReplyDurations = assignedConversations
      .map((c) => {
        const first = c.messages.find(
          (m) => m.direction === "INCOMING" && !m.isInternal
        );
        return differenceInMinutesSafe(
          c.firstResponseAt,
          first?.createdAt
        );
      })
      .filter((v): v is number => typeof v === "number");

    return {
      id: membership.userId,
      name: sanitizeDisplayName(
        membership.user?.name,
        membership.user?.email
      ),
      email: membership.user?.email || "",
      role: membership.role,
      openChats: assignedOpenConversations.length,
      overdueChats: assignedOverdueConversations.length,
      resolvedConversations: resolvedConversations.length,
      unreadAssigned,
      avgFirstReplyMinutes: average(memberFirstReplyDurations),
    };
  });

  const planLimits = getPlanLimitSnapshot(workspace.plan);
  const usageItems = [
    {
      key: "whatsapp",
      label: "WhatsApp numbers",
      used: workspace.numbers.length,
      limit: planLimits.whatsapp,
    },
    {
      key: "chatbots",
      label: "AI chatbots",
      used: workspace.chatbots.length,
      limit: planLimits.chatbots,
    },
    {
      key: "users",
      label: "Team members",
      used: workspace.members.length,
      limit: planLimits.users,
    },
    {
      key: "contacts",
      label: "Contacts",
      used: contacts.length,
      limit: planLimits.contacts,
    },
    {
      key: "broadcasts",
      label: "Broadcasts this period",
      used: campaigns.length,
      limit: planLimits.broadcasts,
    },
  ].map((item) => ({
    ...item,
    percent:
      item.limit > 0
        ? Math.min(100, Math.round((item.used / item.limit) * 100))
        : 0,
  }));

  const recentCampaigns = campaigns.map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    senderName: campaign.number?.name || "WhatsApp sender",
    senderPhoneNumber: campaign.number?.phoneNumber || "",
    createdAt: campaign.createdAt,
    deliveredCount: campaign.deliveredCount,
    readCount: campaign.readCount,
    repliedCount: campaign.repliedCount,
    recipientCount: campaign._count?.recipients || 0,
    deliveryRate: toPercent(
      campaign.deliveredCount,
      campaign._count?.recipients || 0
    ),
    readRate: toPercent(
      campaign.readCount,
      campaign.deliveredCount || 0
    ),
    replyRate: toPercent(
      campaign.repliedCount,
      campaign._count?.recipients || 0
    ),
  }));

  const highUsageItems = usageItems
    .filter((item) => item.percent >= 80)
    .sort((l, r) => r.percent - l.percent);

  const maxedUsageItems = highUsageItems.filter(
    (item) => item.percent >= 100
  );
  const usageAlertDetails = highUsageItems
    .slice(0, 3)
    .map(
      (item) =>
        `${item.label} ${item.percent}% (${item.used}/${item.limit})`
    )
    .join(", ");
  const usageAlertSuffix =
    highUsageItems.length > 3
      ? `, and ${highUsageItems.length - 3} more.`
      : ".";

  const connectedWhatsApp = workspace.numbers.filter(
    (n) => n.status === "CONNECTED"
  ).length;
  const connectedInstagram = INSTAGRAM_INTEGRATION_ENABLED
    ? workspace.instagramAccounts.filter(
        (a) => a.status === "CONNECTED"
      ).length
    : 0;

  const alerts = [
    overdueConversations.length > 0
      ? {
          id: "overdue-conversations",
          severity: "critical",
          title: `${overdueConversations.length} overdue conversations`,
          description:
            "Customers are waiting past the SLA threshold right now.",
          href: "/app/inbox",
        }
      : null,
    unreadMessagesCount > 0
      ? {
          id: "unread-messages",
          severity:
            unreadMessagesCount > 10 ? "warning" : "info",
          title: `${unreadMessagesCount} unread customer message${unreadMessagesCount === 1 ? "" : "s"}`,
          description:
            "Review the inbox and assign follow-up quickly.",
          href: "/app/inbox",
        }
      : null,
    staleContacts.length > 0
      ? {
          id: "stale-leads",
          severity: "warning",
          title: `${staleContacts.length} stale lead${staleContacts.length === 1 ? "" : "s"}`,
          description:
            "These leads have gone quiet for more than 7 days.",
          href: "/app/crm",
        }
      : null,
    failedMessagesCount > 0
      ? {
          id: "failed-messages",
          severity: "warning",
          title: `${failedMessagesCount} failed outbound message${failedMessagesCount === 1 ? "" : "s"}`,
          description:
            "A recent send did not reach the channel successfully.",
          href: "/app/inbox",
        }
      : null,
    workspace.numbers.filter((n) => n.status !== "CONNECTED")
      .length +
      (INSTAGRAM_INTEGRATION_ENABLED
        ? workspace.instagramAccounts.filter(
            (a) => a.status !== "CONNECTED"
          ).length
        : 0) >
    0
      ? {
          id: "disconnected-channels",
          severity: "warning",
          title: "One or more channels need reconnection",
          description:
            "Disconnected channels stop inbound messages and broadcasts.",
          href: "/app/channels",
        }
      : null,
    highUsageItems.length > 0
      ? {
          id: "plan-limits",
          severity:
            maxedUsageItems.length > 0 ? "warning" : "info",
          title:
            maxedUsageItems.length > 0
              ? maxedUsageItems.length === 1
                ? `${maxedUsageItems[0].label} is fully used`
                : `${maxedUsageItems.length} plan limits are fully used`
              : "Workspace is nearing a plan limit",
          description: `${usageAlertDetails}${usageAlertSuffix}`,
          href: "/app/settings/billing/plans",
        }
      : null,
  ].filter(Boolean);

  return {
    meta: {
      range,
      start,
      end,
      generatedAt: now,
      availableFilters: {
        agents: workspace.members.map((m) => ({
          id: m.userId,
          name: sanitizeDisplayName(m.user?.name, m.user?.email),
        })),
        leadSources: Array.from(
          new Set(
            contacts
              .map((c) => c.leadSource?.trim())
              .filter(Boolean)
          )
        ).sort(),
      },
    },
    overview: {
      newLeads: contactsCreatedInRange.length,
      openChats: openConversations.length,
      overdueChats: overdueConversations.length,
      avgFirstReplyMinutes: average(firstReplyDurations),
      dealsWon,
      pipelineValue: toCurrency(pipelineValue),
      unreadMessages: unreadMessagesCount,
      botHandledRate: toPercent(
        botHandledConversations.length,
        conversationsInRange.length
      ),
    },
    pipeline: {
      stages: pipelineStages,
      winRate: toPercent(dealsWon, contactsCreatedInRange.length),
      staleLeadCount: staleContacts.length,
      lostDeals: lostDealsInRange,
      sourceBreakdown: Array.from(sourceMap.entries())
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count),
      lostReasons: Array.from(lostReasonMap.entries())
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count),
    },
    inbox: {
      unreadMessages: unreadMessagesCount,
      openChats: openConversations.length,
      overdueChats: overdueConversations.length,
      slaComplianceRate: toPercent(
        openConversations.length - overdueConversations.length,
        openConversations.length
      ),
      waitingForCustomer: openConversations.filter(
        (c) => c.internalStatus === "WAITING_FOR_CUSTOMER"
      ).length,
      waitingForInternal: openConversations.filter(
        (c) => c.internalStatus === "WAITING_FOR_INTERNAL"
      ).length,
      avgFirstReplyMinutes: average(firstReplyDurations),
    },
    team: {
      workload: teamMembers.sort((a, b) => b.openChats - a.openChats),
    },
    campaigns: {
      totals: {
        campaigns: campaigns.length,
        delivered: campaigns.reduce(
          (sum, c) => sum + c.deliveredCount,
          0
        ),
        read: campaigns.reduce((sum, c) => sum + c.readCount, 0),
        replied: campaigns.reduce(
          (sum, c) => sum + c.repliedCount,
          0
        ),
      },
      recent: recentCampaigns,
    },
    chatbot: {
      enabledBots: workspace.chatbots.filter((c) => c.enabled).length,
      assignedChannels:
        workspace.numbers.filter((n) => n.chatbotId).length +
        (INSTAGRAM_INTEGRATION_ENABLED
          ? workspace.instagramAccounts.filter((a) => a.chatbotId)
              .length
          : 0),
      aiMessagesSent: conversationsInRange.reduce(
        (sum, c) =>
          sum +
          c.messages.filter(
            (m) =>
              m.direction === "OUTGOING" && m.senderType === "AI_BOT"
          ).length,
        0
      ),
      botHandledRate: toPercent(
        botHandledConversations.length,
        conversationsInRange.length
      ),
      handoffRate: toPercent(
        aiTouchedConversations.filter((c) =>
          c.messages.some(
            (m) =>
              m.direction === "OUTGOING" &&
              m.senderType === "USER" &&
              !m.isInternal
          )
        ).length,
        aiTouchedConversations.length
      ),
    },
    channels: {
      whatsappConnected: connectedWhatsApp,
      whatsappDisconnected:
        workspace.numbers.length - connectedWhatsApp,
      instagramConnected: connectedInstagram,
      instagramDisconnected: INSTAGRAM_INTEGRATION_ENABLED
        ? workspace.instagramAccounts.length - connectedInstagram
        : 0,
      usage: usageItems,
      aiSpend: billingSummary.aiSpend,
      creditBalance: billingSummary.balance,
    },
    alerts,
  };
}
