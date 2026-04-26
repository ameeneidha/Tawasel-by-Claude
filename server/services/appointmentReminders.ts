import prisma from "../../src/lib/prisma.js";
import { sendMetaMessage, sendTemplateMessage, getWhatsAppChannelConfig } from "./meta.js";

// ── Appointment Reminder & Follow-Up Scheduler ────────────────────
// Runs every 30 minutes. Two modes:
//   1. Rules-based: reads AppointmentReminderRule rows per workspace (Phase 2)
//   2. Legacy hardcoded: 24h + 1h + post-visit (fires for workspaces with no rules)

const REMINDER_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const SCHEDULER_TOLERANCE_MS = 20 * 60 * 1000; // ±20 min window around target time

// Use the workspace timezone for all reminder formatting.
// Defaults to Asia/Dubai (UAE, UTC+4) — the primary market for Tawasel.
// TODO: store timezone per workspace and pass it in here.
const REMINDER_TIMEZONE = process.env.REMINDER_TIMEZONE || "Asia/Dubai";

function formatReminderTime(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: REMINDER_TIMEZONE });
}

function formatReminderDate(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: REMINDER_TIMEZONE });
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

// ── Helper: build default message body ────────────────────────────

function buildReminderBody(
  triggerType: string,
  offsetMinutes: number,
  customerName: string,
  serviceName: string,
  staffName: string,
  startTime: Date,
  businessName: string
): string {
  if (triggerType === "AFTER_END") {
    return [
      `Hi ${customerName}! 😊`,
      ``,
      `We hope your visit to *${businessName}* went well!`,
      ``,
      `We'd love to hear your feedback — and whenever you're ready to book again, just reply to this message.`,
    ].join("\n");
  }

  const hoursAway = Math.round(offsetMinutes / 60);
  const timeLabel =
    offsetMinutes >= 60 ? `${hoursAway} hour${hoursAway !== 1 ? "s" : ""}` : `${offsetMinutes} minutes`;

  if (offsetMinutes <= 120) {
    // Short reminder (≤2h) — concise
    return `Hi ${customerName}! ⏰\n\nReminder: your appointment at *${businessName}* with ${staffName} is in ${timeLabel} at ${formatReminderTime(startTime)}.\n\nSee you soon!`;
  }

  // Longer reminder — full details
  return [
    `Hi ${customerName}! 👋`,
    ``,
    `This is a reminder that you have an upcoming appointment at *${businessName}*:`,
    ``,
    `📅 *Date:* ${formatReminderDate(startTime)}`,
    `🕐 *Time:* ${formatReminderTime(startTime)}`,
    `👤 *With:* ${staffName}`,
    ``,
    `Need to reschedule? Just reply to this message.`,
  ].join("\n");
}

// ── Rules-Based Reminder Pass ──────────────────────────────────────
// For each enabled rule, find appointments whose trigger window overlaps
// now, and where no log entry exists yet for that rule+appointment pair.

