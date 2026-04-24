import prisma from "../../src/lib/prisma.js";
import { sendMetaMessage, sendTemplateMessage, getWhatsAppChannelConfig } from "./meta.js";

// ── Appointment Reminder & Follow-Up Scheduler ────────────────────
// Runs every 30 minutes, handles 3 automated WhatsApp messages:
//   1. 24h reminder  — sent when appointment is 24h away (reminderSentAt)
//   2. 1h reminder   — sent when appointment is 1h away  (reminder1hSentAt)
//   3. Post-visit    — sent 30min–4h after endTime        (followUpSentAt)

const REMINDER_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

// Template names must match what was submitted via /api/appointments/setup-templates
const TEMPLATE_REMINDER_24H = "tawasel_reminder_24h";
const TEMPLATE_REMINDER_1H  = "tawasel_reminder_1h";

function formatReminderTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatReminderDate(date: Date): string {
  return date.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// ── Helper: get WhatsApp number for a workspace ────────────────────

async function getWaNumber(workspaceId: string) {
  return prisma.whatsAppNumber.findFirst({
    where: { workspaceId },
    select: { id: true, metaAccessToken: true, metaPhoneNumberId: true },
  });
}

// ── Helper: check whether a template is APPROVED in the DB ─────────

async function hasApprovedTemplate(workspaceId: string, name: string): Promise<boolean> {
  const tpl = await prisma.whatsAppTemplate.findFirst({
    where: { workspaceId, name, status: "APPROVED" },
  });
  return !!tpl;
}

// ── Helper: save outbound message to conversation ──────────────────

async function saveReminderMessage(
  workspaceId: string,
  contactId: string,
  content: string,
  senderName: string
) {
  const conversation = await prisma.conversation.findFirst({
    where: { workspaceId, contactId, channelType: "WHATSAPP" },
  });
  if (!conversation) return;

  const msg = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      content,
      direction: "OUTGOING",
      senderType: "AI_BOT",
      senderName,
      status: "SENT",
    },
  });

  if (globalReminderEmitter) {
    globalReminderEmitter(workspaceId, msg, conversation.id);
  }
}

// ── 24-Hour Reminder ───────────────────────────────────────────────

async function send24hReminders() {
  const now = new Date();
  const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000); // 23h from now
  const windowEnd   = new Date(now.getTime() + 25 * 60 * 60 * 1000); // 25h from now

  const appointments = await prisma.appointment.findMany({
    where: {
      startTime: { gte: windowStart, lte: windowEnd },
      status: { in: ["SCHEDULED", "CONFIRMED"] },
      reminderSentAt: null,
    },
    include: {
      contact:   { select: { id: true, name: true, phoneNumber: true } },
      service:   { select: { name: true, durationMin: true, price: true, currency: true } },
      staff:     { select: { name: true } },
      workspace: { select: { id: true, name: true } },
    },
  });

  if (appointments.length === 0) return;
  console.log(`[Reminders 24h] Found ${appointments.length} appointment(s)`);

  for (const appt of appointments) {
    if (!appt.contact?.phoneNumber) continue;

    const waNumber = await getWaNumber(appt.workspaceId);
    if (!waNumber) continue;
    const config = getWhatsAppChannelConfig(waNumber);
    if (!config.accessToken || !config.phoneNumberId) continue;

    const startTime    = new Date(appt.startTime);
    const businessName = appt.workspace?.name || "us";
    const customerName = appt.contact.name || "there";
    const dateTimeStr  = `${formatReminderDate(startTime)} at ${formatReminderTime(startTime)}`;

    try {
      const useTemplate = await hasApprovedTemplate(appt.workspaceId, TEMPLATE_REMINDER_24H);

      let messageId: string | undefined;
      let messageContent: string;

      if (useTemplate) {
        // Template: {{1}}=name, {{2}}=service, {{3}}=staff, {{4}}=datetime, {{5}}=business
        messageId = await sendTemplateMessage(
          appt.contact.phoneNumber,
          TEMPLATE_REMINDER_24H,
          "en",
          [customerName, appt.service.name, appt.staff.name, dateTimeStr, businessName],
          config as { accessToken: string; phoneNumberId: string }
        );
        messageContent = `[24h reminder template sent to ${customerName}]`;
      } else {
        // Fallback plain text (works if customer messaged recently)
        messageContent = [
          `Hi ${customerName}! 👋`,
          ``,
          `Reminder about your upcoming appointment:`,
          ``,
          `📋 *Service:* ${appt.service.name}`,
          `👤 *With:* ${appt.staff.name}`,
          `📅 *Date:* ${formatReminderDate(startTime)}`,
          `🕐 *Time:* ${formatReminderTime(startTime)}`,
          `⏱️ *Duration:* ${appt.service.durationMin} minutes`,
          appt.service.price > 0 ? `💰 *Price:* ${appt.service.price} ${appt.service.currency}` : "",
          ``,
          `Need to reschedule? Just reply to this message.`,
          ``,
          `— ${businessName}`,
        ].filter(Boolean).join("\n");
        messageId = await sendMetaMessage(appt.contact.phoneNumber, messageContent, "whatsapp", config);
      }

      await prisma.appointment.update({ where: { id: appt.id }, data: { reminderSentAt: new Date() } });
      await saveReminderMessage(appt.workspaceId, appt.contact.id, messageContent, "24h Reminder");
      await prisma.activityLog.create({
        data: {
          type: "REMINDER_SENT",
          content: `24h reminder sent for ${appt.service.name} with ${appt.staff.name} on ${dateTimeStr}`,
          contactId: appt.contact.id,
          workspaceId: appt.workspaceId,
        },
      });
      console.log(`[Reminders 24h] ✅ ${appt.id} → ${appt.contact.phoneNumber}`);
    } catch (err: any) {
      console.error(`[Reminders 24h] ❌ ${appt.id}:`, err?.message || err);
    }
  }
}

