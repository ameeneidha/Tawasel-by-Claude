import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import prisma from "./src/lib/prisma.js";
import { Server } from "socket.io";
import { createServer } from "http";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import Stripe from "stripe";
import axios from "axios";
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
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
  GROWTH: 3,
  PRO: 5,
};

const getWorkspaceUserLimit = (plan?: string | null) => WORKSPACE_USER_LIMITS[(plan || '').toUpperCase()] || 1;

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
        model: chatbot.model || "gpt-4o-mini",
        messages: [
          { role: "system", content: chatbot.instructions },
          { role: "user", content: message }
        ],
      });
      return completion.choices[0].message.content || "";
    } else if (genAI) {
      const result = await genAI.models.generateContent({
        model: chatbot.model || "gemini-1.5-flash",
        contents: [
          { parts: [{ text: `System Instructions: ${chatbot.instructions}` }] },
          { parts: [{ text: `User Message: ${message}` }] }
        ]
      });
      return result.text || "";
    }
  } catch (error) {
    console.error("AI Response Error:", error);
  }
  return "";
}

async function generateAISummary(conversationHistory: { content: string; senderType: string }[]) {
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
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
      });
      return completion.choices[0].message.content || "";
    }

    if (genAI) {
      const result = await genAI.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{ parts: [{ text: prompt }] }],
      });
      return result.text || "";
    }
  } catch (error) {
    console.error("AI Summary Error:", error);
  }

  return "";
}