async function runRulesBasedReminders() {
  const now = new Date();

  const rules = await prisma.appointmentReminderRule.findMany({
    where: { enabled: true },
    select: {
      id: true,
      workspaceId: true,
      name: true,
      triggerType: true,
      offsetMinutes: true,
      templateName: true,
      messageBody: true,
    },
  });

  if (rules.length === 0) return;

  for (const rule of rules) {
    try {
      // Calculate target fire time window
      let windowStart: Date, windowEnd: Date;
      if (rule.triggerType === "BEFORE_START") {
        // We want appointments where: startTime ≈ now + offsetMinutes
        const target = now.getTime() + rule.offsetMinutes * 60000;
        windowStart = new Date(target - SCHEDULER_TOLERANCE_MS);
        windowEnd   = new Date(target + SCHEDULER_TOLERANCE_MS);
      } else {
        // AFTER_END: endTime ≈ now - offsetMinutes
        const target = now.getTime() - rule.offsetMinutes * 60000;
        windowStart = new Date(target - SCHEDULER_TOLERANCE_MS);
        windowEnd   = new Date(target + SCHEDULER_TOLERANCE_MS);
      }

      // Find appointments in the window for this workspace that haven't been logged yet
      const appointments = await prisma.appointment.findMany({
        where: {
          workspaceId: rule.workspaceId,
          status: { in: ["SCHEDULED", "CONFIRMED", ...(rule.triggerType === "AFTER_END" ? ["COMPLETED"] : [])] },
          ...(rule.triggerType === "BEFORE_START"
            ? { startTime: { gte: windowStart, lte: windowEnd } }
            : { endTime:   { gte: windowStart, lte: windowEnd } }),
          // Exclude appointments already handled by this rule
          reminderLogs: { none: { ruleId: rule.id } },
        },
        include: {
          contact:   { select: { id: true, name: true, phoneNumber: true } },
          service:   { select: { name: true, durationMin: true, price: true, currency: true } },
          staff:     { select: { name: true } },
          workspace: { select: { id: true, name: true } },
        },
      });

      if (appointments.length === 0) continue;
      console.log(`[Reminders Rule "${rule.name}"] Found ${appointments.length} appointment(s)`);

      const waNumber = await getWaNumber(rule.workspaceId);
      if (!waNumber) continue;
      const config = getWhatsAppChannelConfig(waNumber);
      if (!config.accessToken || !config.phoneNumberId) continue;

      for (const appt of appointments) {
        if (!appt.contact?.phoneNumber) continue;

        const customerName = appt.contact.name || "there";
        const businessName = appt.workspace?.name || "us";
        const startTime    = new Date(appt.startTime);
        const timeStr      = formatReminderTime(startTime);
        const dateStr      = `${formatReminderDate(startTime)} at ${timeStr}`;

        try {
          let messageContent: string;

          const tplName = rule.templateName?.trim();
          if (tplName) {
            // Template specified — always try it directly without checking local DB status.
            // Local DB may be stale (PENDING) even though Meta already approved it.
            // Parameter order matches the standard tawasel_reminder templates:
            //   {{1}} customer_name, {{2}} business, {{3}} staff, {{4}} date/time
            const tplParams = rule.triggerType === "BEFORE_START"
              ? [customerName, businessName, appt.staff.name, dateStr]
              : [customerName, businessName, appt.staff.name, timeStr];

            await sendTemplateMessage(
              appt.contact.phoneNumber,
              tplName,
              "en_US",
              tplParams,
              config as { accessToken: string; phoneNumberId: string }
            );
            messageContent = `[${rule.name} template "${tplName}" sent to ${customerName}]`;
          } else {
            // No template — use plain text (only works within open 24h session window)
            messageContent =
              rule.messageBody?.trim() ||
              buildReminderBody(rule.triggerType, rule.offsetMinutes, customerName,
                appt.service.name, appt.staff.name, startTime, businessName);
            // Replace placeholders in custom body
            messageContent = messageContent
              .replace(/\{\{customer_name\}\}/gi, customerName)
              .replace(/\{\{service\}\}/gi, appt.service.name)
              .replace(/\{\{staff\}\}/gi, appt.staff.name)
              .replace(/\{\{date\}\}/gi, formatReminderDate(startTime))
              .replace(/\{\{time\}\}/gi, timeStr)
              .replace(/\{\{business\}\}/gi, businessName);

            await sendMetaMessage(appt.contact.phoneNumber, messageContent, "whatsapp", config);
          }

          // Mark as sent — upsert is safe against race conditions
          await prisma.appointmentReminderLog.upsert({
            where: { ruleId_appointmentId: { ruleId: rule.id, appointmentId: appt.id } },
            update: { sentAt: new Date() },
            create: { ruleId: rule.id, appointmentId: appt.id },
          });

          await saveReminderMessage(appt.workspaceId, appt.contact.id, messageContent, rule.name);
          await prisma.activityLog.create({
            data: {
              type: "REMINDER_SENT",
              content: `Reminder "${rule.name}" sent for ${appt.service.name} with ${appt.staff.name}`,
              contactId: appt.contact.id,
              workspaceId: appt.workspaceId,
            },
          });
          console.log(`[Reminders Rule "${rule.name}"] ✅ ${appt.id} → ${appt.contact.phoneNumber}`);
        } catch (err: any) {
          console.error(`[Reminders Rule "${rule.name}"] ❌ ${appt.id}:`, err?.message || err);
        }
      }
    } catch (err: any) {
      console.error(`[Reminders] Rule ${rule.id} error:`, err?.message || err);
    }
  }
}

