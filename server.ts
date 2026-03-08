import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import prisma from "./src/lib/prisma.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Auth Mock (For demo purposes)
  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({
      where: { email },
      include: { memberships: { include: { workspace: true } } }
    });
    
    if (user && user.password === password) {
      res.json({ user });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  // Workspace Routes
  app.get("/api/workspaces", async (req, res) => {
    const { userId } = req.query;
    const memberships = await prisma.workspaceMembership.findMany({
      where: { userId: userId as string },
      include: { workspace: true }
    });
    res.json(memberships.map(m => m.workspace));
  });

  // Inbox Routes
  app.get("/api/conversations", async (req, res) => {
    const { workspaceId } = req.query;
    const conversations = await prisma.conversation.findMany({
      where: { workspaceId: workspaceId as string },
      include: { contact: true, messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { lastMessageAt: 'desc' }
    });
    res.json(conversations);
  });

  app.get("/api/conversations/:id", async (req, res) => {
    const conversation = await prisma.conversation.findUnique({
      where: { id: req.params.id },
      include: { 
        contact: { include: { customValues: { include: { definition: true } } } }, 
        messages: { orderBy: { createdAt: 'asc' } },
        notes: { orderBy: { createdAt: 'desc' } },
        number: true,
        instagramAccount: true
      }
    });
    res.json(conversation);
  });

  app.post("/api/messages", async (req, res) => {
    const { conversationId, content, direction, senderType, isInternal, senderName } = req.body;
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
    
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() }
    });

    res.json(message);
  });

  // Templates
  app.get("/api/templates/whatsapp", async (req, res) => {
    const { workspaceId } = req.query;
    const templates = await prisma.whatsAppTemplate.findMany({
      where: { workspaceId: workspaceId as string }
    });
    res.json(templates);
  });

  // Numbers
  app.get("/api/numbers", async (req, res) => {
    const { workspaceId } = req.query;
    const numbers = await prisma.whatsAppNumber.findMany({
      where: { workspaceId: workspaceId as string },
      include: { chatbot: true }
    });
    res.json(numbers);
  });

  // Instagram Accounts
  app.get("/api/instagram/accounts", async (req, res) => {
    const { workspaceId } = req.query;
    const accounts = await prisma.instagramAccount.findMany({
      where: { workspaceId: workspaceId as string },
      include: { chatbots: true }
    });
    res.json(accounts);
  });

  app.post("/api/instagram/accounts", async (req, res) => {
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
  app.get("/api/chatbots", async (req, res) => {
    const { workspaceId } = req.query;
    const chatbots = await prisma.chatbot.findMany({
      where: { workspaceId: workspaceId as string },
      include: { numbers: true, instagramAccounts: true, tools: true }
    });
    res.json(chatbots);
  });

  // Team
  app.get("/api/team", async (req, res) => {
    const { workspaceId } = req.query;
    const members = await prisma.workspaceMembership.findMany({
      where: { workspaceId: workspaceId as string },
      include: { user: true }
    });
    res.json(members);
  });

  // Billing
  app.get("/api/billing/ledger", async (req, res) => {
    const { workspaceId } = req.query;
    const ledger = await prisma.billingLedgerEntry.findMany({
      where: { workspaceId: workspaceId as string },
      orderBy: { createdAt: 'desc' }
    });
    res.json(ledger);
  });

  // AI Suggestions
  app.get("/api/ai/suggestions", async (req, res) => {
    const { conversationId } = req.query;
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId as string },
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 10 } }
    });
    
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Import dynamically to avoid issues with top-level imports in server.ts if needed
    const { generateReplySuggestions } = await import("./src/services/aiService.js");
    
    const history = conversation.messages
      .reverse()
      .filter(m => !m.isInternal)
      .map(m => ({
        content: m.content,
        senderType: m.senderType
      }));

    const suggestions = await generateReplySuggestions(history);
    res.json(suggestions);
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