// ── 1-Hour Reminder ────────────────────────────────────────────────

async function send1hReminders() {
  const now = new Date();
  const windowStart = new Date(now.getTime() + 45 * 60 * 1000);  // 45min from now
  const windowEnd   = new Date(now.getTime() + 90 * 60 * 1000);  // 90min from now

  const appointments = await prisma.appointment.findMany({
    where: {
      startTime: { gte: windowStart, lte: windowEnd },
      status: { in: ["SCHEDULED", "CONFIRMED"] },
      reminder1hSentAt: null,
    },
    include: {
      contact:   { select: { id: true, name: true, phoneNumber: true } },
      service:   { select: { name: true } },
      staff:     { select: { name: true } },
      workspace: { select: { id: true, name: true } },
    },
  });

  if (appointments.length === 0) return;
  console.log(`[Reminders 1h] Found ${appointments.length} appointment(s)`);

  for (const appt of appointments) {
    if (!appt.contact?.phoneNumber) continue;

    const waNumber = await getWaNumber(appt.workspaceId);
    if (!waNumber) continue;
    const config = getWhatsAppChannelConfig(waNumber);
    if (!config.accessToken || !config.phoneNumberId) continue;

    const startTime    = new Date(appt.startTime);
    const businessName = appt.workspace?.name || "us";
    const customerName = appt.contact.name || "there";
    const timeStr      = formatReminderTime(startTime);

    try {
      const useTemplate = await hasApprovedTemplate(appt.workspaceId, TEMPLATE_REMINDER_1H);

      let messageContent: string;

      if (useTemplate) {
        // Template: {{1}}=name, {{2}}=service, {{3}}=staff, {{4}}=time, {{5}}=business
        await sendTemplateMessage(
          appt.contact.phoneNumber,
          TEMPLATE_REMINDER_1H,
          "en",
          [customerName, appt.service.name, appt.staff.name, timeStr, businessName],
          config as { accessToken: string; phoneNumberId: string }
        );
        messageContent = `[1h reminder template sent to ${customerName}]`;
      } else {
        // Fallback plain text
        messageContent = `Hi ${customerName}! ⏰\n\nYour ${appt.service.name} with ${appt.staff.name} is in 1 hour at ${timeStr}. See you soon! — ${businessName}`;
        await sendMetaMessage(appt.contact.phoneNumber, messageContent, "whatsapp", config);
      }

      await prisma.appointment.update({ where: { id: appt.id }, data: { reminder1hSentAt: new Date() } });
      await saveReminderMessage(appt.workspaceId, appt.contact.id, messageContent, "1h Reminder");
      await prisma.activityLog.create({
        data: {
          type: "REMINDER_SENT",
          content: `1h reminder sent for ${appt.service.name} with ${appt.staff.name} at ${timeStr}`,
          contactId: appt.contact.id,
          workspaceId: appt.workspaceId,
        },
      });
      console.log(`[Reminders 1h] ✅ ${appt.id} → ${appt.contact.phoneNumber}`);
    } catch (err: any) {
      console.error(`[Reminders 1h] ❌ ${appt.id}:`, err?.message || err);
    }
  }
}

