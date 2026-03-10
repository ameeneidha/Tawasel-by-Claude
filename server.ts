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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

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

async function sendMetaMessage(to: string, text: string, type: 'whatsapp' | 'instagram', config: { accessToken: string, phoneNumberId?: string, instagramId?: string }) {
  try {
    if (type === 'whatsapp') {
      await axios.post(
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
    } else {
      await axios.post(
        `https://graph.facebook.com/v17.0/me/messages`, // 'me' works if the token is for the page
        {
          recipient: { id: to },
          message: { text: text },
        },
        {
          headers: { Authorization: `Bearer ${config.accessToken}` },
        }
      );
    }
  } catch (error: any) {
    console.error(`Error sending ${type} message:`, error.response?.data || error.message);
  }
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
  const PORT = 3000;

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
        if (workspaceId) {
          // Update workspace billing status or add credits
          console.log(`Payment successful for workspace: ${workspaceId}`);
          await prisma.billingLedgerEntry.create({
            data: {
              workspaceId,
              amount: (session.amount_total || 0) / 100,
              type: 'CREDIT',
              description: 'Subscription payment'
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
  app.post("/api/billing/create-checkout-session", requireAuth, async (req, res) => {
    if (!stripe) return res.status(500).json({ error: "Stripe not configured" });
    const { planId, workspaceId, successUrl, cancelUrl } = req.body;

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
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { workspaceId },
      });
      res.json({ url: session.url });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
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

  app.post("/webhook/meta", async (req, res) => {
    const body = req.body;
    console.log("Meta Webhook received:", JSON.stringify(body, null, 2));

    // Process incoming messages from WhatsApp
    if (body.object === "whatsapp_business_account") {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const message = value?.messages?.[0];
      const metadata = value?.metadata;

      if (message && message.type === 'text') {
        const from = message.from;
        const text = message.text?.body;
        const phoneNumberId = metadata?.phone_number_id;
        const displayPhoneNumber = metadata?.display_phone_number;

        // Find the WhatsApp number in our DB
        const number = await prisma.whatsAppNumber.findFirst({
          where: { phoneNumber: displayPhoneNumber }
        });

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
          io.to(number.workspaceId).emit("new-message", newMsg);
          io.to(number.workspaceId).emit("conversation-updated", conversation.id);

          // Trigger AI Chatbot if enabled
          if (number.autoReply && number.chatbotId) {
            const chatbot = await prisma.chatbot.findUnique({ where: { id: number.chatbotId } });
            if (chatbot && chatbot.enabled) {
              const aiResponse = await getAIResponse(chatbot, text);
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
          if (account.chatbotId) {
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

  app.post("/api/workspaces", requireAuth, async (req, res) => {
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
        tasks: { where: { status: 'PENDING' } }
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
            tasks: true
          } 
        }, 
        assignedTo: { select: { id: true, name: true, image: true } },
        messages: { orderBy: { createdAt: 'asc' } },
        notes: { orderBy: { createdAt: 'desc' } },
        tasks: { orderBy: { createdAt: 'desc' } },
        activities: { orderBy: { createdAt: 'desc' }, take: 20 },
        number: true,
        instagramAccount: true
      }
    });
    res.json(conversation);
  });

  app.patch("/api/conversations/:id", requireAuth, async (req, res) => {
    const { assignedToId, priority, status, internalStatus, tags, resolvedAt, slaStatus } = req.body;
    
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
        slaStatus 
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

    res.json(conversation);
  });

  app.post("/api/messages", requireAuth, async (req, res) => {
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
          content: direction === 'OUTGOING' ? 'Agent sent a message' : 'Customer sent a message',
          conversationId,
          contactId: conversation.contactId,
          workspaceId: conversation.workspaceId
        }
      });
    }

    res.json(message);
  });

  // Socket.io Broadcast for manual messages
  app.post("/api/messages/send", requireAuth, async (req, res) => {
    const { conversationId, content, senderId, senderName } = req.body;
    
    try {
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId }
      });

      if (!conversation) return res.status(404).json({ error: "Conversation not found" });

      const message = await prisma.message.create({
        data: {
          conversationId,
          content,
          direction: 'OUTGOING',
          senderType: 'USER',
          senderName,
          status: 'SENT'
        }
      });

      await prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() }
      });

      // Broadcast to all clients in this workspace
      io.to(conversation.workspaceId).emit("new-message", message);

      res.json(message);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
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

  app.post("/api/instagram/accounts", requireAuth, async (req, res) => {
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

  app.post("/api/chatbots", requireAuth, async (req, res) => {
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

  app.patch("/api/chatbots/:id", requireAuth, async (req, res) => {
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

  // Contacts / CRM
  app.get("/api/contacts", requireAuth, async (req, res) => {
    const { workspaceId } = req.query;
    const contacts = await prisma.contact.findMany({
      where: { workspaceId: workspaceId as string },
      include: { 
        conversations: { take: 1, orderBy: { lastMessageAt: 'desc' } },
        activities: { orderBy: { createdAt: 'desc' }, take: 5 },
        tasks: { where: { status: 'PENDING' } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(contacts);
  });

  app.get("/api/contacts/:id", requireAuth, async (req, res) => {
    const contact = await prisma.contact.findUnique({
      where: { id: req.params.id },
      include: {
        conversations: { include: { messages: { take: 1, orderBy: { createdAt: 'desc' } } } },
        activities: { orderBy: { createdAt: 'desc' } },
        tasks: { orderBy: { createdAt: 'desc' } },
        customValues: { include: { definition: true } }
      }
    });
    res.json(contact);
  });

  app.patch("/api/contacts/:id", requireAuth, async (req, res) => {
    const { pipelineStage, name, phoneNumber, leadSource, tags, notes, assignedToId } = req.body;
    const oldContact = await prisma.contact.findUnique({ where: { id: req.params.id } });
    
    const contact = await prisma.contact.update({
      where: { id: req.params.id },
      data: { pipelineStage, name, phoneNumber, leadSource, tags, notes, assignedToId }
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

  app.post("/api/tasks", requireAuth, async (req, res) => {
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

    res.json(task);
  });

  app.patch("/api/tasks/:id", requireAuth, async (req, res) => {
    const { status, title, description, dueDate, priority, assignedToId } = req.body;
    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: { status, title, description, dueDate: dueDate ? new Date(dueDate) : undefined, priority, assignedToId }
    });
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

  app.post("/api/automation/rules", requireAuth, async (req, res) => {
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
        _count: { select: { recipients: true } }
      }
    });
    res.json(campaigns);
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
