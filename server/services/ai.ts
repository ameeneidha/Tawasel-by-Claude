import prisma from "../../src/lib/prisma.js";
import {
  openai,
  FIXED_CHATBOT_MODEL,
  APPENDED_CHATBOT_SAFETY_INSTRUCTIONS,
  GPT_4_1_MINI_INPUT_COST_PER_1M,
  GPT_4_1_MINI_CACHED_INPUT_COST_PER_1M,
  GPT_4_1_MINI_OUTPUT_COST_PER_1M,
  WORKSPACE_PLAN_LIMITS,
  applyChannelFeatureFlagsToPlanLimits,
  getWorkspacePlanLimits,
} from "../config.js";

// ── AI Quota ──────────────────────────────────────────────────────

export async function getWorkspaceAiUsageThisMonth(workspaceId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  return prisma.usageLog.count({
    where: {
      workspaceId,
      type: "AI_TOKEN",
      createdAt: { gte: startOfMonth },
    },
  });
}

export async function checkAiQuota(
  workspaceId: string | null | undefined
): Promise<{ allowed: boolean; used: number; limit: number }> {
  if (!workspaceId) {
    return { allowed: false, used: 0, limit: 0 };
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { plan: true },
  });

  const limits = getWorkspacePlanLimits(workspace?.plan);
  const used = await getWorkspaceAiUsageThisMonth(workspaceId);

  return {
    allowed: used < limits.aiMessagesPerMonth,
    used,
    limit: limits.aiMessagesPerMonth,
  };
}

// ── Billing ────────────────────────────────────────────────────────

export const roundBillingAmount = (value: number) =>
  Number(value.toFixed(6));

export const getOpenAIUsageBreakdown = (usage: any) => {
  const promptTokens = Number(usage?.prompt_tokens || 0);
  const completionTokens = Number(usage?.completion_tokens || 0);
  const cachedPromptTokens = Number(
    usage?.prompt_tokens_details?.cached_tokens ||
      usage?.input_tokens_details?.cached_tokens ||
      0
  );
  const billablePromptTokens = Math.max(
    promptTokens - cachedPromptTokens,
    0
  );
  const totalTokens = Number(
    usage?.total_tokens || promptTokens + completionTokens
  );

  return {
    promptTokens,
    cachedPromptTokens,
    billablePromptTokens,
    completionTokens,
    totalTokens,
  };
};

export const calculateGpt41MiniCostUsd = (usage: any) => {
  const breakdown = getOpenAIUsageBreakdown(usage);

  const inputCost =
    (breakdown.billablePromptTokens / 1_000_000) *
    GPT_4_1_MINI_INPUT_COST_PER_1M;
  const cachedInputCost =
    (breakdown.cachedPromptTokens / 1_000_000) *
    GPT_4_1_MINI_CACHED_INPUT_COST_PER_1M;
  const outputCost =
    (breakdown.completionTokens / 1_000_000) * GPT_4_1_MINI_OUTPUT_COST_PER_1M;

  return {
    ...breakdown,
    inputCost,
    cachedInputCost,
    outputCost,
    totalCost: inputCost + cachedInputCost + outputCost,
  };
};

export async function recordAiUsage(
  workspaceId: string | null | undefined,
  description: string,
  usage: any,
  model = FIXED_CHATBOT_MODEL
) {
  if (!workspaceId) return null;

  const costBreakdown = calculateGpt41MiniCostUsd(usage);
  if (costBreakdown.totalTokens <= 0) return null;

  const roundedCost = roundBillingAmount(costBreakdown.totalCost);
  const ledgerDescription = `${description} (${model}) - ${costBreakdown.totalTokens} tokens`;

  await prisma.$transaction([
    prisma.usageLog.create({
      data: {
        workspaceId,
        type: "AI_TOKEN",
        quantity: costBreakdown.totalTokens,
        cost: roundedCost,
      },
    }),
    prisma.billingLedgerEntry.create({
      data: {
        workspaceId,
        amount: roundedCost,
        type: "DEBIT",
        description: ledgerDescription,
      },
    }),
  ]);

  return {
    ...costBreakdown,
    totalCost: roundedCost,
    description: ledgerDescription,
  };
}

// ── AI Functions ───────────────────────────────────────────────────

export async function getAIResponse(chatbot: any, message: string) {
  try {
    const quota = await checkAiQuota(chatbot.workspaceId);
    if (!quota.allowed) {
      console.warn(
        `AI quota exceeded for workspace ${chatbot.workspaceId}: ${quota.used}/${quota.limit}`
      );
      return "";
    }

    if (openai) {
      const systemPrompt = [
        chatbot.instructions?.trim(),
        APPENDED_CHATBOT_SAFETY_INSTRUCTIONS,
      ]
        .filter(Boolean)
        .join("\n\n");
      const completion = await openai.chat.completions.create({
        model: FIXED_CHATBOT_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
      });
      await recordAiUsage(
        chatbot.workspaceId,
        `AI chatbot reply - ${chatbot.name}`,
        completion.usage
      );
      return completion.choices[0].message.content || "";
    }
  } catch (error) {
    console.error("AI Response Error:", error);
  }
  return "";
}

