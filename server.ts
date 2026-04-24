import dotenv from "dotenv";
dotenv.config();

import * as Sentry from "@sentry/node";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "production",
    tracesSampleRate: 0.2,
  });
}

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import prisma from "./src/lib/prisma.js";
import { Server } from "socket.io";
import { createServer } from "http";
import axios from "axios";
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import cors from 'cors';
import Stripe from "stripe";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { redisConnection, WEBHOOK_QUEUE_NAME, SOCKET_EVENTS_CHANNEL } from "./server/lib/redis.js";

// ── Modular imports (extracted from this file) ─────────────────────
import {
  stripe, openai, upload,
  FIXED_CHATBOT_MODEL, INSTAGRAM_INTEGRATION_ENABLED,
  GPT_4_1_MINI_INPUT_COST_PER_1M, GPT_4_1_MINI_CACHED_INPUT_COST_PER_1M,
  GPT_4_1_MINI_OUTPUT_COST_PER_1M, APPENDED_CHATBOT_SAFETY_INSTRUCTIONS,
  normalizePhone, EMAIL_LIKE_REGEX,
  PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH,
  PASSWORD_UPPERCASE_REGEX, PASSWORD_LOWERCASE_REGEX, PASSWORD_NUMBER_REGEX,
  WORKSPACE_USER_LIMITS, WORKSPACE_PLAN_LIMITS,
  JWT_SECRET, PUBLIC_APP_URL, API_URL, ALLOWED_ORIGINS,
  AUTH_RATE_LIMIT_WINDOW_MS, AUTH_RATE_LIMIT_MAX, authRateLimitStore,
  IS_PRODUCTION, EMAIL_LINK_PREVIEW_ENABLED, SUPERADMIN_EMAIL,
  getWorkspaceUserLimit, getWorkspacePlanLimits,
  createSecureToken, hashSecureToken, normalizeOriginValue,
} from "./server/config.js";

import {
  requireAuth, authRateLimiter, getUserByToken, hasSubscription,
  requireWorkspaceAccessById, requireWorkspaceAccessFromQuery,
  requireConversationAccess, requireContactAccess,
  requireVerifiedEmail, requireSuperadmin,
  requireSubscribedWorkspaceById, requireSubscribedWorkspaceFromBody,
  requireSubscribedWorkspaceManagerById, requireSubscribedWorkspaceManagerFromBody,
  requireSubscribedConversation, requireSubscribedContact, requireSubscribedTask,
  enforceWorkspacePlanLimit, enforceMonthlyAppointmentLimit, verifyMetaSignature,
  businessRateLimiter, requireRole,
} from "./server/middleware/index.js";

import {
  getAIResponse, generateAISummary, generateAIReplySuggestions,
  recordAiUsage, roundBillingAmount, getOpenAIUsageBreakdown,
  calculateGpt41MiniCostUsd, getWorkspaceBillingSummary, getPlanLimitSnapshot,
  checkAiQuota,
} from "./server/services/ai.js";

import { getDashboardSections } from "./server/services/dashboard.js";
import { startReminderScheduler, setReminderEmitter } from "./server/services/appointmentReminders.js";
import { startFollowUpScheduler, setFollowUpEmitter } from "./server/services/followUpScheduler.js";

import {
  sendMetaMessage, uploadWhatsAppMedia, sendWhatsAppMediaMessage,
  refreshBroadcastCampaignStats, downloadMetaMedia,
  getWhatsAppChannelConfig, getWhatsAppMediaKind,
  buildIncomingWhatsAppMessagePayload, parseEmbeddedSignupState,
  buildEmbeddedSignupState, formatMetaDisplayPhoneNumber,
  getEmbeddedSignupRuntimeConfig, escapeHtml,
  exchangeMetaCodeForAccessToken, fetchEmbeddedSignupPhoneAssets,
  fetchInstagramContactProfile, META_GRAPH_VERSION,
  INSTAGRAM_PROFILE_SYNC_TTL_MS,
} from "./server/services/meta.js";

import type {
  WhatsAppMediaKind, IncomingWhatsAppMessagePayload,
  EmbeddedSignupPhoneAsset, EmbeddedSignupResultPayload,
} from "./server/services/meta.js";

import {
  deriveNameFromEmail, sanitizeDisplayName, getInstagramContactFallbackName,
  validateRegistrationInput,
  createPasswordResetToken, hashPasswordResetToken,
  createEmailVerificationToken, hashEmailVerificationToken,
  sanitizeUser, sanitizeMembership,
  DEFAULT_PIPELINE_STAGE_KEY, PIPELINE_STAGE_COLOR_REGEX,
  DEFAULT_WORKSPACE_PIPELINE_STAGES,
  normalizePipelineStageKey, normalizePipelineStageLookupValue,
  sanitizePipelineStageColor, sortPipelineStages,
  getFallbackPipelineStageKey, parseStageChangeMetadata,
  ensureWorkspacePipelineStages, getWorkspacePipelineStages,
  resolvePipelineStageFromStages, resolveWorkspacePipelineStageValue,
  buildUniqueWorkspacePipelineStageKey,
  startOfDay, endOfDay, addDays, wait,
  resolveContactListIds, parseImportedListNames, fileToDataUrl,
} from "./server/utils/helpers.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let httpServer: ReturnType<typeof createServer>;
let webhookQueue: Queue | null = null;
let socketEventSubscriber: IORedis | null = null;

