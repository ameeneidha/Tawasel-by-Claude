import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import prisma from "./src/lib/prisma.js";
import { Server } from "socket.io";
import { createServer } from "http";
import OpenAI from "openai";
import Stripe from "stripe";
import axios from "axios";
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FIXED_CHATBOT_MODEL = "gpt-5-nano";
const GPT_5_NANO_INPUT_COST_PER_1M = 0.05;
const GPT_5_NANO_CACHED_INPUT_COST_PER_1M = 0.005;
const GPT_5_NANO_OUTPUT_COST_PER_1M = 0.4;

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024,
    files: 5,
  },
});

const normalizePhone = (value?: string | null) => (value || "").replace(/\D/g, "");
const EMAIL_LIKE_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const WORKSPACE_USER_LIMITS: Record<string, number> = {
  STARTER: 1,
  GROWTH: 5,
  PRO: 10,
};

const WORKSPACE_PLAN_LIMITS: Record<
  string,
  {
    users: number;
    whatsapp: number;
    instagram: number;
    chatbots: number;
    contacts: number;
    broadcasts: number;
    automations: number;
  }
> = {
  STARTER: {
    users: 1,
    whatsapp: 1,
    instagram: 1,
    chatbots: 1,
    contacts: 1000,
    broadcasts: 500,
    automations: 3,
  },
  GROWTH: {
    users: 5,
    whatsapp: 2,
    instagram: 1,
    chatbots: 3,
    contacts: 5000,
    broadcasts: 3000,
    automations: 15,
  },
  PRO: {
    users: 10,
    whatsapp: 5,
    instagram: 2,
    chatbots: 10,
    contacts: 25000,
    broadcasts: 10000,
    automations: 999999,
  },
};

const DASHBOARD_STAGE_LABELS: Record<string, string> = {
  NEW_LEAD: 'New Lead',
  CONTACTED: 'Contacted',
  QUALIFIED: 'Qualified',
  QUOTE_SENT: 'Quote Sent',
  WON: 'Won',
  LOST: 'Lost',
};

const JWT_SECRET = (() => {
  const value = (process.env.JWT_SECRET || '').trim();
  if (!value || value === 'your-secret-key-here' || value.length < 32) {
    throw new Error('FATAL: JWT_SECRET env var is missing, defaulted, or too short (minimum 32 characters).');
  }
  return value;
})();

const normalizeOriginValue = (value: string) => {
  try {
    return new URL(value).origin;
  } catch {
    return value.replace(/\/$/, '');
  }
};

const PUBLIC_APP_URL = (process.env.PUBLIC_APP_URL || process.env.APP_URL || '').trim();
const API_URL = (process.env.API_URL || '').trim();

const ALLOWED_ORIGINS = Array.from(
  new Set(
    [
      process.env.ALLOWED_ORIGINS || '',
      PUBLIC_APP_URL,
      process.env.APP_URL || '',
      'http://localhost:3000,http://127.0.0.1:3000',
    ]
      .flatMap((value) => value.split(','))
      .map((value) => value.trim())
      .filter(Boolean)
      .map(normalizeOriginValue)
  )
);

const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const AUTH_RATE_LIMIT_MAX = 10;
const authRateLimitStore = new Map<string, { count: number; resetAt: number }>();

const getWorkspaceUserLimit = (plan?: string | null) => WORKSPACE_USER_LIMITS[(plan || '').toUpperCase()] || 1;
const getWorkspacePlanLimits = (plan?: string | null) =>
  WORKSPACE_PLAN_LIMITS[(plan || '').toUpperCase()] || WORKSPACE_PLAN_LIMITS.STARTER;

const deriveNameFromEmail = (email?: string | null) => {
  const localPart = (email || '').split('@')[0]?.trim();
  if (!localPart) {
    return 'User';
  }

  return localPart
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
};

const sanitizeDisplayName = (name?: string | null, email?: string | null) => {
  const trimmedName = name?.trim() || '';
  if (!trimmedName || EMAIL_LIKE_REGEX.test(trimmedName)) {
    return deriveNameFromEmail(email || trimmedName);
  }

  return trimmedName;
};

const createPasswordResetToken = () => {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, tokenHash };
};

const hashPasswordResetToken = (token: string) =>
  crypto.createHash('sha256').update(token).digest('hex');

const sanitizeUser = (user: any) => {
  if (!user) return user;
  const {
    password,
    passwordResetTokenHash,
    passwordResetExpiresAt,
    ...safeUser
  } = user;
  return safeUser;
};

const sanitizeMembership = (membership: any) => {
  if (!membership) return membership;
  return {
    ...membership,
    user: sanitizeUser(membership.user),
  };
};

const SUPERADMIN_EMAIL = 'ameeneidha@gmail.com';

type WhatsAppMediaKind = 'image' | 'document' | 'audio';
type IncomingWhatsAppMessagePayload =
  | {
      type: 'TEXT';
      content: string;
      aiInput: string | null;
    }
  | {
      type: 'IMAGE' | 'DOCUMENT' | 'AUDIO';
      content: string;
      aiInput: string | null;
      mediaId: string;
      mediaMimeType?: string;
      mediaFilename?: string;
    };

type EmbeddedSignupPhoneAsset = {
  wabaId: string | null;
  phoneNumberId: string;
  displayPhoneNumber: string;
  verifiedName?: string | null;
  businessName?: string | null;
};

type EmbeddedSignupResultPayload = {
  success: boolean;
  error?: string;
  workspaceId?: string | null;
  businessId?: string | null;
  accessToken?: string | null;
  tokenExpiresAt?: string | null;
  phoneNumbers?: EmbeddedSignupPhoneAsset[];
};

const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v22.0';

const getWhatsAppChannelConfig = (number?: {
  metaAccessToken?: string | null;
  metaPhoneNumberId?: string | null;
} | null) => ({
  accessToken: number?.metaAccessToken?.trim() || process.env.META_ACCESS_TOKEN || "",
  phoneNumberId: number?.metaPhoneNumberId?.trim() || process.env.META_PHONE_NUMBER_ID || "",
});

const parseEmbeddedSignupState = (state?: string | null) => {
  if (!state) return null;
  try {
    return JSON.parse(Buffer.from(state, 'base64url').toString('utf8')) as {
      workspaceId?: string;
      requestedAt?: string;
    };
  } catch {
    return null;
  }
};

const buildEmbeddedSignupState = (workspaceId: string) =>
  Buffer.from(
    JSON.stringify({
      workspaceId,
      requestedAt: new Date().toISOString(),
    }),
    'utf8'
  ).toString('base64url');

const formatMetaDisplayPhoneNumber = (phoneNumber?: string | null) => {
  const trimmed = phoneNumber?.trim() || '';
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) return trimmed;
  const digits = normalizePhone(trimmed);
  return digits ? `+${digits}` : trimmed;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

async function exchangeMetaCodeForAccessToken(code: string, redirectUri: string) {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error('Meta app credentials are not configured');
  }

  const response = await axios.get(`https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`, {
    params: {
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri,
      code,
    },
  });

  return response.data as {
    access_token: string;
    expires_in?: number;
    token_type?: string;
  };
}

async function fetchEmbeddedSignupPhoneAssets(accessToken: string) {
  const collected = new Map<string, EmbeddedSignupPhoneAsset>();
  const headers = {
    Authorization: `Bearer ${accessToken}`,
  };

  const addPhone = (
    phone: any,
    fallback: { wabaId?: string | null; businessName?: string | null } = {}
  ) => {
    const phoneNumberId = String(phone?.id || '').trim();
    if (!phoneNumberId) return;

    collected.set(phoneNumberId, {
      wabaId: String(phone?.whatsapp_business_account_id || fallback.wabaId || '').trim() || fallback.wabaId || null,
      phoneNumberId,
      displayPhoneNumber: formatMetaDisplayPhoneNumber(
        phone?.display_phone_number || phone?.formatted_phone_number || phone?.phone_number
      ),
      verifiedName: phone?.verified_name || null,
      businessName: fallback.businessName || phone?.verified_name || null,
    });
  };

  const queryCandidates = [
    {
      path: '/me',
      params: {
        fields:
          'id,name,owned_whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,verified_name,whatsapp_business_account_id}},client_whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,verified_name,whatsapp_business_account_id}}',
      },
      collect: (data: any) => {
        const groups = [
          ...(Array.isArray(data?.owned_whatsapp_business_accounts?.data)
            ? data.owned_whatsapp_business_accounts.data
            : []),
          ...(Array.isArray(data?.client_whatsapp_business_accounts?.data)
            ? data.client_whatsapp_business_accounts.data
            : []),
        ];

        for (const business of groups) {
          const phones = Array.isArray(business?.phone_numbers?.data)
            ? business.phone_numbers.data
            : Array.isArray(business?.phone_numbers)
              ? business.phone_numbers
              : [];
          for (const phone of phones) {
            addPhone(phone, { wabaId: business?.id || null, businessName: business?.name || data?.name || null });
          }
        }
      },
    },
    {
      path: '/me/owned_whatsapp_business_accounts',
      params: {
        fields: 'id,name,phone_numbers{id,display_phone_number,verified_name,whatsapp_business_account_id}',
      },
      collect: (data: any) => {
        for (const business of Array.isArray(data?.data) ? data.data : []) {
          const phones = Array.isArray(business?.phone_numbers?.data)
            ? business.phone_numbers.data
            : Array.isArray(business?.phone_numbers)
              ? business.phone_numbers
              : [];
          for (const phone of phones) {
            addPhone(phone, { wabaId: business?.id || null, businessName: business?.name || null });
          }
        }
      },
    },
    {
      path: '/me/client_whatsapp_business_accounts',
      params: {
        fields: 'id,name,phone_numbers{id,display_phone_number,verified_name,whatsapp_business_account_id}',
      },
      collect: (data: any) => {
        for (const business of Array.isArray(data?.data) ? data.data : []) {
          const phones = Array.isArray(business?.phone_numbers?.data)
            ? business.phone_numbers.data
            : Array.isArray(business?.phone_numbers)
              ? business.phone_numbers
              : [];
          for (const phone of phones) {
            addPhone(phone, { wabaId: business?.id || null, businessName: business?.name || null });
          }
        }
      },
    },
  ];

  for (const query of queryCandidates) {
    try {
      const response = await axios.get(`https://graph.facebook.com/${META_GRAPH_VERSION}${query.path}`, {
        params: query.params,
        headers,
      });
      query.collect(response.data);
      if (collected.size > 0) {
        break;
      }
    } catch (error) {
      console.warn(`Embedded signup asset lookup failed for ${query.path}`);
    }
  }

  return Array.from(collected.values()).filter((asset) => asset.displayPhoneNumber || asset.phoneNumberId);
}

const getWhatsAppMediaKind = (file: Express.Multer.File): WhatsAppMediaKind | null => {
  if (file.mimetype.startsWith('image/')) return 'image';
  if (file.mimetype.startsWith('audio/')) return 'audio';
  if (
    file.mimetype === 'application/pdf' ||
    file.mimetype.includes('officedocument') ||
    file.mimetype.includes('msword') ||
    file.mimetype.startsWith('text/')
  ) {
    return 'document';
  }
  return null;
};

const buildIncomingWhatsAppMessagePayload = (message: any): IncomingWhatsAppMessagePayload | null => {
  if (!message?.type) return null;

  if (message.type === 'text') {
    const text = message.text?.body?.trim();
    if (!text) return null;
    return {
      type: 'TEXT',
      content: text,
      aiInput: text,
    };
  }

  if (message.type === 'image' && message.image?.id) {
    const caption = message.image?.caption?.trim();
    return {
      type: 'IMAGE',
      content: caption || '[Image]',
      aiInput: caption || null,
      mediaId: message.image.id,
      mediaMimeType: message.image?.mime_type,
    };
  }

  if (message.type === 'document' && message.document?.id) {
    const filename = message.document?.filename || 'Document';
    const caption = message.document?.caption?.trim();
    return {
      type: 'DOCUMENT',
      content: caption ? `[Document] ${filename}\n${caption}` : `[Document] ${filename}`,
      aiInput: caption || null,
      mediaId: message.document.id,
      mediaMimeType: message.document?.mime_type,
      mediaFilename: filename,
    };
  }

  if (message.type === 'audio' && message.audio?.id) {
    const isVoiceNote = Boolean(message.audio?.voice);
    return {
      type: 'AUDIO',
      content: isVoiceNote ? '[Voice note]' : '[Audio]',
      aiInput: null,
      mediaId: message.audio.id,
      mediaMimeType: message.audio?.mime_type,
      mediaFilename: isVoiceNote ? 'voice-note.ogg' : 'audio-message',
    };
  }

  return null;
};

async function getAIResponse(chatbot: any, message: string) {
  try {
    if (openai) {
      const completion = await openai.chat.completions.create({
        model: FIXED_CHATBOT_MODEL,
        messages: [
          { role: "system", content: chatbot.instructions },
          { role: "user", content: message }
        ],
      });
      await recordAiUsage(chatbot.workspaceId, `AI chatbot reply - ${chatbot.name}`, completion.usage);
      return completion.choices[0].message.content || "";
    }
  } catch (error) {
    console.error("AI Response Error:", error);
  }
  return "";
}

async function generateAISummary(
  conversationHistory: { content: string; senderType: string }[],
  workspaceId?: string | null
) {
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
      await recordAiUsage(workspaceId, "AI conversation summary", completion.usage);
      return completion.choices[0].message.content || "";
    }
  } catch (error) {
    console.error("AI Summary Error:", error);
  }

  return "";
}

async function generateAIReplySuggestions(
  conversationHistory: { content: string; senderType: string }[],
  workspaceId?: string | null
) {
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
      await recordAiUsage(workspaceId, "AI reply suggestions", completion.usage);

      const content = completion.choices[0].message.content || "";
      const parsed = parseSuggestionPayload(content);
      if (parsed.length) return parsed;
    }
  } catch (error) {
    console.error("AI Reply Suggestions Error:", error);
  }

  return [];
}

