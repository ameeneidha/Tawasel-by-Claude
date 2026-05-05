import OpenAI from "openai";
import Stripe from "stripe";
import multer from "multer";
import crypto from "crypto";

// ── Feature Flags ──────────────────────────────────────────────────
export const INSTAGRAM_INTEGRATION_ENABLED = true;

// ── AI Model Config ────────────────────────────────────────────────
export const FIXED_CHATBOT_MODEL = "gpt-4.1-mini";
export const GPT_4_1_MINI_INPUT_COST_PER_1M = 0.4;
export const GPT_4_1_MINI_CACHED_INPUT_COST_PER_1M = 0.1;
export const GPT_4_1_MINI_OUTPUT_COST_PER_1M = 1.6;
export const APPENDED_CHATBOT_SAFETY_INSTRUCTIONS = `# Safety Instructions
- Respond only to the customer's explicit requests. Do not offer unsolicited actions or promises.
- Use only the business instructions, the current conversation, and information already provided in the chat.
- If information is not available, reply exactly: "Sorry, I don't have information on that."
- Do not invent pricing, policies, delivery times, contact methods, or account status.
- Do not claim to access files, private systems, live databases, or external tools unless the business instructions clearly provide that ability.
- If the customer asks for a human agent or asks for something outside your allowed scope, say a human agent will follow up.
- Do not claim abilities you do not have, such as generating images, videos, or checking third-party systems live.`;

// ── Third-party Clients ────────────────────────────────────────────
export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024,
    files: 5,
  },
});

// ── Validation Constants ───────────────────────────────────────────
export const EMAIL_LIKE_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;
export const PASSWORD_UPPERCASE_REGEX = /[A-Z]/;
export const PASSWORD_LOWERCASE_REGEX = /[a-z]/;
export const PASSWORD_NUMBER_REGEX = /\d/;

// ── Plan Limits ────────────────────────────────────────────────────
export const WORKSPACE_USER_LIMITS: Record<string, number> = {
  STARTER: 1,
  GROWTH: 5,
  PRO: 10,
};

export type PlanLimits = {
  users: number;
  whatsapp: number;
  instagram: number;
  chatbots: number;
  contacts: number;
  broadcasts: number;
  automations: number;
  aiMessagesPerMonth: number;
  transcriptionMinutesPerMonth: number;
  services: number;
  staffMembers: number;
  appointmentsPerMonth: number;
};

export const WORKSPACE_PLAN_LIMITS: Record<string, PlanLimits> = {
  STARTER: {
    users: 1,
    whatsapp: 1,
    instagram: 1,
    chatbots: 1,
    contacts: 1000,
    broadcasts: 500,
    automations: 3,
    aiMessagesPerMonth: 1000,
    transcriptionMinutesPerMonth: 60,
    services: 5,
    staffMembers: 1,
    appointmentsPerMonth: 100,
  },
  GROWTH: {
    users: 5,
    whatsapp: 2,
    instagram: 1,
    chatbots: 3,
    contacts: 5000,
    broadcasts: 3000,
    automations: 15,
    aiMessagesPerMonth: 5000,
    transcriptionMinutesPerMonth: 300,
    services: 20,
    staffMembers: 5,
    appointmentsPerMonth: 500,
  },
  PRO: {
    users: 10,
    whatsapp: 5,
    instagram: 2,
    chatbots: 10,
    contacts: 25000,
    broadcasts: 10000,
    automations: 999999,
    aiMessagesPerMonth: 25000,
    transcriptionMinutesPerMonth: 1500,
    services: 999999,
    staffMembers: 10,
    appointmentsPerMonth: 999999,
  },
};

// ── JWT ────────────────────────────────────────────────────────────
export const JWT_SECRET = (() => {
  const value = (process.env.JWT_SECRET || "").trim();
  if (!value || value === "your-secret-key-here" || value.length < 32) {
    throw new Error(
      "FATAL: JWT_SECRET env var is missing, defaulted, or too short (minimum 32 characters)."
    );
  }
  return value;
})();

// ── URLs & Origins ─────────────────────────────────────────────────
export const normalizeOriginValue = (value: string) => {
  try {
    return new URL(value).origin;
  } catch {
    return value.replace(/\/$/, "");
  }
};

export const PUBLIC_APP_URL = (
  process.env.PUBLIC_APP_URL ||
  process.env.APP_URL ||
  ""
).trim();
export const API_URL = (process.env.API_URL || "").trim();

export const ALLOWED_ORIGINS = Array.from(
  new Set(
    [
      process.env.ALLOWED_ORIGINS || "",
      PUBLIC_APP_URL,
      process.env.APP_URL || "",
      "http://localhost:3000,http://127.0.0.1:3000",
    ]
      .flatMap((value) => value.split(","))
      .map((value) => value.trim())
      .filter(Boolean)
      .map(normalizeOriginValue)
  )
);

// ── Rate Limiting ──────────────────────────────────────────────────
export const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const AUTH_RATE_LIMIT_MAX = 10;
export const authRateLimitStore = new Map<
  string,
  { count: number; resetAt: number }
>();

// ── Business Rate Limiting ─────────────────────────────────────────
export const BUSINESS_RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
export const BUSINESS_RATE_LIMITS: Record<string, number> = {
  messages: 60,
  contacts: 30,
  campaigns: 10,
  ai: 20,
};
export const businessRateLimitStore = new Map<
  string,
  { count: number; resetAt: number }
>();

// ── Environment ────────────────────────────────────────────────────
export const IS_PRODUCTION =
  (process.env.NODE_ENV || "").trim().toLowerCase() === "production";
export const EMAIL_LINK_PREVIEW_ENABLED =
  !IS_PRODUCTION &&
  (process.env.ALLOW_EMAIL_LINK_PREVIEW || "true").trim().toLowerCase() !==
    "false";
export const SUPERADMIN_EMAIL = (
  process.env.SUPERADMIN_EMAIL || ""
).trim().toLowerCase();

// ── Helper Functions ───────────────────────────────────────────────
export const getWorkspaceUserLimit = (plan?: string | null) =>
  WORKSPACE_USER_LIMITS[(plan || "").toUpperCase()] || 1;

export const applyChannelFeatureFlagsToPlanLimits = <
  T extends { instagram: number }
>(
  limits: T
): T =>
  INSTAGRAM_INTEGRATION_ENABLED
    ? limits
    : {
        ...limits,
        instagram: 0,
      };

export const getWorkspacePlanLimits = (plan?: string | null) =>
  applyChannelFeatureFlagsToPlanLimits(
    WORKSPACE_PLAN_LIMITS[(plan || "").toUpperCase()] ||
      WORKSPACE_PLAN_LIMITS.STARTER
  );

/**
 * Resolve plan limits for a workspace, taking active plan overrides into account.
 * Call this instead of getWorkspacePlanLimits when you have the full workspace row.
 */
export const resolveWorkspacePlanLimits = (workspace: {
  plan: string;
  planOverride?: string | null;
  planOverrideUntil?: Date | string | null;
}) => {
  if (
    workspace.planOverride &&
    workspace.planOverrideUntil &&
    new Date(workspace.planOverrideUntil) > new Date()
  ) {
    return getWorkspacePlanLimits(workspace.planOverride);
  }
  return getWorkspacePlanLimits(workspace.plan);
};

export const normalizePhone = (value?: string | null) =>
  (value || "").replace(/\D/g, "");

export const createSecureToken = () => {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
  return { token, tokenHash };
};

export const hashSecureToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");
