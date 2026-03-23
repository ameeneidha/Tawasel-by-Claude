import jwt from "jsonwebtoken";
import crypto from "crypto";
import prisma from "../../src/lib/prisma.js";
import {
  JWT_SECRET,
  AUTH_RATE_LIMIT_WINDOW_MS,
  AUTH_RATE_LIMIT_MAX,
  authRateLimitStore,
  SUPERADMIN_EMAIL,
  getWorkspacePlanLimits,
} from "../config.js";

// ── Core Auth ──────────────────────────────────────────────────────

export const requireAuth = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
};

// ── Rate Limiting ──────────────────────────────────────────────────

export const authRateLimiter =
  (label: string) => (req: any, res: any, next: any) => {
    const now = Date.now();
    const key = `${label}:${req.ip || req.headers["x-forwarded-for"] || "unknown"}`;
    const current = authRateLimitStore.get(key);

    if (!current || current.resetAt <= now) {
      authRateLimitStore.set(key, {
        count: 1,
        resetAt: now + AUTH_RATE_LIMIT_WINDOW_MS,
      });
      return next();
    }

    if (current.count >= AUTH_RATE_LIMIT_MAX) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((current.resetAt - now) / 1000)
      );
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res
        .status(429)
        .json({ error: "Too many attempts. Please try again later." });
    }

    current.count += 1;
    authRateLimitStore.set(key, current);
    next();
  };

// ── User Helpers ───────────────────────────────────────────────────

export const getUserByToken = async (req: any) => {
  return prisma.user.findUnique({ where: { id: req.user.userId } });
};

export const hasSubscription = (status?: string | null) =>
  ["active", "trialing"].includes((status || "").toLowerCase());

// ── Workspace Access ───────────────────────────────────────────────

export const requireWorkspaceAccessById = async (
  req: any,
  res: any,
  next: any,
  workspaceId?: string | null
) => {
  if (!workspaceId) {
    return res.status(400).json({ error: "Workspace is required" });
  }

  const membership = await prisma.workspaceMembership.findFirst({
    where: { workspaceId, userId: req.user.userId },
  });

  if (!membership) {
    return res.status(403).json({ error: "Workspace access denied" });
  }

  next();
};

export const requireWorkspaceAccessFromQuery = async (
  req: any,
  res: any,
  next: any
) =>
  requireWorkspaceAccessById(
    req,
    res,
    next,
    String(req.query.workspaceId || "").trim() || null
  );

export const requireConversationAccess = async (
  req: any,
  res: any,
  next: any
) => {
  const conversationId = String(
    req.params.id || req.body.conversationId || ""
  ).trim();
  if (!conversationId) {
    return res.status(400).json({ error: "Conversation is required" });
  }
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { workspaceId: true },
  });
  return requireWorkspaceAccessById(req, res, next, conversation?.workspaceId);
};

export const requireContactAccess = async (
  req: any,
  res: any,
  next: any
) => {
  const contactId = String(req.params.id || req.body.contactId || "").trim();
  if (!contactId) {
    return res.status(400).json({ error: "Contact is required" });
  }
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { workspaceId: true },
  });
  return requireWorkspaceAccessById(req, res, next, contact?.workspaceId);
};

export const requireVerifiedEmail = async (
  req: any,
  res: any,
  next: any
) => {
  const user = await getUserByToken(req);
  if (!user?.emailVerified) {
    return res
      .status(403)
      .json({ error: "Verify your email before continuing" });
  }
  next();
};

export const requireSuperadmin = async (req: any, res: any, next: any) => {
  const user = await getUserByToken(req);
  if (!user || String(user.email || "").toLowerCase() !== SUPERADMIN_EMAIL) {
    return res.status(403).json({ error: "Superadmin access required" });
  }
  req.superadminUser = user;
  next();
};

// ── Subscribed Workspace Access ────────────────────────────────────

export const requireSubscribedWorkspaceById = async (
  req: any,
  res: any,
  next: any,
  workspaceId?: string | null
) => {
  if (!workspaceId) {
    return res.status(400).json({ error: "Workspace is required" });
  }
  const membership = await prisma.workspaceMembership.findFirst({
    where: { workspaceId, userId: req.user.userId },
    include: { workspace: true },
  });
  if (!membership) {
    return res.status(403).json({ error: "Workspace access denied" });
  }
  if (!membership.userId) {
    return res.status(403).json({ error: "Workspace access denied" });
  }
  const user = await getUserByToken(req);
  if (!user?.emailVerified) {
    return res
      .status(403)
      .json({ error: "Verify your email before using this feature" });
  }
  if (!hasSubscription(membership.workspace.subscriptionStatus)) {
    return res
      .status(403)
      .json({ error: "Subscribe to a plan to use this feature" });
  }
  next();
};

export const requireSubscribedWorkspaceFromBody = async (
  req: any,
  res: any,
  next: any
) =>
  requireSubscribedWorkspaceById(
    req,
    res,
    next,
    req.body.workspaceId || req.query.workspaceId
  );