function parseSuggestionPayload(payload: string) {
  try {
    const parsed = JSON.parse(payload);
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    if (Array.isArray(parsed?.suggestions)) return parsed.suggestions.map(String).filter(Boolean);
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

const roundBillingAmount = (value: number) => Number(value.toFixed(6));

const getOpenAIUsageBreakdown = (usage: any) => {
  const promptTokens = Number(usage?.prompt_tokens || 0);
  const completionTokens = Number(usage?.completion_tokens || 0);
  const cachedPromptTokens = Number(
    usage?.prompt_tokens_details?.cached_tokens ||
      usage?.input_tokens_details?.cached_tokens ||
      0
  );
  const billablePromptTokens = Math.max(promptTokens - cachedPromptTokens, 0);
  const totalTokens = Number(usage?.total_tokens || promptTokens + completionTokens);

  return {
    promptTokens,
    cachedPromptTokens,
    billablePromptTokens,
    completionTokens,
    totalTokens,
  };
};

const calculateGpt5NanoCostUsd = (usage: any) => {
  const breakdown = getOpenAIUsageBreakdown(usage);

  const inputCost = (breakdown.billablePromptTokens / 1_000_000) * GPT_5_NANO_INPUT_COST_PER_1M;
  const cachedInputCost = (breakdown.cachedPromptTokens / 1_000_000) * GPT_5_NANO_CACHED_INPUT_COST_PER_1M;
  const outputCost = (breakdown.completionTokens / 1_000_000) * GPT_5_NANO_OUTPUT_COST_PER_1M;

  return {
    ...breakdown,
    inputCost,
    cachedInputCost,
    outputCost,
    totalCost: inputCost + cachedInputCost + outputCost,
  };
};

async function recordAiUsage(
  workspaceId: string | null | undefined,
  description: string,
  usage: any,
  model = FIXED_CHATBOT_MODEL
) {
  if (!workspaceId) return null;

  const costBreakdown = calculateGpt5NanoCostUsd(usage);
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

async function getWorkspaceBillingSummary(workspaceId: string) {
  const [ledger, usageLogs] = await Promise.all([
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
  ]);

  const totalCredits = ledger
    .filter((entry) => entry.type === "CREDIT")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const totalDebits = ledger
    .filter((entry) => entry.type === "DEBIT")
    .reduce((sum, entry) => sum + entry.amount, 0);
  const balance = totalCredits - totalDebits;
  const aiTokensUsed = usageLogs.reduce((sum, entry) => sum + entry.quantity, 0);
  const aiSpend = usageLogs.reduce((sum, entry) => sum + entry.cost, 0);

  return {
    balance: roundBillingAmount(balance),
    totalCredits: roundBillingAmount(totalCredits),
    totalDebits: roundBillingAmount(totalDebits),
    aiTokensUsed,
    aiSpend: roundBillingAmount(aiSpend),
    usageEvents: usageLogs.length,
    ledger,
    usageLogs,
  };
}

const getPlanLimitSnapshot = (plan?: string | null) =>
  WORKSPACE_PLAN_LIMITS[(plan || '').toUpperCase()] || {
    users: 1,
    whatsapp: 1,
    instagram: 1,
    chatbots: 1,
    contacts: 1000,
    broadcasts: 500,
    automations: 3,
  };

const startOfDay = (value: Date) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfDay = (value: Date) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

const addDays = (value: Date, days: number) => {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
};

const isWithinRange = (value: Date | string | null | undefined, start: Date, end: Date) => {
  if (!value) return false;
  const date = value instanceof Date ? value : new Date(value);
  return date >= start && date <= end;
};

const toPercent = (value: number, total: number) => {
  if (!total) return 0;
  return Math.round((value / total) * 1000) / 10;
};

const toCurrency = (value: number) => Math.round((value || 0) * 100) / 100;

const average = (values: number[]) => {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
};

const differenceInMinutesSafe = (later?: Date | string | null, earlier?: Date | string | null) => {
  if (!later || !earlier) return null;
  const laterDate = later instanceof Date ? later : new Date(later);
  const earlierDate = earlier instanceof Date ? earlier : new Date(earlier);
  const diffMs = laterDate.getTime() - earlierDate.getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return null;
  return diffMs / (1000 * 60);
};

const parseDashboardDateRange = (query: any) => {
  const now = new Date();
  const range = String(query.range || '7d').trim().toLowerCase();
  let start = startOfDay(addDays(now, -6));
  let end = endOfDay(now);

  if (range === 'today') {
    start = startOfDay(now);
    end = endOfDay(now);
  } else if (range === '30d') {
    start = startOfDay(addDays(now, -29));
    end = endOfDay(now);
  } else if (range === 'custom') {
    const from = query.from ? new Date(String(query.from)) : null;
    const to = query.to ? new Date(String(query.to)) : null;

    if (from && !Number.isNaN(from.getTime())) {
      start = startOfDay(from);
    }

    if (to && !Number.isNaN(to.getTime())) {
      end = endOfDay(to);
    }
  }

  return {
    range,
    start,
    end,
  };
};

function buildConversationWhere(workspaceId: string, query: any) {
  return {
    workspaceId,
    ...(query.agentId ? { assignedToId: String(query.agentId) } : {}),
    ...(query.channelType ? { channelType: String(query.channelType).toUpperCase() } : {}),
    ...(query.priority ? { priority: String(query.priority).toUpperCase() } : {}),
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
    ...(query.agentId ? { assignedToId: String(query.agentId) } : {}),
    ...(query.leadSource ? { leadSource: String(query.leadSource) } : {}),
  };
}

async function getDashboardSections(workspaceId: string, query: any) {
  const { range, start, end } = parseDashboardDateRange(query);
  const now = new Date();
  const staleThreshold = addDays(now, -7);
  const conversationWhere = buildConversationWhere(workspaceId, query);
  const contactWhere = buildContactWhere(workspaceId, query);
  const messageConversationWhere = {
    ...conversationWhere,
  };

  const [workspace, contacts, conversations, unreadMessagesCount, failedMessagesCount, stageActivities, campaigns, billingSummary] =
    await Promise.all([
      prisma.workspace.findUnique({
        where: { id: workspaceId },
        include: {
          members: {
            include: {
              user: true,
            },
          },
          numbers: true,
          instagramAccounts: true,
          chatbots: true,
          automationRules: {
            where: { enabled: true },
          },
        },
      }),
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
          contact: {
            select: {
              leadSource: true,
            },
          },
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          messages: {
            orderBy: { createdAt: 'asc' },
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
          direction: 'INCOMING',
          isInternal: false,
          readAt: null,
          conversation: messageConversationWhere,
        },
      }),
      prisma.message.count({
        where: {
          direction: 'OUTGOING',
          status: 'FAILED',
          createdAt: { gte: start, lte: end },
          conversation: messageConversationWhere,
        },
      }),
      prisma.activityLog.findMany({
        where: {
          workspaceId,
          type: 'STAGE_CHANGE',
          createdAt: { gte: start, lte: end },
        },
        select: {
          id: true,
          content: true,
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
          _count: {
            select: {
              recipients: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      getWorkspaceBillingSummary(workspaceId),
    ]);

  if (!workspace) {
    throw new Error('Workspace not found');
  }

  const contactsCreatedInRange = contacts.filter((contact) => isWithinRange(contact.createdAt, start, end));
  const activePipelineContacts = contacts.filter(
    (contact) => !['WON', 'LOST'].includes((contact.pipelineStage || '').toUpperCase())
  );
  const staleContacts = activePipelineContacts.filter(
    (contact) => !contact.lastActivityAt || new Date(contact.lastActivityAt) < staleThreshold
  );

  const openConversations = conversations.filter(
    (conversation) => conversation.status === 'ACTIVE' && conversation.internalStatus !== 'RESOLVED'
  );
  const overdueConversations = openConversations.filter(
    (conversation) =>
      conversation.slaStatus === 'BREACHED' ||
      (conversation.slaDeadline ? new Date(conversation.slaDeadline) < now : false)
  );
  const conversationsInRange = conversations.filter((conversation) =>
    conversation.messages.some((message) => isWithinRange(message.createdAt, start, end))
  );

  const firstReplyDurations = conversationsInRange
    .map((conversation) => {
      const firstCustomerMessage = conversation.messages.find(
        (message) => message.direction === 'INCOMING' && !message.isInternal
      );
      return differenceInMinutesSafe(conversation.firstResponseAt, firstCustomerMessage?.createdAt);
    })
    .filter((value): value is number => typeof value === 'number');

  const dealsWon = stageActivities.filter((activity) => activity.content.includes(' to WON')).length;
  const lostDealsInRange = stageActivities.filter((activity) => activity.content.includes(' to LOST')).length;
  const pipelineValue = activePipelineContacts.reduce(
    (sum, contact) => sum + Number(contact.estimatedValue || 0),
    0
  );

  const botHandledConversations = conversationsInRange.filter((conversation) => {
    const hasAiReply = conversation.messages.some(
      (message) => message.direction === 'OUTGOING' && message.senderType === 'AI_BOT'
    );
    const hasHumanReply = conversation.messages.some(
      (message) => message.direction === 'OUTGOING' && message.senderType === 'USER' && !message.isInternal
    );
    return hasAiReply && !hasHumanReply;
  });

  const aiTouchedConversations = conversationsInRange.filter((conversation) =>
    conversation.messages.some(
      (message) => message.direction === 'OUTGOING' && message.senderType === 'AI_BOT'
    )
  );

  const pipelineStages = Object.entries(DASHBOARD_STAGE_LABELS).map(([stageId, label]) => {
    const stageContacts = contacts.filter((contact) => (contact.pipelineStage || '').toUpperCase() === stageId);
    return {
      id: stageId,
      label,
      count: stageContacts.length,
      value: toCurrency(
        stageContacts.reduce((sum, contact) => sum + Number(contact.estimatedValue || 0), 0)
      ),
    };
  });

  const sourceMap = new Map<string, number>();
  for (const contact of contactsCreatedInRange) {
    const key = contact.leadSource?.trim() || 'Unknown';
    sourceMap.set(key, (sourceMap.get(key) || 0) + 1);
  }

  const lostReasonMap = new Map<string, number>();
  for (const contact of contacts.filter((item) => item.pipelineStage === 'LOST')) {
    const key = contact.lostReason?.trim() || 'Unknown';
    lostReasonMap.set(key, (lostReasonMap.get(key) || 0) + 1);
  }

  const teamMembers = workspace.members.map((membership) => {
    const assignedConversations = conversations.filter(
      (conversation) => conversation.assignedToId === membership.userId
    );
    const assignedOpenConversations = assignedConversations.filter(
      (conversation) => conversation.status === 'ACTIVE' && conversation.internalStatus !== 'RESOLVED'
    );
    const assignedOverdueConversations = overdueConversations.filter(
      (conversation) => conversation.assignedToId === membership.userId
    );
    const resolvedConversations = assignedConversations.filter((conversation) =>
      isWithinRange(conversation.resolvedAt, start, end)
    );
    const unreadAssigned = assignedOpenConversations.reduce(
      (sum, conversation) =>
        sum +
        conversation.messages.filter(
          (message) => message.direction === 'INCOMING' && !message.isInternal && !message.readAt
        ).length,
      0
    );
    const memberFirstReplyDurations = assignedConversations
      .map((conversation) => {
        const firstCustomerMessage = conversation.messages.find(
          (message) => message.direction === 'INCOMING' && !message.isInternal
        );
        return differenceInMinutesSafe(conversation.firstResponseAt, firstCustomerMessage?.createdAt);
      })
      .filter((value): value is number => typeof value === 'number');

    return {
      id: membership.userId,
      name: sanitizeDisplayName(membership.user?.name, membership.user?.email),
      email: membership.user?.email || '',
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
      key: 'whatsapp',
      label: 'WhatsApp numbers',
      used: workspace.numbers.length,
      limit: planLimits.whatsapp,
    },
    {
      key: 'instagram',
      label: 'Instagram accounts',
      used: workspace.instagramAccounts.length,
      limit: planLimits.instagram,
    },
    {
      key: 'chatbots',
      label: 'AI chatbots',
      used: workspace.chatbots.length,
      limit: planLimits.chatbots,
    },
    {
      key: 'users',
      label: 'Team members',
      used: workspace.members.length,
      limit: planLimits.users,
    },
    {
      key: 'contacts',
      label: 'Contacts',
      used: contacts.length,
      limit: planLimits.contacts,
    },
    {
      key: 'broadcasts',
      label: 'Broadcasts this period',
      used: campaigns.length,
      limit: planLimits.broadcasts,
    },
  ].map((item) => ({
    ...item,
    percent: item.limit > 0 ? Math.min(100, Math.round((item.used / item.limit) * 100)) : 0,
  }));

  const recentCampaigns = campaigns.map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    senderName: campaign.number?.name || 'WhatsApp sender',
    senderPhoneNumber: campaign.number?.phoneNumber || '',
    createdAt: campaign.createdAt,
    deliveredCount: campaign.deliveredCount,
    readCount: campaign.readCount,
    repliedCount: campaign.repliedCount,
    recipientCount: campaign._count?.recipients || 0,
    deliveryRate: toPercent(campaign.deliveredCount, campaign._count?.recipients || 0),
    readRate: toPercent(campaign.readCount, campaign.deliveredCount || 0),
    replyRate: toPercent(campaign.repliedCount, campaign._count?.recipients || 0),
  }));

  const highUsageItems = usageItems
    .filter((item) => item.percent >= 80)
    .sort((left, right) => right.percent - left.percent);

  const maxedUsageItems = highUsageItems.filter((item) => item.percent >= 100);
  const usageAlertDetails = highUsageItems
    .slice(0, 3)
    .map((item) => `${item.label} ${item.percent}% (${item.used}/${item.limit})`)
    .join(', ');

  const usageAlertSuffix =
    highUsageItems.length > 3 ? `, and ${highUsageItems.length - 3} more.` : '.';

  const alerts = [
    overdueConversations.length > 0
      ? {
          id: 'overdue-conversations',
          severity: 'critical',
          title: `${overdueConversations.length} overdue conversations`,
          description: 'Customers are waiting past the SLA threshold right now.',
          href: '/app/inbox',
        }
      : null,
    unreadMessagesCount > 0
      ? {
          id: 'unread-messages',
          severity: unreadMessagesCount > 10 ? 'warning' : 'info',
          title: `${unreadMessagesCount} unread customer message${unreadMessagesCount === 1 ? '' : 's'}`,
          description: 'Review the inbox and assign follow-up quickly.',
          href: '/app/inbox',
        }
      : null,
    staleContacts.length > 0
      ? {
          id: 'stale-leads',
          severity: 'warning',
          title: `${staleContacts.length} stale lead${staleContacts.length === 1 ? '' : 's'}`,
          description: 'These leads have gone quiet for more than 7 days.',
          href: '/app/crm',
        }
      : null,
    failedMessagesCount > 0
      ? {
          id: 'failed-messages',
          severity: 'warning',
          title: `${failedMessagesCount} failed outbound message${failedMessagesCount === 1 ? '' : 's'}`,
          description: 'A recent send did not reach the channel successfully.',
          href: '/app/inbox',
        }
      : null,
    workspace.numbers.filter((number) => number.status !== 'CONNECTED').length +
      workspace.instagramAccounts.filter((account) => account.status !== 'CONNECTED').length >
    0
      ? {
          id: 'disconnected-channels',
          severity: 'warning',
          title: 'One or more channels need reconnection',
          description: 'Disconnected channels stop inbound messages and broadcasts.',
          href: '/app/channels',
        }
      : null,
    highUsageItems.length > 0
      ? {
          id: 'plan-limits',
          severity: maxedUsageItems.length > 0 ? 'warning' : 'info',
          title:
            maxedUsageItems.length > 0
              ? maxedUsageItems.length === 1
                ? `${maxedUsageItems[0].label} is fully used`
                : `${maxedUsageItems.length} plan limits are fully used`
              : 'Workspace is nearing a plan limit',
          description: `${usageAlertDetails}${usageAlertSuffix}`,
          href: '/app/settings/billing/plans',
        }
      : null,
  ].filter(Boolean);

  const connectedWhatsApp = workspace.numbers.filter((number) => number.status === 'CONNECTED').length;
  const connectedInstagram = workspace.instagramAccounts.filter((account) => account.status === 'CONNECTED').length;

  return {
    meta: {
      range,
      start,
      end,
      generatedAt: now,
      availableFilters: {
        agents: workspace.members.map((membership) => ({
          id: membership.userId,
          name: sanitizeDisplayName(membership.user?.name, membership.user?.email),
        })),
        leadSources: Array.from(
          new Set(contacts.map((contact) => contact.leadSource?.trim()).filter(Boolean))
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
      botHandledRate: toPercent(botHandledConversations.length, conversationsInRange.length),
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
      waitingForCustomer: openConversations.filter((conversation) => conversation.internalStatus === 'WAITING_FOR_CUSTOMER').length,
      waitingForInternal: openConversations.filter((conversation) => conversation.internalStatus === 'WAITING_FOR_INTERNAL').length,
      avgFirstReplyMinutes: average(firstReplyDurations),
    },
    team: {
      workload: teamMembers.sort((a, b) => b.openChats - a.openChats),
    },
    campaigns: {
      totals: {
        campaigns: campaigns.length,
        delivered: campaigns.reduce((sum, campaign) => sum + campaign.deliveredCount, 0),
        read: campaigns.reduce((sum, campaign) => sum + campaign.readCount, 0),
        replied: campaigns.reduce((sum, campaign) => sum + campaign.repliedCount, 0),
      },
      recent: recentCampaigns,
    },
    chatbot: {
      enabledBots: workspace.chatbots.filter((chatbot) => chatbot.enabled).length,
      assignedChannels:
        workspace.numbers.filter((number) => number.chatbotId).length +
        workspace.instagramAccounts.filter((account) => account.chatbotId).length,
      aiMessagesSent: conversationsInRange.reduce(
        (sum, conversation) =>
          sum +
          conversation.messages.filter(
            (message) =>
              message.direction === 'OUTGOING' && message.senderType === 'AI_BOT'
          ).length,
        0
      ),
      botHandledRate: toPercent(botHandledConversations.length, conversationsInRange.length),
      handoffRate: toPercent(
        aiTouchedConversations.filter((conversation) =>
          conversation.messages.some(
            (message) =>
              message.direction === 'OUTGOING' &&
              message.senderType === 'USER' &&
              !message.isInternal
          )
        ).length,
        aiTouchedConversations.length
      ),
    },
    channels: {
      whatsappConnected: connectedWhatsApp,
      whatsappDisconnected: workspace.numbers.length - connectedWhatsApp,
      instagramConnected: connectedInstagram,
      instagramDisconnected: workspace.instagramAccounts.length - connectedInstagram,
      usage: usageItems,
      aiSpend: billingSummary.aiSpend,
      creditBalance: billingSummary.balance,
    },
    alerts,
  };
}

async function sendMetaMessage(to: string, text: string, type: 'whatsapp' | 'instagram', config: { accessToken: string, phoneNumberId?: string, instagramId?: string }) {
  try {
    if (type === 'whatsapp') {
      const response = await axios.post(
        `https://graph.facebook.com/v17.0/${config.phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          to: to,
          text: { body: text },
        },
        {
          headers: { Authorization: `Bearer ${config.accessToken}` },
        }
      );

      return response.data?.messages?.[0]?.id as string | undefined;
    } else {
      const response = await axios.post(
        `https://graph.facebook.com/v17.0/me/messages`, // 'me' works if the token is for the page
        {
          recipient: { id: to },
          message: { text: text },
        },
        {
          headers: { Authorization: `Bearer ${config.accessToken}` },
        }
      );

      return response.data?.message_id as string | undefined;
    }
  } catch (error: any) {
    const metaMessage =
      error.response?.data?.error?.message ||
      error.response?.data?.message ||
      error.message ||
      `Failed to send ${type} message`;
    console.error(`Error sending ${type} message:`, error.response?.data || error.message);
    throw new Error(metaMessage);
  }
}

async function uploadWhatsAppMedia(file: Express.Multer.File, config: { accessToken: string; phoneNumberId: string }) {
  const formData = new FormData();
  formData.append('messaging_product', 'whatsapp');
  formData.append('file', new Blob([file.buffer], { type: file.mimetype }), file.originalname);

  try {
    const response = await axios.post(
      `https://graph.facebook.com/v17.0/${config.phoneNumberId}/media`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
        },
        maxBodyLength: Infinity,
      }
    );

    return response.data?.id as string;
  } catch (error: any) {
    const metaMessage =
      error.response?.data?.error?.message ||
      error.response?.data?.message ||
      error.message ||
      'Failed to upload WhatsApp media';
    console.error('Error uploading WhatsApp media:', error.response?.data || error.message);
    throw new Error(metaMessage);
  }
}

async function sendWhatsAppMediaMessage(
  to: string,
  file: Express.Multer.File,
  config: { accessToken: string; phoneNumberId: string },
  caption?: string
) {
  const mediaKind = getWhatsAppMediaKind(file);
  if (!mediaKind) {
    throw new Error(`Unsupported attachment type: ${file.mimetype}`);
  }

  const mediaId = await uploadWhatsAppMedia(file, config);
  const payload: Record<string, any> = {
    messaging_product: 'whatsapp',
    to,
    type: mediaKind,
  };

  if (mediaKind === 'image') {
    payload.image = {
      id: mediaId,
      ...(caption ? { caption } : {}),
    };
  } else if (mediaKind === 'document') {
    payload.document = {
      id: mediaId,
      filename: file.originalname,
      ...(caption ? { caption } : {}),
    };
  } else {
    payload.audio = {
      id: mediaId,
    };
  }

  try {
    const response = await axios.post(
      `https://graph.facebook.com/v17.0/${config.phoneNumberId}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
        },
      }
    );
    return {
      mediaKind,
      mediaId,
      messageId: response.data?.messages?.[0]?.id as string | undefined
    };
  } catch (error: any) {
    const metaMessage =
      error.response?.data?.error?.message ||
      error.response?.data?.message ||
      error.message ||
      'Failed to send WhatsApp attachment';
    console.error('Error sending WhatsApp attachment:', error.response?.data || error.message);
    throw new Error(metaMessage);
  }
}

async function refreshBroadcastCampaignStats(campaignId: string) {
  const [deliveredCount, readCount, repliedCount, pendingCount] = await Promise.all([
    prisma.broadcastRecipient.count({
      where: {
        campaignId,
        status: { in: ['SENT', 'DELIVERED', 'READ', 'REPLIED'] }
      }
    }),
    prisma.broadcastRecipient.count({
      where: {
        campaignId,
        status: { in: ['READ', 'REPLIED'] }
      }
    }),
    prisma.broadcastRecipient.count({
      where: {
        campaignId,
        status: 'REPLIED'
      }
    }),
    prisma.broadcastRecipient.count({
      where: {
        campaignId,
        status: 'PENDING'
      }
    }),
  ]);

  return prisma.broadcastCampaign.update({
    where: { id: campaignId },
    data: {
      status: pendingCount > 0 ? 'SENDING' : 'COMPLETED',
      deliveredCount,
      readCount,
      repliedCount,
    },
    include: {
      _count: { select: { recipients: true } },
      number: true,
    }
  });
}

function fileToDataUrl(file?: Express.Multer.File) {
  if (!file) {
    return null;
  }

  const base64 = file.buffer.toString('base64');
  return `data:${file.mimetype};base64,${base64}`;
}

async function downloadMetaMedia(mediaId: string, accessToken: string) {
  const metadataResponse = await axios.get(
    `https://graph.facebook.com/v17.0/${mediaId}`,
    {
      params: { fields: 'url,mime_type' },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const mediaUrl = metadataResponse.data?.url as string | undefined;
  const mimeType = metadataResponse.data?.mime_type as string | undefined;

  if (!mediaUrl) {
    throw new Error('Meta did not return a media URL');
  }

  const fileResponse = await axios.get<ArrayBuffer>(mediaUrl, {
    responseType: 'arraybuffer',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return {
    buffer: Buffer.from(fileResponse.data),
    contentType: mimeType || fileResponse.headers['content-type'] || 'application/octet-stream',
  };
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || ALLOWED_ORIGINS.includes(origin)) {
          return callback(null, true);
        }
        callback(new Error("Not allowed by CORS"));
      },
      methods: ["GET", "POST"],
      credentials: true,
    }
  });
  const PORT = Number(process.env.PORT) || 3000;

  const syncWorkspaceSubscription = async (
    workspaceId: string,
    subscriptionId: string | null | undefined,
    planKey?: string | null,
    customerId?: string | Stripe.Customer | Stripe.DeletedCustomer | null
  ) => {
    if (!stripe || !workspaceId) return null;

    let subscription: Stripe.Subscription | null = null;
    if (subscriptionId) {
      subscription = await stripe.subscriptions.retrieve(subscriptionId);
    }

    const customerValue = typeof customerId === 'string'
      ? customerId
      : customerId && !customerId.deleted
        ? customerId.id
        : null;

    return prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        plan: planKey || undefined,
        stripeCustomerId: customerValue || undefined,
        stripeSubscriptionId: subscription?.id || subscriptionId || undefined,
        subscriptionStatus: subscription?.status || undefined,
        subscriptionCurrentPeriodEnd: subscription?.items.data[0]?.current_period_end
          ? new Date(subscription.items.data[0].current_period_end * 1000)
          : undefined,
        subscriptionCancelAtPeriodEnd: subscription?.cancel_at_period_end ?? false,
      }
    });
  };

  app.get("/health", (req, res) => {
    res.send("OK");
  });

  app.get("/api/ping", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Stripe Webhook
  app.post("/api/webhooks/stripe", express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripe || !sig || !webhookSecret) {
      return res.status(400).send('Webhook Error: Stripe not configured or missing signature');
    }

    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      console.error(`Webhook Error: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session;
        const workspaceId = session.metadata?.workspaceId;
        const planKey = session.metadata?.planKey;
        if (workspaceId) {
          // Update workspace billing status or add credits
          console.log(`Payment successful for workspace: ${workspaceId}, plan: ${planKey}`);
          
          await syncWorkspaceSubscription(workspaceId, typeof session.subscription === 'string' ? session.subscription : session.subscription?.id, planKey, session.customer);

          await prisma.billingLedgerEntry.create({
            data: {
              workspaceId,
              amount: (session.amount_total || 0) / 100,
              type: 'CREDIT',
              description: `Subscription payment - ${planKey || 'Plan'}`
            }
          });
        }
        break;
      case 'customer.subscription.updated':
      case 'customer.subscription.created':
        const subscription = event.data.object as Stripe.Subscription;
        if (subscription.metadata?.workspaceId) {
          await syncWorkspaceSubscription(
            subscription.metadata.workspaceId,
            subscription.id,
            subscription.metadata?.planKey,
            subscription.customer
          );
        }
        break;
      case 'customer.subscription.deleted':
        const deletedSubscription = event.data.object as Stripe.Subscription;
        if (deletedSubscription.metadata?.workspaceId) {
          await prisma.workspace.update({
            where: { id: deletedSubscription.metadata.workspaceId },
            data: {
              stripeSubscriptionId: deletedSubscription.id,
              subscriptionStatus: deletedSubscription.status,
              subscriptionCancelAtPeriodEnd: deletedSubscription.cancel_at_period_end,
              subscriptionCurrentPeriodEnd: deletedSubscription.items.data[0]?.current_period_end
                ? new Date(deletedSubscription.items.data[0].current_period_end * 1000)
                : null,
            }
          });
        }
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  });

  // Meta Webhook Verification (GET)
  app.get("/webhook/meta", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    const expectedToken = (process.env.META_VERIFY_TOKEN || "").trim();

    if (mode === "subscribe" && String(token).trim() === expectedToken) {
      console.log("Meta Webhook Verified Successfully!");
      // Meta requires the challenge to be returned exactly as received in the response body
      res.set('Content-Type', 'text/plain');
      return res.status(200).send(challenge);
    }
    
    console.error("Meta Webhook Verification Failed");
    return res.status(403).send("Verification failed");
  });

  app.use(express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf?.length ? buf.toString('utf8') : '';
    }
  }));

  const requireAuth = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };

  const authRateLimiter = (label: string) => (req: any, res: any, next: any) => {
    const now = Date.now();
    const key = `${label}:${req.ip || req.headers['x-forwarded-for'] || 'unknown'}`;
    const current = authRateLimitStore.get(key);

    if (!current || current.resetAt <= now) {
      authRateLimitStore.set(key, { count: 1, resetAt: now + AUTH_RATE_LIMIT_WINDOW_MS });
      return next();
    }

    if (current.count >= AUTH_RATE_LIMIT_MAX) {
      const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({ error: 'Too many attempts. Please try again later.' });
    }

    current.count += 1;
    authRateLimitStore.set(key, current);
    next();
  };

  const getUserByToken = async (req: any) => {
    return prisma.user.findUnique({ where: { id: req.user.userId } });
  };

  const hasSubscription = (status?: string | null) => ['active', 'trialing'].includes((status || '').toLowerCase());

  const requireWorkspaceAccessById = async (req: any, res: any, next: any, workspaceId?: string | null) => {
    if (!workspaceId) {
      return res.status(400).json({ error: 'Workspace is required' });
    }

    const membership = await prisma.workspaceMembership.findFirst({
      where: { workspaceId, userId: req.user.userId }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Workspace access denied' });
    }

    next();
  };

  const requireWorkspaceAccessFromQuery = async (req: any, res: any, next: any) =>
    requireWorkspaceAccessById(req, res, next, String(req.query.workspaceId || '').trim() || null);

  const requireConversationAccess = async (req: any, res: any, next: any) => {
    const conversationId = String(req.params.id || req.body.conversationId || '').trim();
    if (!conversationId) {
      return res.status(400).json({ error: 'Conversation is required' });
    }
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { workspaceId: true }
    });
    return requireWorkspaceAccessById(req, res, next, conversation?.workspaceId);
  };

  const requireContactAccess = async (req: any, res: any, next: any) => {
    const contactId = String(req.params.id || req.body.contactId || '').trim();
    if (!contactId) {
      return res.status(400).json({ error: 'Contact is required' });
    }
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { workspaceId: true }
    });
    return requireWorkspaceAccessById(req, res, next, contact?.workspaceId);
  };

  const requireVerifiedEmail = async (req: any, res: any, next: any) => {
    const user = await getUserByToken(req);
    if (!user?.emailVerified) {
      return res.status(403).json({ error: 'Verify your email before continuing' });
    }
    next();
  };

  const requireSuperadmin = async (req: any, res: any, next: any) => {
    const user = await getUserByToken(req);
    if (!user || String(user.email || '').toLowerCase() !== SUPERADMIN_EMAIL) {
      return res.status(403).json({ error: 'Superadmin access required' });
    }
    req.superadminUser = user;
    next();
  };

  const requireSubscribedWorkspaceById = async (req: any, res: any, next: any, workspaceId?: string | null) => {
    if (!workspaceId) {
      return res.status(400).json({ error: 'Workspace is required' });
    }
    const membership = await prisma.workspaceMembership.findFirst({
      where: { workspaceId, userId: req.user.userId },
      include: { workspace: true }
    });
    if (!membership) {
      return res.status(403).json({ error: 'Workspace access denied' });
    }
    if (!membership.userId) {
      return res.status(403).json({ error: 'Workspace access denied' });
    }
    const user = await getUserByToken(req);
    if (!user?.emailVerified) {
      return res.status(403).json({ error: 'Verify your email before using this feature' });
    }
    if (!hasSubscription(membership.workspace.subscriptionStatus)) {
      return res.status(403).json({ error: 'Subscribe to a plan to use this feature' });
    }
    next();
  };

  const requireSubscribedWorkspaceFromBody = async (req: any, res: any, next: any) =>
    requireSubscribedWorkspaceById(req, res, next, req.body.workspaceId || req.query.workspaceId);

  const requireSubscribedConversation = async (req: any, res: any, next: any) => {
    const conversationId = req.body.conversationId || req.params.id;
    const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
    return requireSubscribedWorkspaceById(req, res, next, conversation?.workspaceId);
  };

  const requireSubscribedContact = async (req: any, res: any, next: any) => {
    const contact = await prisma.contact.findUnique({ where: { id: req.params.id } });
    return requireSubscribedWorkspaceById(req, res, next, contact?.workspaceId);
  };

  const requireSubscribedTask = async (req: any, res: any, next: any) => {
    const task = await prisma.task.findUnique({ where: { id: req.params.id } });
    return requireSubscribedWorkspaceById(req, res, next, task?.workspaceId);
  };

  const enforceWorkspacePlanLimit = async (
    res: any,
    workspaceId: string,
    resource: 'whatsapp' | 'instagram' | 'chatbots' | 'contacts' | 'broadcasts' | 'automations',
    pendingAdds = 1
  ) => {
    if (pendingAdds <= 0) {
      return true;
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, plan: true }
    });

    if (!workspace) {
      res.status(404).json({ error: 'Workspace not found' });
      return false;
    }

    const limits = getWorkspacePlanLimits(workspace.plan);
    const currentCount =
      resource === 'whatsapp'
        ? await prisma.whatsAppNumber.count({ where: { workspaceId } })
        : resource === 'instagram'
          ? await prisma.instagramAccount.count({ where: { workspaceId } })
          : resource === 'chatbots'
            ? await prisma.chatbot.count({ where: { workspaceId } })
            : resource === 'broadcasts'
              ? await prisma.broadcastCampaign.count({ where: { workspaceId } })
              : resource === 'automations'
                ? await prisma.automationRule.count({ where: { workspaceId } })
                : await prisma.contact.count({ where: { workspaceId } });

    const limit = limits[resource];
    if (currentCount + pendingAdds > limit) {
      const resourceLabel =
        resource === 'whatsapp'
          ? 'WhatsApp numbers'
          : resource === 'instagram'
            ? 'Instagram accounts'
            : resource === 'chatbots'
              ? 'AI chatbots'
              : resource === 'broadcasts'
                ? 'broadcasts'
                : resource === 'automations'
                  ? 'automation rules'
                  : 'contacts';

      res.status(403).json({
        error: `Plan limit reached: ${limit} ${resourceLabel} allowed on ${workspace.plan} plan`
      });
      return false;
    }

    return true;
  };

  const verifyMetaSignature = (req: any) => {
    const signature = String(req.headers['x-hub-signature-256'] || '').trim();
    const appSecret = String(process.env.META_APP_SECRET || '').trim();
    const rawBody = String(req.rawBody || '');

    if (!signature || !appSecret || !rawBody) {
      return false;
    }

    const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
    if (signature.length !== expected.length) {
      return false;
    }

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  };

  const resolveContactListIds = async (workspaceId: string, listIds?: string[], listNames?: string[]) => {
    const resolvedIds = new Set((Array.isArray(listIds) ? listIds : []).filter(Boolean));
    const normalizedNames = Array.from(
      new Set((Array.isArray(listNames) ? listNames : []).map((name) => String(name).trim()).filter(Boolean))
    );

    if (!workspaceId || normalizedNames.length === 0) {
      return Array.from(resolvedIds);
    }

    const existingLists = await prisma.contactList.findMany({
      where: { workspaceId }
    });

    const byName = new Map(existingLists.map((list) => [list.name.trim().toLowerCase(), list]));

    for (const name of normalizedNames) {
      const existing = byName.get(name.toLowerCase());
      if (existing) {
        resolvedIds.add(existing.id);
        continue;
      }

      const created = await prisma.contactList.create({
        data: {
          workspaceId,
          name
        }
      });

      byName.set(created.name.trim().toLowerCase(), created);
      resolvedIds.add(created.id);
    }

    return Array.from(resolvedIds);
  };

  const parseImportedListNames = (value?: string | null) =>
    Array.from(
      new Set(
        String(value || '')
          .split(/[|;,]/)
          .map((name) => name.trim())
          .filter(Boolean)
      )
    );

  const normalizePipelineStageValue = (value?: string | null) => {
    const normalized = String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

    if (!normalized) {
      return 'NEW_LEAD';
    }

    const pipelineMap: Record<string, string> = {
      new_lead: 'NEW_LEAD',
      newlead: 'NEW_LEAD',
      contacted: 'CONTACTED',
      qualified: 'QUALIFIED',
      quote_sent: 'QUOTE_SENT',
      quotesent: 'QUOTE_SENT',
      won: 'WON',
      lost: 'LOST',
    };

    return pipelineMap[normalized] || 'NEW_LEAD';
  };

  const getApiBaseUrl = (req: express.Request) =>
    (API_URL || process.env.APP_URL || `${req.protocol}://${req.get('host') || `localhost:${PORT}`}`).replace(/\/$/, '');

  const getPublicAppBaseUrl = (req: express.Request) =>
    (PUBLIC_APP_URL || process.env.APP_URL || req.headers.origin || `${req.protocol}://${req.get('host') || `localhost:${PORT}`}`).replace(/\/$/, '');

  const getEmbeddedSignupCallbackUrl = (req: express.Request) =>
    `${getApiBaseUrl(req)}/api/meta/embedded-signup/callback`;

  const sendEmbeddedSignupCallbackPage = (res: express.Response, payload: EmbeddedSignupResultPayload) => {
    const message = JSON.stringify({
      type: 'meta-embedded-signup',
      payload,
    }).replace(/</g, '\\u003c');
    const callbackTargetOrigin = normalizeOriginValue(PUBLIC_APP_URL || process.env.APP_URL || '');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>WhatsApp connection</title>
    <style>
      body { font-family: Arial, sans-serif; background: #f6f8fb; color: #102030; display: grid; place-items: center; min-height: 100vh; margin: 0; }
      .card { background: white; border-radius: 16px; padding: 24px; box-shadow: 0 10px 30px rgba(16,32,48,.08); max-width: 420px; width: calc(100% - 32px); }
      h1 { font-size: 20px; margin: 0 0 8px; }
      p { margin: 0; color: #667085; line-height: 1.5; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Returning to WABA Hub</h1>
      <p>You can close this window if it does not close automatically.</p>
      </div>
      <script>
        (function () {
          var message = ${message};
          var targetOrigin = ${JSON.stringify(callbackTargetOrigin || '')} || window.location.origin;
          try {
            if (window.opener && !window.opener.closed) {
              window.opener.postMessage(message, targetOrigin);
            }
          } catch (error) {}
          window.setTimeout(function () { window.close(); }, 200);
        })();
    </script>
  </body>
</html>`);
  };

  // Socket.io connection handling
  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);
    
    socket.on("join-workspace", (workspaceId) => {
      socket.join(workspaceId);
      console.log(`User ${socket.id} joined workspace ${workspaceId}`);
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/meta/embedded-signup/config", requireAuth, async (req, res) => {
    res.json({
      enabled: Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET && process.env.META_EMBEDDED_SIGNUP_CONFIG_ID),
      graphVersion: META_GRAPH_VERSION,
      appId: process.env.META_APP_ID || null,
      configId: process.env.META_EMBEDDED_SIGNUP_CONFIG_ID || null,
      callbackUrl: getEmbeddedSignupCallbackUrl(req),
    });
  });

  app.get("/api/meta/embedded-signup/start", requireAuth, async (req: any, res) => {
    const workspaceId = String(req.query.workspaceId || '').trim();
    if (!workspaceId) {
      return res.status(400).json({ error: "Workspace is required" });
    }

    return requireSubscribedWorkspaceById(req, res, async () => {
      const appId = process.env.META_APP_ID;
      const configId = process.env.META_EMBEDDED_SIGNUP_CONFIG_ID;

      if (!appId || !process.env.META_APP_SECRET || !configId) {
        return res.status(400).json({ error: "Embedded Signup is not configured yet" });
      }

      const redirectUri = getEmbeddedSignupCallbackUrl(req);
      const params = new URLSearchParams({
        client_id: appId,
        redirect_uri: redirectUri,
        state: buildEmbeddedSignupState(workspaceId),
        response_type: 'code',
        config_id: configId,
        scope: 'business_management,whatsapp_business_management,whatsapp_business_messaging',
      });

      res.json({
        url: `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth?${params.toString()}`,
        callbackUrl: redirectUri,
      });
    }, workspaceId);
  });

  app.get("/api/meta/embedded-signup/callback", async (req, res) => {
    const error = String(req.query.error_message || req.query.error_description || req.query.error || '').trim();
    const state = parseEmbeddedSignupState(String(req.query.state || ''));
    const phoneNumberId = String(req.query.phone_number_id || '').trim();
    const wabaId = String(req.query.waba_id || '').trim();
    const displayPhoneNumber = String(req.query.display_phone_number || '').trim();
    const businessId = String(req.query.business_id || '').trim();
    const businessName = String(req.query.business_name || '').trim();

    if (error) {
      return sendEmbeddedSignupCallbackPage(res, {
        success: false,
        error,
        workspaceId: state?.workspaceId || null,
      });
    }

    const code = String(req.query.code || '').trim();
    if (!code) {
      return sendEmbeddedSignupCallbackPage(res, {
        success: false,
        error: "Meta did not return an authorization code",
        workspaceId: state?.workspaceId || null,
      });
    }

    try {
      const redirectUri = getEmbeddedSignupCallbackUrl(req);
      const tokenResponse = await exchangeMetaCodeForAccessToken(code, redirectUri);
      let phoneNumbers = await fetchEmbeddedSignupPhoneAssets(tokenResponse.access_token);

      if (phoneNumbers.length === 0 && phoneNumberId) {
        phoneNumbers = [
          {
            wabaId: wabaId || null,
            phoneNumberId,
            displayPhoneNumber: formatMetaDisplayPhoneNumber(displayPhoneNumber || phoneNumberId),
            businessName: businessName || null,
          },
        ];
      }

      if (phoneNumbers.length === 0) {
        return sendEmbeddedSignupCallbackPage(res, {
          success: false,
          error: "Meta connected successfully, but no WhatsApp phone number details were returned",
          workspaceId: state?.workspaceId || null,
        });
      }

      return sendEmbeddedSignupCallbackPage(res, {
        success: true,
        workspaceId: state?.workspaceId || null,
        businessId: businessId || null,
        accessToken: tokenResponse.access_token,
        tokenExpiresAt: tokenResponse.expires_in
          ? new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString()
          : null,
        phoneNumbers,
      });
    } catch (callbackError: any) {
      return sendEmbeddedSignupCallbackPage(res, {
        success: false,
        error: callbackError?.response?.data?.error?.message || callbackError?.message || "Could not finish WhatsApp Embedded Signup",
        workspaceId: state?.workspaceId || null,
      });
    }
  });

  app.post("/api/meta/embedded-signup/finalize", requireAuth, requireSubscribedWorkspaceFromBody, async (req, res) => {
    const {
      workspaceId,
      phoneNumberId,
      displayPhoneNumber,
      wabaId,
      businessId,
      accessToken,
      tokenExpiresAt,
      verifiedName,
      businessName,
      name,
    } = req.body;

    const normalizedWorkspaceId = String(workspaceId || '').trim();
    const normalizedPhoneNumberId = String(phoneNumberId || '').trim();
    const normalizedDisplayPhone = formatMetaDisplayPhoneNumber(displayPhoneNumber);
    const normalizedAccessToken = String(accessToken || '').trim();

    if (!normalizedWorkspaceId || !normalizedPhoneNumberId || !normalizedDisplayPhone || !normalizedAccessToken) {
      return res.status(400).json({ error: "Workspace, phone number, and Meta token are required" });
    }

    const existingByMetaId = await prisma.whatsAppNumber.findUnique({
      where: { metaPhoneNumberId: normalizedPhoneNumberId }
    });

    const existingByPhone = existingByMetaId
      ? null
      : await prisma.whatsAppNumber.findFirst({
          where: {
            workspaceId: normalizedWorkspaceId,
            phoneNumber: normalizedDisplayPhone
          }
        });

    const existing = existingByMetaId || existingByPhone;
    const nextName = String(name || verifiedName || businessName || normalizedDisplayPhone).trim() || normalizedDisplayPhone;
    const nextTokenExpiresAt = tokenExpiresAt ? new Date(tokenExpiresAt) : null;
    const movingAcrossWorkspaces = Boolean(existing && existing.workspaceId !== normalizedWorkspaceId);
    const needsCapacity = !existing || movingAcrossWorkspaces;

    if (!(await enforceWorkspacePlanLimit(res, normalizedWorkspaceId, 'whatsapp', needsCapacity ? 1 : 0))) {
      return;
    }

    const data = {
      name: nextName,
      phoneNumber: normalizedDisplayPhone,
      status: 'CONNECTED',
      connectionSource: 'EMBEDDED_SIGNUP',
      metaPhoneNumberId: normalizedPhoneNumberId,
      metaWabaId: String(wabaId || '').trim() || null,
      metaBusinessId: String(businessId || '').trim() || null,
      metaAccessToken: normalizedAccessToken,
      metaTokenExpiresAt: nextTokenExpiresAt,
      workspaceId: normalizedWorkspaceId,
      autoReply: movingAcrossWorkspaces ? false : existing?.autoReply ?? false,
      chatbotId: movingAcrossWorkspaces ? null : existing?.chatbotId ?? null,
    };

    const savedNumber = existing
      ? await prisma.whatsAppNumber.update({
          where: { id: existing.id },
          data,
        })
      : await prisma.whatsAppNumber.create({
          data,
        });

    res.json(savedNumber);
  });

  // Stripe Checkout
  app.post("/api/billing/create-checkout-session", requireAuth, requireVerifiedEmail, async (req, res) => {
    if (!stripe) return res.status(500).json({ error: "Stripe not configured" });
    const { planId, planKey, workspaceId, successUrl, cancelUrl } = req.body;

    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price: planId, // This should be a Stripe Price ID
            quantity: 1,
          },
        ],
        mode: "subscription",
        subscription_data: {
          metadata: { workspaceId, planKey }
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { workspaceId, planKey },
      });
      res.json({ url: session.url });
    } catch (e: any) {
      res.status(400).json({ error: e.message || "Message could not be sent" });
    }
  });

  app.post("/api/billing/sync-subscription", requireAuth, async (req: any, res) => {
    if (!stripe) return res.status(500).json({ error: "Stripe not configured" });
    const { workspaceId } = req.body;
    if (!workspaceId) return res.status(400).json({ error: "Missing workspaceId" });

    const membership = await prisma.workspaceMembership.findFirst({
      where: { workspaceId, userId: req.user.userId },
      include: { workspace: true }
    });
    if (!membership) return res.status(403).json({ error: "Workspace access denied" });

    const sessions = await stripe.checkout.sessions.list({ limit: 50 });
    const latestPaidSession = sessions.data
      .filter((session) =>
        session.metadata?.workspaceId === workspaceId &&
        session.payment_status === 'paid' &&
        session.status === 'complete'
      )
      .sort((a, b) => b.created - a.created)[0];

    if (!latestPaidSession) {
      return res.status(404).json({ error: "No paid checkout session found for this workspace" });
    }

    const updatedWorkspace = await syncWorkspaceSubscription(
      workspaceId,
      typeof latestPaidSession.subscription === 'string'
        ? latestPaidSession.subscription
        : latestPaidSession.subscription?.id,
      latestPaidSession.metadata?.planKey,
      latestPaidSession.customer
    );

    res.json({ workspace: updatedWorkspace });
  });

  // AI Chatbot Query
  app.post("/api/chatbots/query", requireAuth, async (req: any, res) => {
    const { chatbotId, message, conversationId } = req.body;

    try {
      const chatbot = await prisma.chatbot.findUnique({
        where: { id: chatbotId }
      });

      if (!chatbot || !chatbot.enabled) {
        return res.status(404).json({ error: "Chatbot not found or disabled" });
      }

      const membership = await prisma.workspaceMembership.findFirst({
        where: {
          workspaceId: chatbot.workspaceId,
          userId: req.user.userId,
        },
        include: { workspace: true },
      });

      if (!membership) {
        return res.status(403).json({ error: "Workspace access denied" });
      }

      if (!membership.workspace || !hasSubscription(membership.workspace.subscriptionStatus)) {
        return res.status(403).json({ error: "Choose a paid plan to use AI chatbots" });
      }

      const responseText = await getAIResponse(chatbot, message);

      if (!responseText) {
        return res.status(500).json({ error: "No AI provider configured or AI failed" });
      }

      // Save the AI message if conversationId is provided
      if (conversationId) {
        const aiMsg = await prisma.message.create({
          data: {
            conversationId,
            content: responseText,
            direction: 'OUTGOING',
            senderType: 'AI_BOT',
            senderName: chatbot.name,
            status: 'SENT'
          }
        });

        // Broadcast the new message via Socket.io
        const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
        if (conversation) {
          io.to(conversation.workspaceId).emit("new-message", aiMsg);
        }
      }

      res.json({ response: responseText });
    } catch (e: any) {
      console.error('AI Error:', e);
      res.status(500).json({ error: "AI processing failed" });
    }
  });

  app.post("/api/ai/reply-suggestions", requireAuth, requireSubscribedWorkspaceFromBody, async (req, res) => {
    const history = Array.isArray(req.body?.history) ? req.body.history : [];
    const workspaceId = String(req.body?.workspaceId || '').trim() || null;

    try {
      const suggestions = await generateAIReplySuggestions(history, workspaceId);
      if (!suggestions.length) {
        return res.status(500).json({ error: "No AI provider configured or AI failed" });
      }
      res.json({ suggestions });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to generate reply suggestions" });
    }
  });

  app.post("/api/ai/summarize", requireAuth, requireSubscribedWorkspaceFromBody, async (req, res) => {
    const history = Array.isArray(req.body?.history) ? req.body.history : [];
    const workspaceId = String(req.body?.workspaceId || '').trim() || null;

    try {
      const summary = await generateAISummary(history, workspaceId);
      if (!summary) {
        return res.status(500).json({ error: "No AI provider configured or AI failed" });
      }
      res.json({ summary });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to summarize conversation" });
    }
  });

  app.post("/webhook/meta", async (req: any, res) => {
    if (!verifyMetaSignature(req)) {
      return res.status(403).send("Forbidden");
    }

    const body = req.body;
    console.log("Meta Webhook received", {
      object: body?.object,
      entryCount: Array.isArray(body?.entry) ? body.entry.length : 0,
    });

    // Process incoming messages from WhatsApp
    if (body.object === "whatsapp_business_account") {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const message = value?.messages?.[0];
      const statuses = value?.statuses || [];
      const metadata = value?.metadata;

      for (const receipt of statuses) {
        const metaMessageId = receipt?.id;
        if (!metaMessageId) {
          continue;
        }

        let recipient = await prisma.broadcastRecipient.findFirst({
          where: { metaMessageId }
        });

        if (!recipient && receipt?.recipient_id && metadata?.display_phone_number) {
          const workspaceNumbers = await prisma.whatsAppNumber.findMany();
          const displayDigits = normalizePhone(metadata.display_phone_number);
          const receiptChannel = workspaceNumbers.find(
            (candidate) =>
              (candidate.metaPhoneNumberId && candidate.metaPhoneNumberId === metadata?.phone_number_id) ||
              normalizePhone(candidate.phoneNumber) === displayDigits
          );

          if (receiptChannel) {
            const fallbackRecipients = await prisma.broadcastRecipient.findMany({
              where: {
                campaign: { workspaceId: receiptChannel.workspaceId },
                status: { in: ['SENT', 'DELIVERED'] }
              },
              include: {
                campaign: {
                  select: {
                    scheduledAt: true
                  }
                }
              }
            });

            const recipientDigits = normalizePhone(receipt.recipient_id);
            recipient = fallbackRecipients
              .filter((candidate) => normalizePhone(candidate.phoneNumber) === recipientDigits)
              .sort((a, b) => {
                const aTime = a.campaign.scheduledAt ? new Date(a.campaign.scheduledAt).getTime() : 0;
                const bTime = b.campaign.scheduledAt ? new Date(b.campaign.scheduledAt).getTime() : 0;
                return bTime - aTime;
              })[0] ?? null;
          }
        }

        if (!recipient) {
          continue;
        }

        const nextStatus =
          receipt.status === 'read'
            ? 'READ'
            : receipt.status === 'delivered'
              ? 'DELIVERED'
              : receipt.status === 'failed'
                ? 'FAILED'
                : receipt.status === 'sent'
                  ? 'SENT'
                  : null;

        if (!nextStatus) {
          continue;
        }

        await prisma.broadcastRecipient.update({
          where: { id: recipient.id },
          data: {
            status: nextStatus,
            metaMessageId
          }
        });

        await refreshBroadcastCampaignStats(recipient.campaignId);
      }

      if (message) {
        const incomingPayload = buildIncomingWhatsAppMessagePayload(message);
        if (!incomingPayload) {
          return res.sendStatus(200);
        }

        const from = message.from;
        const phoneNumberId = metadata?.phone_number_id;
        const displayPhoneNumber = metadata?.display_phone_number;

        // Meta returns display numbers without punctuation, so normalize before matching.
        const numbers = await prisma.whatsAppNumber.findMany();
        const displayDigits = normalizePhone(displayPhoneNumber);
        const number = numbers.find(
          (candidate) =>
            (candidate.metaPhoneNumberId && candidate.metaPhoneNumberId === phoneNumberId) ||
            normalizePhone(candidate.phoneNumber) === displayDigits
        );

        if (number) {
          // Find or create contact
          let contact = await prisma.contact.findFirst({
            where: { 
              workspaceId: number.workspaceId,
              phoneNumber: from
            }
          });

          if (!contact) {
            contact = await prisma.contact.create({
              data: {
                name: value.contacts?.[0]?.profile?.name || from,
                phoneNumber: from,
                workspaceId: number.workspaceId,
                lastActivityAt: new Date(),
              }
            });
          } else {
            contact = await prisma.contact.update({
              where: { id: contact.id },
              data: {
                lastActivityAt: new Date(),
              },
            });
          }

          // Find or create conversation
          let conversation = await prisma.conversation.findFirst({
            where: { 
              workspaceId: number.workspaceId,
              contactId: contact.id,
              channelType: 'WHATSAPP'
            }
          });

          if (!conversation) {
            conversation = await prisma.conversation.create({
              data: {
                workspaceId: number.workspaceId,
                contactId: contact.id,
                numberId: number.id,
                channelType: 'WHATSAPP',
                status: 'ACTIVE',
                lastMessageAt: new Date()
              }
            });
          } else {
            conversation = await prisma.conversation.update({
              where: { id: conversation.id },
              data: { lastMessageAt: new Date() }
            });
          }

          const newMsg = await prisma.message.create({
            data: {
              conversationId: conversation.id,
              content: incomingPayload.content,
              type: incomingPayload.type,
              mediaId: incomingPayload.type === 'TEXT' ? null : incomingPayload.mediaId,
              mediaMimeType: incomingPayload.type === 'TEXT' ? null : incomingPayload.mediaMimeType,
              mediaFilename: incomingPayload.type === 'TEXT' ? null : incomingPayload.mediaFilename,
              direction: 'INCOMING',
              senderType: 'USER',
              status: 'READ',
              readAt: null,
            }
          });

          const repliedRecipient = await prisma.broadcastRecipient.findFirst({
            where: {
              phoneNumber: from,
              status: { in: ['SENT', 'DELIVERED', 'READ'] },
              campaign: {
                workspaceId: number.workspaceId,
                numberId: number.id,
              }
            },
            include: {
              campaign: {
                select: {
                  scheduledAt: true
                }
              }
            },
            orderBy: {
              campaign: {
                scheduledAt: 'desc'
              }
            }
          });

          if (repliedRecipient) {
            await prisma.broadcastRecipient.update({
              where: { id: repliedRecipient.id },
              data: { status: 'REPLIED' }
            });

            await refreshBroadcastCampaignStats(repliedRecipient.campaignId);
          }

          // Broadcast via Socket.io
          io.to(number.workspaceId).emit("new-message", newMsg);
          io.to(number.workspaceId).emit("conversation-updated", conversation.id);

          // Trigger AI Chatbot if enabled
          if (!conversation.aiPaused && number.autoReply && number.chatbotId && incomingPayload.aiInput) {
            const chatbot = await prisma.chatbot.findUnique({ where: { id: number.chatbotId } });
            if (chatbot && chatbot.enabled) {
              const aiResponse = await getAIResponse(chatbot, incomingPayload.aiInput);
              if (aiResponse) {
                const whatsAppConfig = getWhatsAppChannelConfig(number);
                // Send back to WhatsApp
                await sendMetaMessage(from, aiResponse, 'whatsapp', {
                  accessToken: whatsAppConfig.accessToken,
                  phoneNumberId: whatsAppConfig.phoneNumberId || phoneNumberId
                });

                // Save AI message
                const aiMsg = await prisma.message.create({
                  data: {
                    conversationId: conversation.id,
                    content: aiResponse,
                    direction: 'OUTGOING',
                    senderType: 'AI_BOT',
                    senderName: chatbot.name,
                    status: 'SENT'
                  }
                });

                io.to(number.workspaceId).emit("new-message", aiMsg);
              }
            }
          }
        }
      }
    }

    // Process incoming messages from Instagram
    if (body.object === "instagram") {
      const entry = body.entry?.[0];
      const messaging = entry?.messaging?.[0];
      const senderId = messaging?.sender?.id;
      const recipientId = messaging?.recipient?.id;
      const message = messaging?.message;

      if (message && message.text) {
        const text = message.text;

        // Find the Instagram account in our DB
        const account = await prisma.instagramAccount.findUnique({
          where: { instagramId: recipientId }
        });

        if (account) {
          // Find or create contact
          let contact = await prisma.contact.findFirst({
            where: { 
              workspaceId: account.workspaceId,
              instagramId: senderId
            }
          });

          if (!contact) {
            contact = await prisma.contact.create({
              data: {
                instagramId: senderId,
                workspaceId: account.workspaceId,
                lastActivityAt: new Date(),
              }
            });
          } else {
            contact = await prisma.contact.update({
              where: { id: contact.id },
              data: {
                lastActivityAt: new Date(),
              },
            });
          }

          // Find or create conversation
          let conversation = await prisma.conversation.findFirst({
            where: { 
              workspaceId: account.workspaceId,
              contactId: contact.id,
              channelType: 'INSTAGRAM'
            }
          });

          if (!conversation) {
            conversation = await prisma.conversation.create({
              data: {
                workspaceId: account.workspaceId,
                contactId: contact.id,
                instagramAccountId: account.id,
                channelType: 'INSTAGRAM',
                status: 'ACTIVE',
                lastMessageAt: new Date()
              }
            });
          }

          const newMsg = await prisma.message.create({
            data: {
              conversationId: conversation.id,
              content: text,
              direction: 'INCOMING',
              senderType: 'USER',
              status: 'READ',
              readAt: null,
            }
          });

          // Broadcast via Socket.io
          io.to(account.workspaceId).emit("new-message", newMsg);
          io.to(account.workspaceId).emit("conversation-updated", conversation.id);

          // Trigger AI Chatbot if enabled
            if (!conversation.aiPaused && account.chatbotId) {
            const chatbot = await prisma.chatbot.findUnique({ where: { id: account.chatbotId } });
            if (chatbot && chatbot.enabled) {
              const aiResponse = await getAIResponse(chatbot, text);
              if (aiResponse) {
                // Send back to Instagram
                await sendMetaMessage(senderId, aiResponse, 'instagram', {
                  accessToken: account.accessToken || process.env.META_ACCESS_TOKEN || "",
                  instagramId: recipientId
                });

                // Save AI message
                const aiMsg = await prisma.message.create({
                  data: {
                    conversationId: conversation.id,
                    content: aiResponse,
                    direction: 'OUTGOING',
                    senderType: 'AI_BOT',
                    senderName: chatbot.name,
                    status: 'SENT'
                  }
                });

                io.to(account.workspaceId).emit("new-message", aiMsg);
              }
            }
          }
        }
      }
    }

    res.sendStatus(200);
  });

  // Auth Mock (For demo purposes)
  app.post("/api/auth/register", authRateLimiter('register'), async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Missing name, email or password" });
    }

    try {
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ error: "User already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          emailVerified: false,
        },
      });

      // Create initial workspace for the user
      const workspace = await prisma.workspace.create({
        data: {
          name: `${name}'s Workspace`,
          slug: `${name.toLowerCase().replace(/ /g, '-')}-${Date.now()}`,
          plan: 'NONE',
        }
      });

      await prisma.workspaceMembership.create({
        data: {
          userId: user.id,
          workspaceId: workspace.id,
          role: 'OWNER'
        }
      });

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({ token, user: sanitizeUser(user) });
    } catch (e: any) {
      console.error('[auth:register]', e);
      res.status(500).json({ error: 'Registration failed' });
    }
  });

  app.post("/api/auth/verify-email", requireAuth, async (req, res) => {
    try {
      const user = await prisma.user.update({
        where: { id: (req as any).user.userId },
        data: { emailVerified: true }
      });
      res.json({ success: true, user: sanitizeUser(user) });
    } catch (e: any) {
      console.error('[auth:verify-email]', e);
      res.status(500).json({ error: 'Could not verify email' });
    }
  });

  app.post("/api/auth/forgot-password", authRateLimiter('forgot-password'), async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (user?.id) {
      const { token, tokenHash } = createPasswordResetToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetTokenHash: tokenHash,
          passwordResetExpiresAt: expiresAt,
        }
      });

      const appBaseUrl = getPublicAppBaseUrl(req);
      const resetUrl = `${appBaseUrl}/reset-password?token=${token}`;
      console.log(`[AUTH] Password reset requested for ${email} at ${new Date().toISOString()}`);
      // TODO: send resetUrl via email provider. Do not expose or log tokens in responses.
      void resetUrl;
    }

    res.json({
      success: true,
      message: "If the account exists, a reset link is ready.",
    });
  });

  app.get("/api/auth/reset-password/validate", async (req, res) => {
    const token = String(req.query?.token || '').trim();
    if (!token) {
      return res.status(400).json({ error: "Reset token is required" });
    }

    const tokenHash = hashPasswordResetToken(token);
    const user = await prisma.user.findFirst({
      where: {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: {
          gt: new Date(),
        }
      },
      select: { id: true }
    });

    if (!user) {
      return res.status(400).json({ error: "This password reset link is invalid or has expired" });
    }

    res.json({ success: true });
  });

  app.post("/api/auth/reset-password", authRateLimiter('reset-password'), async (req, res) => {
    const token = String(req.body?.token || '').trim();
    const password = String(req.body?.password || '');

    if (!token || !password) {
      return res.status(400).json({ error: "Reset token and new password are required" });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const tokenHash = hashPasswordResetToken(token);
    const user = await prisma.user.findFirst({
      where: {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: {
          gt: new Date(),
        }
      }
    });

    if (!user) {
      return res.status(400).json({ error: "This password reset link is invalid or has expired" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
      }
    });

    res.json({ success: true });
  });

  app.post("/api/auth/login", authRateLimiter('login'), async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({
      where: { email },
      include: { memberships: { include: { workspace: true } } }
    });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token, user: sanitizeUser(user) });
  });

  app.get("/api/users/:id", requireAuth, async (req: any, res) => {
    if (req.user.userId !== req.params.id) {
      const sharedWorkspace = await prisma.workspaceMembership.findFirst({
        where: {
          userId: req.params.id,
          workspace: {
            members: {
              some: {
                userId: req.user.userId,
              }
            }
          }
        }
      });

      if (!sharedWorkspace) {
        return res.status(403).json({ error: "Access denied" });
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        emailVerified: true,
      }
    });
    if (user) res.json(user);
    else res.status(404).json({ error: "User not found" });
  });

  // Workspace Routes
  app.get("/api/workspaces", requireAuth, async (req: any, res) => {
    const memberships = await prisma.workspaceMembership.findMany({
      where: { userId: req.user.userId },
      include: { workspace: true }
    });
    res.json(memberships.map(m => m.workspace));
  });

  app.post("/api/workspaces", requireAuth, requireVerifiedEmail, async (req: any, res) => {
    const { name } = req.body;
    const userId = req.user.userId;
    if (!name) return res.status(400).json({ error: "Workspace name is required" });

    let slug = name.toLowerCase().trim().replace(/ /g, '-').replace(/[^\w-]+/g, '');
    if (!slug) slug = 'workspace';
    
    // Check if user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "User not found" });

    // Check if slug exists
    const existing = await prisma.workspace.findUnique({ where: { slug } });
    if (existing) {
      slug = `${slug}-${Math.random().toString(36).substring(2, 7)}`;
    }
    
    try {
      // 1. Create Workspace
      const workspace = await prisma.workspace.create({
        data: {
          name,
          slug,
          plan: 'NONE',
        }
      });

      // 2. Create Membership
      await prisma.workspaceMembership.create({
        data: {
          userId,
          workspaceId: workspace.id,
          role: 'OWNER'
        }
      });

      // 3. Create Business Settings
      await prisma.businessSetting.create({
        data: {
          workspaceId: workspace.id,
          timezone: 'UTC'
        }
      });

      res.json(workspace);
    } catch (e: any) {
      console.error('[workspace:create]', e);
      res.status(500).json({ error: "Unable to create workspace. Please try again." });
    }
  });

  const withDashboardAccess =
    (section?: (summary: Awaited<ReturnType<typeof getDashboardSections>>) => unknown) =>
    async (req: any, res: any, next: any) => {
      try {
        const workspaceId = String(req.query.workspaceId || '').trim();
        if (!workspaceId) {
          return res.status(400).json({ error: 'Workspace is required' });
        }

        const membership = await prisma.workspaceMembership.findFirst({
          where: { workspaceId, userId: req.user.userId },
          include: { workspace: true },
        });

        if (!membership) {
          return res.status(403).json({ error: 'Workspace access denied' });
        }

        const user = await getUserByToken(req);
        if (!user?.emailVerified) {
          return res.status(403).json({ error: 'Verify your email before using this feature' });
        }

        if (!hasSubscription(membership.workspace.subscriptionStatus)) {
          return res.status(403).json({ error: 'Subscribe to a plan to use this feature' });
        }

        const summary = await getDashboardSections(workspaceId, req.query);
        res.json(section ? section(summary) : summary);
      } catch (error) {
        next(error);
      }
    };

  app.get("/api/dashboard/summary", requireAuth, withDashboardAccess());
  app.get("/api/dashboard/overview", requireAuth, withDashboardAccess((summary) => summary.overview));
  app.get("/api/dashboard/pipeline", requireAuth, withDashboardAccess((summary) => summary.pipeline));
  app.get("/api/dashboard/inbox", requireAuth, withDashboardAccess((summary) => summary.inbox));
  app.get("/api/dashboard/team", requireAuth, withDashboardAccess((summary) => summary.team));
  app.get("/api/dashboard/campaigns", requireAuth, withDashboardAccess((summary) => summary.campaigns));
  app.get("/api/dashboard/chatbot", requireAuth, withDashboardAccess((summary) => summary.chatbot));
  app.get("/api/dashboard/channels", requireAuth, withDashboardAccess((summary) => summary.channels));
  app.get("/api/dashboard/alerts", requireAuth, withDashboardAccess((summary) => ({
    meta: summary.meta,
    alerts: summary.alerts,
  })));

  // Inbox Routes
  app.get("/api/conversations", requireAuth, requireWorkspaceAccessFromQuery, async (req, res) => {
    const { workspaceId } = req.query;
    const conversations = await prisma.conversation.findMany({
      where: { workspaceId: workspaceId as string },
      include: { 
        contact: true, 
        assignedTo: { select: { id: true, name: true, image: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        tasks: { where: { status: 'PENDING' } },
        number: { include: { chatbot: { select: { id: true, name: true, enabled: true } } } },
        instagramAccount: { include: { chatbot: { select: { id: true, name: true, enabled: true } } } }
      },
      orderBy: { lastMessageAt: 'desc' }
    });

    // Mark breached conversations
    const now = new Date();
    for (const conv of conversations) {
      if (conv.slaDeadline && conv.slaDeadline < now && conv.slaStatus !== 'BREACHED') {
        await prisma.conversation.update({
          where: { id: conv.id },
          data: { slaStatus: 'BREACHED' }
        });
        conv.slaStatus = 'BREACHED'; // Update local object for response
      }
    }

    res.json(conversations);
  });

  app.get("/api/conversations/:id", requireAuth, requireConversationAccess, async (req, res) => {
    await prisma.message.updateMany({
      where: {
        conversationId: req.params.id,
        direction: 'INCOMING',
        isInternal: false,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    const conversation = await prisma.conversation.findUnique({
      where: { id: req.params.id },
      include: { 
        contact: { 
          include: { 
            customValues: { include: { definition: true } },
            activities: { orderBy: { createdAt: 'desc' }, take: 20 },
            tasks: true,
            listMemberships: { include: { list: true } }
          } 
        }, 
        assignedTo: { select: { id: true, name: true, image: true } },
        messages: { orderBy: { createdAt: 'asc' } },
        notes: { orderBy: { createdAt: 'desc' } },
        tasks: { orderBy: { createdAt: 'desc' } },
        activities: { orderBy: { createdAt: 'desc' }, take: 20 },
        number: { include: { chatbot: { select: { id: true, name: true, enabled: true } } } },
        instagramAccount: { include: { chatbot: { select: { id: true, name: true, enabled: true } } } }
      }
    });
    res.json(conversation);
  });

  app.get("/api/messages/:id/media", requireAuth, async (req: any, res) => {
    try {
      const message = await prisma.message.findUnique({
        where: { id: req.params.id },
        include: {
          conversation: {
            include: {
              instagramAccount: true,
              number: true,
            }
          }
        }
      });

      if (!message?.mediaId) {
        return res.status(404).json({ error: "Media not found for this message" });
      }

      const membership = await prisma.workspaceMembership.findFirst({
        where: {
          workspaceId: message.conversation.workspaceId,
          userId: req.user.userId
        }
      });

      if (!membership) {
        return res.status(403).json({ error: "Workspace access denied" });
      }

      const accessToken =
        message.conversation.channelType === 'INSTAGRAM'
          ? message.conversation.instagramAccount?.accessToken || process.env.META_ACCESS_TOKEN || ""
          : getWhatsAppChannelConfig(message.conversation.number).accessToken;

      if (!accessToken) {
        return res.status(400).json({ error: "Meta media access token is not configured" });
      }

      const media = await downloadMetaMedia(message.mediaId, accessToken);
      const fallbackName =
        message.mediaFilename ||
        (message.type === 'IMAGE'
          ? 'image'
          : message.type === 'AUDIO'
            ? 'audio'
            : 'document');

      res.setHeader('Content-Type', message.mediaMimeType || media.contentType);
      res.setHeader('Cache-Control', 'private, max-age=60');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fallbackName)}"`);
      return res.send(media.buffer);
    } catch (error: any) {
      console.error('Failed to proxy Meta media:', error.response?.data || error.message);
      return res.status(500).json({
        error:
          error.response?.data?.error?.message ||
          error.message ||
          'Failed to load media',
      });
    }
  });

  app.patch("/api/conversations/:id", requireAuth, requireSubscribedConversation, async (req, res) => {
    const { assignedToId, priority, status, internalStatus, tags, resolvedAt, slaStatus, aiPaused } = req.body;
    
    const oldConv = await prisma.conversation.findUnique({ where: { id: req.params.id } });
    
    const conversation = await prisma.conversation.update({
      where: { id: req.params.id },
      data: { 
        assignedToId, 
        priority, 
        status, 
        internalStatus, 
        tags, 
        resolvedAt: resolvedAt ? new Date(resolvedAt) : undefined,
        slaStatus,
        aiPaused
      }
    });

    // Log activity if assignment changed
    if (assignedToId && assignedToId !== oldConv?.assignedToId) {
      await prisma.activityLog.create({
        data: {
          type: 'ASSIGNMENT',
          content: `Conversation assigned to user ${assignedToId}`,
          conversationId: conversation.id,
          contactId: conversation.contactId,
          workspaceId: conversation.workspaceId
        }
      });
    }

    if (priority && priority !== oldConv?.priority) {
      await prisma.activityLog.create({
        data: {
          type: 'PRIORITY_UPDATED',
          content: `Priority changed to ${priority}`,
          conversationId: conversation.id,
          contactId: conversation.contactId,
          workspaceId: conversation.workspaceId
        }
      });
    }

    if (internalStatus && internalStatus !== oldConv?.internalStatus) {
      await prisma.activityLog.create({
        data: {
          type: 'STATUS_UPDATED',
          content: `Internal status changed to ${internalStatus.replaceAll('_', ' ')}`,
          conversationId: conversation.id,
          contactId: conversation.contactId,
          workspaceId: conversation.workspaceId
        }
      });
    }

    if (typeof aiPaused === 'boolean' && aiPaused !== oldConv?.aiPaused) {
      await prisma.activityLog.create({
        data: {
          type: 'AI_HANDOFF',
          content: aiPaused ? 'AI chatbot paused for agent handoff' : 'AI chatbot resumed for this conversation',
          conversationId: conversation.id,
          contactId: conversation.contactId,
          workspaceId: conversation.workspaceId
        }
      });
    }

    io.to(conversation.workspaceId).emit("conversation-updated", conversation.id);

    res.json(conversation);
  });

  app.post("/api/messages", requireAuth, requireSubscribedConversation, async (req, res) => {
    const { conversationId, content, direction, senderType, isInternal, senderName } = req.body;
    
    const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });

    const message = await prisma.message.create({
      data: {
        conversationId,
        content,
        direction,
        senderType,
        senderName,
        isInternal: isInternal || false,
        status: 'SENT',
        readAt: direction === 'INCOMING' && !isInternal ? null : undefined,
      }
    });
    
    const updateData: any = { lastMessageAt: new Date() };
    
    // SLA Tracking
    if (direction === 'OUTGOING' && !isInternal) {
      if (!conversation.firstResponseAt) {
        updateData.firstResponseAt = new Date();
      }
      updateData.slaDeadline = null; // Reset deadline on response
      updateData.slaStatus = 'OK';
    } else if (direction === 'INCOMING') {
      // Set deadline if not already set (e.g., 2 hours from now)
      if (!conversation.slaDeadline) {
        const deadline = new Date();
        deadline.setHours(deadline.getHours() + 2);
        updateData.slaDeadline = deadline;
        updateData.slaStatus = 'OK';
      }
    }

    await prisma.conversation.update({
      where: { id: conversationId },
      data: updateData
    });

    await prisma.contact.update({
      where: { id: conversation.contactId },
      data: { lastActivityAt: new Date() }
    });

    // Automation Rules Engine
    if (direction === 'INCOMING') {
      const rules = await prisma.automationRule.findMany({
        where: { workspaceId: conversation.workspaceId, enabled: true }
      });

      for (const rule of rules) {
        let shouldTrigger = false;
        const conditions = JSON.parse(rule.conditions || '{}');
        const actions = JSON.parse(rule.actions || '[]');
        
        if (rule.trigger === 'NEW_LEAD' && !conversation.firstResponseAt) {
          shouldTrigger = true;
        } else if (rule.trigger === 'KEYWORD' && content.toLowerCase().includes(conditions.keyword?.toLowerCase())) {
          shouldTrigger = true;
        }

        if (shouldTrigger) {
          const actionData: any = {};
          // Assuming actions is an array of { type: string, value: any }
          for (const action of actions) {
            if (action.type === 'AUTO_ASSIGN' && action.value) {
              actionData.assignedToId = action.value;
            } else if (action.type === 'AUTO_PRIORITIZE') {
              actionData.priority = 'HIGH';
            }
          }

          if (Object.keys(actionData).length > 0) {
            await prisma.conversation.update({
              where: { id: conversationId },
              data: actionData
            });
            
            await prisma.activityLog.create({
              data: {
                type: 'AUTOMATION',
                content: `Rule "${rule.name}" triggered`,
                conversationId,
                contactId: conversation.contactId,
                workspaceId: conversation.workspaceId
              }
            });
          }
        }
      }
    }

    // Log activity
    if (!isInternal) {
      await prisma.activityLog.create({
        data: {
          type: 'MESSAGE_SENT',
          content: direction === 'OUTGOING'
            ? `Message sent by ${senderName || 'agent'}`
            : 'Customer sent a message',
          conversationId,
          contactId: conversation.contactId,
          workspaceId: conversation.workspaceId
        }
      });
    }

    res.json(message);
  });

  // Socket.io Broadcast for manual messages
  app.post("/api/messages/send", requireAuth, upload.array('attachments', 5), requireSubscribedConversation, async (req, res) => {
    const { conversationId, content, senderId, senderName, isInternal } = req.body;
    const attachments = (req.files as Express.Multer.File[] | undefined) || [];
    const isInternalMessage = isInternal === true || isInternal === 'true';
    const createdMessages = [];
    
    try {
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          contact: true,
          number: true,
          instagramAccount: true
        }
      });

      if (!conversation) return res.status(404).json({ error: "Conversation not found" });

      if (!isInternalMessage) {
        if (conversation.channelType === 'WHATSAPP') {
          const to = normalizePhone(conversation.contact.phoneNumber);
          const whatsAppConfig = getWhatsAppChannelConfig(conversation.number);
          const phoneNumberId = whatsAppConfig.phoneNumberId;

          if (!to || !phoneNumberId || !whatsAppConfig.accessToken) {
            return res.status(400).json({ error: "WhatsApp channel is not fully configured" });
          }

          for (const attachment of attachments) {
            const sentMedia = await sendWhatsAppMediaMessage(
              to,
              attachment,
              {
                accessToken: whatsAppConfig.accessToken,
                phoneNumberId
              },
              content?.trim() || undefined
            );

            createdMessages.push(await prisma.message.create({
              data: {
                conversationId,
                content:
                  sentMedia.mediaKind === 'image'
                    ? content?.trim() || '[Image]'
                    : sentMedia.mediaKind === 'audio'
                      ? '[Audio]'
                      : `[Document] ${attachment.originalname}`,
                type: sentMedia.mediaKind.toUpperCase(),
                mediaId: sentMedia.mediaId,
                mediaMimeType: attachment.mimetype,
                mediaFilename: attachment.originalname,
                direction: 'OUTGOING',
                senderType: 'USER',
                senderName,
                isInternal: isInternalMessage,
                status: 'SENT',
              }
            }));
          }

          if (content?.trim() && attachments.length === 0) {
            await sendMetaMessage(to, content, 'whatsapp', {
              accessToken: whatsAppConfig.accessToken,
              phoneNumberId
            });
          }
        } else if (conversation.channelType === 'INSTAGRAM' && conversation.contact.instagramId) {
          if (attachments.length > 0) {
            return res.status(400).json({ error: "Instagram attachments are not connected yet. Send text only for now." });
          }
          await sendMetaMessage(conversation.contact.instagramId, content, 'instagram', {
            accessToken: conversation.instagramAccount?.accessToken || process.env.META_ACCESS_TOKEN || "",
            instagramId: conversation.instagramAccount?.instagramId
          });
        }
      }

      if (content?.trim() || attachments.length === 0) {
        createdMessages.push(await prisma.message.create({
          data: {
            conversationId,
            content,
            direction: 'OUTGOING',
            senderType: 'USER',
            senderName,
            isInternal: isInternalMessage,
            status: 'SENT'
          }
        }));
      }

      await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: new Date(),
          aiPaused: !isInternalMessage ? true : conversation.aiPaused
        }
      });

      await prisma.contact.update({
        where: { id: conversation.contactId },
        data: { lastActivityAt: new Date() }
      });

      if (isInternalMessage) {
        await prisma.activityLog.create({
          data: {
            type: 'INTERNAL_NOTE',
            content: `Internal note added by ${senderName || 'team member'}`,
            conversationId,
            contactId: conversation.contactId,
            workspaceId: conversation.workspaceId
          }
        });
      } else {
        await prisma.activityLog.create({
          data: {
            type: 'MESSAGE_SENT',
            content: `Message sent by ${senderName || 'agent'}`,
            conversationId,
            contactId: conversation.contactId,
            workspaceId: conversation.workspaceId
          }
        });

        if (!conversation.aiPaused) {
          await prisma.activityLog.create({
            data: {
              type: 'AI_HANDOFF',
              content: `AI chatbot paused after ${senderName || 'agent'} took over the conversation`,
              conversationId,
              contactId: conversation.contactId,
              workspaceId: conversation.workspaceId
            }
          });
        }
      }

      // Broadcast to all clients in this workspace
      for (const message of createdMessages) {
        io.to(conversation.workspaceId).emit("new-message", message);
      }
      io.to(conversation.workspaceId).emit("conversation-updated", conversation.id);

      res.json({ messages: createdMessages });
    } catch (e: any) {
      res.status(400).json({ error: e.message || "Message could not be sent" });
    }
  });

  // Templates
  app.get("/api/templates/whatsapp", requireAuth, requireWorkspaceAccessFromQuery, async (req, res) => {
    const { workspaceId } = req.query;
    const templates = await prisma.whatsAppTemplate.findMany({
      where: { workspaceId: workspaceId as string }
    });
    res.json(templates);
  });

  // Numbers
  app.get("/api/numbers", requireAuth, requireWorkspaceAccessFromQuery, async (req, res) => {
    const { workspaceId } = req.query;
    const numbers = await prisma.whatsAppNumber.findMany({
      where: { workspaceId: workspaceId as string },
      include: { chatbot: true }
    });
    res.json(numbers);
  });

  // Instagram Accounts
  app.get("/api/instagram/accounts", requireAuth, requireWorkspaceAccessFromQuery, async (req, res) => {
    const { workspaceId } = req.query;
    const accounts = await prisma.instagramAccount.findMany({
      where: { workspaceId: workspaceId as string },
      include: { chatbot: true }
    });
    res.json(accounts);
  });

  app.post("/api/instagram/accounts", requireAuth, requireSubscribedWorkspaceFromBody, async (req, res) => {
    const { workspaceId, name, instagramId, username } = req.body;
    if (!(await enforceWorkspacePlanLimit(res, workspaceId, 'instagram'))) {
      return;
    }
    const account = await prisma.instagramAccount.create({
      data: {
        workspaceId,
        name,
        instagramId,
        username,
        status: 'CONNECTED'
      }
    });
    res.json(account);
  });

  // Chatbots
  app.get("/api/chatbots", requireAuth, requireWorkspaceAccessFromQuery, async (req, res) => {
    const { workspaceId } = req.query;
    const chatbots = await prisma.chatbot.findMany({
      where: { workspaceId: workspaceId as string },
      include: { numbers: true, instagramAccounts: true, tools: true }
    });
    res.json(chatbots);
  });

  app.post("/api/chatbots", requireAuth, requireSubscribedWorkspaceFromBody, async (req, res) => {
    const { workspaceId, name, instructions } = req.body;
    if (!(await enforceWorkspacePlanLimit(res, workspaceId, 'chatbots'))) {
      return;
    }
    const chatbot = await prisma.chatbot.create({
      data: {
        workspaceId,
        name,
        instructions,
        model: FIXED_CHATBOT_MODEL,
        enabled: true
      },
      include: { numbers: true, instagramAccounts: true, tools: true }
    });
    res.json(chatbot);
  });

  app.patch("/api/chatbots/:id", requireAuth, async (req, res, next) => {
    const chatbot = await prisma.chatbot.findUnique({ where: { id: req.params.id } });
    return requireSubscribedWorkspaceById(req, res, next, chatbot?.workspaceId);
  }, async (req, res) => {
    const { name, instructions, enabled, language } = req.body;
    const chatbot = await prisma.chatbot.update({
      where: { id: req.params.id },
      data: {
        name,
        instructions,
        model: FIXED_CHATBOT_MODEL,
        enabled,
        language
      },
      include: { numbers: true, instagramAccounts: true, tools: true }
    });
    res.json(chatbot);
  });

  // Team
  app.get("/api/team", requireAuth, requireWorkspaceAccessFromQuery, async (req, res) => {
    const { workspaceId } = req.query;
    const members = await prisma.workspaceMembership.findMany({
      where: { workspaceId: workspaceId as string },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            emailVerified: true,
          }
        }
      }
    });
    res.json(members.map(sanitizeMembership));
  });

  app.post("/api/team", requireAuth, requireSubscribedWorkspaceFromBody, async (req: any, res) => {
    const { workspaceId, name, email, password, role } = req.body;

    if (!workspaceId || !name?.trim() || !email?.trim()) {
      return res.status(400).json({ error: "Name, email, and workspace are required" });
    }

    const membership = await prisma.workspaceMembership.findFirst({
      where: {
        workspaceId,
        userId: req.user.userId
      },
      include: {
        workspace: true
      }
    });

    if (!membership) {
      return res.status(403).json({ error: "Workspace access denied" });
    }

    if (!['OWNER', 'ADMIN'].includes(membership.role)) {
      return res.status(403).json({ error: "Only owners or admins can add team members" });
    }

    const currentMembersCount = await prisma.workspaceMembership.count({
      where: { workspaceId }
    });

    const userLimit = getWorkspaceUserLimit(membership.workspace.plan);
    if (currentMembersCount >= userLimit) {
      return res.status(400).json({ error: `User limit reached for ${membership.workspace.plan || 'Starter'} plan` });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = sanitizeDisplayName(name, normalizedEmail);
    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (!user) {
      if (!password?.trim() || password.trim().length < 6) {
        return res.status(400).json({ error: "New members need a password with at least 6 characters" });
      }

      user = await prisma.user.create({
        data: {
          name: normalizedName,
          email: normalizedEmail,
          password: await bcrypt.hash(password.trim(), 10),
          emailVerified: true,
        }
      });
    } else if (!user.name || EMAIL_LIKE_REGEX.test(user.name)) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { name: normalizedName }
      });
    }

    const existingMembership = await prisma.workspaceMembership.findFirst({
      where: {
        workspaceId,
        userId: user.id
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            emailVerified: true,
          }
        }
      }
    });

    if (existingMembership) {
      return res.status(400).json({ error: "This user is already in the team" });
    }

    const teamMember = await prisma.workspaceMembership.create({
      data: {
        workspaceId,
        userId: user.id,
        role: ['OWNER', 'ADMIN', 'USER'].includes((role || '').toUpperCase()) ? role.toUpperCase() : 'USER',
        status: 'ACTIVE',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            emailVerified: true,
          }
        }
      }
    });

    res.json(sanitizeMembership(teamMember));
  });

  app.patch("/api/team/:id", requireAuth, requireSubscribedWorkspaceFromBody, async (req: any, res) => {
    const { workspaceId, name, role, status } = req.body;
    const membershipId = req.params.id;

    if (!workspaceId || !membershipId) {
      return res.status(400).json({ error: "Workspace and member are required" });
    }

    const actorMembership = await prisma.workspaceMembership.findFirst({
      where: {
        workspaceId,
        userId: req.user.userId
      }
    });

    if (!actorMembership || actorMembership.role !== 'OWNER') {
      return res.status(403).json({ error: "Only the owner can update team members" });
    }

    const targetMembership = await prisma.workspaceMembership.findFirst({
      where: {
        id: membershipId,
        workspaceId
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            emailVerified: true,
          }
        }
      }
    });

    if (!targetMembership) {
      return res.status(404).json({ error: "Team member not found" });
    }

    if (targetMembership.userId === req.user.userId) {
      return res.status(400).json({ error: "Manage your own account from Settings" });
    }

    if (targetMembership.role === 'OWNER') {
      return res.status(403).json({ error: "Owner account cannot be edited here" });
    }

    const nextRole = ['ADMIN', 'USER'].includes((role || '').toUpperCase()) ? role.toUpperCase() : targetMembership.role;
    const nextStatus = ['ACTIVE', 'INACTIVE'].includes((status || '').toUpperCase()) ? status.toUpperCase() : targetMembership.status;
    const nextName = sanitizeDisplayName(name, targetMembership.user.email);

    await prisma.user.update({
      where: { id: targetMembership.user.id },
      data: {
        name: nextName
      }
    });

    const updatedMembership = await prisma.workspaceMembership.update({
      where: { id: membershipId },
      data: {
        role: nextRole,
        status: nextStatus
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            emailVerified: true,
          }
        }
      }
    });

    res.json(sanitizeMembership(updatedMembership));
  });

  app.delete("/api/team/:id", requireAuth, requireSubscribedWorkspaceFromBody, async (req: any, res) => {
    const { workspaceId } = req.body;
    const membershipId = req.params.id;

    if (!workspaceId || !membershipId) {
      return res.status(400).json({ error: "Workspace and member are required" });
    }

    const actorMembership = await prisma.workspaceMembership.findFirst({
      where: {
        workspaceId,
        userId: req.user.userId
      }
    });

    if (!actorMembership || actorMembership.role !== 'OWNER') {
      return res.status(403).json({ error: "Only the owner can remove team members" });
    }

    const targetMembership = await prisma.workspaceMembership.findFirst({
      where: {
        id: membershipId,
        workspaceId
      }
    });

    if (!targetMembership) {
      return res.status(404).json({ error: "Team member not found" });
    }

    if (targetMembership.userId === req.user.userId) {
      return res.status(400).json({ error: "You cannot remove your own membership here" });
    }

    if (targetMembership.role === 'OWNER') {
      return res.status(403).json({ error: "Owner account cannot be removed here" });
    }

    await prisma.workspaceMembership.delete({
      where: {
        id: membershipId
      }
    });

    res.json({ success: true });
  });

  // Contacts / CRM
  app.get("/api/contacts", requireAuth, requireWorkspaceAccessFromQuery, async (req, res) => {
    const { workspaceId } = req.query;
    const contacts = await prisma.contact.findMany({
      where: { workspaceId: workspaceId as string },
      include: { 
        conversations: { take: 1, orderBy: { lastMessageAt: 'desc' } },
        activities: { orderBy: { createdAt: 'desc' }, take: 5 },
        tasks: { where: { status: 'PENDING' } },
        listMemberships: {
          include: { list: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(contacts);
  });

  app.post("/api/contacts", requireAuth, requireSubscribedWorkspaceFromBody, async (req, res) => {
    const { workspaceId, name, phoneNumber, instagramUsername, pipelineStage, city, leadSource, tags, notes, assignedToId, listIds, listNames, estimatedValue, lostReason } = req.body;

    if (!workspaceId) {
      return res.status(400).json({ error: "Workspace is required" });
    }

    if (!name?.trim() && !phoneNumber?.trim() && !instagramUsername?.trim()) {
      return res.status(400).json({ error: "Add at least a name, phone number, or Instagram username" });
    }

    const resolvedListIds = await resolveContactListIds(workspaceId, listIds, listNames);

    if (!(await enforceWorkspacePlanLimit(res, workspaceId, 'contacts'))) {
      return;
    }

    const contact = await prisma.contact.create({
      data: {
        workspaceId,
        name: name?.trim() || phoneNumber?.trim() || instagramUsername?.trim() || 'New Contact',
        phoneNumber: phoneNumber?.trim() || null,
        instagramUsername: instagramUsername?.trim() || null,
        pipelineStage: pipelineStage || 'NEW_LEAD',
        city: city?.trim() || null,
        estimatedValue: Number(estimatedValue || 0) || 0,
        lostReason: lostReason?.trim() || null,
        leadSource: leadSource?.trim() || null,
        tags: tags?.trim() || null,
        notes: notes?.trim() || null,
        lastActivityAt: new Date(),
        assignedToId: assignedToId || null,
        listMemberships: resolvedListIds.length > 0
          ? {
              create: resolvedListIds.map((listId: string) => ({
                listId
              }))
            }
          : undefined
      },
      include: {
        conversations: { take: 1, orderBy: { lastMessageAt: 'desc' } },
        activities: { orderBy: { createdAt: 'desc' }, take: 5 },
        tasks: { where: { status: 'PENDING' } },
        listMemberships: {
          include: { list: true }
        }
      }
    });

    await prisma.activityLog.create({
      data: {
        type: 'CONTACT_CREATED',
        content: `Contact ${contact.name || contact.phoneNumber || 'New Contact'} was added`,
        contactId: contact.id,
        workspaceId: contact.workspaceId
      }
    });

    res.json(contact);
  });

  app.post("/api/contacts/import", requireAuth, requireSubscribedWorkspaceFromBody, async (req: any, res) => {
    const {
      workspaceId,
      rows,
      mappings,
      defaults,
      duplicateMode,
    } = req.body as {
      workspaceId?: string;
      rows?: Record<string, unknown>[];
      mappings?: Record<string, string | undefined>;
      defaults?: {
        pipelineStage?: string;
        leadSource?: string;
        listNames?: string[];
      };
      duplicateMode?: 'skip' | 'merge';
    };

    if (!workspaceId) {
      return res.status(400).json({ error: "Workspace is required" });
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: "Upload a CSV with at least one row" });
    }

    const normalizedMappings = {
      name: mappings?.name || '',
      phoneNumber: mappings?.phoneNumber || '',
      leadSource: mappings?.leadSource || '',
      pipelineStage: mappings?.pipelineStage || '',
      listNames: mappings?.listNames || '',
    };

    if (!normalizedMappings.phoneNumber) {
      return res.status(400).json({ error: "Map a phone number column before importing" });
    }

    const importDefaults = {
      pipelineStage: normalizePipelineStageValue(defaults?.pipelineStage),
      leadSource: defaults?.leadSource?.trim() || '',
      listNames: Array.from(
        new Set((Array.isArray(defaults?.listNames) ? defaults?.listNames : []).map((name) => String(name).trim()).filter(Boolean))
      ),
    };

    const preparedRows = rows.filter((row) => row && typeof row === 'object');

    const allListNames = new Set(importDefaults.listNames);
    for (const row of preparedRows) {
      const rowValue = normalizedMappings.listNames
        ? row[normalizedMappings.listNames]
        : '';
      for (const listName of parseImportedListNames(String(rowValue || ''))) {
        allListNames.add(listName);
      }
    }

    if (allListNames.size > 0) {
      await resolveContactListIds(workspaceId, [], Array.from(allListNames));
    }

    const workspaceLists = await prisma.contactList.findMany({
      where: { workspaceId }
    });
    const listIdByName = new Map(
      workspaceLists.map((list) => [list.name.trim().toLowerCase(), list.id])
    );

    const existingContacts = await prisma.contact.findMany({
      where: {
        workspaceId,
        phoneNumber: { not: null }
      },
      include: {
        listMemberships: {
          include: { list: true }
        }
      }
    });

    const existingByPhone = new Map(
      existingContacts
        .map((contact) => [normalizePhone(contact.phoneNumber), contact] as const)
        .filter(([digits]) => Boolean(digits))
    );

    const newPhonesToCreate = new Set<string>();
    for (const row of preparedRows) {
      const phoneValue = normalizedMappings.phoneNumber ? String(row[normalizedMappings.phoneNumber] ?? '').trim() : '';
      const normalizedPhone = normalizePhone(phoneValue);
      if (normalizedPhone && !existingByPhone.has(normalizedPhone)) {
        newPhonesToCreate.add(normalizedPhone);
      }
    }

    if (!(await enforceWorkspacePlanLimit(res, workspaceId, 'contacts', newPhonesToCreate.size))) {
      return;
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const [index, row] of preparedRows.entries()) {
      const nameValue = normalizedMappings.name ? String(row[normalizedMappings.name] ?? '').trim() : '';
      const phoneValue = normalizedMappings.phoneNumber ? String(row[normalizedMappings.phoneNumber] ?? '').trim() : '';
      const normalizedPhone = normalizePhone(phoneValue);

      if (!normalizedPhone) {
        skipped += 1;
        errors.push(`Row ${index + 2}: missing a valid phone number`);
        continue;
      }

      const formattedPhone = phoneValue.startsWith('+') ? phoneValue : `+${normalizedPhone}`;
      const leadSourceValue = normalizedMappings.leadSource
        ? String(row[normalizedMappings.leadSource] ?? '').trim()
        : '';
      const pipelineStageValue = normalizedMappings.pipelineStage
        ? String(row[normalizedMappings.pipelineStage] ?? '').trim()
        : '';
      const rowListNames = normalizedMappings.listNames
        ? parseImportedListNames(String(row[normalizedMappings.listNames] ?? ''))
        : [];

      const resolvedRowListIds = Array.from(
        new Set([...importDefaults.listNames, ...rowListNames].map((name) => listIdByName.get(name.trim().toLowerCase())).filter(Boolean))
      ) as string[];

      const existing = existingByPhone.get(normalizedPhone);
      const nextName = nameValue || existing?.name || formattedPhone;
      const nextLeadSource = leadSourceValue || importDefaults.leadSource || existing?.leadSource || null;
      const nextPipelineStage = normalizePipelineStageValue(pipelineStageValue || importDefaults.pipelineStage || existing?.pipelineStage);

      if (existing) {
        if (duplicateMode === 'skip') {
          skipped += 1;
          continue;
        }

        const existingMembershipIds = new Set(existing.listMemberships.map((membership) => membership.listId));
        const missingListIds = resolvedRowListIds.filter((listId) => !existingMembershipIds.has(listId));

        const updatedContact = await prisma.contact.update({
          where: { id: existing.id },
          data: {
            name: nextName,
            phoneNumber: formattedPhone,
            leadSource: nextLeadSource,
            pipelineStage: nextPipelineStage,
            lastActivityAt: new Date(),
            listMemberships: missingListIds.length > 0
              ? {
                  create: missingListIds.map((listId) => ({ listId }))
                }
              : undefined
          },
          include: {
            listMemberships: {
              include: { list: true }
            }
          }
        });

        existingByPhone.set(normalizedPhone, updatedContact);
        updated += 1;
        continue;
      }

      const createdContact = await prisma.contact.create({
        data: {
          workspaceId,
          name: nextName,
          phoneNumber: formattedPhone,
          pipelineStage: nextPipelineStage,
          leadSource: nextLeadSource,
          lastActivityAt: new Date(),
          listMemberships: resolvedRowListIds.length > 0
            ? {
                create: resolvedRowListIds.map((listId) => ({ listId }))
              }
            : undefined
        },
        include: {
          listMemberships: {
            include: { list: true }
          }
        }
      });

      existingByPhone.set(normalizedPhone, createdContact);
      created += 1;
    }

    await prisma.activityLog.create({
      data: {
        type: 'CONTACT_IMPORT',
        content: `CSV import completed: ${created} created, ${updated} updated, ${skipped} skipped`,
        workspaceId,
        userId: req.user?.id || null,
        metadata: JSON.stringify({
          created,
          updated,
          skipped,
          duplicateMode: duplicateMode === 'skip' ? 'skip' : 'merge',
        }),
      }
    });

    res.json({
      created,
      updated,
      skipped,
      totalRows: preparedRows.length,
      errors: errors.slice(0, 20),
    });
  });

  app.get("/api/contacts/:id", requireAuth, requireContactAccess, async (req, res) => {
    const contact = await prisma.contact.findUnique({
      where: { id: req.params.id },
      include: {
        conversations: { include: { messages: { take: 1, orderBy: { createdAt: 'desc' } } } },
        activities: { orderBy: { createdAt: 'desc' } },
        tasks: { orderBy: { createdAt: 'desc' } },
        customValues: { include: { definition: true } },
        listMemberships: { include: { list: true } }
      }
    });
    res.json(contact);
  });

  app.patch("/api/contacts/:id", requireAuth, requireSubscribedContact, async (req, res) => {
    const { pipelineStage, name, phoneNumber, city, leadSource, tags, notes, assignedToId, listIds, listNames, estimatedValue, lostReason } = req.body;
    const oldContact = await prisma.contact.findUnique({ where: { id: req.params.id } });

    const shouldSyncLists = Array.isArray(listIds) || Array.isArray(listNames);

    if (shouldSyncLists) {
      await prisma.contactListMember.deleteMany({
        where: { contactId: req.params.id }
      });
    }

    const resolvedListIds = shouldSyncLists
      ? await resolveContactListIds(oldContact?.workspaceId || '', listIds, listNames)
      : [];

    const contact = await prisma.contact.update({
      where: { id: req.params.id },
      data: {
        pipelineStage,
        name,
        phoneNumber,
        city,
        estimatedValue: estimatedValue === undefined ? undefined : Number(estimatedValue || 0) || 0,
        lostReason: lostReason === undefined ? undefined : lostReason?.trim() || null,
        leadSource,
        tags,
        notes,
        lastActivityAt: new Date(),
        assignedToId,
        listMemberships: shouldSyncLists
          ? {
              create: resolvedListIds.map((listId: string) => ({ listId }))
            }
          : undefined
      },
      include: {
        listMemberships: {
          include: { list: true }
        }
      }
    });

    if (pipelineStage && pipelineStage !== oldContact?.pipelineStage) {
      await prisma.activityLog.create({
        data: {
          type: 'STAGE_CHANGE',
          content: `Lead stage changed from ${oldContact?.pipelineStage} to ${pipelineStage}`,
          contactId: contact.id,
          workspaceId: contact.workspaceId
        }
      });
    }

    res.json(contact);
  });

  app.get("/api/contact-lists", requireAuth, requireWorkspaceAccessFromQuery, async (req, res) => {
    const { workspaceId } = req.query;
    const lists = await prisma.contactList.findMany({
      where: { workspaceId: workspaceId as string },
      include: {
        members: {
          include: { contact: true }
        }
      },
      orderBy: { name: 'asc' }
    });
    res.json(lists);
  });

  app.post("/api/contact-lists", requireAuth, requireSubscribedWorkspaceFromBody, async (req, res) => {
    const { workspaceId, name, contactIds } = req.body;

    if (!workspaceId || !name?.trim()) {
      return res.status(400).json({ error: "Workspace and list name are required" });
    }

    const list = await prisma.contactList.create({
      data: {
        workspaceId,
        name: name.trim(),
        members: Array.isArray(contactIds) && contactIds.length > 0
          ? {
              create: contactIds.map((contactId: string) => ({ contactId }))
            }
          : undefined
      },
      include: {
        members: {
          include: { contact: true }
        }
      }
    });

    res.json(list);
  });

  app.post("/api/contacts/bulk-lists", requireAuth, requireSubscribedWorkspaceFromBody, async (req, res) => {
    const { workspaceId, contactIds, listIds, listNames, action } = req.body;

    if (!workspaceId || !Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({ error: "Workspace and at least one contact are required" });
    }

    if (!['add', 'remove'].includes(action)) {
      return res.status(400).json({ error: "Action must be add or remove" });
    }

    let resolvedListIds: string[] = [];

    if (action === 'add') {
      resolvedListIds = await resolveContactListIds(workspaceId, listIds, listNames);
    } else {
      const ids = new Set((Array.isArray(listIds) ? listIds : []).filter(Boolean));
      const normalizedNames = Array.from(
        new Set((Array.isArray(listNames) ? listNames : []).map((name) => String(name).trim().toLowerCase()).filter(Boolean))
      );

      if (normalizedNames.length > 0) {
        const existingLists = await prisma.contactList.findMany({
          where: { workspaceId }
        });
        for (const list of existingLists) {
          if (normalizedNames.includes(list.name.trim().toLowerCase())) {
            ids.add(list.id);
          }
        }
      }

      resolvedListIds = Array.from(ids);
    }
    if (resolvedListIds.length === 0) {
      return res.status(400).json({ error: "Select at least one list" });
    }

    if (action === 'add') {
      for (const contactId of contactIds) {
        for (const listId of resolvedListIds) {
          const existingMembership = await prisma.contactListMember.findFirst({
            where: { contactId, listId }
          });
          if (!existingMembership) {
            await prisma.contactListMember.create({
              data: { contactId, listId }
            });
          }
        }
      }
    } else {
      await prisma.contactListMember.deleteMany({
        where: {
          contactId: { in: contactIds },
          listId: { in: resolvedListIds }
        }
      });
    }

    const contacts = await prisma.contact.findMany({
      where: { id: { in: contactIds } },
      include: {
        listMemberships: {
          include: { list: true }
        }
      }
    });

    res.json({ contacts });
  });

  // Tasks
  app.get("/api/tasks", requireAuth, requireWorkspaceAccessFromQuery, async (req, res) => {
    const { workspaceId, contactId, conversationId } = req.query;
    const tasks = await prisma.task.findMany({
      where: { 
        workspaceId: workspaceId as string,
        contactId: contactId as string || undefined,
        conversationId: conversationId as string || undefined
      },
      orderBy: { dueDate: 'asc' }
    });
    res.json(tasks);
  });

  app.post("/api/tasks", requireAuth, requireSubscribedWorkspaceFromBody, async (req, res) => {
    const { title, description, dueDate, priority, assignedToId, contactId, conversationId, workspaceId } = req.body;
    const task = await prisma.task.create({
      data: {
        title,
        description,
        dueDate: dueDate ? new Date(dueDate) : null,
        priority,
        assignedToId,
        contactId,
        conversationId,
        workspaceId
      }
    });

    await prisma.activityLog.create({
      data: {
        type: 'TASK_CREATED',
        content: `New task created: ${title}`,
        contactId,
        conversationId,
        workspaceId
      }
    });

    if (conversationId) {
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { workspaceId: true }
      });
      if (conversation?.workspaceId) {
        io.to(conversation.workspaceId).emit("conversation-updated", conversationId);
      }
    }

    res.json(task);
  });

  app.patch("/api/tasks/:id", requireAuth, requireSubscribedTask, async (req, res) => {
    const { status, title, description, dueDate, priority, assignedToId } = req.body;
    const previousTask = await prisma.task.findUnique({ where: { id: req.params.id } });
    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: { status, title, description, dueDate: dueDate ? new Date(dueDate) : undefined, priority, assignedToId }
    });

    await prisma.activityLog.create({
      data: {
        type: 'TASK_UPDATED',
        content: status && status !== previousTask?.status
          ? `Task "${task.title}" marked ${status.toLowerCase()}`
          : `Task "${task.title}" updated`,
        contactId: task.contactId,
        conversationId: task.conversationId,
        workspaceId: task.workspaceId
      }
    });

    if (task.conversationId) {
      io.to(task.workspaceId).emit("conversation-updated", task.conversationId);
    }
    res.json(task);
  });

  // Automation Rules
  app.get("/api/automation/rules", requireAuth, async (req, res) => {
    const { workspaceId } = req.query;
    const rules = await prisma.automationRule.findMany({
      where: { workspaceId: workspaceId as string }
    });
    res.json(rules);
  });

  app.post("/api/automation/rules", requireAuth, requireSubscribedWorkspaceFromBody, async (req, res) => {
    const { name, trigger, conditions, actions, workspaceId } = req.body;
    if (!(await enforceWorkspacePlanLimit(res, workspaceId, 'automations'))) {
      return;
    }
    const rule = await prisma.automationRule.create({
      data: {
        name,
        trigger,
        conditions: JSON.stringify(conditions),
        actions: JSON.stringify(actions),
        workspaceId
      }
    });
    res.json(rule);
  });

  // Activity Logs
  app.get("/api/activity-logs", requireAuth, requireWorkspaceAccessFromQuery, async (req, res) => {
    const { workspaceId, contactId, conversationId } = req.query;
    const logs = await prisma.activityLog.findMany({
      where: {
        workspaceId: workspaceId as string,
        contactId: contactId as string || undefined,
        conversationId: conversationId as string || undefined
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json(logs);
  });

  // Campaigns
  app.get("/api/campaigns", requireAuth, requireWorkspaceAccessFromQuery, async (req, res) => {
    const { workspaceId } = req.query;
    const campaigns = await prisma.broadcastCampaign.findMany({
      where: { workspaceId: workspaceId as string },
      include: { 
        _count: { select: { recipients: true } },
        number: true,
      },
      orderBy: { scheduledAt: 'desc' }
    });
    res.json(campaigns);
  });

  app.get("/api/campaigns/:id", requireAuth, async (req: any, res) => {
    const campaign = await prisma.broadcastCampaign.findUnique({
      where: { id: req.params.id },
      include: {
        number: true,
        recipients: {
          orderBy: { phoneNumber: 'asc' }
        },
        _count: { select: { recipients: true } }
      }
    });

    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    const membership = await prisma.workspaceMembership.findFirst({
      where: {
        workspaceId: campaign.workspaceId,
        userId: req.user.userId
      }
    });

    if (!membership) {
      return res.status(403).json({ error: "Workspace access denied" });
    }

    res.json(campaign);
  });

  app.post("/api/campaigns/test", requireAuth, upload.single('headerImage'), requireSubscribedWorkspaceFromBody, async (req, res) => {
    const { workspaceId, name, numberId, phoneNumber, messageBody } = req.body;
    const headerImage = req.file as Express.Multer.File | undefined;

    if (!workspaceId || !name?.trim() || !numberId || !phoneNumber?.trim()) {
      return res.status(400).json({ error: "Campaign name, sender, and test phone number are required" });
    }

    const number = await prisma.whatsAppNumber.findFirst({
      where: {
        id: numberId,
        workspaceId,
        status: 'CONNECTED'
      }
    });

    if (!number) {
      return res.status(400).json({ error: "Selected sender is not an active WhatsApp channel" });
    }

    const { accessToken, phoneNumberId } = getWhatsAppChannelConfig(number);
    const to = normalizePhone(phoneNumber);

    if (!accessToken || !phoneNumberId || !to) {
      return res.status(400).json({ error: "WhatsApp test sending is not fully configured" });
    }

    const testBody = `[Test Broadcast] ${name.trim()}\n\n${messageBody?.trim() || 'This is a preview of your broadcast message.'}`;

    try {
      if (headerImage) {
        await sendWhatsAppMediaMessage(
          to,
          headerImage,
          { accessToken, phoneNumberId },
          testBody
        );
      } else {
        await sendMetaMessage(to, testBody, 'whatsapp', {
          accessToken,
          phoneNumberId
        });
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Could not send test broadcast message" });
    }
  });

  app.post("/api/campaigns", requireAuth, upload.single('headerImage'), requireSubscribedWorkspaceFromBody, async (req, res) => {
    const { workspaceId, name, numberId, audienceType, audienceId, sendMode, messageBody, templateId } = req.body;
    const headerImage = req.file as Express.Multer.File | undefined;

    if (!workspaceId || !name?.trim() || !numberId || !audienceType || !audienceId) {
      return res.status(400).json({ error: "Campaign name, sender, and audience are required" });
    }

    if (!messageBody?.trim() && !headerImage) {
      return res.status(400).json({ error: "Add message content or a header image before launching the campaign" });
    }

    if (!(await enforceWorkspacePlanLimit(res, workspaceId, 'broadcasts'))) {
      return;
    }

    const number = await prisma.whatsAppNumber.findFirst({
      where: {
        id: numberId,
        workspaceId,
        status: 'CONNECTED'
      }
    });

    if (!number) {
      return res.status(400).json({ error: "Selected sender is not an active WhatsApp channel" });
    }

    const contactWhere =
      audienceType === 'PIPELINE'
        ? {
            workspaceId,
            pipelineStage: audienceId,
            NOT: { phoneNumber: null }
          }
        : {
            workspaceId,
            NOT: { phoneNumber: null },
            listMemberships: {
              some: {
                listId: audienceId
              }
            }
          };

    const contacts = await prisma.contact.findMany({
      where: contactWhere,
      select: {
        phoneNumber: true
      }
    });

    const recipientNumbers = Array.from(
      new Set(
        contacts
          .map((contact) => contact.phoneNumber?.trim())
          .filter((phoneNumber): phoneNumber is string => Boolean(phoneNumber))
      )
    );

    if (recipientNumbers.length === 0) {
      return res.status(400).json({ error: "No phone contacts were found for the selected audience" });
    }

    const campaign = await prisma.broadcastCampaign.create({
      data: {
        workspaceId,
        name: name.trim(),
        numberId,
        templateId: templateId?.trim() || null,
        messageBody: messageBody?.trim() || null,
        headerImageData: fileToDataUrl(headerImage),
        status: sendMode === 'SCHEDULE' ? 'SCHEDULED' : 'SENDING',
        scheduledAt: new Date(),
        recipients: {
          create: recipientNumbers.map((phoneNumber) => ({
            phoneNumber,
            status: 'PENDING'
          }))
        }
      },
      include: {
        _count: { select: { recipients: true } },
        number: true,
        recipients: true,
      }
    });

    if (sendMode === 'SCHEDULE') {
      return res.json(campaign);
    }

    const { accessToken, phoneNumberId } = getWhatsAppChannelConfig(number);

    if (!accessToken || !phoneNumberId) {
      return res.status(400).json({ error: "WhatsApp broadcast sending is not fully configured" });
    }

    let sentCount = 0;

    for (const recipient of campaign.recipients) {
      try {
        let messageId: string | undefined;

        if (headerImage) {
          const sentMedia = await sendWhatsAppMediaMessage(
            recipient.phoneNumber,
            headerImage,
            { accessToken, phoneNumberId },
            messageBody?.trim() || undefined
          );
          messageId = sentMedia.messageId;
        } else {
          messageId = await sendMetaMessage(recipient.phoneNumber, messageBody.trim(), 'whatsapp', {
            accessToken,
            phoneNumberId
          });
        }

        sentCount += 1;
        await prisma.broadcastRecipient.update({
          where: { id: recipient.id },
          data: {
            status: 'SENT',
            metaMessageId: messageId || null
          }
        });
      } catch (error) {
        console.error(`Error sending broadcast recipient ${recipient.phoneNumber}:`, error);
        await prisma.broadcastRecipient.update({
          where: { id: recipient.id },
          data: { status: 'FAILED' }
        });
      }
    }

    let updatedCampaign = await refreshBroadcastCampaignStats(campaign.id);

    if (sentCount > 0 && updatedCampaign.deliveredCount === 0) {
      updatedCampaign = await prisma.broadcastCampaign.update({
        where: { id: campaign.id },
        data: {
          status: 'COMPLETED',
          deliveredCount: sentCount,
        },
        include: {
          _count: { select: { recipients: true } },
          number: true,
        }
      });
    }

    res.json(updatedCampaign);
  });

  // Billing
  app.get("/api/billing/summary", requireAuth, async (req: any, res, next) => {
    return requireWorkspaceAccessById(req, res, next, req.query.workspaceId as string);
  }, async (req, res) => {
    const workspaceId = req.query.workspaceId as string;
    const summary = await getWorkspaceBillingSummary(workspaceId);
    res.json({
      balance: summary.balance,
      totalCredits: summary.totalCredits,
      totalDebits: summary.totalDebits,
      aiTokensUsed: summary.aiTokensUsed,
      aiSpend: summary.aiSpend,
      usageEvents: summary.usageEvents,
    });
  });

  app.get("/api/billing/ledger", requireAuth, async (req: any, res, next) => {
    return requireWorkspaceAccessById(req, res, next, req.query.workspaceId as string);
  }, async (req, res) => {
    const { workspaceId } = req.query;
    const ledger = await prisma.billingLedgerEntry.findMany({
      where: { workspaceId: workspaceId as string },
      orderBy: { createdAt: 'desc' }
    });
    res.json(ledger);
  });

  app.get("/api/billing/usage", requireAuth, async (req: any, res, next) => {
    return requireWorkspaceAccessById(req, res, next, req.query.workspaceId as string);
  }, async (req, res) => {
    const usage = await prisma.usageLog.findMany({
      where: {
        workspaceId: req.query.workspaceId as string,
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(usage);
  });

  // Bootstrap Route
  app.post("/api/dev/bootstrap", requireAuth, async (req, res) => {
    try {
      // 1. Ensure User exists
      const user = await prisma.user.upsert({
        where: { email: 'ameeneidha@gmail.com' },
        update: {},
        create: {
          email: 'ameeneidha@gmail.com',
          name: 'Ameen Eidha',
          password: 'password123',
        },
      });

      // 2. Ensure at least one Workspace exists
      let workspace = await prisma.workspace.findFirst({
        where: { members: { some: { userId: user.id } } }
      });

      if (!workspace) {
        workspace = await prisma.workspace.create({
          data: {
            name: 'Main Business',
            slug: 'main-business',
            members: {
              create: {
                userId: user.id,
                role: 'OWNER'
              }
            },
            businessSettings: {
              create: { timezone: 'UTC' }
            }
          }
        });
      }

      res.json({ user, workspace });
    } catch (e: any) {
      console.error('Bootstrap error:', e);
      res.status(500).json({ error: "Bootstrap failed", details: e.message });
    }
  });
  // Superadmin Routes
  // Dev Seeding Route
  app.post("/api/dev/seed", requireAuth, requireSuperadmin, async (req, res) => {
    const { workspaceId, userId } = req.body;
    if (!workspaceId || !userId) return res.status(400).json({ error: "Missing workspaceId or userId" });

    try {
      // Create some contacts
      const contactsData = [
        { name: "Ahmed Hassan", phoneNumber: "+971501234567", leadSource: "Google Ads", pipelineStage: "QUALIFIED" },
        { name: "Sarah Miller", phoneNumber: "+971559876543", leadSource: "Instagram", pipelineStage: "NEW_LEAD" },
        { name: "John Doe", phoneNumber: "+971521112222", leadSource: "Direct", pipelineStage: "WON" },
        { name: "Fatima Al-Sayed", phoneNumber: "+971583334444", leadSource: "Referral", pipelineStage: "CONTACTED" },
      ];

      for (const c of contactsData) {
        const contact = await prisma.contact.create({
          data: {
            ...c,
            workspaceId,
            assignedToId: userId,
          }
        });

        // Create a conversation for each
        const conv = await prisma.conversation.create({
          data: {
            workspaceId,
            contactId: contact.id,
            status: "ACTIVE",
            priority: Math.random() > 0.5 ? "HIGH" : "MEDIUM",
            internalStatus: "OPEN",
            lastMessageAt: new Date(),
          }
        });

        // Add some messages
        await prisma.message.createMany({
          data: [
            { conversationId: conv.id, content: "Hello, I'm interested in your services.", direction: "INCOMING", senderType: "USER" },
            { conversationId: conv.id, content: "Sure, let me help you with that.", direction: "OUTGOING", senderType: "USER", senderName: "Agent" },
          ]
        });

        // Add a task
        await prisma.task.create({
          data: {
            title: `Follow up with ${contact.name}`,
            workspaceId,
            contactId: contact.id,
            conversationId: conv.id,
            priority: "MEDIUM",
            dueDate: new Date(Date.now() + 86400000), // Tomorrow
          }
        });

        // Add an activity log
        await prisma.activityLog.create({
          data: {
            type: "STAGE_CHANGE",
            content: `Contact ${contact.name} moved to ${contact.pipelineStage}`,
            workspaceId,
            contactId: contact.id,
            conversationId: conv.id,
          }
        });
      }

      res.json({ message: "Seeding successful" });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Seeding failed" });
    }
  });

  const buildPlanBreakdown = (workspaces: Array<{ plan?: string | null }>) => {
    const breakdown = {
      NONE: 0,
      STARTER: 0,
      GROWTH: 0,
      PRO: 0,
      ENTERPRISE: 0,
    };

    for (const workspace of workspaces) {
      const key = String(workspace.plan || 'NONE').toUpperCase() as keyof typeof breakdown;
      if (key in breakdown) {
        breakdown[key] += 1;
      } else {
        breakdown.NONE += 1;
      }
    }

    return breakdown;
  };

  app.get("/api/superadmin/workspaces", requireAuth, requireSuperadmin, async (req, res) => {
    try {
      const workspaces = await prisma.workspace.findMany({
        include: {
          members: {
            take: 5,
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  emailVerified: true,
                }
              }
            }
          },
          _count: {
            select: {
              members: true,
              contacts: true,
              conversations: true,
              chatbots: true,
              campaigns: true,
              numbers: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      res.json(workspaces.map((workspace) => ({
        ...workspace,
        members: workspace.members.map(sanitizeMembership),
      })));
    } catch (error) {
      console.error('[superadmin:workspaces]', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get("/api/superadmin/stats", requireAuth, requireSuperadmin, async (_req, res) => {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const [allWorkspaces, totalUsers, totalMessages, ledgerEntries] = await Promise.all([
        prisma.workspace.findMany({
          select: {
            id: true,
            plan: true,
            subscriptionStatus: true,
            createdAt: true,
          }
        }),
        prisma.user.count(),
        prisma.message.count(),
        prisma.billingLedgerEntry.findMany({ where: { type: 'CREDIT' } }),
      ]);

      const totalRevenue = ledgerEntries.reduce((sum, entry) => sum + entry.amount, 0);
      const recentSignups = allWorkspaces.filter((workspace) => workspace.createdAt >= thirtyDaysAgo).length;
      const activeSubscribers = allWorkspaces.filter((workspace) =>
        ['active', 'trialing'].includes(String(workspace.subscriptionStatus || '').toLowerCase())
      ).length;
      const suspendedCount = 0;

      res.json({
        totalUsers,
        totalWorkspaces: allWorkspaces.length,
        totalMessages,
        totalRevenue,
        recentSignups,
        activeSubscribers,
        suspendedCount,
        planBreakdown: buildPlanBreakdown(allWorkspaces),
      });
    } catch (error) {
      console.error('[superadmin:stats]', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get("/api/superadmin/workspaces/:id", requireAuth, requireSuperadmin, async (req, res) => {
    try {
      const workspace = await prisma.workspace.findUnique({
        where: { id: req.params.id },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  emailVerified: true,
                  createdAt: true,
                }
              }
            }
          },
          _count: {
            select: {
              contacts: true,
              conversations: true,
              chatbots: true,
              campaigns: true,
              numbers: true,
              activities: true,
              tasks: true,
            }
          },
          featureRequests: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
          issueReports: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
          ledgerEntries: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
          usageLogs: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        }
      });

      if (!workspace) {
        return res.status(404).json({ error: 'Workspace not found' });
      }

      const totalMessageCount = await prisma.message.count({
        where: {
          conversation: {
            workspaceId: workspace.id,
          }
        }
      });

      res.json({
        ...workspace,
        members: workspace.members.map(sanitizeMembership),
        counts: {
          ...workspace._count,
          messages: totalMessageCount,
        }
      });
    } catch (error) {
      console.error('[superadmin:workspace-detail]', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get("/api/superadmin/users", requireAuth, requireSuperadmin, async (req, res) => {
    try {
      const search = String(req.query.search || '').trim();
      const page = Math.max(1, Number(req.query.page || 1) || 1);
      const limit = Math.min(50, Math.max(1, Number(req.query.limit || 20) || 20));
      const skip = (page - 1) * limit;

      const where = search
        ? {
            OR: [
              { email: { contains: search } },
              { name: { contains: search } },
            ]
          }
        : undefined;

      const [total, users] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({
          where,
          select: {
            id: true,
            name: true,
            email: true,
            emailVerified: true,
            createdAt: true,
            memberships: {
              include: {
                workspace: {
                  select: {
                    id: true,
                    name: true,
                    plan: true,
                  }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        })
      ]);

      res.json({
        total,
        page,
        limit,
        users: users.map((user) => ({
          ...user,
          memberships: user.memberships
            .filter((membership) => Boolean(membership.workspace))
            .map((membership) => ({
              id: membership.id,
              role: membership.role,
              status: membership.status,
              workspace: membership.workspace,
            }))
        }))
      });
    } catch (error) {
      console.error('[superadmin:users]', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("CRITICAL SERVER ERROR:", err);
  process.exit(1);
});