async function generateAIReplySuggestions(conversationHistory: { content: string; senderType: string }[]) {
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
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
      });

      const content = completion.choices[0].message.content || "";
      const parsed = parseSuggestionPayload(content);
      if (parsed.length) return parsed;
    }

    if (genAI) {
      const result = await genAI.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
        },
      });
      const text = result.text || "";
      const parsed = parseSuggestionPayload(text);
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
      origin: "*",
      methods: ["GET", "POST"]
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

    console.log("Meta Verification Request:", { mode, token, expectedToken });

    if (mode === "subscribe" && String(token).trim() === expectedToken) {
      console.log("Meta Webhook Verified Successfully!");
      // Meta requires the challenge to be returned exactly as received in the response body
      res.set('Content-Type', 'text/plain');
      return res.status(200).send(challenge);
    }
    
    console.error("Meta Webhook Verification Failed: Token Mismatch", { 
      received: token, 
      expected: expectedToken 
    });
    return res.status(403).send("Verification failed");
  });

  app.use(express.json());

  const requireAuth = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
      req.user = decoded;
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };

  const getUserByToken = async (req: any) => {
    return prisma.user.findUnique({ where: { id: req.user.userId } });
  };

  const hasSubscription = (status?: string | null) => ['active', 'trialing'].includes((status || '').toLowerCase());

  const requireVerifiedEmail = async (req: any, res: any, next: any) => {
    const user = await getUserByToken(req);
    if (!user?.emailVerified) {
      return res.status(403).json({ error: 'Verify your email before continuing' });
    }
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
  app.post("/api/chatbots/query", requireAuth, async (req, res) => {
    const { chatbotId, message, conversationId } = req.body;

    try {
      const chatbot = await prisma.chatbot.findUnique({
        where: { id: chatbotId }
      });

      if (!chatbot || !chatbot.enabled) {
        return res.status(404).json({ error: "Chatbot not found or disabled" });
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

  app.post("/api/ai/reply-suggestions", requireAuth, async (req, res) => {
    const history = Array.isArray(req.body?.history) ? req.body.history : [];

    try {
      const suggestions = await generateAIReplySuggestions(history);
      if (!suggestions.length) {
        return res.status(500).json({ error: "No AI provider configured or AI failed" });
      }
      res.json({ suggestions });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to generate reply suggestions" });
    }
  });

  app.post("/api/ai/summarize", requireAuth, async (req, res) => {
    const history = Array.isArray(req.body?.history) ? req.body.history : [];

    try {
      const summary = await generateAISummary(history);
      if (!summary) {
        return res.status(500).json({ error: "No AI provider configured or AI failed" });
      }
      res.json({ summary });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to summarize conversation" });
    }
  });

  app.post("/webhook/meta", async (req, res) => {
    const body = req.body;
    console.log("Meta Webhook received:", JSON.stringify(body, null, 2));

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
            (candidate) => normalizePhone(candidate.phoneNumber) === displayDigits
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
        const number = numbers.find((candidate) => normalizePhone(candidate.phoneNumber) === displayDigits);

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
                workspaceId: number.workspaceId
              }
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
              status: 'READ'
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
                // Send back to WhatsApp
                await sendMetaMessage(from, aiResponse, 'whatsapp', {
                  accessToken: process.env.META_ACCESS_TOKEN || "",
                  phoneNumberId: phoneNumberId
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
                workspaceId: account.workspaceId
              }
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
              status: 'READ'
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
  app.post("/api/auth/register", async (req, res) => {
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
        process.env.JWT_SECRET || 'fallback-secret',
        { expiresIn: '7d' }
      );

      res.json({ token, user });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/auth/verify-email", requireAuth, async (req, res) => {
    try {
      const user = await prisma.user.update({
        where: { id: (req as any).user.userId },
        data: { emailVerified: true }
      });
      res.json({ success: true, user });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
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
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );
    res.json({ token, user });
  });

  app.get("/api/users/:id", requireAuth, async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id }
    });
    if (user) res.json(user);
    else res.status(404).json({ error: "User not found" });
  });

  // Workspace Routes
  app.get("/api/workspaces", requireAuth, async (req, res) => {
    const { userId } = req.query;
    const memberships = await prisma.workspaceMembership.findMany({
      where: { userId: userId as string },
      include: { workspace: true }
    });
    res.json(memberships.map(m => m.workspace));
  });

  app.post("/api/workspaces", requireAuth, requireSubscribedWorkspaceFromBody, async (req, res) => {
    const { name, userId } = req.body;
    console.log('Creating workspace for user:', userId, 'name:', name);
    if (!name || !userId) return res.status(400).json({ error: "Missing name or userId" });

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
      console.error('Detailed Workspace creation error:', {
        message: e.message,
        code: e.code,
        meta: e.meta,
        stack: e.stack
      });
      res.status(500).json({ 
        error: "Failed to create workspace", 
        details: e.message,
        code: e.code 
      });
    }
  });

  // Inbox Routes
  app.get("/api/conversations", requireAuth, async (req, res) => {
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

  app.get("/api/conversations/:id", requireAuth, async (req, res) => {
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
              instagramAccount: true
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
          : process.env.META_ACCESS_TOKEN || "";

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
        status: 'SENT'
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
          const phoneNumberId = process.env.META_PHONE_NUMBER_ID || "";

          if (!to || !phoneNumberId || !process.env.META_ACCESS_TOKEN) {
            return res.status(400).json({ error: "WhatsApp channel is not fully configured" });
          }

          for (const attachment of attachments) {
            const sentMedia = await sendWhatsAppMediaMessage(
              to,
              attachment,
              {
                accessToken: process.env.META_ACCESS_TOKEN,
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
                status: 'SENT'
              }
            }));
          }

          if (content?.trim() && attachments.length === 0) {
            await sendMetaMessage(to, content, 'whatsapp', {
              accessToken: process.env.META_ACCESS_TOKEN,
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
  app.get("/api/templates/whatsapp", requireAuth, async (req, res) => {
    const { workspaceId } = req.query;
    const templates = await prisma.whatsAppTemplate.findMany({
      where: { workspaceId: workspaceId as string }
    });
    res.json(templates);
  });

  // Numbers
  app.get("/api/numbers", requireAuth, async (req, res) => {
    const { workspaceId } = req.query;
    const numbers = await prisma.whatsAppNumber.findMany({
      where: { workspaceId: workspaceId as string },
      include: { chatbot: true }
    });
    res.json(numbers);
  });

  // Instagram Accounts
  app.get("/api/instagram/accounts", requireAuth, async (req, res) => {
    const { workspaceId } = req.query;
    const accounts = await prisma.instagramAccount.findMany({
      where: { workspaceId: workspaceId as string },
      include: { chatbot: true }
    });
    res.json(accounts);
  });

  app.post("/api/instagram/accounts", requireAuth, requireSubscribedWorkspaceFromBody, async (req, res) => {
    const { workspaceId, name, instagramId, username } = req.body;
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
  app.get("/api/chatbots", requireAuth, async (req, res) => {
    const { workspaceId } = req.query;
    const chatbots = await prisma.chatbot.findMany({
      where: { workspaceId: workspaceId as string },
      include: { numbers: true, instagramAccounts: true, tools: true }
    });
    res.json(chatbots);
  });

  app.post("/api/chatbots", requireAuth, requireSubscribedWorkspaceFromBody, async (req, res) => {
    const { workspaceId, name, instructions, model } = req.body;
    const chatbot = await prisma.chatbot.create({
      data: {
        workspaceId,
        name,
        instructions,
        model: model || 'gpt-4o-mini',
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
    const { name, instructions, model, enabled, language } = req.body;
    const chatbot = await prisma.chatbot.update({
      where: { id: req.params.id },
      data: {
        name,
        instructions,
        model,
        enabled,
        language
      },
      include: { numbers: true, instagramAccounts: true, tools: true }
    });
    res.json(chatbot);
  });

  // Team
  app.get("/api/team", requireAuth, async (req, res) => {
    const { workspaceId } = req.query;
    const members = await prisma.workspaceMembership.findMany({
      where: { workspaceId: workspaceId as string },
      include: { user: true }
    });
    res.json(members);
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
      include: { user: true }
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
        user: true
      }
    });

    res.json(teamMember);
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
        user: true
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
        user: true
      }
    });

    res.json(updatedMembership);
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
  app.get("/api/contacts", requireAuth, async (req, res) => {
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
    const { workspaceId, name, phoneNumber, instagramUsername, pipelineStage, city, leadSource, tags, notes, assignedToId, listIds, listNames } = req.body;

    if (!workspaceId) {
      return res.status(400).json({ error: "Workspace is required" });
    }

    if (!name?.trim() && !phoneNumber?.trim() && !instagramUsername?.trim()) {
      return res.status(400).json({ error: "Add at least a name, phone number, or Instagram username" });
    }

    const resolvedListIds = await resolveContactListIds(workspaceId, listIds, listNames);

    const contact = await prisma.contact.create({
      data: {
        workspaceId,
        name: name?.trim() || phoneNumber?.trim() || instagramUsername?.trim() || 'New Contact',
        phoneNumber: phoneNumber?.trim() || null,
        instagramUsername: instagramUsername?.trim() || null,
        pipelineStage: pipelineStage || 'NEW_LEAD',
        city: city?.trim() || null,
        leadSource: leadSource?.trim() || null,
        tags: tags?.trim() || null,
        notes: notes?.trim() || null,
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

  app.get("/api/contacts/:id", requireAuth, async (req, res) => {
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
    const { pipelineStage, name, phoneNumber, city, leadSource, tags, notes, assignedToId, listIds, listNames } = req.body;
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
        leadSource,
        tags,
        notes,
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

  app.get("/api/contact-lists", requireAuth, async (req, res) => {
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
  app.get("/api/tasks", requireAuth, async (req, res) => {
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
  app.get("/api/activity-logs", requireAuth, async (req, res) => {
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
  app.get("/api/campaigns", requireAuth, async (req, res) => {
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

    const accessToken = process.env.META_ACCESS_TOKEN || "";
    const phoneNumberId = process.env.META_PHONE_NUMBER_ID || "";
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

    const accessToken = process.env.META_ACCESS_TOKEN || "";
    const phoneNumberId = process.env.META_PHONE_NUMBER_ID || "";

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
  app.get("/api/billing/ledger", requireAuth, async (req, res) => {
    const { workspaceId } = req.query;
    const ledger = await prisma.billingLedgerEntry.findMany({
      where: { workspaceId: workspaceId as string },
      orderBy: { createdAt: 'desc' }
    });
    res.json(ledger);
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
  app.get("/api/superadmin/stats", requireAuth, async (req, res) => {
    const [totalUsers, totalWorkspaces, totalMessages, ledgerEntries] = await Promise.all([
      prisma.user.count(),
      prisma.workspace.count(),
      prisma.message.count(),
      prisma.billingLedgerEntry.findMany({ where: { type: 'CREDIT' } })
    ]);

    const totalRevenue = ledgerEntries.reduce((sum, entry) => sum + entry.amount, 0);

    res.json({
      totalUsers,
      totalWorkspaces,
      totalMessages,
      totalRevenue
    });
  });

  // Dev Seeding Route
  app.post("/api/dev/seed", requireAuth, async (req, res) => {
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

  app.get("/api/superadmin/workspaces", requireAuth, async (req, res) => {
    const workspaces = await prisma.workspace.findMany({
      include: {
        members: { take: 1 },
        _count: {
          select: { members: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(workspaces);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
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
