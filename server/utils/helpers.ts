import prisma from "../../src/lib/prisma.js";
import {
  EMAIL_LIKE_REGEX,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_UPPERCASE_REGEX,
  PASSWORD_LOWERCASE_REGEX,
  PASSWORD_NUMBER_REGEX,
  createSecureToken,
  hashSecureToken,
} from "../config.js";

// ── Name Helpers ───────────────────────────────────────────────────

export const deriveNameFromEmail = (email?: string | null) => {
  const localPart = (email || "").split("@")[0]?.trim();
  if (!localPart) {
    return "User";
  }

  return localPart
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
};

export const sanitizeDisplayName = (
  name?: string | null,
  email?: string | null
) => {
  const trimmedName = name?.trim() || "";
  if (!trimmedName || EMAIL_LIKE_REGEX.test(trimmedName)) {
    return deriveNameFromEmail(email || trimmedName);
  }

  return trimmedName;
};

export const getInstagramContactFallbackName = (
  instagramId?: string | null
) => {
  const normalized = String(instagramId || "").trim();
  if (!normalized) {
    return "IG User";
  }

  const suffix = normalized.slice(-4);
  return suffix ? `IG User ${suffix}` : "IG User";
};

// ── Validation ─────────────────────────────────────────────────────

export const validateRegistrationInput = ({
  name,
  email,
  password,
}: {
  name: string;
  email: string;
  password: string;
}) => {
  if (name.trim().length < 2) {
    return "Full name must be at least 2 characters.";
  }

  if (name.trim().length > 80) {
    return "Full name must be 80 characters or fewer.";
  }

  if (!EMAIL_LIKE_REGEX.test(email)) {
    return "Please enter a valid email address.";
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`;
  }

  if (!PASSWORD_UPPERCASE_REGEX.test(password)) {
    return "Password must include at least one uppercase letter.";
  }

  if (!PASSWORD_LOWERCASE_REGEX.test(password)) {
    return "Password must include at least one lowercase letter.";
  }

  if (!PASSWORD_NUMBER_REGEX.test(password)) {
    return "Password must include at least one number.";
  }

  return null;
};

// ── Token Helpers ──────────────────────────────────────────────────

export const createPasswordResetToken = () => createSecureToken();
export const hashPasswordResetToken = (token: string) =>
  hashSecureToken(token);
export const createEmailVerificationToken = () => createSecureToken();
export const hashEmailVerificationToken = (token: string) =>
  hashSecureToken(token);

// ── User Sanitization ──────────────────────────────────────────────

export const sanitizeUser = (user: any) => {
  if (!user) return user;
  const {
    password,
    passwordResetTokenHash,
    passwordResetExpiresAt,
    emailVerificationTokenHash,
    emailVerificationExpiresAt,
    emailVerificationSentAt,
    ...safeUser
  } = user;
  return safeUser;
};

export const sanitizeMembership = (membership: any) => {
  if (!membership) return membership;
  return {
    ...membership,
    user: sanitizeUser(membership.user),
  };
};

// ── Pipeline Stage Utilities ───────────────────────────────────────

export const DEFAULT_PIPELINE_STAGE_KEY = "NEW_LEAD";
export const PIPELINE_STAGE_COLOR_REGEX =
  /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export const DEFAULT_WORKSPACE_PIPELINE_STAGES = [
  {
    key: "NEW_LEAD",
    name: "New Lead",
    color: "#3B82F6",
    position: 0,
    isSystem: true,
    isTerminal: false,
    terminalType: "OPEN",
  },
  {
    key: "CONTACTED",
    name: "Contacted",
    color: "#6366F1",
    position: 1,
    isSystem: true,
    isTerminal: false,
    terminalType: "OPEN",
  },
  {
    key: "QUALIFIED",
    name: "Qualified",
    color: "#8B5CF6",
    position: 2,
    isSystem: true,
    isTerminal: false,
    terminalType: "OPEN",
  },
  {
    key: "QUOTE_SENT",
    name: "Quote Sent",
    color: "#F97316",
    position: 3,
    isSystem: true,
    isTerminal: false,
    terminalType: "OPEN",
  },
  {
    key: "WON",
    name: "Won",
    color: "#22C55E",
    position: 4,
    isSystem: true,
    isTerminal: true,
    terminalType: "WON",
  },
  {
    key: "LOST",
    name: "Lost",
    color: "#EF4444",
    position: 5,
    isSystem: true,
    isTerminal: true,
    terminalType: "LOST",
  },
] as const;

export const normalizePipelineStageKey = (value?: string | null) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);

export const normalizePipelineStageLookupValue = (value?: string | null) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

export const sanitizePipelineStageColor = (
  value?: string | null,
  fallback = "#25D366"
) => {
  const trimmed = String(value || "").trim();
  return PIPELINE_STAGE_COLOR_REGEX.test(trimmed) ? trimmed : fallback;
};

export const sortPipelineStages = <
  T extends { position: number; name: string }
>(
  stages: T[]
) =>
  [...stages].sort(
    (a, b) => a.position - b.position || a.name.localeCompare(b.name)
  );

export const getFallbackPipelineStageKey = (
  stages: Array<{
    key: string;
    isTerminal?: boolean;
    terminalType?: string;
  }>
) =>
  stages.find(
    (stage) =>
      !stage.isTerminal &&
      stage.terminalType !== "WON" &&
      stage.terminalType !== "LOST"
  )?.key ||
  stages[0]?.key ||
  DEFAULT_PIPELINE_STAGE_KEY;

export const parseStageChangeMetadata = (activity: {
  metadata?: string | null;
  content?: string | null;
}) => {
  const rawMetadata = String(activity.metadata || "").trim();
  if (rawMetadata) {
    try {
      const parsed = JSON.parse(rawMetadata);
      return {
        previousStageKey: normalizePipelineStageKey(parsed.previousStageKey),
        nextStageKey: normalizePipelineStageKey(parsed.nextStageKey),
      };
    } catch {
      // Keep fallback parsing below for older activity log entries.
    }
  }

  const content = String(activity.content || "");
  const match = content.match(/from\s+([A-Z_]+)\s+to\s+([A-Z_]+)/i);
  return {
    previousStageKey: normalizePipelineStageKey(match?.[1]),
    nextStageKey: normalizePipelineStageKey(match?.[2]),
  };
};

export const ensureWorkspacePipelineStages = async (workspaceId: string) => {
  const existingCount = await prisma.workspacePipelineStage.count({
    where: { workspaceId },
  });

  if (existingCount === 0) {
    await prisma.workspacePipelineStage.createMany({
      data: DEFAULT_WORKSPACE_PIPELINE_STAGES.map((stage) => ({
        workspaceId,
        key: stage.key,
        name: stage.name,
        color: stage.color,
        position: stage.position,
        isSystem: stage.isSystem,
        isTerminal: stage.isTerminal,
        terminalType: stage.terminalType,
      })),
    });
  }

  return prisma.workspacePipelineStage.findMany({
    where: { workspaceId },
    orderBy: [{ position: "asc" }, { name: "asc" }],
  });
};

export const getWorkspacePipelineStages = async (workspaceId: string) =>
  sortPipelineStages(await ensureWorkspacePipelineStages(workspaceId));

export const resolvePipelineStageFromStages = (
  stages: Array<{
    key: string;
    name: string;
    isTerminal?: boolean;
    terminalType?: string;
  }>,
  value?: string | null,
  fallbackValue?: string | null
) => {
  const fallbackKey =
    normalizePipelineStageKey(fallbackValue) ||
    getFallbackPipelineStageKey(stages);

  const normalizedKey = normalizePipelineStageKey(value);
  const normalizedLookup = normalizePipelineStageLookupValue(value);

  const matchedStage =
    stages.find((stage) => stage.key === normalizedKey) ||
    stages.find(
      (stage) =>
        normalizePipelineStageLookupValue(stage.name) === normalizedLookup ||
        normalizePipelineStageLookupValue(stage.key) === normalizedLookup
    );

  return matchedStage?.key || fallbackKey;
};

export const resolveWorkspacePipelineStageValue = async (
  workspaceId: string,
  value?: string | null,
  fallbackValue?: string | null
) =>
  resolvePipelineStageFromStages(
    await getWorkspacePipelineStages(workspaceId),
    value,
    fallbackValue
  );

export const buildUniqueWorkspacePipelineStageKey = (
  stages: Array<{ key: string }>,
  name?: string | null
) => {
  const baseKey = normalizePipelineStageKey(name) || "STAGE";
  const taken = new Set(stages.map((stage) => stage.key));

  if (!taken.has(baseKey)) {
    return baseKey;
  }

  let suffix = 2;
  while (taken.has(`${baseKey}_${suffix}`)) {
    suffix += 1;
  }

  return `${baseKey}_${suffix}`;
};

// ── Date/Time Helpers ──────────────────────────────────────────────

export const startOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const endOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

export const addDays = (date: Date, days: number) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

export const wait = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// ── Contact List Helpers ───────────────────────────────────────────

export const resolveContactListIds = async (
  workspaceId: string,
  listIds?: string[],
  listNames?: string[]
): Promise<string[]> => {
  const resolvedIds = new Set(
    (Array.isArray(listIds) ? listIds : []).filter(Boolean)
  );
  const normalizedNames = Array.from(
    new Set(
      (Array.isArray(listNames) ? listNames : [])
        .map((name) => String(name).trim())
        .filter(Boolean)
    )
  );

  if (!workspaceId || normalizedNames.length === 0) {
    return Array.from(resolvedIds);
  }

  const existingLists = await prisma.contactList.findMany({
    where: { workspaceId },
  });

  const byName = new Map(
    existingLists.map((list) => [list.name.trim().toLowerCase(), list])
  );

  for (const name of normalizedNames) {
    const existing = byName.get(name.toLowerCase());
    if (existing) {
      resolvedIds.add(existing.id);
      continue;
    }

    const created = await prisma.contactList.create({
      data: { workspaceId, name },
    });

    byName.set(created.name.trim().toLowerCase(), created);
    resolvedIds.add(created.id);
  }

  return Array.from(resolvedIds);
};

export const parseImportedListNames = (value?: string | null): string[] =>
  Array.from(
    new Set(
      String(value || "")
        .split(/[|;,]/)
        .map((name) => name.trim())
        .filter(Boolean)
    )
  );

// ── File Helpers ───────────────────────────────────────────────────

export const fileToDataUrl = (file?: { buffer: Buffer; mimetype: string }) => {
  if (!file) return null;
  const base64 = file.buffer.toString("base64");
  return `data:${file.mimetype};base64,${base64}`;
};