// ── Post-Visit Follow-Up ───────────────────────────────────────────
// Fires 30min–4h after appointment endTime. Uses plain text — by this
// point the 1h reminder was sent today so the 24h session is open.

async function sendPostVisitFollowUps() {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 4 * 60 * 60 * 1000);  // up to 4h ago
  const windowEnd   = new Date(now.getTime() - 30 * 60 * 1000);       // at least 30min ago

  const appointments = await prisma.appointment.findMany({
    where: {
      endTime: { gte: windowStart, lte: windowEnd },
      status: { in: ["SCHEDULED", "CONFIRMED", "COMPLETED"] },
      followUpSentAt: null,
    },
    include: {
      contact:   { select: { id: true, name: true, phoneNumber: true } },
      service:   { select: { name: true } },
      staff:     { select: { name: true } },
      workspace: { select: { id: true, name: true } },
    },
  });

  if (appointments.length === 0) return;
  console.log(`[Follow-Up] Found ${appointments.length} appointment(s)`);

  for (const appt of appointments) {
    if (!appt.contact?.phoneNumber) continue;

    const waNumber = await getWaNumber(appt.workspaceId);
    if (!waNumber) continue;
    const config = getWhatsAppChannelConfig(waNumber);
    if (!config.accessToken || !config.phoneNumberId) continue;

    const businessName = appt.workspace?.name || "us";
    const customerName = appt.contact.name || "there";

    const message = [
      `Hi ${customerName}! 😊`,
      ``,
      `How was your ${appt.service.name} with ${appt.staff.name} today?`,
      ``,
      `We'd love to hear your feedback — and whenever you're ready to rebook, just reply to this message!`,
      ``,
      `— ${businessName}`,
    ].join("\n");

    try {
      await sendMetaMessage(appt.contact.phoneNumber, message, "whatsapp", config);
      await prisma.appointment.update({ where: { id: appt.id }, data: { followUpSentAt: new Date() } });
      await saveReminderMessage(appt.workspaceId, appt.contact.id, message, "Post-Visit Follow-Up");
      await prisma.activityLog.create({
        data: {
          type: "REMINDER_SENT",
          content: `Post-visit follow-up sent after ${appt.service.name} with ${appt.staff.name}`,
          contactId: appt.contact.id,
          workspaceId: appt.workspaceId,
        },
      });
      console.log(`[Follow-Up] ✅ ${appt.id} → ${appt.contact.phoneNumber}`);
    } catch (err: any) {
      console.error(`[Follow-Up] ❌ ${appt.id}:`, err?.message || err);
    }
  }
}

// ── Main scheduler tick ────────────────────────────────────────────

async function runReminderTick() {
  try {
    await send24hReminders();
    await send1hReminders();
    await sendPostVisitFollowUps();
  } catch (error) {
    console.error("[Reminders] Scheduler tick error:", error);
  }
}

// ── Socket.io emitter callback ─────────────────────────────────────

type ReminderEmitter = (workspaceId: string, message: any, conversationId: string) => void;
let globalReminderEmitter: ReminderEmitter | null = null;

export function setReminderEmitter(emitter: ReminderEmitter) {
  globalReminderEmitter = emitter;
}

// ── Start / Stop ───────────────────────────────────────────────────

let reminderInterval: ReturnType<typeof setInterval> | null = null;

export function startReminderScheduler() {
  if (reminderInterval) return;
  console.log(`[Reminders] Scheduler started — checking every ${REMINDER_INTERVAL_MS / 60000} minutes`);
  runReminderTick();
  reminderInterval = setInterval(runReminderTick, REMINDER_INTERVAL_MS);
}

export function stopReminderScheduler() {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
    console.log("[Reminders] Scheduler stopped");
  }
}
