import prisma from "../../src/lib/prisma.js";
import { sendMetaMessage, getWhatsAppChannelConfig } from "./meta.js";

// ── Appointment Reminder Scheduler ──────────────────────────────────
// Runs every 30 minutes, finds appointments in the next 24 hours
// that haven't had a reminder sent yet, and sends WhatsApp messages.

const REMINDER_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const REMINDER_WINDOW_HOURS = 24;

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

async function sendAppointmentReminders() {
  try {
    const now = new Date();
    const reminderCutoff = new Date(
      now.getTime() + REMINDER_WINDOW_HOURS * 60 * 60 * 1000
    );

    // Find appointments starting within the next 24 hours
    // that are SCHEDULED or CONFIRMED, haven't been reminded, and haven't been cancelled
    const upcomingAppointments = await prisma.appointment.findMany({
      where: {
        startTime: {
          gt: now,
          lte: reminderCutoff,
        },
        status: { in: ["SCHEDULED", "CONFIRMED"] },
        reminderSentAt: null,
      },
      include: {
        contact: {
          select: { id: true, name: true, phoneNumber: true },
        },
        service: {
          select: { name: true, durationMin: true, price: true, currency: true },
        },
        staff: {
          select: { name: true },
        },
        workspace: {
          select: {
            id: true,
            name: true,
            businessSettings: {
              select: { timezone: true },
            },
          },
        },
      },
    });

    if (upcomingAppointments.length === 0) return;

    console.log(
      `[Reminders] Found ${upcomingAppointments.length} appointment(s) to remind`
    );

    for (const appt of upcomingAppointments) {
      // Skip if contact has no phone number
      if (!appt.contact?.phoneNumber) {
        console.log(
          `[Reminders] Skipping ${appt.id} — no phone number for contact`
        );
        continue;
      }

      // Find a WhatsApp number for this workspace to send from
      const whatsappNumber = await prisma.whatsAppNumber.findFirst({
        where: { workspaceId: appt.workspaceId },
        select: {
          id: true,
          metaAccessToken: true,
          metaPhoneNumberId: true,
        },
      });

      if (!whatsappNumber) {
        console.log(
          `[Reminders] Skipping ${appt.id} — no WhatsApp number configured for workspace`
        );
        continue;
      }

      const config = getWhatsAppChannelConfig(whatsappNumber);
      if (!config.accessToken || !config.phoneNumberId) {
        console.log(
          `[Reminders] Skipping ${appt.id} — WhatsApp not fully configured`
        );
        continue;
      }

      // Build reminder message
      const startTime = new Date(appt.startTime);
      const businessName = appt.workspace?.name || "our clinic";
      const customerName = appt.contact.name || "there";

      const message = [
        `Hi ${customerName}! 👋`,
        ``,
        `This is a friendly reminder about your upcoming appointment:`,
        ``,
        `📋 *Service:* ${appt.service.name}`,
        `👤 *With:* ${appt.staff.name}`,
        `📅 *Date:* ${formatReminderDate(startTime)}`,
        `🕐 *Time:* ${formatReminderTime(startTime)}`,
        `⏱️ *Duration:* ${appt.service.durationMin} minutes`,
        appt.service.price > 0
          ? `💰 *Price:* ${appt.service.price} ${appt.service.currency}`
          : "",
        ``,
        `If you need to reschedule or cancel, please reply to this message.`,
        ``,
        `See you soon! — ${businessName}`,
      ]
        .filter(Boolean)
        .join("\n");

      try {
        await sendMetaMessage(
          appt.contact.phoneNumber,
          message,
          "whatsapp",
          config
        );

        // Mark reminder as sent
        await prisma.appointment.update({
          where: { id: appt.id },
          data: { reminderSentAt: new Date() },
        });

        // Save the reminder as a message in the conversation
        const conversation = await prisma.conversation.findFirst({
          where: {
            workspaceId: appt.workspaceId,
            contactId: appt.contact.id,
            channelType: "WHATSAPP",
          },
        });

        if (conversation) {
          const reminderMsg = await prisma.message.create({
            data: {
              conversationId: conversation.id,
              content: message,
              direction: "OUTGOING",
              senderType: "AI_BOT",
              senderName: "Appointment Reminder",
              status: "SENT",
            },
          });

          // Import io dynamically to avoid circular deps — we'll use a callback
          if (globalReminderEmitter) {
            globalReminderEmitter(appt.workspaceId, reminderMsg, conversation.id);
          }
        }

        // Log activity
        await prisma.activityLog.create({
          data: {
            type: "REMINDER_SENT",
            content: `Appointment reminder sent: ${appt.service.name} with ${appt.staff.name} on ${formatReminderDate(startTime)} at ${formatReminderTime(startTime)}`,
            contactId: appt.contact.id,
            workspaceId: appt.workspaceId,
          },
        });

        console.log(
          `[Reminders] ✅ Sent reminder for appointment ${appt.id} to ${appt.contact.phoneNumber}`
        );
      } catch (error: any) {
        console.error(
          `[Reminders] ❌ Failed to send reminder for ${appt.id}:`,
          error?.message || error
        );
      }
    }
  } catch (error) {
    console.error("[Reminders] Scheduler error:", error);
  }
}

// ── Socket.io emitter callback (set from server.ts to avoid circular imports) ──

type ReminderEmitter = (
  workspaceId: string,
  message: any,
  conversationId: string
) => void;

let globalReminderEmitter: ReminderEmitter | null = null;

export function setReminderEmitter(emitter: ReminderEmitter) {
  globalReminderEmitter = emitter;
}

// ── Start/Stop ─────────────────────────────────────────────────────

let reminderInterval: ReturnType<typeof setInterval> | null = null;

export function startReminderScheduler() {
  if (reminderInterval) return;

  console.log(
    `[Reminders] Scheduler started — checking every ${REMINDER_INTERVAL_MS / 60000} minutes`
  );

  // Run immediately on start, then every 30 minutes
  sendAppointmentReminders();
  reminderInterval = setInterval(sendAppointmentReminders, REMINDER_INTERVAL_MS);
}

export function stopReminderScheduler() {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
    console.log("[Reminders] Scheduler stopped");
  }
}