async function startServer() {
  const app = express();
  httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || ALLOWED_ORIGINS.includes(origin)) {
          return callback(null, true);
        }
        // Silently reject — no error thrown so Sentry doesn't capture noise
        callback(null, false);
      },
      methods: ["GET", "POST"],
      credentials: true,
    }
  });
  const PORT = Number(process.env.PORT) || 3000;

  // ── BullMQ webhook queue + Redis pub/sub for Socket.io relay ─────
  webhookQueue = new Queue(WEBHOOK_QUEUE_NAME, {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { age: 3600, count: 1000 },
      removeOnFail: { age: 24 * 3600, count: 5000 },
    },
  });

  socketEventSubscriber = new IORedis(process.env.REDIS_URL || "redis://127.0.0.1:6379", {
    maxRetriesPerRequest: null,
  });
  await socketEventSubscriber.subscribe(SOCKET_EVENTS_CHANNEL);
  socketEventSubscriber.on("message", (_channel, raw) => {
    try {
      const { room, event, data } = JSON.parse(raw);
      if (room && event) {
        io.to(room).emit(event, data);
      }
    } catch (e) {
      console.error("[socket-relay] Failed to parse message:", e);
    }
  });
  console.log(`[server] Subscribed to Redis channel "${SOCKET_EVENTS_CHANNEL}" for Socket.io relay`);

  // Scope CORS to API routes only — static assets (JS/CSS bundles, images)
  // must never go through CORS, otherwise direct-IP page loads or unexpected
  // Origin headers cause the browser to error on the bundle fetch.
  const corsMiddleware = cors({
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      // Silently reject — no error thrown so Sentry doesn't capture noise
      callback(null, false);
    },
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-workspace-id"],
    credentials: true,
  });
  app.use('/api', corsMiddleware);
  app.use('/webhook', corsMiddleware);
  app.options('/api/*', corsMiddleware);
  app.options('/webhook/*', corsMiddleware);

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
    limit: '2mb', // Allows base64 profile images up to ~1.5MB raw
    verify: (req: any, _res, buf) => {
      req.rawBody = buf?.length ? buf.toString('utf8') : '';
    }
  }));


  const instagramProfileHydrationQueue = new Set<string>();

  const enqueueInstagramProfileHydration = ({
    contactId,
    workspaceId,
    instagramScopedUserId,
    accessToken,
  }: {
    contactId: string;
    workspaceId: string;
    instagramScopedUserId?: string | null;
    accessToken?: string | null;
  }) => {
    const normalizedScopedUserId = String(instagramScopedUserId || '').trim();
    const normalizedAccessToken = String(accessToken || '').trim();
    if (!contactId || !workspaceId || !normalizedScopedUserId || !normalizedAccessToken) {
      return;
    }

    const queueKey = `${workspaceId}:${contactId}:${normalizedScopedUserId}`;
    if (instagramProfileHydrationQueue.has(queueKey)) {
      return;
    }

    instagramProfileHydrationQueue.add(queueKey);

    setTimeout(async () => {
      try {
        const currentContact = await prisma.contact.findUnique({
          where: { id: contactId },
          select: {
            id: true,
            name: true,
            instagramUsername: true,
            avatar: true,
            lastProfileSyncAt: true,
          },
        });

        if (!currentContact) {
          return;
        }

        const hasCachedProfile =
          Boolean(currentContact.instagramUsername?.trim()) ||
          Boolean(currentContact.avatar?.trim()) ||
          (Boolean(currentContact.name?.trim()) &&
            currentContact.name.trim() !== getInstagramContactFallbackName(normalizedScopedUserId));

        const lastSyncAgeMs = currentContact.lastProfileSyncAt
          ? Date.now() - currentContact.lastProfileSyncAt.getTime()
          : Number.POSITIVE_INFINITY;

        if (hasCachedProfile && lastSyncAgeMs < INSTAGRAM_PROFILE_SYNC_TTL_MS) {
          return;
        }

        const profile = await fetchInstagramContactProfile(normalizedScopedUserId, normalizedAccessToken);
        if (!profile) {
          return;
        }

        const updatedContact = await prisma.contact.update({
          where: { id: contactId },
          data: {
            instagramScopedUserId: normalizedScopedUserId,
            instagramId: normalizedScopedUserId,
            instagramUsername: profile.username?.trim() || null,
            name: profile.name?.trim() || getInstagramContactFallbackName(normalizedScopedUserId),
            avatar: profile.profile_pic?.trim() || currentContact.avatar || null,
            instagramFollowerCount:
              typeof profile.follower_count === 'number' ? profile.follower_count : null,
            instagramIsVerifiedUser:
              typeof profile.is_verified_user === 'boolean' ? profile.is_verified_user : null,
            lastProfileSyncAt: new Date(),
          },
        });

        const relatedConversations = await prisma.conversation.findMany({
          where: {
            workspaceId,
            contactId,
          },
          select: { id: true },
        });

        for (const conversation of relatedConversations) {
          io.to(workspaceId).emit('conversation-updated', conversation.id);
        }

        io.to(workspaceId).emit('contact-updated', {
          contactId: updatedContact.id,
        });
      } catch (error) {
        console.error('[instagram-profile-sync:queue-failure]', error);
      } finally {
        instagramProfileHydrationQueue.delete(queueKey);
      }
    }, 0);
  };

  const getApiBaseUrl = (req: express.Request) =>
    (API_URL || process.env.APP_URL || `${req.protocol}://${req.get('host') || `localhost:${PORT}`}`).replace(/\/$/, '');

  const getPublicAppBaseUrl = (req: express.Request) =>
    (PUBLIC_APP_URL || process.env.APP_URL || req.headers.origin || `${req.protocol}://${req.get('host') || `localhost:${PORT}`}`).replace(/\/$/, '');

  const buildEmailVerificationUrl = (req: express.Request, token: string) =>
    `${getPublicAppBaseUrl(req)}/verify-email?token=${encodeURIComponent(token)}`;

  const buildPasswordResetUrl = (req: express.Request, token: string) =>
    `${getPublicAppBaseUrl(req)}/reset-password?token=${encodeURIComponent(token)}`;

  const sendEmailViaResend = async ({
    to,
    subject,
    html,
    text,
  }: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }) => {
    const resendApiKey = (process.env.RESEND_API_KEY || '').trim();
    const emailFrom = (process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL || '').trim();

    if (!resendApiKey || !emailFrom) {
      return {
        delivered: false,
        provider: 'preview',
        configured: false,
        error: 'Email delivery is not configured.',
      } as const;
    }

    try {
      await axios.post(
        'https://api.resend.com/emails',
        {
          from: emailFrom,
          to: [to],
          subject,
          html,
          text,
        },
        {
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (error: any) {
      console.error('[email:resend]', error);
      return {
        delivered: false,
        provider: 'resend',
        configured: true,
        error: error?.response?.data?.message || 'Could not send email with Resend.',
      } as const;
    }

    return {
      delivered: true,
      provider: 'resend',
      configured: true,
      error: null,
    } as const;
  };

  const issueEmailVerification = async (req: express.Request, user: {
    id: string;
    email?: string | null;
    name?: string | null;
  }) => {
    if (!user.email?.trim()) {
      throw new Error('User email is required for email verification');
    }

    const { token, tokenHash } = createEmailVerificationToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationTokenHash: tokenHash,
        emailVerificationExpiresAt: expiresAt,
        emailVerificationSentAt: new Date(),
      } as any,
    });

    const verificationUrl = buildEmailVerificationUrl(req, token);
    const displayName = sanitizeDisplayName(user.name, user.email);
    const subject = 'Verify your email for Tawasel App';
    const text = [
      `Hi ${displayName},`,
      '',
      'Verify your email to unlock billing, CRM, campaigns, and automation in Tawasel App.',
      '',
      `Verify your email: ${verificationUrl}`,
      '',
      'This link expires in 24 hours.',
    ].join('\n');

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
        <p>Hi ${escapeHtml(displayName)},</p>
        <p>Verify your email to unlock billing, CRM, campaigns, and automation in Tawasel App.</p>
        <p>
          <a href="${escapeHtml(verificationUrl)}" style="display:inline-block;background:#25D366;color:#ffffff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700">
            Verify Email
          </a>
        </p>
        <p style="font-size:14px;color:#475569">This link expires in 24 hours.</p>
        <p style="font-size:14px;color:#475569">If the button does not work, copy this link:<br />${escapeHtml(verificationUrl)}</p>
      </div>
    `;

    const delivery = await sendEmailViaResend({
      to: user.email,
      subject,
      html,
      text,
    });

    if (!delivery.delivered && !EMAIL_LINK_PREVIEW_ENABLED) {
      throw new Error(delivery.error || 'Could not send verification email.');
    }

    return {
      emailSent: delivery.delivered,
      provider: delivery.provider,
      verificationUrl: !delivery.delivered && EMAIL_LINK_PREVIEW_ENABLED ? verificationUrl : undefined,
      message: delivery.delivered
        ? 'Verification email sent. Check your inbox.'
        : delivery.configured
          ? 'Email delivery failed locally. Use the verification link below for testing.'
          : 'Email delivery is not configured locally. Use the verification link below for testing.',
    };
  };

  const issuePasswordReset = async (
    req: express.Request,
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
    }
  ) => {
    if (!user.email?.trim()) {
      throw new Error('User email is required for password reset');
    }

    const { token, tokenHash } = createPasswordResetToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: expiresAt,
      },
    });

    const resetUrl = buildPasswordResetUrl(req, token);
    const displayName = sanitizeDisplayName(user.name, user.email);
    const subject = 'Reset your Tawasel App password';
    const text = [
      `Hi ${displayName},`,
      '',
      'We received a request to reset your password for Tawasel App.',
      '',
      `Reset your password: ${resetUrl}`,
      '',
      'This link expires in 1 hour.',
      'If you did not request this, you can ignore this email.',
    ].join('\n');

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
        <p>Hi ${escapeHtml(displayName)},</p>
        <p>We received a request to reset your password for Tawasel App.</p>
        <p>
          <a href="${escapeHtml(resetUrl)}" style="display:inline-block;background:#25D366;color:#ffffff;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700">
            Reset Password
          </a>
        </p>
        <p style="font-size:14px;color:#475569">This link expires in 1 hour.</p>
        <p style="font-size:14px;color:#475569">If you did not request this, you can ignore this email.</p>
        <p style="font-size:14px;color:#475569">If the button does not work, copy this link:<br />${escapeHtml(resetUrl)}</p>
      </div>
    `;

    const delivery = await sendEmailViaResend({
      to: user.email,
      subject,
      html,
      text,
    });

    if (!delivery.delivered && !EMAIL_LINK_PREVIEW_ENABLED) {
      throw new Error(delivery.error || 'Could not send password reset email.');
    }

    return {
      emailSent: delivery.delivered,
      resetUrl: !delivery.delivered && EMAIL_LINK_PREVIEW_ENABLED ? resetUrl : undefined,
      message: delivery.delivered
        ? 'If the account exists, a password reset email has been sent.'
        : delivery.configured
          ? 'Email delivery failed locally. Use the reset link below for testing.'
          : 'Email delivery is not configured locally. Use the reset link below for testing.',
    };
  };

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
    const config = getEmbeddedSignupRuntimeConfig();
    res.json({
      enabled: config.enabled,
      graphVersion: META_GRAPH_VERSION,
      appId: config.appId || null,
      configId: config.configId || null,
      missingKeys: config.missingKeys,
      callbackUrl: getEmbeddedSignupCallbackUrl(req),
    });
  });

  app.get("/api/meta/embedded-signup/start", requireAuth, async (req: any, res) => {
    const workspaceId = String(req.query.workspaceId || '').trim();
    if (!workspaceId) {
      return res.status(400).json({ error: "Workspace is required" });
    }

    return requireSubscribedWorkspaceById(req, res, async () => {
      const config = getEmbeddedSignupRuntimeConfig();

      if (!config.enabled) {
        return res.status(400).json({
          error: `Embedded Signup is not configured yet. Missing: ${config.missingKeys.join(', ')}`,
          missingKeys: config.missingKeys,
          callbackUrl: getEmbeddedSignupCallbackUrl(req),
        });
      }

      const redirectUri = getEmbeddedSignupCallbackUrl(req);
      const extras = JSON.stringify({
        sessionInfoVersion: 3,
        featureType: 'whatsapp_business_app_onboarding',
      });
      const params = new URLSearchParams({
        client_id: config.appId,
        redirect_uri: redirectUri,
        state: buildEmbeddedSignupState(workspaceId),
        response_type: 'code',
        config_id: config.configId,
        scope: 'business_management,whatsapp_business_management,whatsapp_business_messaging',
        extras,
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

    console.log('[embedded-signup] callback received', {
      workspaceId: state?.workspaceId || null,
      hasCode: Boolean(String(req.query.code || '').trim()),
      error: error || null,
      phoneNumberId: phoneNumberId || null,
      displayPhoneNumber: displayPhoneNumber || null,
      businessId: businessId || null,
      businessName: businessName || null,
      wabaId: wabaId || null,
    });

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

      // Debug: check token permissions
      try {
        const debugRes = await axios.get(`https://graph.facebook.com/${META_GRAPH_VERSION}/debug_token`, {
          params: { input_token: tokenResponse.access_token, access_token: `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}` }
        });
        console.log('[embedded-signup] token debug:', JSON.stringify(debugRes.data, null, 2));
      } catch (e: any) {
        console.warn('[embedded-signup] token debug failed:', e?.response?.data || e?.message);
      }

      let phoneNumbers = await fetchEmbeddedSignupPhoneAssets(tokenResponse.access_token, {
        businessId: businessId || null,
        wabaId: wabaId || null,
      });

      // Retry after 3s delay — Meta may still be provisioning
      if (phoneNumbers.length === 0) {
        console.log('[embedded-signup] no phones found, retrying in 3s...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        phoneNumbers = await fetchEmbeddedSignupPhoneAssets(tokenResponse.access_token, {
          businessId: businessId || null,
          wabaId: wabaId || null,
        });
      }

      // Fallback: try with the global System User token
      if (phoneNumbers.length === 0 && process.env.META_ACCESS_TOKEN) {
        console.log('[embedded-signup] retrying with System User token...');
        phoneNumbers = await fetchEmbeddedSignupPhoneAssets(process.env.META_ACCESS_TOKEN, {
          businessId: businessId || null,
          wabaId: wabaId || null,
        });
      }

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
        console.warn('[embedded-signup] no phone assets returned after callback', {
          workspaceId: state?.workspaceId || null,
          businessId: businessId || null,
          wabaId: wabaId || null,
          phoneNumberId: phoneNumberId || null,
          displayPhoneNumber: displayPhoneNumber || null,
        });
        return sendEmbeddedSignupCallbackPage(res, {
          success: false,
          error: "Meta connected successfully, but no WhatsApp phone number details were returned",
          workspaceId: state?.workspaceId || null,
          businessId: businessId || null,
          accessToken: tokenResponse.access_token,
          tokenExpiresAt: tokenResponse.expires_in
            ? new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString()
            : null,
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

  // Refresh an expired/short-lived Embedded Signup token to a fresh long-lived one.
  // Call this when template operations fail with "missing permissions" after token expiry.
  app.post("/api/meta/embedded-signup/refresh-token", requireAuth, requireRole('ADMIN', 'OWNER'), async (req: any, res) => {
    const workspaceId = String(req.body.workspaceId || '').trim();
    const numberId = String(req.body.numberId || '').trim();
    if (!workspaceId) return res.status(400).json({ error: "workspaceId required" });

    const waNumber = numberId
      ? await prisma.whatsAppNumber.findFirst({ where: { id: numberId, workspaceId } })
      : await prisma.whatsAppNumber.findFirst({
          where: { workspaceId, metaWabaId: { not: null }, metaAccessToken: { not: null } },
        });

    if (!waNumber?.metaAccessToken) {
      return res.status(404).json({ error: "No connected WhatsApp number with a stored token found" });
    }

    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    if (!appId || !appSecret) return res.status(500).json({ error: "Meta app credentials not configured" });

    try {
      const r = await axios.get(`https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`, {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: waNumber.metaAccessToken,
        },
      });
      const newToken: string = r.data.access_token;
      const expiresIn: number | undefined = r.data.expires_in;
      await prisma.whatsAppNumber.update({
        where: { id: waNumber.id },
        data: {
          metaAccessToken: newToken,
          metaTokenExpiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
        },
      });
      console.log(`[token-refresh] ✅ Refreshed token for number ${waNumber.phoneNumber}`);
      res.json({ ok: true, expiresIn, phone: waNumber.phoneNumber });
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || e?.message;
      console.error('[token-refresh] ❌', msg);
      // Token is fully expired — cannot extend. User must reconnect.
      res.status(400).json({
        error: msg || "Token refresh failed",
        hint: "The token has fully expired and cannot be renewed. Go to Channels and reconnect the WhatsApp number to get a fresh token.",
      });
    }
  });

  app.post("/api/meta/embedded-signup/resolve-assets", requireAuth, requireRole('ADMIN', 'OWNER'), async (req, res) => {
    const accessToken = String(req.body.accessToken || '').trim();
    const businessId = String(req.body.businessId || '').trim();
    const wabaId = String(req.body.wabaId || '').trim();

    if (!accessToken) {
      return res.status(400).json({ error: "Meta access token is required" });
    }

    try {
      const phoneNumbers = await fetchEmbeddedSignupPhoneAssets(accessToken, {
        businessId: businessId || null,
        wabaId: wabaId || null,
      });

      return res.json({
        success: true,
        phoneNumbers,
      });
    } catch (error: any) {
      return res.status(400).json({
        error: error?.response?.data?.error?.message || error?.message || "Could not resolve WhatsApp phone assets",
      });
    }
  });

  app.post("/api/meta/embedded-signup/finalize", requireAuth, requireRole('ADMIN', 'OWNER'), requireSubscribedWorkspaceFromBody, async (req, res) => {
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

    // ── Register number with Cloud API + subscribe WABA to webhooks ──
    // These two calls are required after Embedded Signup or the number
    // stays "Pending" and Meta never delivers webhooks for it.
    try {
      await axios.post(
        `https://graph.facebook.com/${META_GRAPH_VERSION}/${normalizedPhoneNumberId}/register`,
        { messaging_product: 'whatsapp', pin: '000000' },
        { headers: { Authorization: `Bearer ${normalizedAccessToken}` } }
      );
      console.log(`[embedded-signup] registered phone ${normalizedPhoneNumberId} with Cloud API`);
    } catch (e: any) {
      // Non-fatal — number may already be registered
      console.warn('[embedded-signup] register call failed (may already be registered):', e?.response?.data || e?.message);
    }

    if (wabaId) {
      try {
        await axios.post(
          `https://graph.facebook.com/${META_GRAPH_VERSION}/${wabaId}/subscribed_apps`,
          {},
          { headers: { Authorization: `Bearer ${normalizedAccessToken}` } }
        );
        console.log(`[embedded-signup] subscribed WABA ${wabaId} to webhooks`);
      } catch (e: any) {
        console.warn('[embedded-signup] webhook subscription failed:', e?.response?.data || e?.message);
      }
    }

    res.json(savedNumber);
  });

  // Stripe Checkout
  app.post("/api/billing/create-checkout-session", requireAuth, requireRole('OWNER'), requireVerifiedEmail, async (req, res) => {
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

  app.post("/api/billing/create-portal-session", requireAuth, requireRole('OWNER'), async (req: any, res) => {
    if (!stripe) return res.status(500).json({ error: "Stripe not configured" });

    const { workspaceId, returnUrl } = req.body;
    if (!workspaceId) {
      return res.status(400).json({ error: "Missing workspaceId" });
    }

    const membership = await prisma.workspaceMembership.findFirst({
      where: { workspaceId, userId: req.user.userId },
      include: { workspace: true },
    });

    if (!membership) {
      return res.status(403).json({ error: "Workspace access denied" });
    }

    if (!['OWNER', 'ADMIN'].includes(String(membership.role || '').toUpperCase())) {
      return res.status(403).json({ error: "Only workspace owners and admins can manage billing" });
    }

    const customerId = String(membership.workspace?.stripeCustomerId || '').trim();
    if (!customerId) {
      return res.status(400).json({ error: "No Stripe customer is connected to this workspace yet" });
    }

    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: String(returnUrl || `${PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000'}/app/settings/billing`),
      });

      res.json({ url: session.url });
    } catch (e: any) {
      console.error('[billing:create-portal-session]', e);
      res.status(400).json({ error: e?.message || "Could not open Stripe billing portal" });
    }
  });

  app.post("/api/billing/sync-subscription", requireAuth, requireRole('OWNER'), async (req: any, res) => {
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
  app.post("/api/chatbots/query", requireAuth, businessRateLimiter('ai'), async (req: any, res) => {
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

      const quota = await checkAiQuota(chatbot.workspaceId);
      if (!quota.allowed) {
        return res.status(403).json({
          error: `Monthly AI message limit reached (${quota.used}/${quota.limit}). Upgrade your plan for more AI messages.`,
          quotaExceeded: true,
          used: quota.used,
          limit: quota.limit,
        });
      }

      // Get contactId from conversation if available
      let contactId: string | undefined;
      if (conversationId) {
        const conv = await prisma.conversation.findUnique({
          where: { id: conversationId },
          select: { contactId: true },
        });
        contactId = conv?.contactId || undefined;
      }

      const aiResult = await getAIResponse(chatbot, message, {
        workspaceId: chatbot.workspaceId,
        contactId,
        conversationId,
      });

      if (!aiResult.text) {
        return res.status(500).json({ error: "No AI provider configured or AI failed" });
      }

      // Save the AI message if conversationId is provided
      if (conversationId) {
        const aiMsg = await prisma.message.create({
          data: {
            conversationId,
            content: aiResult.text,
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

      res.json({ response: aiResult.text, escalated: aiResult.escalated, escalationReason: aiResult.escalationReason });
    } catch (e: any) {
      console.error('AI Error:', e);
      res.status(500).json({ error: "AI processing failed" });
    }
  });

  app.post("/api/ai/reply-suggestions", requireAuth, businessRateLimiter('ai'), requireSubscribedWorkspaceFromBody, async (req, res) => {
    const history = Array.isArray(req.body?.history) ? req.body.history : [];
    const workspaceId = String(req.body?.workspaceId || '').trim() || null;

    try {
      const quota = await checkAiQuota(workspaceId);
      if (!quota.allowed) {
        return res.status(403).json({
          error: `Monthly AI message limit reached (${quota.used}/${quota.limit}). Upgrade your plan for more AI messages.`,
          quotaExceeded: true,
          used: quota.used,
          limit: quota.limit,
        });
      }

      const suggestions = await generateAIReplySuggestions(history, workspaceId);
      if (!suggestions.length) {
        return res.status(500).json({ error: "No AI provider configured or AI failed" });
      }
      res.json({ suggestions });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to generate reply suggestions" });
    }
  });

  app.post("/api/ai/summarize", requireAuth, businessRateLimiter('ai'), requireSubscribedWorkspaceFromBody, async (req, res) => {
    const history = Array.isArray(req.body?.history) ? req.body.history : [];
    const workspaceId = String(req.body?.workspaceId || '').trim() || null;

    try {
      const quota = await checkAiQuota(workspaceId);
      if (!quota.allowed) {
        return res.status(403).json({
          error: `Monthly AI message limit reached (${quota.used}/${quota.limit}). Upgrade your plan for more AI messages.`,
          quotaExceeded: true,
          used: quota.used,
          limit: quota.limit,
        });
      }

      const summary = await generateAISummary(history, workspaceId);
      if (!summary) {
        return res.status(500).json({ error: "No AI provider configured or AI failed" });
      }
      res.json({ summary });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to summarize conversation" });
    }
  });

  app.post("/webhook/meta", async (req, res) => {
    if (!verifyMetaSignature(req)) {
      return res.status(403).send("Forbidden");
    }

    const body = req.body;
    console.log("Meta Webhook received", {
      object: body?.object,
      entryCount: Array.isArray(body?.entry) ? body.entry.length : 0,
    });

    // Enqueue for async processing by the BullMQ worker.
    // Respond 200 immediately so Meta does not retry.
    try {
      if (webhookQueue) {
        await webhookQueue.add("meta-webhook", { body });
      } else {
        console.error("[webhook] webhookQueue not initialized, processing inline");
        const { processMetaWebhook } = await import("./server/services/webhookProcessor.js");
        processMetaWebhook(body, {
          emit: (room, event, data) => io.to(room).emit(event, data),
        }).catch((err) => console.error("[webhook-inline] failed:", err));
      }
    } catch (err) {
      console.error("[webhook] enqueue failed:", err);
    }

    res.sendStatus(200);
  });

  // Auth Mock (For demo purposes)
  app.post("/api/auth/register", authRateLimiter('register'), async (req, res) => {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Missing name, email or password" });
    }

    const registrationValidationError = validateRegistrationInput({ name, email, password });
    if (registrationValidationError) {
      return res.status(400).json({ error: registrationValidationError });
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

      const verification = await issueEmailVerification(req, user);

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({ token, user: sanitizeUser(user), verification });
    } catch (e: any) {
      console.error('[auth:register]', e);
      res.status(500).json({ error: e?.message || 'Registration failed' });
    }
  });

  app.post("/api/auth/verify-email", requireAuth, async (req, res) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: (req as any).user.userId },
      });

      if (!user?.id) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (user.emailVerified) {
        return res.json({
          success: true,
          user: sanitizeUser(user),
          emailSent: false,
          message: 'Email is already verified.',
        });
      }

      const verification = await issueEmailVerification(req, user);
      res.json({ success: true, user: sanitizeUser(user), ...verification });
    } catch (e: any) {
      console.error('[auth:verify-email]', e);
      res.status(500).json({ error: e?.message || 'Could not send verification email' });
    }
  });

  app.get("/api/auth/verify-email/validate", async (req, res) => {
    const token = String(req.query?.token || '').trim();
    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    const tokenHash = hashEmailVerificationToken(token);
    const user = await prisma.user.findFirst({
      where: {
        emailVerificationTokenHash: tokenHash,
        emailVerificationExpiresAt: {
          gt: new Date(),
        },
      } as any,
      select: {
        id: true,
        email: true,
        emailVerified: true,
      },
    });

    if (!user) {
      return res.status(400).json({ error: 'This email verification link is invalid or has expired' });
    }

    if (user.emailVerified) {
      return res.json({ success: true, alreadyVerified: true });
    }

    res.json({ success: true });
  });

  app.post("/api/auth/verify-email/complete", async (req, res) => {
    const token = String(req.body?.token || '').trim();
    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    const tokenHash = hashEmailVerificationToken(token);
    const user = await prisma.user.findFirst({
      where: {
        emailVerificationTokenHash: tokenHash,
        emailVerificationExpiresAt: {
          gt: new Date(),
        },
      } as any,
    });

    if (!user) {
      return res.status(400).json({ error: 'This email verification link is invalid or has expired' });
    }

    const verifiedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationTokenHash: null,
        emailVerificationExpiresAt: null,
      } as any,
    });

    res.json({
      success: true,
      message: 'Email verified successfully.',
      user: sanitizeUser(verifiedUser),
    });
  });

  app.post("/api/auth/forgot-password", authRateLimiter('forgot-password'), async (req, res) => {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user?.id) {
        return res.json({
          success: true,
          emailSent: false,
          message: "If the account exists, a password reset email has been sent.",
        });
      }

      const reset = await issuePasswordReset(req, user);
      console.log(`[AUTH] Password reset requested for ${email} at ${new Date().toISOString()}`);

      res.json({
        success: true,
        ...reset,
      });
    } catch (e: any) {
      console.error('[auth:forgot-password]', e);
      res.status(500).json({ error: e?.message || 'Could not send password reset email' });
    }
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

  // ── Public Booking (no auth) ────────────────────────────────────────
  // Used by the client-facing /book/:slug page. No requireAuth.

  // GET /api/public/book/:slug — workspace info + services + staff
  app.get("/api/public/book/:slug", async (req, res) => {
    try {
      const workspace = await prisma.workspace.findUnique({
        where: { slug: req.params.slug },
        select: {
          id: true, name: true, suspended: true,
          services: {
            where: { enabled: true },
            orderBy: { name: "asc" },
            select: { id: true, name: true, description: true, durationMin: true, price: true, currency: true, color: true },
          },
          staffMembers: {
            where: { enabled: true },
            orderBy: { name: "asc" },
            select: { id: true, name: true, avatar: true, workingHours: true, staffServices: { select: { serviceId: true } } },
          },
        },
      });
      if (!workspace) return res.status(404).json({ error: "Booking page not found" });
      if (workspace.suspended) return res.status(403).json({ error: "This business is currently unavailable" });
      res.json({ id: workspace.id, name: workspace.name, services: workspace.services, staff: workspace.staffMembers });
    } catch (err) {
      console.error("[public-book:info]", err);
      res.status(500).json({ error: "Failed to load booking page" });
    }
  });

  // GET /api/public/book/:slug/availability — available time slots
  app.get("/api/public/book/:slug/availability", async (req, res) => {
    try {
      const { serviceId, staffId, date } = req.query as Record<string, string>;
      if (!serviceId || !date) return res.status(400).json({ error: "serviceId and date are required" });

      const workspace = await prisma.workspace.findUnique({ where: { slug: req.params.slug }, select: { id: true } });
      if (!workspace) return res.status(404).json({ error: "Not found" });

      const service = await prisma.service.findFirst({
        where: { id: serviceId, workspaceId: workspace.id, enabled: true },
      });
      if (!service) return res.status(404).json({ error: "Service not found" });

      // Build staff list — specific staff or all staff eligible for this service
      const staffWhere: any = { workspaceId: workspace.id, enabled: true };
      if (staffId && staffId !== "any") {
        staffWhere.id = staffId;
      } else {
        staffWhere.staffServices = { some: { serviceId } };
      }
      let staffList = await prisma.staffMember.findMany({ where: staffWhere });

      // Fallback: if "any" staff was requested but no StaffService links exist,
      // use all enabled staff in the workspace (common when owner hasn't assigned services yet).
      if (staffList.length === 0 && (!staffId || staffId === "any")) {
        staffList = await prisma.staffMember.findMany({
          where: { workspaceId: workspace.id, enabled: true },
        });
      }

      const d = new Date(date);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const dayEnd   = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
      const dayName  = dayNames[d.getDay()];

      const existingAppointments = await prisma.appointment.findMany({
        where: {
          workspaceId: workspace.id,
          staffId: { in: staffList.map((s) => s.id) },
          status: { not: "CANCELLED" },
          startTime: { gte: dayStart, lt: dayEnd },
        },
      });

      // Collect all unique available slots across eligible staff
      const slotSet = new Set<string>();

      for (const staff of staffList) {
        let hours: any = null;
        try { hours = JSON.parse(staff.workingHours || "{}")[dayName]; } catch {}
        // Fallback to default working hours (09:00–17:00, Sun–Thu) when not configured.
        if (!hours?.start || !hours?.end) {
          if (dayName === "fri" || dayName === "sat") continue;
          hours = { start: "09:00", end: "17:00" };
        }

        const staffAppts = existingAppointments.filter((a) => a.staffId === staff.id);
        const [sh, sm] = hours.start.split(":").map(Number);
        const [eh, em] = hours.end.split(":").map(Number);
        const workStart = new Date(dayStart.getTime() + sh * 3600000 + sm * 60000);
        const workEnd   = new Date(dayStart.getTime() + eh * 3600000 + em * 60000);

        let cursor = new Date(workStart);
        while (cursor.getTime() + service.durationMin * 60000 <= workEnd.getTime()) {
          const slotEnd = new Date(cursor.getTime() + service.durationMin * 60000);
          const hasConflict = staffAppts.some((a) => a.startTime < slotEnd && a.endTime > cursor);
          if (!hasConflict) {
            slotSet.add(
              `${String(cursor.getHours()).padStart(2, "0")}:${String(cursor.getMinutes()).padStart(2, "0")}`
            );
          }
          cursor = new Date(cursor.getTime() + 30 * 60000);
        }
      }

      const slots = Array.from(slotSet).sort();
      res.json({ slots });
    } catch (err) {
      console.error("[public-book:availability]", err);
      res.status(500).json({ error: "Failed to check availability" });
    }
  });

  // POST /api/public/book/:slug — create the appointment
  app.post("/api/public/book/:slug", async (req, res) => {
    try {
      const { serviceId, staffId, date, slot, customerName, customerPhone } = req.body;
      if (!serviceId || !date || !slot || !customerPhone?.trim()) {
        return res.status(400).json({ error: "serviceId, date, slot, and customerPhone are required" });
      }

      const workspace = await prisma.workspace.findUnique({ where: { slug: req.params.slug }, select: { id: true, name: true } });
      if (!workspace) return res.status(404).json({ error: "Not found" });

      const service = await prisma.service.findFirst({ where: { id: serviceId, workspaceId: workspace.id, enabled: true } });
      if (!service) return res.status(404).json({ error: "Service not found" });

      // Resolve staff — pick first available if "any"
      let resolvedStaffId = staffId;
      if (!staffId || staffId === "any") {
        const d = new Date(date);
        const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
        const dayName  = dayNames[d.getDay()];
        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const dayEnd   = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
        const [slotH, slotM] = slot.split(":").map(Number);
        const slotStart = new Date(dayStart.getTime() + slotH * 3600000 + slotM * 60000);
        const slotEnd   = new Date(slotStart.getTime() + service.durationMin * 60000);

        let eligibleStaff = await prisma.staffMember.findMany({
          where: { workspaceId: workspace.id, enabled: true, staffServices: { some: { serviceId } } },
        });
        if (eligibleStaff.length === 0) {
          // Fallback when no StaffService links exist — use all enabled staff
          eligibleStaff = await prisma.staffMember.findMany({
            where: { workspaceId: workspace.id, enabled: true },
          });
        }
        for (const sm of eligibleStaff) {
          let hours: any = null;
          try { hours = JSON.parse(sm.workingHours || "{}")[dayName]; } catch {}
          if (!hours?.start || !hours?.end) {
            if (dayName === "fri" || dayName === "sat") continue;
            hours = { start: "09:00", end: "17:00" };
          }
          const conflict = await prisma.appointment.findFirst({
            where: { staffId: sm.id, status: { not: "CANCELLED" }, startTime: { gte: dayStart, lt: dayEnd },
              AND: [{ startTime: { lt: slotEnd } }, { endTime: { gt: slotStart } }] },
          });
          if (!conflict) { resolvedStaffId = sm.id; break; }
        }
        if (!resolvedStaffId || resolvedStaffId === "any") {
          return res.status(409).json({ error: "No available staff for this slot. Please choose another time." });
        }
      }

      const staffMember = await prisma.staffMember.findFirst({ where: { id: resolvedStaffId, workspaceId: workspace.id } });
      if (!staffMember) return res.status(404).json({ error: "Staff not found" });

      // Build start/end times
      const d = new Date(date);
      const [slotH, slotM] = slot.split(":").map(Number);
      const startTime = new Date(d.getFullYear(), d.getMonth(), d.getDate(), slotH, slotM, 0);
      const endTime   = new Date(startTime.getTime() + service.durationMin * 60000);

      // Upsert contact by phone number
      const phone = normalizePhone(customerPhone.trim());
      if (!phone) return res.status(400).json({ error: "Invalid phone number" });

      let contact = await prisma.contact.findFirst({ where: { workspaceId: workspace.id, phoneNumber: phone } });
      if (!contact) {
        contact = await prisma.contact.create({
          data: { workspaceId: workspace.id, phoneNumber: phone, name: customerName?.trim() || undefined, leadSource: "BOOKING_LINK" },
        });
      }

      // Create appointment
      const appointment = await prisma.appointment.create({
        data: { workspaceId: workspace.id, contactId: contact.id, serviceId, staffId: resolvedStaffId, startTime, endTime, status: "SCHEDULED" },
        include: { service: true, staff: true },
      });

      // Send WhatsApp confirmation (fire-and-forget)
      (async () => {
        try {
          const waNumber = await prisma.whatsAppNumber.findFirst({ where: { workspaceId: workspace.id } });
          if (!waNumber) return;
          const { getWhatsAppChannelConfig, sendMetaMessage } = await import("./server/services/meta.js");
          const { sendTemplateMessage } = await import("./server/services/meta.js");
          const config = getWhatsAppChannelConfig(waNumber);
          if (!config.accessToken || !config.phoneNumberId) return;

          const graphVersion = process.env.META_GRAPH_VERSION || "v22.0";
          const confirmedTemplate = await prisma.whatsAppTemplate.findFirst({
            where: { workspaceId: workspace.id, name: "tawasel_booking_confirmation", status: "APPROVED" },
          });

          const dateTimeStr = startTime.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })
            + " at " + startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });

          if (confirmedTemplate) {
            await sendTemplateMessage(phone, "tawasel_booking_confirmation", "en_US",
              [customerName?.trim() || "there", service.name, staffMember.name, dateTimeStr, workspace.name],
              config as { accessToken: string; phoneNumberId: string }
            );
          } else {
            const msg = `Hi ${customerName?.trim() || "there"}! ✅\n\nYour appointment is confirmed:\n📋 *Service:* ${service.name}\n👤 *With:* ${staffMember.name}\n📅 *Date & Time:* ${dateTimeStr}\n\nSee you soon! — ${workspace.name}`;
            await sendMetaMessage(phone, msg, "whatsapp", config);
          }
        } catch (err: any) {
          console.error("[public-book:confirmation]", err.message);
        }
      })();

      res.json({
        appointmentId: appointment.id,
        serviceName: appointment.service.name,
        staffName: appointment.staff.name,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
      });
    } catch (err) {
      console.error("[public-book:create]", err);
      res.status(500).json({ error: "Failed to create appointment" });
    }
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

  app.patch("/api/users/me", requireAuth, async (req: any, res) => {
    const { name, image } = req.body;
    const updates: any = {};

    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (!trimmed) return res.status(400).json({ error: "Name cannot be empty" });
      updates.name = trimmed;
    }

    if (image !== undefined) {
      // Accept base64 data URL or null (to remove)
      if (image !== null && !String(image).startsWith('data:image/')) {
        return res.status(400).json({ error: "Invalid image format" });
      }
      // Limit ~800KB base64 ≈ ~1.1MB string
      if (image && image.length > 1_200_000) {
        return res.status(400).json({ error: "Image too large. Max 800KB." });
      }
      updates.image = image;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    const updated = await prisma.user.update({
      where: { id: req.user.userId },
      data: updates,
      select: { id: true, name: true, email: true, image: true, emailVerified: true },
    });

    res.json(updated);
  });

  app.post("/api/auth/change-password", requireAuth, async (req: any, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new password are required" });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user?.password) {
      return res.status(400).json({ error: "No password set on this account" });
    }
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
    res.json({ success: true });
  });

  // Workspace Routes
  app.get("/api/workspaces", requireAuth, async (req: any, res) => {
    const memberships = await prisma.workspaceMembership.findMany({
      where: { userId: req.user.userId },
      include: { workspace: true }
    });
    res.json(memberships.map(m => ({ ...m.workspace, membership: { role: m.role } })));
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
    const conversationWhere: any = { workspaceId: workspaceId as string };
    if (!INSTAGRAM_INTEGRATION_ENABLED) {
      conversationWhere.channelType = 'WHATSAPP';
    }
    const conversations = await prisma.conversation.findMany({
      where: conversationWhere,
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

    const unreadCounts = await prisma.message.groupBy({
      by: ['conversationId'],
      where: {
        conversation: {
          workspaceId: workspaceId as string,
          ...(INSTAGRAM_INTEGRATION_ENABLED ? {} : { channelType: 'WHATSAPP' }),
        },
        direction: 'INCOMING',
        isInternal: false,
        readAt: null,
      },
      _count: {
        _all: true,
      },
    });

    const unreadCountByConversationId = new Map(
      unreadCounts.map((entry) => [entry.conversationId, entry._count._all])
    );

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

    res.json(
      conversations.map((conversation) => ({
        ...conversation,
        unreadCount: unreadCountByConversationId.get(conversation.id) || 0,
      }))
    );
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
    if (!conversation || (!INSTAGRAM_INTEGRATION_ENABLED && conversation.channelType !== 'WHATSAPP')) {
      return res.status(404).json({ error: "Conversation not found" });
    }
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
        ? message.conversation.instagramAccount?.accessToken || process.env.INSTAGRAM_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN || ""
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

  // Clear all messages in a conversation
  app.delete("/api/conversations/:id/messages", requireAuth, requireSubscribedConversation, async (req, res) => {
    const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id } });
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });

    await prisma.message.deleteMany({ where: { conversationId: req.params.id } });

    io.to(conversation.workspaceId).emit("conversation-updated", conversation.id);
    res.json({ success: true });
  });

  // Delete a conversation and all its messages
  app.delete("/api/conversations/:id", requireAuth, requireSubscribedConversation, async (req, res) => {
    const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id } });
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });

    // Delete related records first
    await prisma.message.deleteMany({ where: { conversationId: req.params.id } });
    await prisma.conversationNote.deleteMany({ where: { conversationId: req.params.id } });
    await prisma.activityLog.deleteMany({ where: { conversationId: req.params.id } });
    await prisma.task.deleteMany({ where: { conversationId: req.params.id } });
    await prisma.conversation.delete({ where: { id: req.params.id } });

    io.to(conversation.workspaceId).emit("conversation-deleted", conversation.id);
    res.json({ success: true });
  });

  app.post("/api/messages", requireAuth, businessRateLimiter('messages'), requireSubscribedConversation, async (req, res) => {
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
  app.post("/api/messages/send", requireAuth, businessRateLimiter('messages'), upload.array('attachments', 5), requireSubscribedConversation, async (req, res) => {
    const { conversationId, content, senderId, senderName, isInternal, replyToMetaMessageId, replyToId } = req.body;
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
            const whatsappMsgId = await sendMetaMessage(to, content, 'whatsapp', {
              accessToken: whatsAppConfig.accessToken,
              phoneNumberId,
              replyToMetaMessageId: replyToMetaMessageId || undefined
            });

            createdMessages.push(await prisma.message.create({
              data: {
                conversationId,
                content,
                direction: 'OUTGOING',
                senderType: 'USER',
                senderName,
                isInternal: isInternalMessage,
                metaMessageId: whatsappMsgId || null,
                replyToId: replyToId || null,
                status: 'SENT'
              }
            }));
          }
        } else if (conversation.channelType === 'INSTAGRAM' && conversation.contact.instagramId) {
          if (attachments.length > 0) {
            return res.status(400).json({ error: "Instagram attachments are not connected yet. Send text only for now." });
          }
          const igMsgId = await sendMetaMessage(conversation.contact.instagramId, content, 'instagram', {
            accessToken: conversation.instagramAccount?.accessToken || process.env.INSTAGRAM_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN || "",
            instagramId: conversation.instagramAccount?.instagramId
          });

          createdMessages.push(await prisma.message.create({
            data: {
              conversationId,
              content,
              direction: 'OUTGOING',
              senderType: 'USER',
              senderName,
              isInternal: isInternalMessage,
              metaMessageId: igMsgId || null,
              status: 'SENT'
            }
          }));
        }
      }

      // Internal notes or fallback (no Meta send)
      if (createdMessages.length === 0 && (content?.trim() || attachments.length === 0)) {
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

  app.post("/api/templates/whatsapp/sync", requireAuth, requireRole('ADMIN', 'OWNER'), requireSubscribedWorkspaceFromBody, async (req, res) => {
    const workspaceId = String(req.body.workspaceId || '').trim();
    const whatsAppNumberId = String(req.body.whatsAppNumberId || '').trim();
    if (!workspaceId) {
      return res.status(400).json({ error: "Workspace is required" });
    }

    // If user picked a specific number, use it (scoped to workspace).
    // Otherwise prefer a number that actually has credentials (seeded placeholders have null metaWabaId).
    const waNumber = whatsAppNumberId
      ? await prisma.whatsAppNumber.findFirst({ where: { id: whatsAppNumberId, workspaceId } })
      : (await prisma.whatsAppNumber.findFirst({
          where: { workspaceId, metaWabaId: { not: null }, metaAccessToken: { not: null } },
        })) || (await prisma.whatsAppNumber.findFirst({ where: { workspaceId } }));

    const wabaId = waNumber?.metaWabaId?.trim() || process.env.META_WABA_ID || '';

    // Try per-number token first (Embedded Signup — likely has correct Business Manager access),
    // then System User token as fallback.
    const tokens: { label: string; token: string }[] = [];
    if (waNumber?.metaAccessToken?.trim()) tokens.push({ label: "per-number", token: waNumber.metaAccessToken.trim() });
    if (process.env.META_ACCESS_TOKEN?.trim()) tokens.push({ label: "system-user", token: process.env.META_ACCESS_TOKEN.trim() });

    if (tokens.length === 0 || !wabaId) {
      return res.status(400).json({ error: "WhatsApp Business Account not configured. Please connect a WhatsApp number first." });
    }

    try {
      const graphVersion = process.env.META_GRAPH_VERSION || 'v22.0';
      let metaRes: any = null;
      let lastErr: any = null;
      for (const { label, token } of tokens) {
        try {
          console.log(`[template-sync] Attempting list with ${label} token (WABA ${wabaId})`);
          metaRes = await axios.get(
            `https://graph.facebook.com/${graphVersion}/${wabaId}/message_templates`,
            {
              params: { access_token: token, limit: 250 },
              timeout: 15000,
            }
          );
          console.log(`[template-sync] ✅ Success with ${label} token`);
          break;
        } catch (e: any) {
          lastErr = e;
          console.error(`[template-sync] ❌ ${label} token failed:`, e.response?.data?.error || e.message);
        }
      }
      if (!metaRes) throw lastErr || new Error("All tokens failed");

      const metaTemplates = metaRes.data?.data || [];

      // Upsert each template
      let synced = 0;
      for (const t of metaTemplates) {
        const bodyComponent = t.components?.find((c: any) => c.type === 'BODY');
        const content = bodyComponent?.text || '';

        await prisma.whatsAppTemplate.upsert({
          where: {
            id: await prisma.whatsAppTemplate.findFirst({
              where: { workspaceId, name: t.name, language: t.language },
              select: { id: true }
            }).then(r => r?.id || 'nonexistent')
          },
          update: {
            content,
            category: t.category || 'UTILITY',
            status: t.status || 'APPROVED',
            rejectedReason: t.rejected_reason || null,
          },
          create: {
            workspaceId,
            name: t.name,
            content,
            category: t.category || 'UTILITY',
            language: t.language || 'en',
            status: t.status || 'APPROVED',
            rejectedReason: t.rejected_reason || null,
          }
        });
        synced++;
      }

      // Return updated templates
      const templates = await prisma.whatsAppTemplate.findMany({
        where: { workspaceId }
      });
      res.json({ synced, templates });
    } catch (err: any) {
      console.error('[template-sync] Meta API error:', err.response?.data || err.message);
      return res.status(502).json({ error: "Failed to fetch templates from WhatsApp. Check your WABA configuration." });
    }
  });

  // ── Appointment Template Setup ─────────────────────────────────────
  // Creates the 3 standard Tawasel appointment templates in the workspace's
  // WABA using their stored OAuth token. Safe to call multiple times —
  // Meta returns an error for duplicate names which we treat as "already exists".

  const APPOINTMENT_TEMPLATES = [
    {
      name: "tawasel_booking_confirmation",
      category: "UTILITY",
      language: "en_US",
      bodyText:
        "Hi {{1}}! ✅\n\nYour appointment is confirmed:\n📋 *Service:* {{2}}\n👤 *With:* {{3}}\n📅 *Date & Time:* {{4}}\n\nWe'll send you a reminder before your appointment. See you soon! — {{5}}",
    },
    {
      name: "tawasel_reminder_24h",
      category: "UTILITY",
      language: "en_US",
      bodyText:
        "Hi {{1}}! 👋\n\nReminder about your upcoming appointment:\n📋 *Service:* {{2}}\n👤 *With:* {{3}}\n🕐 *Time:* {{4}}\n\nNeed to reschedule? Just reply to this message. — {{5}}",
    },
    {
      name: "tawasel_reminder_1h",
      category: "UTILITY",
      language: "en_US",
      bodyText:
        "Hi {{1}}! ⏰\n\nYour {{2}} with {{3}} is in 1 hour at {{4}}. See you soon! — {{5}}",
    },
  ];

  app.post("/api/appointments/setup-templates", requireAuth, requireRole("ADMIN", "OWNER"), requireSubscribedWorkspaceFromBody, async (req: any, res) => {
    const workspaceId = String(req.body.workspaceId || "").trim();
    const whatsAppNumberId = String(req.body.whatsAppNumberId || "").trim();
    if (!workspaceId) return res.status(400).json({ error: "Workspace ID required" });

    const waNumber = whatsAppNumberId
      ? await prisma.whatsAppNumber.findFirst({ where: { id: whatsAppNumberId, workspaceId } })
      : (await prisma.whatsAppNumber.findFirst({
          where: { workspaceId, metaWabaId: { not: null }, metaAccessToken: { not: null } },
        })) || (await prisma.whatsAppNumber.findFirst({ where: { workspaceId } }));
    const wabaId = waNumber?.metaWabaId?.trim() || process.env.META_WABA_ID || "";

    // Try per-number token first (Embedded Signup), then System User token as fallback.
    const tokens: { label: string; token: string }[] = [];
    if (waNumber?.metaAccessToken?.trim()) tokens.push({ label: "per-number", token: waNumber.metaAccessToken.trim() });
    if (process.env.META_ACCESS_TOKEN?.trim()) tokens.push({ label: "system-user", token: process.env.META_ACCESS_TOKEN.trim() });

    if (tokens.length === 0 || !wabaId) {
      return res.status(400).json({ error: "No WhatsApp number connected. Connect a number first." });
    }

    const graphVersion = process.env.META_GRAPH_VERSION || "v22.0";
    const results: { name: string; status: string; detail?: string }[] = [];
    // Track the working token for auto-sync at the end
    let workingToken: string = tokens[0].token;

    for (const tpl of APPOINTMENT_TEMPLATES) {
      let submitted = false;
      let alreadyExists = false;
      let lastCode: number | undefined;
      let lastDetail: string = "";
      for (const { label, token } of tokens) {
        try {
          console.log(`[setup-templates] ${tpl.name}: trying ${label} token (WABA ${wabaId})`);
          await axios.post(
            `https://graph.facebook.com/${graphVersion}/${wabaId}/message_templates`,
            {
              name: tpl.name,
              category: tpl.category,
              language: tpl.language,
              components: [{ type: "BODY", text: tpl.bodyText }],
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          console.log(`[setup-templates] ✅ ${tpl.name} submitted with ${label} token`);
          workingToken = token;
          submitted = true;
          break;
        } catch (err: any) {
          lastCode = err.response?.data?.error?.code;
          lastDetail = err.response?.data?.error?.message || err.message;
          console.error(`[setup-templates] ❌ ${tpl.name} ${label} token:`, { code: lastCode, message: lastDetail });
          if (lastCode === 2388085 || lastDetail?.includes("already exists")) {
            workingToken = token;
            alreadyExists = true;
            break;
          }
        }
      }

      if (submitted) {
        await prisma.whatsAppTemplate.upsert({
          where: {
            id: await prisma.whatsAppTemplate.findFirst({
              where: { workspaceId, name: tpl.name, language: tpl.language },
              select: { id: true },
            }).then((r) => r?.id || "nonexistent"),
          },
          update: { status: "PENDING" },
          create: {
            workspaceId,
            name: tpl.name,
            content: tpl.bodyText,
            category: tpl.category,
            language: tpl.language,
            status: "PENDING",
          },
        });
        results.push({ name: tpl.name, status: "submitted" });
      } else if (alreadyExists) {
        results.push({ name: tpl.name, status: "already_exists" });
      } else {
        results.push({ name: tpl.name, status: "error", detail: lastDetail });
      }
    }

    // Auto-sync so the new templates appear in the DB right away
    try {
      const syncRes = await axios.get(
        `https://graph.facebook.com/${graphVersion}/${wabaId}/message_templates`,
        { params: { access_token: workingToken, limit: 250 }, timeout: 10000 }
      );
      const metaTemplates = syncRes.data?.data || [];
      for (const t of metaTemplates) {
        const bodyComponent = t.components?.find((c: any) => c.type === "BODY");
        const content = bodyComponent?.text || "";
        await prisma.whatsAppTemplate.upsert({
          where: {
            id: await prisma.whatsAppTemplate.findFirst({
              where: { workspaceId, name: t.name, language: t.language },
              select: { id: true },
            }).then((r) => r?.id || "nonexistent"),
          },
          update: { content, category: t.category || "UTILITY", status: t.status || "PENDING" },
          create: {
            workspaceId,
            name: t.name,
            content,
            category: t.category || "UTILITY",
            language: t.language || "en_US",
            status: t.status || "PENDING",
          },
        });
      }
    } catch (syncErr: any) {
      console.warn("[setup-templates] auto-sync after create failed:", syncErr.message);
    }

    res.json({
      results,
      message: "Templates submitted to Meta for approval. They will be active within a few minutes.",
    });
  });

  // ── Template Creator (create custom WhatsApp template in Meta) ─────
  app.post("/api/templates/whatsapp/create", requireAuth, requireRole("ADMIN", "OWNER"), requireSubscribedWorkspaceFromBody, async (req: any, res) => {
    const { workspaceId, name, category, language, bodyText, variableCount, whatsAppNumberId } = req.body;
    if (!workspaceId || !name || !category || !language || !bodyText) {
      return res.status(400).json({ error: "name, category, language, and bodyText are required" });
    }

    // Validate name: lowercase letters, numbers, underscores only
    if (!/^[a-z0-9_]{1,512}$/.test(name)) {
      return res.status(400).json({ error: "Template name must be lowercase letters, numbers, and underscores only" });
    }

    const waNumber = whatsAppNumberId
      ? await prisma.whatsAppNumber.findFirst({ where: { id: whatsAppNumberId, workspaceId } })
      : (await prisma.whatsAppNumber.findFirst({
          where: { workspaceId, metaWabaId: { not: null }, metaAccessToken: { not: null } },
        })) || (await prisma.whatsAppNumber.findFirst({ where: { workspaceId } }));
    const wabaId = waNumber?.metaWabaId?.trim() || process.env.META_WABA_ID || "";
    if (!wabaId) {
      return res.status(400).json({ error: "No WhatsApp number connected. Connect a number in Channels first." });
    }

    // Try multiple tokens in order of likely permissions:
    // 1. Per-number token (captured during Embedded Signup — includes whatsapp_business_management if app was approved)
    // 2. System User token from env (for workspaces under the same Business Manager as the app)
    const tokens: { label: string; token: string }[] = [];
    if (waNumber?.metaAccessToken?.trim()) tokens.push({ label: "per-number", token: waNumber.metaAccessToken.trim() });
    if (process.env.META_ACCESS_TOKEN?.trim()) tokens.push({ label: "system-user", token: process.env.META_ACCESS_TOKEN.trim() });
    if (tokens.length === 0) {
      return res.status(400).json({ error: "No WhatsApp access token available. Reconnect your number." });
    }

    // Convert named tokens ({{customer_name}}, {{service}}, etc.) → numbered ({{1}}, {{2}}...)
    // because Meta requires numbered placeholders and sample values for approval.
    const SAMPLE_VALUES: Record<string, string> = {
      customer_name: "Ahmed",
      name: "Ahmed",
      service: "Haircut",
      staff: "Sara",
      date: "Monday, April 25",
      time: "3:30 PM",
      business: "Tawasel Salon",
      phone: "+971501234567",
      amount: "150 AED",
      code: "123456",
    };
    const tokenOrder: string[] = [];
    const seen = new Set<string>();
    let numberedText = bodyText.replace(/\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g, (_m, key) => {
      if (!seen.has(key)) {
        seen.add(key);
        tokenOrder.push(key);
      }
      return `{{${tokenOrder.indexOf(key) + 1}}}`;
    });
    // Also normalize any pre-existing {{1}}, {{2}} so sample count matches
    const numericMatches = Array.from(numberedText.matchAll(/\{\{(\d+)\}\}/g)).map(m => parseInt(m[1], 10));
    const maxNum = numericMatches.length ? Math.max(...numericMatches) : tokenOrder.length;
    const exampleValues: string[] = [];
    for (let i = 1; i <= maxNum; i++) {
      const namedKey = tokenOrder[i - 1];
      exampleValues.push(namedKey ? (SAMPLE_VALUES[namedKey] || `Sample${i}`) : `Sample${i}`);
    }

    const components: any[] = [{ type: "BODY", text: numberedText }];
    if (exampleValues.length > 0) {
      components[0].example = { body_text: [exampleValues] };
    }

    const graphVersion = process.env.META_GRAPH_VERSION || "v22.0";
    let lastError: string = "";
    let lastCode: number | undefined;
    let success = false;

    for (const { label, token } of tokens) {
      console.log(`[templates/create] Attempting with ${label} token (WABA ${wabaId}, template ${name}, ${exampleValues.length} vars)`);
      try {
        await axios.post(
          `https://graph.facebook.com/${graphVersion}/${wabaId}/message_templates`,
          { name, category, language, components },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log(`[templates/create] ✅ Success with ${label} token`);
        success = true;
        break;
      } catch (err: any) {
        lastCode = err.response?.data?.error?.code;
        lastError = err.response?.data?.error?.message || err.message;
        console.error(`[templates/create] ❌ ${label} token failed:`, { code: lastCode, message: lastError });
        // If template already exists, treat as success immediately
        if (lastCode === 2388085 || lastError.includes("already exists")) {
          success = true;
          break;
        }
        // Otherwise, try next token
      }
    }

    if (!success) {
      return res.status(400).json({
        error: lastError || "Failed to create template on Meta",
        hint: "Reconnect your WhatsApp number in Channels — the access token may have expired. Template creation requires whatsapp_business_management permission.",
        wabaId,
        metaErrorCode: lastCode,
      });
    }

    // Upsert locally as PENDING
    const existing = await prisma.whatsAppTemplate.findFirst({
      where: { workspaceId, name, language },
    });
    // Store the numbered version locally — that's what Meta has and what we send at runtime
    const template = existing
      ? await prisma.whatsAppTemplate.update({ where: { id: existing.id }, data: { content: numberedText, status: "PENDING", category, rejectedReason: null } })
      : await prisma.whatsAppTemplate.create({ data: { workspaceId, name, content: numberedText, category, language, status: "PENDING" } });

    res.json({ template, message: "Template submitted to Meta for approval. Usually approved within a few minutes." });
  });

  // ── Delete a WhatsApp template (from Meta + local DB) ──────────────
  app.delete("/api/templates/whatsapp/:id", requireAuth, requireRole("ADMIN", "OWNER"), async (req: any, res) => {
    const { id } = req.params;
    const workspaceId = String(req.query.workspaceId || req.body?.workspaceId || "").trim();
    if (!workspaceId) return res.status(400).json({ error: "workspaceId required" });

    const template = await prisma.whatsAppTemplate.findFirst({ where: { id, workspaceId } });
    if (!template) return res.status(404).json({ error: "Template not found" });

    // Find the credentialed number for this workspace
    const waNumber =
      (await prisma.whatsAppNumber.findFirst({
        where: { workspaceId, metaWabaId: { not: null }, metaAccessToken: { not: null } },
      })) || (await prisma.whatsAppNumber.findFirst({ where: { workspaceId } }));
    const wabaId = waNumber?.metaWabaId?.trim() || process.env.META_WABA_ID || "";

    const tokens: { label: string; token: string }[] = [];
    if (waNumber?.metaAccessToken?.trim()) tokens.push({ label: "per-number", token: waNumber.metaAccessToken.trim() });
    if (process.env.META_ACCESS_TOKEN?.trim()) tokens.push({ label: "system-user", token: process.env.META_ACCESS_TOKEN.trim() });

    // Try to delete from Meta if we have credentials. If Meta deletion fails
    // (already deleted / rejected cooldown / missing permissions), still remove
    // the local row so the user sees a clean state.
    let metaDeleted = false;
    let metaError: string = "";
    if (wabaId && tokens.length > 0) {
      const graphVersion = process.env.META_GRAPH_VERSION || "v22.0";
      for (const { label, token } of tokens) {
        try {
          console.log(`[templates/delete] ${template.name}: trying ${label} token`);
          await axios.delete(
            `https://graph.facebook.com/${graphVersion}/${wabaId}/message_templates`,
            {
              params: { name: template.name },
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          console.log(`[templates/delete] ✅ ${template.name} deleted from Meta with ${label} token`);
          metaDeleted = true;
          break;
        } catch (err: any) {
          metaError = err.response?.data?.error?.message || err.message;
          console.error(`[templates/delete] ❌ ${label} token:`, metaError);
        }
      }
    }

    await prisma.whatsAppTemplate.delete({ where: { id } });

    res.json({
      ok: true,
      metaDeleted,
      metaError: metaDeleted ? null : metaError || null,
      message: metaDeleted
        ? "Template deleted from WhatsApp and removed locally."
        : "Template removed locally. Meta deletion may have failed — check WhatsApp Manager.",
    });
  });

  // ── Appointment Reminder Rules CRUD ────────────────────────────────
  // GET /api/reminder-rules?workspaceId=
  app.get("/api/reminder-rules", requireAuth, requireWorkspaceAccessFromQuery, async (req, res) => {
    const workspaceId = req.query.workspaceId as string;
    const rules = await prisma.appointmentReminderRule.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
    });
    res.json(rules);
  });

  // POST /api/reminder-rules
  app.post("/api/reminder-rules", requireAuth, requireRole("ADMIN", "OWNER"), requireSubscribedWorkspaceFromBody, async (req: any, res) => {
    const { workspaceId, name, triggerType, offsetMinutes, templateName, messageBody } = req.body;
    if (!workspaceId || !name || !triggerType || offsetMinutes == null) {
      return res.status(400).json({ error: "name, triggerType, and offsetMinutes are required" });
    }
    if (!["BEFORE_START", "AFTER_END"].includes(triggerType)) {
      return res.status(400).json({ error: "triggerType must be BEFORE_START or AFTER_END" });
    }
    if (Number(offsetMinutes) < 5) {
      return res.status(400).json({ error: "offsetMinutes must be at least 5" });
    }
    // Cap at 5 active rules per workspace
    const count = await prisma.appointmentReminderRule.count({ where: { workspaceId, enabled: true } });
    if (count >= 5) {
      return res.status(400).json({ error: "Maximum 5 active reminder rules per workspace" });
    }
    const rule = await prisma.appointmentReminderRule.create({
      data: {
        workspaceId,
        name: name.trim(),
        triggerType,
        offsetMinutes: Number(offsetMinutes),
        templateName: templateName?.trim() || null,
        messageBody: messageBody?.trim() || null,
        enabled: true,
      },
    });
    res.json(rule);
  });

  // PATCH /api/reminder-rules/:id
  app.patch("/api/reminder-rules/:id", requireAuth, requireRole("ADMIN", "OWNER"), async (req: any, res) => {
    const { id } = req.params;
    const { name, triggerType, offsetMinutes, templateName, messageBody, enabled } = req.body;
    const workspaceId = req.body.workspaceId;
    // Verify ownership
    const existing = await prisma.appointmentReminderRule.findFirst({ where: { id, workspaceId } });
    if (!existing) return res.status(404).json({ error: "Rule not found" });

    const rule = await prisma.appointmentReminderRule.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(triggerType !== undefined && { triggerType }),
        ...(offsetMinutes !== undefined && { offsetMinutes: Number(offsetMinutes) }),
        ...(templateName !== undefined && { templateName: templateName?.trim() || null }),
        ...(messageBody !== undefined && { messageBody: messageBody?.trim() || null }),
        ...(enabled !== undefined && { enabled }),
      },
    });
    res.json(rule);
  });

  // DELETE /api/reminder-rules/:id
  app.delete("/api/reminder-rules/:id", requireAuth, requireRole("ADMIN", "OWNER"), async (req: any, res) => {
    const { id } = req.params;
    const workspaceId = req.query.workspaceId as string;
    const existing = await prisma.appointmentReminderRule.findFirst({ where: { id, workspaceId } });
    if (!existing) return res.status(404).json({ error: "Rule not found" });
    await prisma.appointmentReminderRule.delete({ where: { id } });
    res.json({ success: true });
  });

  // ── Compose (outbound template message) ────────────────────────────
  app.post("/api/compose/send", requireAuth, requireSubscribedWorkspaceFromBody, async (req, res) => {
    const workspaceId = String(req.body.workspaceId || '').trim();
    const numberId = String(req.body.numberId || '').trim();
    const recipientPhone = String(req.body.recipientPhone || '').trim();
    const recipientName = String(req.body.recipientName || '').trim();
    const templateName = String(req.body.templateName || '').trim();
    const templateLanguage = String(req.body.templateLanguage || 'en').trim();
    const message = String(req.body.message || '').trim();

    if (!workspaceId || !numberId || !recipientPhone) {
      return res.status(400).json({ error: "Workspace, sender number, and recipient phone are required" });
    }
    if (!templateName && !message) {
      return res.status(400).json({ error: "Template or message is required" });
    }

    const waNumber = await prisma.whatsAppNumber.findFirst({
      where: { id: numberId, workspaceId }
    });
    if (!waNumber) {
      return res.status(404).json({ error: "Sender number not found" });
    }

    const config = getWhatsAppChannelConfig(waNumber);
    if (!config.accessToken || !config.phoneNumberId) {
      return res.status(400).json({ error: "WhatsApp channel is not fully configured" });
    }

    const to = normalizePhone(recipientPhone);
    if (!to) {
      return res.status(400).json({ error: "Invalid phone number" });
    }

    try {
      const graphVersion = process.env.META_GRAPH_VERSION || 'v22.0';
      let metaMessageId: string | undefined;

      if (templateName) {
        // Send as template message (works outside 24-hour window)
        const templatePayload: any = {
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: templateName,
            language: { code: templateLanguage },
          }
        };

        // Look up the template from DB to check how many variables it has
        const dbTemplate = await prisma.whatsAppTemplate.findFirst({
          where: { workspaceId, name: templateName }
        });
        const templateContent = dbTemplate?.content || '';
        // Count variable placeholders like {{1}}, {{2}}, etc.
        const varMatches = templateContent.match(/\{\{\d+\}\}/g);
        const varCount = varMatches ? new Set(varMatches).size : 0;

        if (varCount > 0) {
          // Build parameters array matching the number of variables in the template
          const parameters: { type: string; text: string }[] = [];
          for (let i = 0; i < varCount; i++) {
            // Use recipientName for {{1}}, fallback to empty string for others
            if (i === 0 && recipientName) {
              parameters.push({ type: 'text', text: recipientName });
            } else {
              parameters.push({ type: 'text', text: recipientName || '' });
            }
          }
          templatePayload.template.components = [{
            type: 'body',
            parameters
          }];
        }
        // If template has 0 variables, don't include components at all

        const metaRes = await axios.post(
          `https://graph.facebook.com/${graphVersion}/${config.phoneNumberId}/messages`,
          templatePayload,
          { headers: { Authorization: `Bearer ${config.accessToken}` } }
        );
        metaMessageId = metaRes.data?.messages?.[0]?.id;
      } else {
        // Send as regular text (only works within 24-hour window)
        metaMessageId = await sendMetaMessage(to, message, 'whatsapp', {
          accessToken: config.accessToken,
          phoneNumberId: config.phoneNumberId
        });
      }

      // Find or create contact
      let contact = await prisma.contact.findFirst({
        where: { workspaceId, phoneNumber: to }
      });
      if (!contact) {
        contact = await prisma.contact.create({
          data: {
            workspaceId,
            name: recipientName || to,
            phoneNumber: to,
            lastActivityAt: new Date(),
          }
        });
      }

      // Find or create conversation
      let conversation = await prisma.conversation.findFirst({
        where: { workspaceId, contactId: contact.id, channelType: 'WHATSAPP' }
      });
      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            workspaceId,
            contactId: contact.id,
            numberId: waNumber.id,
            channelType: 'WHATSAPP',
            status: 'ACTIVE',
            lastMessageAt: new Date(),
          }
        });
      }

      // Save message
      const savedMessage = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          content: message || `[Template: ${templateName}]`,
          direction: 'OUTGOING',
          senderType: 'USER',
          senderName: (req as any).user?.name || 'System',
          status: 'SENT',
        }
      });

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() }
      });

      io.to(workspaceId).emit('new-message', savedMessage);
      io.to(workspaceId).emit('conversation-updated', conversation.id);

      res.json({ success: true, messageId: metaMessageId, conversationId: conversation.id });
    } catch (err: any) {
      console.error('[compose] send error:', err.response?.data || err.message);
      const metaError = err.response?.data?.error?.message || 'Failed to send message';
      return res.status(502).json({ error: metaError });
    }
  });

  app.get("/api/templates/session", requireAuth, requireWorkspaceAccessFromQuery, async (req, res) => {
    const { workspaceId } = req.query;
    const templates = await prisma.sessionTemplate.findMany({
      where: { workspaceId: workspaceId as string },
      orderBy: { name: 'asc' }
    });
    res.json(templates);
  });

  app.post("/api/templates/session", requireAuth, requireRole('ADMIN', 'OWNER'), requireSubscribedWorkspaceFromBody, async (req, res) => {
    const workspaceId = String(req.body.workspaceId || '').trim();
    const name = String(req.body.name || '').trim();
    const content = String(req.body.content || '').trim();

    if (!workspaceId) {
      return res.status(400).json({ error: "Workspace is required" });
    }

    if (name.length < 2 || name.length > 80) {
      return res.status(400).json({ error: "Template name must be between 2 and 80 characters" });
    }

    if (!content) {
      return res.status(400).json({ error: "Template content is required" });
    }

    if (content.length > 2000) {
      return res.status(400).json({ error: "Template content must be 2000 characters or fewer" });
    }

    const template = await prisma.sessionTemplate.create({
      data: {
        workspaceId,
        name,
        content
      }
    });

    res.json(template);
  });

  app.patch("/api/templates/session/:id", requireAuth, requireRole('ADMIN', 'OWNER'), async (req, res, next) => {
    const existingTemplate = await prisma.sessionTemplate.findUnique({
      where: { id: String(req.params.id || '').trim() }
    });

    if (!existingTemplate) {
      return res.status(404).json({ error: "Template not found" });
    }

    return requireSubscribedWorkspaceById(req, res, next, existingTemplate.workspaceId);
  }, async (req, res) => {
    const templateId = String(req.params.id || '').trim();

    if (!templateId) {
      return res.status(400).json({ error: "Template is required" });
    }

    const name = String(req.body.name || '').trim();
    const content = String(req.body.content || '').trim();

    if (name.length < 2 || name.length > 80) {
      return res.status(400).json({ error: "Template name must be between 2 and 80 characters" });
    }

    if (!content) {
      return res.status(400).json({ error: "Template content is required" });
    }

    if (content.length > 2000) {
      return res.status(400).json({ error: "Template content must be 2000 characters or fewer" });
    }

    const template = await prisma.sessionTemplate.update({
      where: { id: templateId },
      data: {
        name,
        content
      }
    });

    res.json(template);
  });

  app.delete("/api/templates/session/:id", requireAuth, requireRole('ADMIN', 'OWNER'), async (req, res, next) => {
    const existingTemplate = await prisma.sessionTemplate.findUnique({
      where: { id: String(req.params.id || '').trim() }
    });

    if (!existingTemplate) {
      return res.status(404).json({ error: "Template not found" });
    }

    return requireSubscribedWorkspaceById(req, res, next, existingTemplate.workspaceId);
  }, async (req, res) => {
    const templateId = String(req.params.id || '').trim();

    if (!templateId) {
      return res.status(400).json({ error: "Template is required" });
    }

    await prisma.sessionTemplate.delete({
      where: { id: templateId }
    });

    res.json({ success: true });
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

  app.delete("/api/numbers/:id", requireAuth, requireRole('ADMIN', 'OWNER'), async (req: any, res) => {
    try {
      const { id } = req.params;
      const number = await prisma.whatsAppNumber.findUnique({ where: { id } });
      if (!number) return res.status(404).json({ error: "Number not found" });

      const membership = await prisma.workspaceMembership.findFirst({
        where: { workspaceId: number.workspaceId, userId: req.user!.userId }
      });
      if (!membership && req.user!.role !== 'SUPERADMIN') {
        return res.status(403).json({ error: "Access denied" });
      }

      // Delete all related records in correct order
      const convIds = (await prisma.conversation.findMany({ where: { numberId: id }, select: { id: true } })).map(c => c.id);
      if (convIds.length > 0) {
        await prisma.message.deleteMany({ where: { conversationId: { in: convIds } } });
        await prisma.conversationNote.deleteMany({ where: { conversationId: { in: convIds } } });
        await prisma.task.deleteMany({ where: { conversationId: { in: convIds } } });
        await prisma.activityLog.deleteMany({ where: { conversationId: { in: convIds } } });
        await prisma.conversation.deleteMany({ where: { numberId: id } });
      }
      const campIds = (await prisma.broadcastCampaign.findMany({ where: { numberId: id }, select: { id: true } })).map(c => c.id);
      if (campIds.length > 0) {
        await prisma.broadcastRecipient.deleteMany({ where: { campaignId: { in: campIds } } });
        await prisma.broadcastCampaign.deleteMany({ where: { numberId: id } });
      }
      await prisma.whatsAppNumber.delete({ where: { id } });
      res.json({ success: true });
    } catch (err: any) {
      console.error("[DELETE /api/numbers/:id]", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Instagram Accounts
  app.get("/api/instagram/accounts", requireAuth, requireWorkspaceAccessFromQuery, async (req, res) => {
    if (!INSTAGRAM_INTEGRATION_ENABLED) {
      return res.json([]);
    }
    const { workspaceId } = req.query;
    const accounts = await prisma.instagramAccount.findMany({
      where: { workspaceId: workspaceId as string },
      include: { chatbot: true }
    });
    res.json(accounts);
  });

  app.post("/api/instagram/accounts", requireAuth, requireRole('ADMIN', 'OWNER'), requireSubscribedWorkspaceFromBody, async (req, res) => {
    if (!INSTAGRAM_INTEGRATION_ENABLED) {
      return res.status(403).json({ error: "Instagram is not enabled in this release" });
    }
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

  app.post("/api/chatbots", requireAuth, requireRole('ADMIN', 'OWNER'), requireSubscribedWorkspaceFromBody, async (req, res) => {
    const { workspaceId, name, instructions } = req.body;
    if (!(await enforceWorkspacePlanLimit(res, workspaceId, 'chatbots'))) {
      return;
    }
      const chatbot = await prisma.chatbot.create({
      data: {
        workspaceId,
        name,
        instructions,
        enabled: true
      },
      include: { numbers: true, instagramAccounts: true, tools: true }
    });
    res.json(chatbot);
  });

  app.patch("/api/chatbots/:id", requireAuth, requireRole('ADMIN', 'OWNER'), async (req, res, next) => {
    const chatbot = await prisma.chatbot.findUnique({ where: { id: req.params.id } });
    return requireSubscribedWorkspaceById(req, res, next, chatbot?.workspaceId);
  }, async (req, res) => {
    const { name, instructions, enabled, language, assignedNumberIds } = req.body;
    const existingChatbot = await prisma.chatbot.findUnique({
      where: { id: req.params.id },
      include: { numbers: true }
    });

    if (!existingChatbot) {
      return res.status(404).json({ error: "Chatbot not found" });
    }

    const normalizedAssignedNumberIds = assignedNumberIds === undefined
      ? existingChatbot.numbers.map((number) => number.id)
      : Array.from(
          new Set(
            (Array.isArray(assignedNumberIds) ? assignedNumberIds : [])
              .filter((value): value is string => typeof value === "string")
              .map((value) => value.trim())
              .filter(Boolean)
          )
        );

    if (normalizedAssignedNumberIds.length > 0) {
      const numbersInWorkspace = await prisma.whatsAppNumber.findMany({
        where: {
          id: { in: normalizedAssignedNumberIds },
          workspaceId: existingChatbot.workspaceId,
        },
        select: { id: true },
      });

      if (numbersInWorkspace.length !== normalizedAssignedNumberIds.length) {
        return res.status(400).json({ error: "One or more selected WhatsApp channels are invalid." });
      }
    }

    const chatbot = await prisma.$transaction(async (tx) => {
      await tx.chatbot.update({
        where: { id: req.params.id },
        data: {
          name,
          instructions,
          enabled,
          language
        }
      });

      await tx.whatsAppNumber.updateMany({
        where: {
          workspaceId: existingChatbot.workspaceId,
          chatbotId: req.params.id,
          id: { notIn: normalizedAssignedNumberIds }
        },
        data: {
          chatbotId: null,
          autoReply: false
        }
      });

      if (normalizedAssignedNumberIds.length > 0) {
        await tx.whatsAppNumber.updateMany({
          where: {
            workspaceId: existingChatbot.workspaceId,
            id: { in: normalizedAssignedNumberIds }
          },
          data: {
            chatbotId: req.params.id,
            autoReply: true
          }
        });
      }

      return tx.chatbot.findUnique({
        where: { id: req.params.id },
        include: { numbers: true, instagramAccounts: true, tools: true }
      });
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

  app.post("/api/team", requireAuth, requireRole('ADMIN', 'OWNER'), requireSubscribedWorkspaceFromBody, async (req: any, res) => {
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

  app.patch("/api/team/:id", requireAuth, requireRole('ADMIN', 'OWNER'), requireSubscribedWorkspaceFromBody, async (req: any, res) => {
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

  app.delete("/api/team/:id", requireAuth, requireRole('ADMIN', 'OWNER'), requireSubscribedWorkspaceFromBody, async (req: any, res) => {
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

  // Pipeline stages
  app.get("/api/pipeline-stages", requireAuth, requireWorkspaceAccessFromQuery, async (req, res) => {
    const workspaceId = String(req.query.workspaceId || '').trim();
    if (!workspaceId) {
      return res.status(400).json({ error: "Workspace is required" });
    }

    const stages = await getWorkspacePipelineStages(workspaceId);
    res.json(stages);
  });

  app.post("/api/pipeline-stages", requireAuth, requireSubscribedWorkspaceManagerFromBody, async (req, res) => {
    const workspaceId = String(req.body.workspaceId || '').trim();
    const name = String(req.body.name || '').trim();
    const color = sanitizePipelineStageColor(req.body.color, '#25D366');

    if (!workspaceId) {
      return res.status(400).json({ error: "Workspace is required" });
    }

    if (name.length < 2 || name.length > 40) {
      return res.status(400).json({ error: "Stage name must be between 2 and 40 characters" });
    }

    const existingStages = await getWorkspacePipelineStages(workspaceId);
    const key = buildUniqueWorkspacePipelineStageKey(existingStages, name);
    const position = existingStages.length;

    const stage = await prisma.workspacePipelineStage.create({
      data: {
        workspaceId,
        key,
        name,
        color,
        position,
        isSystem: false,
        isTerminal: false,
        terminalType: 'OPEN',
      },
    });

    res.json(stage);
  });

  app.patch("/api/pipeline-stages/:id", requireAuth, requireSubscribedWorkspaceManagerFromBody, async (req, res) => {
    const workspaceId = String(req.body.workspaceId || '').trim();
    const stageId = String(req.params.id || '').trim();
    const name = req.body.name === undefined ? undefined : String(req.body.name || '').trim();
    const color = req.body.color === undefined ? undefined : sanitizePipelineStageColor(req.body.color);

    if (!workspaceId || !stageId) {
      return res.status(400).json({ error: "Workspace and stage are required" });
    }

    const existingStage = await prisma.workspacePipelineStage.findFirst({
      where: {
        id: stageId,
        workspaceId,
      },
    });

    if (!existingStage) {
      return res.status(404).json({ error: "Pipeline stage not found" });
    }

    if (name !== undefined && (name.length < 2 || name.length > 40)) {
      return res.status(400).json({ error: "Stage name must be between 2 and 40 characters" });
    }

    const updatedStage = await prisma.workspacePipelineStage.update({
      where: { id: stageId },
      data: {
        name: name === undefined ? undefined : name,
        color: color === undefined ? undefined : color,
      },
    });

    res.json(updatedStage);
  });

  app.post("/api/pipeline-stages/reorder", requireAuth, requireSubscribedWorkspaceManagerFromBody, async (req, res) => {
    const workspaceId = String(req.body.workspaceId || '').trim();
    const orderedStageIds = Array.isArray(req.body.orderedStageIds)
      ? req.body.orderedStageIds.map((id: unknown) => String(id || '').trim()).filter(Boolean)
      : [];

    if (!workspaceId) {
      return res.status(400).json({ error: "Workspace is required" });
    }

    const stages = await getWorkspacePipelineStages(workspaceId);
    const currentIds = stages.map((stage) => stage.id);

    if (
      orderedStageIds.length !== currentIds.length ||
      currentIds.some((id) => !orderedStageIds.includes(id))
    ) {
      return res.status(400).json({ error: "Provide the full ordered stage list" });
    }

    await prisma.$transaction(
      orderedStageIds.map((stageId, index) =>
        prisma.workspacePipelineStage.update({
          where: { id: stageId },
          data: { position: index },
        })
      )
    );

    res.json(await getWorkspacePipelineStages(workspaceId));
  });

  app.delete("/api/pipeline-stages/:id", requireAuth, requireSubscribedWorkspaceManagerFromBody, async (req, res) => {
    const workspaceId = String(req.body.workspaceId || req.query.workspaceId || '').trim();
    const stageId = String(req.params.id || '').trim();

    if (!workspaceId || !stageId) {
      return res.status(400).json({ error: "Workspace and stage are required" });
    }

    const existingStage = await prisma.workspacePipelineStage.findFirst({
      where: {
        id: stageId,
        workspaceId,
      },
    });

    if (!existingStage) {
      return res.status(404).json({ error: "Pipeline stage not found" });
    }

    const allStages = await getWorkspacePipelineStages(workspaceId);
    const remainingStages = sortPipelineStages(allStages.filter((stage) => stage.id !== stageId));

    if (remainingStages.length === 0) {
      return res.status(400).json({ error: "Keep at least one stage in the pipeline" });
    }

    const remainingOpenStages = remainingStages.filter(
      (stage) => !stage.isTerminal && stage.terminalType === 'OPEN'
    );

    if (remainingOpenStages.length === 0) {
      return res.status(400).json({ error: "Keep at least one open stage for new leads" });
    }

    const existingIndex = allStages.findIndex((stage) => stage.id === stageId);
    const replacementStage =
      remainingStages[existingIndex] ||
      remainingStages[existingIndex - 1] ||
      remainingOpenStages[0] ||
      remainingStages[0];

    const contactsUsingStage = await prisma.contact.count({
      where: {
        workspaceId,
        pipelineStage: existingStage.key,
      },
    });

    await prisma.$transaction([
      prisma.contact.updateMany({
        where: {
          workspaceId,
          pipelineStage: existingStage.key,
        },
        data: {
          pipelineStage: replacementStage.key,
          lastActivityAt: new Date(),
        },
      }),
      prisma.workspacePipelineStage.delete({
        where: { id: stageId },
      }),
      ...remainingStages.map((stage, index) =>
        prisma.workspacePipelineStage.update({
          where: { id: stage.id },
          data: { position: index },
        })
      ),
    ]);

    res.json({
      success: true,
      replacementStageKey: replacementStage.key,
      replacementStageName: replacementStage.name,
      reassignedCount: contactsUsingStage,
    });
  });

  // Custom Attributes
  app.get("/api/custom-attributes", requireAuth, requireWorkspaceAccessFromQuery, async (req, res) => {
    try {
      const attrs = await prisma.customAttributeDefinition.findMany({
        where: { workspaceId: req.query.workspaceId as string },
        orderBy: { name: 'asc' }
      });
      res.json(attrs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch custom attributes" });
    }
  });

  app.post("/api/custom-attributes", requireAuth, requireRole('ADMIN', 'OWNER'), async (req, res) => {
    const { workspaceId, name, key, type } = req.body;
    if (!workspaceId || !name || !key) return res.status(400).json({ error: "Name and key are required" });
    try {
      const existing = await prisma.customAttributeDefinition.findFirst({ where: { workspaceId, key } });
      if (existing) return res.status(400).json({ error: "An attribute with this key already exists" });
      const attr = await prisma.customAttributeDefinition.create({
        data: { name, key, type: type || 'STRING', workspaceId }
      });
      res.json(attr);
    } catch (error) {
      res.status(500).json({ error: "Failed to create custom attribute" });
    }
  });

  app.patch("/api/custom-attributes/:id", requireAuth, requireRole('ADMIN', 'OWNER'), async (req, res) => {
    const { name, workspaceId } = req.body;
    if (!workspaceId) return res.status(400).json({ error: "Workspace ID required" });
    try {
      const attr = await prisma.customAttributeDefinition.findUnique({ where: { id: req.params.id } });
      if (!attr || attr.workspaceId !== workspaceId) return res.status(404).json({ error: "Not found" });
      const updated = await prisma.customAttributeDefinition.update({
        where: { id: req.params.id },
        data: { name }
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update custom attribute" });
    }
  });

  app.delete("/api/custom-attributes/:id", requireAuth, requireRole('ADMIN', 'OWNER'), async (req, res) => {
    const workspaceId = req.headers['x-workspace-id'] as string;
    if (!workspaceId) return res.status(400).json({ error: "Workspace ID required" });
    try {
      const attr = await prisma.customAttributeDefinition.findUnique({ where: { id: req.params.id } });
      if (!attr || attr.workspaceId !== workspaceId) return res.status(404).json({ error: "Not found" });
      // Delete values first, then definition
      await prisma.contactCustomAttributeValue.deleteMany({ where: { definitionId: req.params.id } });
      await prisma.customAttributeDefinition.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete custom attribute" });
    }
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

  app.post("/api/contacts", requireAuth, businessRateLimiter('contacts'), requireSubscribedWorkspaceFromBody, async (req, res) => {
    const { workspaceId, name, phoneNumber, instagramUsername, pipelineStage, city, leadSource, tags, notes, assignedToId, listIds, listNames, estimatedValue, lostReason } = req.body;

    if (!workspaceId) {
      return res.status(400).json({ error: "Workspace is required" });
    }

    if (!name?.trim() && !phoneNumber?.trim() && !instagramUsername?.trim()) {
      return res.status(400).json({ error: "Add at least a name, phone number, or Instagram username" });
    }

    const resolvedListIds = await resolveContactListIds(workspaceId, listIds, listNames);
    const resolvedPipelineStage = await resolveWorkspacePipelineStageValue(workspaceId, pipelineStage);

    if (!(await enforceWorkspacePlanLimit(res, workspaceId, 'contacts'))) {
      return;
    }

    const contact = await prisma.contact.create({
      data: {
        workspaceId,
        name: name?.trim() || phoneNumber?.trim() || instagramUsername?.trim() || 'New Contact',
        phoneNumber: phoneNumber?.trim() || null,
        instagramUsername: instagramUsername?.trim() || null,
        pipelineStage: resolvedPipelineStage,
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

    const workspacePipelineStages = await getWorkspacePipelineStages(workspaceId);

    const importDefaults = {
      pipelineStage: resolvePipelineStageFromStages(workspacePipelineStages, defaults?.pipelineStage),
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
      const nextPipelineStage = resolvePipelineStageFromStages(
        workspacePipelineStages,
        pipelineStageValue || importDefaults.pipelineStage || existing?.pipelineStage,
        existing?.pipelineStage || importDefaults.pipelineStage
      );

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

    if (!oldContact) {
      return res.status(404).json({ error: "Contact not found" });
    }

    const shouldSyncLists = Array.isArray(listIds) || Array.isArray(listNames);

    if (shouldSyncLists) {
      await prisma.contactListMember.deleteMany({
        where: { contactId: req.params.id }
      });
    }

    const resolvedListIds = shouldSyncLists
      ? await resolveContactListIds(oldContact?.workspaceId || '', listIds, listNames)
      : [];
    const workspacePipelineStages = await getWorkspacePipelineStages(oldContact.workspaceId);
    const resolvedPipelineStage =
      pipelineStage === undefined
        ? undefined
        : resolvePipelineStageFromStages(workspacePipelineStages, pipelineStage, oldContact.pipelineStage);
    const oldStage = workspacePipelineStages.find(
      (stage) => stage.key === normalizePipelineStageKey(oldContact.pipelineStage)
    );
    const newStage = workspacePipelineStages.find(
      (stage) => stage.key === normalizePipelineStageKey(resolvedPipelineStage)
    );

    const contact = await prisma.contact.update({
      where: { id: req.params.id },
      data: {
        pipelineStage: resolvedPipelineStage,
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

    if (resolvedPipelineStage && resolvedPipelineStage !== oldContact?.pipelineStage) {
      await prisma.activityLog.create({
        data: {
          type: 'STAGE_CHANGE',
          content: `Lead stage changed from ${oldStage?.name || oldContact.pipelineStage} to ${newStage?.name || resolvedPipelineStage}`,
          contactId: contact.id,
          workspaceId: contact.workspaceId,
          metadata: JSON.stringify({
            previousStageKey: oldContact.pipelineStage,
            nextStageKey: resolvedPipelineStage,
          }),
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

  app.post("/api/automation/rules", requireAuth, requireRole('ADMIN', 'OWNER'), requireSubscribedWorkspaceFromBody, async (req, res) => {
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

  // ── Assignment Rules CRUD ────────────────────────────────────────

  app.get("/api/assignment-rules", requireAuth, requireWorkspaceAccessFromQuery, async (req, res) => {
    const rules = await prisma.assignmentRule.findMany({
      where: { workspaceId: req.query.workspaceId as string },
      orderBy: { priority: 'desc' }
    });
    res.json(rules);
  });

  app.post("/api/assignment-rules", requireAuth, requireRole('ADMIN', 'OWNER'), requireSubscribedWorkspaceFromBody, async (req, res) => {
    const { name, strategy, conditions, agentIds, priority, workspaceId } = req.body;
    const rule = await prisma.assignmentRule.create({
      data: {
        name,
        strategy,
        conditions: JSON.stringify(conditions || {}),
        agentIds: JSON.stringify(agentIds || []),
        priority: priority || 0,
        workspaceId
      }
    });
    res.json(rule);
  });

  app.patch("/api/assignment-rules/:id", requireAuth, requireRole('ADMIN', 'OWNER'), async (req: any, res) => {
    const rule = await prisma.assignmentRule.findUnique({ where: { id: req.params.id } });
    if (!rule) return res.status(404).json({ error: "Rule not found" });

    const data: any = {};
    if (req.body.name !== undefined) data.name = req.body.name;
    if (req.body.strategy !== undefined) data.strategy = req.body.strategy;
    if (req.body.conditions !== undefined) data.conditions = JSON.stringify(req.body.conditions);
    if (req.body.agentIds !== undefined) data.agentIds = JSON.stringify(req.body.agentIds);
    if (req.body.priority !== undefined) data.priority = req.body.priority;
    if (req.body.enabled !== undefined) data.enabled = req.body.enabled;

    const updated = await prisma.assignmentRule.update({ where: { id: req.params.id }, data });
    res.json(updated);
  });

  app.delete("/api/assignment-rules/:id", requireAuth, requireRole('ADMIN', 'OWNER'), async (req: any, res) => {
    await prisma.assignmentRule.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  });

  // ── Follow-up Sequences CRUD ───────────────────────────────────

  app.get("/api/follow-up-sequences", requireAuth, requireWorkspaceAccessFromQuery, async (req, res) => {
    const sequences = await prisma.followUpSequence.findMany({
      where: { workspaceId: req.query.workspaceId as string },
      include: {
        steps: { orderBy: { position: 'asc' } },
        _count: { select: { enrollments: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(sequences);
  });

  app.post("/api/follow-up-sequences", requireAuth, requireRole('ADMIN', 'OWNER'), requireSubscribedWorkspaceFromBody, async (req, res) => {
    const { name, triggerType, steps, workspaceId } = req.body;
    const sequence = await prisma.followUpSequence.create({
      data: {
        name,
        triggerType: triggerType || 'NEW_LEAD',
        workspaceId,
        steps: {
          create: (steps || []).map((s: any, i: number) => ({
            position: i,
            delayHours: s.delayHours || 24,
            templateName: s.templateName,
            templateLanguage: s.templateLanguage || 'en'
          }))
        }
      },
      include: { steps: { orderBy: { position: 'asc' } } }
    });
    res.json(sequence);
  });

  app.patch("/api/follow-up-sequences/:id", requireAuth, requireRole('ADMIN', 'OWNER'), async (req: any, res) => {
    const seq = await prisma.followUpSequence.findUnique({ where: { id: req.params.id } });
    if (!seq) return res.status(404).json({ error: "Sequence not found" });

    const data: any = {};
    if (req.body.name !== undefined) data.name = req.body.name;
    if (req.body.triggerType !== undefined) data.triggerType = req.body.triggerType;
    if (req.body.enabled !== undefined) data.enabled = req.body.enabled;

    const updated = await prisma.followUpSequence.update({
      where: { id: req.params.id },
      data,
      include: { steps: { orderBy: { position: 'asc' } } }
    });

    // If steps are provided, replace them
    if (req.body.steps) {
      await prisma.followUpStep.deleteMany({ where: { sequenceId: req.params.id } });
      for (let i = 0; i < req.body.steps.length; i++) {
        const s = req.body.steps[i];
        await prisma.followUpStep.create({
          data: {
            sequenceId: req.params.id,
            position: i,
            delayHours: s.delayHours || 24,
            templateName: s.templateName,
            templateLanguage: s.templateLanguage || 'en'
          }
        });
      }
    }

    const final = await prisma.followUpSequence.findUnique({
      where: { id: req.params.id },
      include: { steps: { orderBy: { position: 'asc' } } }
    });
    res.json(final);
  });

  app.delete("/api/follow-up-sequences/:id", requireAuth, requireRole('ADMIN', 'OWNER'), async (req: any, res) => {
    await prisma.followUpSequence.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  });

  // Manual enrollment
  app.post("/api/follow-up-sequences/:id/enroll", requireAuth, async (req: any, res) => {
    const { contactId, conversationId, workspaceId } = req.body;
    const seq = await prisma.followUpSequence.findUnique({
      where: { id: req.params.id },
      include: { steps: { orderBy: { position: 'asc' } } }
    });
    if (!seq || seq.steps.length === 0) {
      return res.status(404).json({ error: "Sequence not found or has no steps" });
    }

    const existing = await prisma.followUpEnrollment.findUnique({
      where: { sequenceId_contactId: { sequenceId: req.params.id, contactId } }
    });
    if (existing) {
      return res.status(409).json({ error: "Contact already enrolled in this sequence" });
    }

    const enrollment = await prisma.followUpEnrollment.create({
      data: {
        sequenceId: req.params.id,
        contactId,
        conversationId,
        workspaceId,
        nextStepDueAt: new Date(Date.now() + seq.steps[0].delayHours * 60 * 60 * 1000)
      }
    });
    res.json(enrollment);
  });

  app.get("/api/follow-up-enrollments", requireAuth, requireWorkspaceAccessFromQuery, async (req, res) => {
    const enrollments = await prisma.followUpEnrollment.findMany({
      where: { workspaceId: req.query.workspaceId as string },
      include: { sequence: true },
      orderBy: { enrolledAt: 'desc' },
      take: 100
    });
    res.json(enrollments);
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

  app.post("/api/campaigns/test", requireAuth, requireRole('ADMIN', 'OWNER'), upload.single('headerImage'), requireSubscribedWorkspaceFromBody, async (req, res) => {
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

  app.post("/api/campaigns", requireAuth, requireRole('ADMIN', 'OWNER'), businessRateLimiter('campaigns'), upload.single('headerImage'), requireSubscribedWorkspaceFromBody, async (req, res) => {
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

    // Load template details if templateId is provided
    let template: any = null;
    if (templateId?.trim()) {
      template = await prisma.whatsAppTemplate.findFirst({
        where: { id: templateId.trim(), workspaceId }
      });
    }

    const graphVersion = process.env.META_GRAPH_VERSION || 'v22.0';
    let sentCount = 0;

    for (const recipient of campaign.recipients) {
      try {
        let messageId: string | undefined;

        if (template) {
          // Send as template message (works outside 24-hour window)
          const templatePayload: any = {
            messaging_product: 'whatsapp',
            to: normalizePhone(recipient.phoneNumber),
            type: 'template',
            template: {
              name: template.name,
              language: { code: template.language || 'en' },
            }
          };

          // Add header image as component if provided
          if (headerImage) {
            const mediaId = await uploadWhatsAppMedia(headerImage, { accessToken, phoneNumberId });
            templatePayload.template.components = templatePayload.template.components || [];
            templatePayload.template.components.unshift({
              type: 'header',
              parameters: [{ type: 'image', image: { id: mediaId } }]
            });
          }

          const metaRes = await axios.post(
            `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`,
            templatePayload,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          messageId = metaRes.data?.messages?.[0]?.id;
        } else if (headerImage) {
          const sentMedia = await sendWhatsAppMediaMessage(
            recipient.phoneNumber,
            headerImage,
            { accessToken, phoneNumberId },
            messageBody?.trim() || undefined
          );
          messageId = sentMedia.messageId;
        } else {
          messageId = await sendMetaMessage(normalizePhone(recipient.phoneNumber), messageBody.trim(), 'whatsapp', {
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

        // Also save the broadcast message in the inbox conversation
        try {
          const recipientPhone = normalizePhone(recipient.phoneNumber);
          const contact = await prisma.contact.findFirst({
            where: { workspaceId, phoneNumber: recipientPhone }
          }) || await prisma.contact.findFirst({
            where: { workspaceId, phoneNumber: recipient.phoneNumber }
          });

          if (contact) {
            let conversation = await prisma.conversation.findFirst({
              where: { workspaceId, contactId: contact.id, channelType: 'WHATSAPP' }
            });

            if (!conversation) {
              conversation = await prisma.conversation.create({
                data: {
                  workspaceId,
                  contactId: contact.id,
                  numberId: number.id,
                  channelType: 'WHATSAPP',
                  status: 'ACTIVE',
                  lastMessageAt: new Date()
                }
              });
            }

            const broadcastContent = template
              ? `[Template: ${template.name}] ${template.content || messageBody?.trim() || ''}`
              : messageBody?.trim() || `[Broadcast: ${name.trim()}]`;
            const inboxMsg = await prisma.message.create({
              data: {
                conversationId: conversation.id,
                content: broadcastContent,
                direction: 'OUTGOING',
                senderType: 'SYSTEM',
                senderName: `Broadcast: ${name.trim()}`,
                metaMessageId: messageId || null,
                status: 'SENT'
              }
            });

            await prisma.conversation.update({
              where: { id: conversation.id },
              data: { lastMessageAt: new Date() }
            });

            io.to(workspaceId).emit("new-message", inboxMsg);
            io.to(workspaceId).emit("conversation-updated", conversation.id);
          }
        } catch (inboxError) {
          console.error(`Failed to save broadcast to inbox for ${recipient.phoneNumber}:`, inboxError);
        }
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
        where: { email: SUPERADMIN_EMAIL },
        update: {},
        create: {
          email: SUPERADMIN_EMAIL,
          name: 'Admin',
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
            suspended: true,
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
      const suspendedCount = allWorkspaces.filter((w: any) => w.suspended).length;

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

  // ── Superadmin: Suspend / Unsuspend Workspace ───────────────────

  app.post("/api/superadmin/workspaces/:id/suspend", requireAuth, requireSuperadmin, async (req, res) => {
    try {
      const { reason } = req.body || {};
      const workspace = await prisma.workspace.update({
        where: { id: req.params.id },
        data: { suspended: true, suspendedReason: reason || null },
      });
      res.json({ success: true, suspended: true, id: workspace.id });
    } catch (error) {
      console.error('[superadmin:suspend]', error);
      res.status(500).json({ error: 'Failed to suspend workspace' });
    }
  });

  app.post("/api/superadmin/workspaces/:id/unsuspend", requireAuth, requireSuperadmin, async (req, res) => {
    try {
      const workspace = await prisma.workspace.update({
        where: { id: req.params.id },
        data: { suspended: false, suspendedReason: null },
      });
      res.json({ success: true, suspended: false, id: workspace.id });
    } catch (error) {
      console.error('[superadmin:unsuspend]', error);
      res.status(500).json({ error: 'Failed to unsuspend workspace' });
    }
  });

  // ── Superadmin: Plan Override ───────────────────────────────────

  app.post("/api/superadmin/workspaces/:id/plan-override", requireAuth, requireSuperadmin, async (req, res) => {
    try {
      const { plan, durationDays } = req.body || {};
      if (!plan || !['STARTER', 'GROWTH', 'PRO'].includes(String(plan).toUpperCase())) {
        return res.status(400).json({ error: 'Invalid plan. Must be STARTER, GROWTH, or PRO.' });
      }
      const days = Math.max(1, Math.min(365, Number(durationDays) || 30));
      const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

      const workspace = await prisma.workspace.update({
        where: { id: req.params.id },
        data: {
          planOverride: String(plan).toUpperCase(),
          planOverrideUntil: until,
        },
      });
      res.json({ success: true, id: workspace.id, planOverride: workspace.planOverride, planOverrideUntil: workspace.planOverrideUntil });
    } catch (error) {
      console.error('[superadmin:plan-override]', error);
      res.status(500).json({ error: 'Failed to set plan override' });
    }
  });

  app.post("/api/superadmin/workspaces/:id/remove-plan-override", requireAuth, requireSuperadmin, async (req, res) => {
    try {
      const workspace = await prisma.workspace.update({
        where: { id: req.params.id },
        data: { planOverride: null, planOverrideUntil: null },
      });
      res.json({ success: true, id: workspace.id });
    } catch (error) {
      console.error('[superadmin:remove-plan-override]', error);
      res.status(500).json({ error: 'Failed to remove plan override' });
    }
  });

  // ── Superadmin: Impersonate Workspace ───────────────────────────

  app.post("/api/superadmin/impersonate/:workspaceId", requireAuth, requireSuperadmin, async (req: any, res) => {
    try {
      const workspaceId = req.params.workspaceId;
      const superadminUser = req.superadminUser;

      const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
      if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

      // Create temporary OWNER membership if not exists
      await prisma.workspaceMembership.upsert({
        where: {
          userId_workspaceId: {
            userId: superadminUser.id,
            workspaceId,
          },
        },
        create: {
          userId: superadminUser.id,
          workspaceId,
          role: 'OWNER',
          status: 'ACTIVE',
        },
        update: {
          role: 'OWNER',
          status: 'ACTIVE',
        },
      });

      res.json({ success: true, workspaceId, workspaceName: workspace.name });
    } catch (error) {
      console.error('[superadmin:impersonate]', error);
      res.status(500).json({ error: 'Failed to impersonate workspace' });
    }
  });

  app.post("/api/superadmin/stop-impersonate/:workspaceId", requireAuth, requireSuperadmin, async (req: any, res) => {
    try {
      const workspaceId = req.params.workspaceId;
      const superadminUser = req.superadminUser;

      // Remove the temporary membership
      await prisma.workspaceMembership.deleteMany({
        where: {
          userId: superadminUser.id,
          workspaceId,
        },
      });

      res.json({ success: true });
    } catch (error) {
      console.error('[superadmin:stop-impersonate]', error);
      res.status(500).json({ error: 'Failed to stop impersonation' });
    }
  });

  // ── Superadmin: Platform Analytics ──────────────────────────────

  app.get("/api/superadmin/analytics", requireAuth, requireSuperadmin, async (_req, res) => {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const [
        totalWorkspaces,
        totalUsers,
        totalMessages,
        totalConversations,
        messagesLast30d,
        messagesLast7d,
        messagesToday,
        allWorkspaces,
      ] = await Promise.all([
        prisma.workspace.count(),
        prisma.user.count(),
        prisma.message.count(),
        prisma.conversation.count(),
        prisma.message.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
        prisma.message.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
        prisma.message.count({ where: { createdAt: { gte: todayStart } } }),
        prisma.workspace.findMany({
          select: { id: true, plan: true, subscriptionStatus: true },
        }),
      ]);

      // Active workspaces (had messages in last 30d)
      const workspacesWithRecentMessages = await prisma.conversation.findMany({
        where: {
          messages: { some: { createdAt: { gte: thirtyDaysAgo } } },
        },
        select: { workspaceId: true },
        distinct: ['workspaceId'],
      });
      const activeWorkspaces30d = workspacesWithRecentMessages.length;

      // Plan distribution
      const planDistribution: Record<string, number> = {};
      for (const ws of allWorkspaces) {
        const plan = String(ws.plan || 'NONE').toUpperCase();
        planDistribution[plan] = (planDistribution[plan] || 0) + 1;
      }

      // MRR calculation (STARTER=99, GROWTH=279, PRO=549 AED)
      const planPrices: Record<string, number> = { STARTER: 99, GROWTH: 279, PRO: 549 };
      let mrr = 0;
      for (const ws of allWorkspaces) {
        if (['active', 'trialing'].includes(String(ws.subscriptionStatus || '').toLowerCase())) {
          mrr += planPrices[String(ws.plan || '').toUpperCase()] || 0;
        }
      }

      // Top 5 workspaces by message count in last 30d
      const topWorkspacesRaw = await prisma.conversation.groupBy({
        by: ['workspaceId'],
        _count: { id: true },
        where: {
          messages: { some: { createdAt: { gte: thirtyDaysAgo } } },
        },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      });

      const topWorkspaceIds = topWorkspacesRaw.map(w => w.workspaceId);
      const topWorkspaceDetails = topWorkspaceIds.length > 0
        ? await prisma.workspace.findMany({
            where: { id: { in: topWorkspaceIds } },
            select: { id: true, name: true, plan: true },
          })
        : [];

      // Get actual message counts for top workspaces
      const topWorkspacesByMessages = await Promise.all(
        topWorkspacesRaw.map(async (tw) => {
          const ws = topWorkspaceDetails.find(d => d.id === tw.workspaceId);
          const msgCount = await prisma.message.count({
            where: {
              conversation: { workspaceId: tw.workspaceId },
              createdAt: { gte: thirtyDaysAgo },
            },
          });
          return {
            id: tw.workspaceId,
            name: ws?.name || 'Unknown',
            plan: ws?.plan || 'NONE',
            messageCount: msgCount,
          };
        })
      );
      topWorkspacesByMessages.sort((a, b) => b.messageCount - a.messageCount);

      res.json({
        totalWorkspaces,
        totalUsers,
        totalMessages,
        totalConversations,
        activeWorkspaces30d,
        messagesLast30d,
        messagesLast7d,
        messagesToday,
        mrr,
        planDistribution,
        topWorkspacesByMessages,
      });
    } catch (error) {
      console.error('[superadmin:analytics]', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ── Superadmin: Refund via Stripe ───────────────────────────────

  app.post("/api/superadmin/workspaces/:id/refund", requireAuth, requireSuperadmin, async (req, res) => {
    try {
      if (!stripe) {
        return res.status(500).json({ error: 'Stripe is not configured' });
      }

      const workspace = await prisma.workspace.findUnique({
        where: { id: req.params.id },
        select: { id: true, name: true, stripeCustomerId: true },
      });

      if (!workspace) return res.status(404).json({ error: 'Workspace not found' });
      if (!workspace.stripeCustomerId) return res.status(400).json({ error: 'Workspace has no Stripe customer' });

      const { amount, reason } = req.body || {};

      // Get latest charge
      const charges = await stripe.charges.list({
        customer: workspace.stripeCustomerId,
        limit: 1,
      });

      if (!charges.data.length) {
        return res.status(400).json({ error: 'No charges found for this customer' });
      }

      const latestCharge = charges.data[0];
      const validReasons = ['duplicate', 'fraudulent', 'requested_by_customer'] as const;
      const stripeReason = validReasons.includes(reason) ? reason : 'requested_by_customer';

      const refundData: any = {
        charge: latestCharge.id,
        reason: stripeReason,
      };

      // Partial refund if amount specified
      if (amount && Number(amount) > 0) {
        refundData.amount = Math.round(Number(amount) * 100); // Convert to cents
      }

      const refund = await stripe.refunds.create(refundData);

      res.json({
        success: true,
        refund: {
          id: refund.id,
          amount: (refund.amount || 0) / 100,
          currency: refund.currency,
          status: refund.status,
          reason: refund.reason,
          chargeId: latestCharge.id,
          originalAmount: (latestCharge.amount || 0) / 100,
        },
      });
    } catch (error: any) {
      console.error('[superadmin:refund]', error);
      res.status(500).json({ error: error?.message || 'Failed to process refund' });
    }
  });

  app.get("/api/superadmin/workspaces/:id/latest-charge", requireAuth, requireSuperadmin, async (req, res) => {
    try {
      if (!stripe) return res.status(500).json({ error: 'Stripe is not configured' });

      const workspace = await prisma.workspace.findUnique({
        where: { id: req.params.id },
        select: { stripeCustomerId: true },
      });

      if (!workspace?.stripeCustomerId) return res.json({ charge: null });

      const charges = await stripe.charges.list({
        customer: workspace.stripeCustomerId,
        limit: 1,
      });

      if (!charges.data.length) return res.json({ charge: null });

      const charge = charges.data[0];
      res.json({
        charge: {
          id: charge.id,
          amount: (charge.amount || 0) / 100,
          currency: charge.currency,
          status: charge.status,
          created: new Date(charge.created * 1000).toISOString(),
          refunded: charge.refunded,
          amountRefunded: (charge.amount_refunded || 0) / 100,
        },
      });
    } catch (error) {
      console.error('[superadmin:latest-charge]', error);
      res.status(500).json({ error: 'Failed to fetch charge info' });
    }
  });

  // ── Appointment Booking: Services ────────────────────────────────

  app.get("/api/services", requireAuth, requireWorkspaceAccessFromQuery, async (req, res) => {
    try {
      const services = await prisma.service.findMany({
        where: { workspaceId: req.query.workspaceId as string },
        include: { staffServices: { include: { staff: true } } },
        orderBy: { name: "asc" },
      });
      res.json(services);
    } catch (error) {
      console.error("[services:list]", error);
      res.status(500).json({ error: "Failed to load services" });
    }
  });

  app.post("/api/services", requireAuth, requireRole('ADMIN', 'OWNER'), requireSubscribedWorkspaceFromBody, async (req: any, res) => {
    const { workspaceId, name, description, durationMin, price, currency, color } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Service name is required" });
    if (!(await enforceWorkspacePlanLimit(res, workspaceId, "services"))) return;

    try {
      const service = await prisma.service.create({
        data: {
          workspaceId,
          name: name.trim(),
          description: description?.trim() || null,
          durationMin: Number(durationMin) || 30,
          price: Number(price) || 0,
          currency: currency?.trim() || "AED",
          color: color?.trim() || "#25D366",
        },
      });
      res.json(service);
    } catch (error) {
      console.error("[services:create]", error);
      res.status(500).json({ error: "Failed to create service" });
    }
  });

  app.patch("/api/services/:id", requireAuth, requireRole('ADMIN', 'OWNER'), async (req: any, res) => {
    try {
      const service = await prisma.service.findUnique({ where: { id: req.params.id } });
      if (!service) return res.status(404).json({ error: "Service not found" });
      await requireSubscribedWorkspaceById(req, res, async () => {
        const { name, description, durationMin, price, currency, color, enabled } = req.body;
        const updated = await prisma.service.update({
          where: { id: req.params.id },
          data: {
            name: name?.trim() || undefined,
            description: description !== undefined ? description?.trim() || null : undefined,
            durationMin: durationMin !== undefined ? Number(durationMin) || 30 : undefined,
            price: price !== undefined ? Number(price) || 0 : undefined,
            currency: currency !== undefined ? currency?.trim() || "AED" : undefined,
            color: color !== undefined ? color?.trim() || "#25D366" : undefined,
            enabled: enabled !== undefined ? Boolean(enabled) : undefined,
          },
        });
        res.json(updated);
      }, service.workspaceId);
    } catch (error) {
      console.error("[services:update]", error);
      res.status(500).json({ error: "Failed to update service" });
    }
  });

  app.delete("/api/services/:id", requireAuth, requireRole('ADMIN', 'OWNER'), async (req: any, res) => {
    try {
      const service = await prisma.service.findUnique({ where: { id: req.params.id } });
      if (!service) return res.status(404).json({ error: "Service not found" });
      await requireSubscribedWorkspaceById(req, res, async () => {
        await prisma.staffService.deleteMany({ where: { serviceId: req.params.id } });
        await prisma.service.delete({ where: { id: req.params.id } });
        res.json({ success: true });
      }, service.workspaceId);
    } catch (error) {
      console.error("[services:delete]", error);
      res.status(500).json({ error: "Failed to delete service" });
    }
  });

  // ── Appointment Booking: Staff ─────────────────────────────────

  app.get("/api/staff", requireAuth, requireWorkspaceAccessFromQuery, async (req, res) => {
    try {
      const staff = await prisma.staffMember.findMany({
        where: { workspaceId: req.query.workspaceId as string },
        include: { staffServices: { include: { service: true } } },
        orderBy: { name: "asc" },
      });
      res.json(staff);
    } catch (error) {
      console.error("[staff:list]", error);
      res.status(500).json({ error: "Failed to load staff" });
    }
  });

  app.post("/api/staff", requireAuth, requireRole('ADMIN', 'OWNER'), requireSubscribedWorkspaceFromBody, async (req: any, res) => {
    const { workspaceId, name, phone, email, workingHours, serviceIds } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Staff name is required" });
    if (!(await enforceWorkspacePlanLimit(res, workspaceId, "staffMembers"))) return;

    try {
      const staff = await prisma.staffMember.create({
        data: {
          workspaceId,
          name: name.trim(),
          phone: phone?.trim() || null,
          email: email?.trim() || null,
          workingHours: workingHours || JSON.stringify({
            sun: { start: "09:00", end: "17:00" },
            mon: { start: "09:00", end: "17:00" },
            tue: { start: "09:00", end: "17:00" },
            wed: { start: "09:00", end: "17:00" },
            thu: { start: "09:00", end: "17:00" },
            fri: null,
            sat: null,
          }),
          staffServices: Array.isArray(serviceIds) && serviceIds.length > 0
            ? { create: serviceIds.map((serviceId: string) => ({ serviceId })) }
            : undefined,
        },
        include: { staffServices: { include: { service: true } } },
      });
      res.json(staff);
    } catch (error) {
      console.error("[staff:create]", error);
      res.status(500).json({ error: "Failed to create staff member" });
    }
  });

  app.patch("/api/staff/:id", requireAuth, requireRole('ADMIN', 'OWNER'), async (req: any, res) => {
    try {
      const staff = await prisma.staffMember.findUnique({ where: { id: req.params.id } });
      if (!staff) return res.status(404).json({ error: "Staff member not found" });
      await requireSubscribedWorkspaceById(req, res, async () => {
        const { name, phone, email, workingHours, enabled, serviceIds } = req.body;

        if (Array.isArray(serviceIds)) {
          await prisma.staffService.deleteMany({ where: { staffId: req.params.id } });
          if (serviceIds.length > 0) {
            await prisma.staffService.createMany({
              data: serviceIds.map((serviceId: string) => ({ staffId: req.params.id, serviceId })),
            });
          }
        }

        const updated = await prisma.staffMember.update({
          where: { id: req.params.id },
          data: {
            name: name?.trim() || undefined,
            phone: phone !== undefined ? phone?.trim() || null : undefined,
            email: email !== undefined ? email?.trim() || null : undefined,
            workingHours: workingHours || undefined,
            enabled: enabled !== undefined ? Boolean(enabled) : undefined,
          },
          include: { staffServices: { include: { service: true } } },
        });
        res.json(updated);
      }, staff.workspaceId);
    } catch (error) {
      console.error("[staff:update]", error);
      res.status(500).json({ error: "Failed to update staff member" });
    }
  });

  app.delete("/api/staff/:id", requireAuth, requireRole('ADMIN', 'OWNER'), async (req: any, res) => {
    try {
      const staff = await prisma.staffMember.findUnique({ where: { id: req.params.id } });
      if (!staff) return res.status(404).json({ error: "Staff member not found" });
      await requireSubscribedWorkspaceById(req, res, async () => {
        await prisma.staffService.deleteMany({ where: { staffId: req.params.id } });
        await prisma.staffMember.delete({ where: { id: req.params.id } });
        res.json({ success: true });
      }, staff.workspaceId);
    } catch (error) {
      console.error("[staff:delete]", error);
      res.status(500).json({ error: "Failed to delete staff member" });
    }
  });

  // ── Appointment Booking: Appointments ──────────────────────────

  app.get("/api/appointments", requireAuth, requireWorkspaceAccessFromQuery, async (req, res) => {
    try {
      const { workspaceId, date, staffId, status, contactId } = req.query;
      const where: any = { workspaceId: workspaceId as string };

      if (date) {
        const d = new Date(date as string);
        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
        where.startTime = { gte: dayStart, lt: dayEnd };
      }
      if (staffId) where.staffId = staffId as string;
      if (contactId) where.contactId = contactId as string;
      if (status && status !== "ALL") where.status = status as string;

      const appointments = await prisma.appointment.findMany({
        where,
        include: { contact: true, service: true, staff: true },
        orderBy: { startTime: "asc" },
      });
      res.json(appointments);
    } catch (error) {
      console.error("[appointments:list]", error);
      res.status(500).json({ error: "Failed to load appointments" });
    }
  });

  app.post("/api/appointments", requireAuth, requireSubscribedWorkspaceFromBody, async (req: any, res) => {
    const { workspaceId, contactId, serviceId, staffId, startTime, notes } = req.body;

    if (!contactId || !serviceId || !staffId || !startTime) {
      return res.status(400).json({ error: "Contact, service, staff, and start time are required" });
    }

    if (!(await enforceMonthlyAppointmentLimit(res, workspaceId))) return;

    try {
      const service = await prisma.service.findUnique({ where: { id: serviceId } });
      if (!service) return res.status(404).json({ error: "Service not found" });

      const start = new Date(startTime);
      const end = new Date(start.getTime() + service.durationMin * 60 * 1000);

      // Check for overlapping appointments
      const overlap = await prisma.appointment.findFirst({
        where: {
          staffId,
          status: { not: "CANCELLED" },
          startTime: { lt: end },
          endTime: { gt: start },
        },
      });

      if (overlap) {
        return res.status(409).json({ error: "This time slot conflicts with an existing appointment" });
      }

      const appointment = await prisma.appointment.create({
        data: {
          workspaceId,
          contactId,
          serviceId,
          staffId,
          startTime: start,
          endTime: end,
          notes: notes?.trim() || null,
          createdById: req.user.userId,
        },
        include: { contact: true, service: true, staff: true },
      });

      await prisma.activityLog.create({
        data: {
          type: "APPOINTMENT_CREATED",
          content: `Appointment booked: ${service.name} with ${appointment.staff.name}`,
          contactId,
          workspaceId,
        },
      });

      io.to(workspaceId).emit("appointment-created", appointment);
      res.json(appointment);
    } catch (error) {
      console.error("[appointments:create]", error);
      res.status(500).json({ error: "Failed to create appointment" });
    }
  });

  app.patch("/api/appointments/:id", requireAuth, async (req: any, res) => {
    try {
      const appointment = await prisma.appointment.findUnique({
        where: { id: req.params.id },
        include: { service: true },
      });
      if (!appointment) return res.status(404).json({ error: "Appointment not found" });

      await requireSubscribedWorkspaceById(req, res, async () => {
        const { startTime, staffId, status, notes } = req.body;
        const data: any = {};

        if (notes !== undefined) data.notes = notes?.trim() || null;
        if (status) data.status = status;

        if (startTime || staffId) {
          const newStart = startTime ? new Date(startTime) : appointment.startTime;
          const newEnd = new Date(newStart.getTime() + appointment.service.durationMin * 60 * 1000);
          const newStaffId = staffId || appointment.staffId;

          const overlap = await prisma.appointment.findFirst({
            where: {
              id: { not: req.params.id },
              staffId: newStaffId,
              status: { not: "CANCELLED" },
              startTime: { lt: newEnd },
              endTime: { gt: newStart },
            },
          });

          if (overlap) {
            return res.status(409).json({ error: "This time slot conflicts with an existing appointment" });
          }

          data.startTime = newStart;
          data.endTime = newEnd;
          if (staffId) data.staffId = staffId;
        }

        const updated = await prisma.appointment.update({
          where: { id: req.params.id },
          data,
          include: { contact: true, service: true, staff: true },
        });

        io.to(appointment.workspaceId).emit("appointment-updated", updated);
        res.json(updated);
      }, appointment.workspaceId);
    } catch (error) {
      console.error("[appointments:update]", error);
      res.status(500).json({ error: "Failed to update appointment" });
    }
  });

  app.delete("/api/appointments/:id", requireAuth, async (req: any, res) => {
    try {
      const appointment = await prisma.appointment.findUnique({ where: { id: req.params.id } });
      if (!appointment) return res.status(404).json({ error: "Appointment not found" });

      await requireSubscribedWorkspaceById(req, res, async () => {
        await prisma.appointment.delete({ where: { id: req.params.id } });
        io.to(appointment.workspaceId).emit("appointment-deleted", req.params.id);
        res.json({ success: true });
      }, appointment.workspaceId);
    } catch (error) {
      console.error("[appointments:delete]", error);
      res.status(500).json({ error: "Failed to delete appointment" });
    }
  });

  // ── Appointment Booking: Availability ──────────────────────────

  app.get("/api/appointments/availability", requireAuth, requireWorkspaceAccessFromQuery, async (req, res) => {
    try {
      const { workspaceId, date, serviceId, staffId } = req.query;
      if (!date || !serviceId) {
        return res.status(400).json({ error: "Date and service are required" });
      }

      const service = await prisma.service.findUnique({ where: { id: serviceId as string } });
      if (!service) return res.status(404).json({ error: "Service not found" });

      const staffWhere: any = { workspaceId: workspaceId as string, enabled: true };
      if (staffId) {
        staffWhere.id = staffId as string;
      } else {
        staffWhere.staffServices = { some: { serviceId: serviceId as string } };
      }

      const staffList = await prisma.staffMember.findMany({ where: staffWhere });

      const d = new Date(date as string);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
      const dayName = dayNames[d.getDay()];

      const existingAppointments = await prisma.appointment.findMany({
        where: {
          workspaceId: workspaceId as string,
          staffId: { in: staffList.map((s) => s.id) },
          status: { not: "CANCELLED" },
          startTime: { gte: dayStart, lt: dayEnd },
        },
      });

      const result = staffList.map((staff) => {
        let hours: any = null;
        try {
          const parsed = JSON.parse(staff.workingHours || "{}");
          hours = parsed[dayName];
        } catch {}

        if (!hours || !hours.start || !hours.end) {
          return { staffId: staff.id, staffName: staff.name, slots: [] };
        }

        const staffAppointments = existingAppointments.filter((a) => a.staffId === staff.id);
        const slots: string[] = [];

        const [startH, startM] = hours.start.split(":").map(Number);
        const [endH, endM] = hours.end.split(":").map(Number);
        const workStart = new Date(dayStart.getTime() + startH * 3600000 + startM * 60000);
        const workEnd = new Date(dayStart.getTime() + endH * 3600000 + endM * 60000);

        let cursor = new Date(workStart);
        while (cursor.getTime() + service.durationMin * 60000 <= workEnd.getTime()) {
          const slotEnd = new Date(cursor.getTime() + service.durationMin * 60000);
          const hasConflict = staffAppointments.some(
            (a) => a.startTime < slotEnd && a.endTime > cursor
          );
          if (!hasConflict) {
            slots.push(
              `${String(cursor.getHours()).padStart(2, "0")}:${String(cursor.getMinutes()).padStart(2, "0")}`
            );
          }
          cursor = new Date(cursor.getTime() + 30 * 60000);
        }

        return { staffId: staff.id, staffName: staff.name, slots };
      });

      res.json(result);
    } catch (error) {
      console.error("[appointments:availability]", error);
      res.status(500).json({ error: "Failed to check availability" });
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

  // Sentry error handler — must be after all routes
  Sentry.setupExpressErrorHandler(app);

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);

    // Wire up appointment reminder emitter with Socket.io
    setReminderEmitter((workspaceId, message, conversationId) => {
      io.to(workspaceId).emit("new-message", message);
      io.to(workspaceId).emit("conversation-updated", conversationId);
    });

    // Start appointment reminder scheduler (checks every 30 min)
    startReminderScheduler();

    // Wire up follow-up sequence emitter with Socket.io
    setFollowUpEmitter((workspaceId, message, conversationId) => {
      io.to(workspaceId).emit("new-message", message);
      io.to(workspaceId).emit("conversation-updated", conversationId);
    });

    // Start follow-up sequence scheduler (checks every 5 min)
    startFollowUpScheduler();
  });
}

startServer().catch(err => {
  console.error("CRITICAL SERVER ERROR:", err);
  process.exit(1);
});

// ── Graceful Shutdown ─────────────────────────────────────────────
function gracefulShutdown(signal: string) {
  console.log(`[shutdown] ${signal} received, closing gracefully...`);

  // Stop accepting new connections
  httpServer.close(async () => {
    console.log("[shutdown] HTTP server closed");

    // Close BullMQ queue + Redis socket subscriber
    try { if (webhookQueue) await webhookQueue.close(); } catch {}
    try { if (socketEventSubscriber) await socketEventSubscriber.quit(); } catch {}
    try { await redisConnection.quit(); } catch {}

    // Flush Sentry events
    try { await Sentry.close(2000); } catch {}

    // Disconnect Prisma
    try { await prisma.$disconnect(); } catch {}

    console.log("[shutdown] Cleanup complete, exiting");
    process.exit(0);
  });

  // Force exit after 10s if connections won't close
  setTimeout(() => {
    console.error("[shutdown] Forced exit after 10s timeout");
    process.exit(1);
  }, 10000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