export const requireSubscribedWorkspaceManagerById = async (
  req: any,
  res: any,
  next: any,
  workspaceId?: string | null
) => {
  if (!workspaceId) {
    return res.status(400).json({ error: "Workspace is required" });
  }

  const membership = await prisma.workspaceMembership.findFirst({
    where: {
      workspaceId,
      userId: req.user.userId,
    },
    include: {
      workspace: true,
    },
  });

  if (!membership) {
    return res.status(403).json({ error: "Workspace access denied" });
  }

  const user = await getUserByToken(req);
  if (!user?.emailVerified) {
    return res
      .status(403)
      .json({ error: "Verify your email before using this feature" });
  }

  if (!hasSubscription(membership.workspace.subscriptionStatus)) {
    return res
      .status(403)
      .json({ error: "Subscribe to a plan to use this feature" });
  }

  if (
    !["OWNER", "ADMIN"].includes(
      String(membership.role || "").toUpperCase()
    )
  ) {
    return res.status(403).json({
      error: "Only workspace owners and admins can manage pipeline stages",
    });
  }

  req.workspaceMembership = membership;
  next();
};

export const requireSubscribedWorkspaceManagerFromBody = async (
  req: any,
  res: any,
  next: any
) =>
  requireSubscribedWorkspaceManagerById(
    req,
    res,
    next,
    req.body.workspaceId || req.query.workspaceId
  );

export const requireSubscribedConversation = async (
  req: any,
  res: any,
  next: any
) => {
  const conversationId = req.body.conversationId || req.params.id;
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });
  return requireSubscribedWorkspaceById(
    req,
    res,
    next,
    conversation?.workspaceId
  );
};

export const requireSubscribedContact = async (
  req: any,
  res: any,
  next: any
) => {
  const contact = await prisma.contact.findUnique({
    where: { id: req.params.id },
  });
  return requireSubscribedWorkspaceById(req, res, next, contact?.workspaceId);
};

export const requireSubscribedTask = async (
  req: any,
  res: any,
  next: any
) => {
  const task = await prisma.task.findUnique({
    where: { id: req.params.id },
  });
  return requireSubscribedWorkspaceById(req, res, next, task?.workspaceId);
};

// ── Plan Limit Enforcement ─────────────────────────────────────────

export const enforceWorkspacePlanLimit = async (
  res: any,
  workspaceId: string,
  resource:
    | "whatsapp"
    | "instagram"
    | "chatbots"
    | "contacts"
    | "broadcasts"
    | "automations"
    | "services"
    | "staffMembers",
  pendingAdds = 1
) => {
  if (pendingAdds <= 0) {
    return true;
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, plan: true },
  });

  if (!workspace) {
    res.status(404).json({ error: "Workspace not found" });
    return false;
  }

  const limits = getWorkspacePlanLimits(workspace.plan);

  const countMap: Record<string, () => Promise<number>> = {
    whatsapp: () => prisma.whatsAppNumber.count({ where: { workspaceId } }),
    instagram: () => prisma.instagramAccount.count({ where: { workspaceId } }),
    chatbots: () => prisma.chatbot.count({ where: { workspaceId } }),
    broadcasts: () => prisma.broadcastCampaign.count({ where: { workspaceId } }),
    automations: () => prisma.automationRule.count({ where: { workspaceId } }),
    contacts: () => prisma.contact.count({ where: { workspaceId } }),
    services: () => prisma.service.count({ where: { workspaceId } }),
    staffMembers: () => prisma.staffMember.count({ where: { workspaceId } }),
  };

  const labelMap: Record<string, string> = {
    whatsapp: "WhatsApp numbers",
    instagram: "Instagram accounts",
    chatbots: "AI chatbots",
    broadcasts: "broadcasts",
    automations: "automation rules",
    contacts: "contacts",
    services: "services",
    staffMembers: "staff members",
  };

  const currentCount = await countMap[resource]();
  const limit = limits[resource];

  if (currentCount + pendingAdds > limit) {
    res.status(403).json({
      error: `Plan limit reached: ${limit} ${labelMap[resource]} allowed on ${workspace.plan} plan`,
    });
    return false;
  }

  return true;
};

export const enforceMonthlyAppointmentLimit = async (
  res: any,
  workspaceId: string
) => {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, plan: true },
  });

  if (!workspace) {
    res.status(404).json({ error: "Workspace not found" });
    return false;
  }

  const limits = getWorkspacePlanLimits(workspace.plan);
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const count = await prisma.appointment.count({
    where: { workspaceId, createdAt: { gte: startOfMonth } },
  });

  if (count + 1 > limits.appointmentsPerMonth) {
    res.status(403).json({
      error: `Plan limit reached: ${limits.appointmentsPerMonth} appointments per month allowed on ${workspace.plan} plan`,
    });
    return false;
  }

  return true;
};

// ── Meta Signature Verification ────────────────────────────────────

export const verifyMetaSignature = (req: any) => {
  const signature = String(
    req.headers["x-hub-signature-256"] || ""
  ).trim();
  const rawBody = String(req.rawBody || "");
  const appSecrets = Array.from(
    new Set(
      [process.env.META_APP_SECRET, process.env.INSTAGRAM_APP_SECRET]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );

  if (!signature || !rawBody || appSecrets.length === 0) {
    return false;
  }

  return appSecrets.some((appSecret) => {
    const expected = `sha256=${crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
    if (signature.length !== expected.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  });
};