// ── Legacy Hardcoded Reminders ─────────────────────────────────────
// Only fires for workspaces that have NO reminder rules configured.
// This ensures existing workspaces keep getting 24h + 1h reminders
// until they set up their own rules.

async function getLegacyWorkspaceIds(): Promise<string[]> {
  // Workspaces with at least one enabled rule handle their own reminders
  const withRules = await prisma.appointmentReminderRule.findMany({
    where: { enabled: true },
    select: { workspaceId: true },
    distinct: ["workspaceId"],
  });
  const ruleWorkspaceIds = new Set(withRules.map((r) => r.workspaceId));

  const allWorkspaces = await prisma.workspace.findMany({
    where: { suspended: false },
    select: { id: true },
  });
  return allWorkspaces.map((w) => w.id).filter((id) => !ruleWorkspaceIds.has(id));
}

async function send24hReminders() {
  const legacyIds = await getLegacyWorkspaceIds();
  if (legacyIds.length === 0) return;

  const now = new Date();
  const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);
  const windowEnd   = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  const appointments = await prisma.appointment.findMany({
    where: {
      workspaceId: { in: legacyIds },
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
  console.log(`[Reminders 24h] Found ${appointments.length} appointment(s) (legacy workspaces)`);

  for (const appt of appointments) {
    if (!appt.contact?.phoneNumber) continue;
    const waNumber = await getWaNumber(appt.workspaceId);
    if (!waNumber) continue;
    const config = getWhatsAppChannelConfig(waNumber);
    if (!config.accessToken || !config.phoneNumberId) continue;

    const startTime    = new Date(appt.startTime);
    const customerName = appt.contact.name || "there";
    const businessName = appt.workspace?.name || "us";
    const dateTimeStr  = `${formatReminderDate(startTime)} at ${formatReminderTime(startTime)}`;

    try {
      const useTemplate = await hasApprovedTemplate(appt.workspaceId, "tawasel_reminder_24h");
      let messageContent: string;

      if (useTemplate) {
        await sendTemplateMessage(appt.contact.phoneNumber, "tawasel_reminder_24h", "en_US",
          [customerName, businessName, appt.staff.name, dateTimeStr],
          config as { accessToken: string; phoneNumberId: string }
        );
        messageContent = `[24h reminder template sent to ${customerName}]`;
      } else {
        messageContent = buildReminderBody("BEFORE_START", 1440, customerName,
          appt.service.name, appt.staff.name, startTime, businessName);
        await sendMetaMessage(appt.contact.phoneNumber, messageContent, "whatsapp", config);
      }

      await prisma.appointment.update({ where: { id: appt.id }, data: { reminderSentAt: new Date() } });
      await saveReminderMessage(appt.workspaceId, appt.contact.id, messageContent, "24h Reminder");
      await prisma.activityLog.create({
        data: { type: "REMINDER_SENT", content: `24h reminder sent for ${appt.service.name} with ${appt.staff.name} on ${dateTimeStr}`, contactId: appt.contact.id, workspaceId: appt.workspaceId },
      });
      console.log(`[Reminders 24h] ✅ ${appt.id} → ${appt.contact.phoneNumber}`);
    } catch (err: any) {
      console.error(`[Reminders 24h] ❌ ${appt.id}:`, err?.message || err);
    }
  }
}

async function send1hReminders() {
  const legacyIds = await getLegacyWorkspaceIds();
  if (legacyIds.length === 0) return;

  const now = new Date();
  const windowStart = new Date(now.getTime() + 45 * 60 * 1000);
  const windowEnd   = new Date(now.getTime() + 90 * 60 * 1000);

  const appointments = await prisma.appointment.findMany({
    where: {
      workspaceId: { in: legacyIds },
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
  console.log(`[Reminders 1h] Found ${appointments.length} appointment(s) (legacy workspaces)`);

  for (const appt of appointments) {
    if (!appt.contact?.phoneNumber) continue;
    const waNumber = await getWaNumber(appt.workspaceId);
    if (!waNumber) continue;
    const config = getWhatsAppChannelConfig(waNumber);
    if (!config.accessToken || !config.phoneNumberId) continue;

    const startTime    = new Date(appt.startTime);
    const customerName = appt.contact.name || "there";
    const businessName = appt.workspace?.name || "us";

    try {
      const useTemplate = await hasApprovedTemplate(appt.workspaceId, "tawasel_reminder_1h");
      let messageContent: string;

      if (useTemplate) {
        await sendTemplateMessage(appt.contact.phoneNumber, "tawasel_reminder_1h", "en_US",
          [customerName, businessName, appt.staff.name, formatReminderTime(startTime)],
          config as { accessToken: string; phoneNumberId: string }
        );
        messageContent = `[1h reminder template sent to ${customerName}]`;
      } else {
        messageContent = buildReminderBody("BEFORE_START", 60, customerName,
          appt.service.name, appt.staff.name, startTime, businessName);
        await sendMetaMessage(appt.contact.phoneNumber, messageContent, "whatsapp", config);
      }

      await prisma.appointment.update({ where: { id: appt.id }, data: { reminder1hSentAt: new Date() } });
      await saveReminderMessage(appt.workspaceId, appt.contact.id, messageContent, "1h Reminder");
      await prisma.activityLog.create({
        data: { type: "REMINDER_SENT", content: `1h reminder sent for ${appt.service.name} with ${appt.staff.name}`, contactId: appt.contact.id, workspaceId: appt.workspaceId },
      });
      console.log(`[Reminders 1h] ✅ ${appt.id} → ${appt.contact.phoneNumber}`);
    } catch (err: any) {
      console.error(`[Reminders 1h] ❌ ${appt.id}:`, err?.message || err);
    }
  }
}

async function sendPostVisitFollowUps() {
  const legacyIds = await getLegacyWorkspaceIds();
  if (legacyIds.length === 0) return;

  const now = new Date();
  const windowStart = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  const windowEnd   = new Date(now.getTime() - 30 * 60 * 1000);

  const appointments = await prisma.appointment.findMany({
    where: {
      workspaceId: { in: legacyIds },
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
  console.log(`[Follow-Up] Found ${appointments.length} appointment(s) (legacy workspaces)`);

  for (const appt of appointments) {
    if (!appt.contact?.phoneNumber) continue;
    const waNumber = await getWaNumber(appt.workspaceId);
    if (!waNumber) continue;
    const config = getWhatsAppChannelConfig(waNumber);
    if (!config.accessToken || !config.phoneNumberId) continue;

    const startTime    = new Date(appt.startTime);
    const customerName = appt.contact.name || "there";
    const businessName = appt.workspace?.name || "us";

    const message = buildReminderBody("AFTER_END", 30, customerName,
      appt.service.name, appt.staff.name, startTime, businessName);

    try {
      await sendMetaMessage(appt.contact.phoneNumber, message, "whatsapp", config);
      await prisma.appointment.update({ where: { id: appt.id }, data: { followUpSentAt: new Date() } });
      await saveReminderMessage(appt.workspaceId, appt.contact.id, message, "Post-Visit Follow-Up");
      await prisma.activityLog.create({
        data: { type: "REMINDER_SENT", content: `Post-visit follow-up sent after ${appt.service.name} with ${appt.staff.name}`, contactId: appt.contact.id, workspaceId: appt.workspaceId },
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
    await runRulesBasedReminders();  // Phase 2: rules from DB
    await send24hReminders();        // Legacy: workspaces with no rules
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