export async function generateAISummary(
  conversationHistory: { content: string; senderType: string }[],
  workspaceId?: string | null
) {
  const quota = await checkAiQuota(workspaceId);
  if (!quota.allowed) {
    return "";
  }

  const historyString = conversationHistory
    .map((msg) => `${msg.senderType}: ${msg.content}`)
    .join("\n");

  const prompt = `
    Summarize the following conversation history between a customer and a business in the UAE.
    Highlight the main intent, key issues, and any next steps for the agent.
    Keep it concise (max 3 sentences).

    Conversation History:
    ${historyString}
  `;

  try {
    if (openai) {
      const completion = await openai.chat.completions.create({
        model: FIXED_CHATBOT_MODEL,
        messages: [{ role: "user", content: prompt }],
      });
      await recordAiUsage(
        workspaceId,
        "AI conversation summary",
        completion.usage
      );
      return completion.choices[0].message.content || "";
    }
  } catch (error) {
    console.error("AI Summary Error:", error);
  }

  return "";
}

function parseSuggestionPayload(payload: string) {
  try {
    const parsed = JSON.parse(payload);
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    if (Array.isArray(parsed?.suggestions))
      return parsed.suggestions.map(String).filter(Boolean);
  } catch {
    const arrayMatch = payload.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        const parsed = JSON.parse(arrayMatch[0]);
        if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
      } catch {
        return [];
      }
    }
  }

  return [];
}

export async function generateAIReplySuggestions(
  conversationHistory: { content: string; senderType: string }[],
  workspaceId?: string | null
) {
  const quota = await checkAiQuota(workspaceId);
  if (!quota.allowed) {
    return [];
  }

  const historyString = conversationHistory
    .map((msg) => `${msg.senderType}: ${msg.content}`)
    .join("\n");

  const prompt = `
    You are an AI assistant helping a customer support agent.
    Based on the following conversation history, suggest 3 concise and professional reply options for the agent.
    The business is based in the UAE.

    Conversation History:
    ${historyString}

    Return only a JSON array of strings.
    Example: ["Sure, I can help with that.", "What is your order number?", "Our office is in Dubai."]
  `;

  try {
    if (openai) {
      const completion = await openai.chat.completions.create({
        model: FIXED_CHATBOT_MODEL,
        messages: [{ role: "user", content: prompt }],
      });
      await recordAiUsage(
        workspaceId,
        "AI reply suggestions",
        completion.usage
      );

      const content = completion.choices[0].message.content || "";
      const parsed = parseSuggestionPayload(content);
      if (parsed.length) return parsed;
    }
  } catch (error) {
    console.error("AI Reply Suggestions Error:", error);
  }

  return [];
}

// ── Billing Summaries ──────────────────────────────────────────────

export async function getWorkspaceBillingSummary(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { plan: true },
  });

  const [ledger, usageLogs, aiMessagesUsedThisMonth] = await Promise.all([
    prisma.billingLedgerEntry.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.usageLog.findMany({
      where: {
        workspaceId,
        type: "AI_TOKEN",
      },
      orderBy: { createdAt: "desc" },
    }),
    getWorkspaceAiUsageThisMonth(workspaceId),
  ]);

  const limits = getWorkspacePlanLimits(workspace?.plan);

  const totalCredits = ledger
    .filter((entry) => entry.type === "CREDIT")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const totalDebits = ledger
    .filter((entry) => entry.type === "DEBIT")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const balance = totalCredits - totalDebits;
  const aiTokensUsed = usageLogs.reduce(
    (sum, entry) => sum + entry.quantity,
    0
  );
  const aiSpend = usageLogs.reduce((sum, entry) => sum + entry.cost, 0);

  return {
    balance: roundBillingAmount(balance),
    totalCredits: roundBillingAmount(totalCredits),
    totalDebits: roundBillingAmount(totalDebits),
    aiTokensUsed,
    aiSpend: roundBillingAmount(aiSpend),
    usageEvents: usageLogs.length,
    aiMessagesUsedThisMonth,
    aiMessagesLimit: limits.aiMessagesPerMonth,
    ledger,
    usageLogs,
  };
}

export const getPlanLimitSnapshot = (plan?: string | null) =>
  applyChannelFeatureFlagsToPlanLimits(
    WORKSPACE_PLAN_LIMITS[(plan || "").toUpperCase()] || {
      users: 1,
      whatsapp: 1,
      instagram: 1,
      chatbots: 1,
      contacts: 1000,
      broadcasts: 500,
      automations: 3,
      aiMessagesPerMonth: 1000,
    }
  );
