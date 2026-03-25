import prisma from "../../src/lib/prisma.js";
import { getWhatsAppChannelConfig } from "./meta.js";
import { normalizePhone } from "../config.js";
import axios from "axios";

// ── Follow-up Sequence Scheduler ────────────────────────────────
// Runs every 5 minutes, processes due follow-up steps
// and sends WhatsApp template messages to enrolled contacts.

const FOLLOWUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let followUpTimer: ReturnType<typeof setInterval> | null = null;
let globalFollowUpEmitter: ((workspaceId: string, message: any, conversationId: string) => void) | null = null;

export function setFollowUpEmitter(
  emitter: (workspaceId: string, message: any, conversationId: string) => void
) {
  globalFollowUpEmitter = emitter;
}

async function processFollowUpSteps() {
  try {
    const now = new Date();

    // Find all active enrollments that are due
    const dueEnrollments = await prisma.followUpEnrollment.findMany({
      where: {
        status: "ACTIVE",
        nextStepDueAt: { lte: now },
      },
      include: {
        sequence: {
          include: { steps: { orderBy: { position: "asc" } } },
        },
      },
    });

    for (const enrollment of dueEnrollments) {
      try {
        const { sequence } = enrollment;
        const steps = sequence.steps;

        if (enrollment.currentStep >= steps.length) {
          // All steps done
          await prisma.followUpEnrollment.update({
            where: { id: enrollment.id },
            data: { status: "COMPLETED" },
          });
          continue;
        }

        // Check if the contact has replied since enrollment — if so, mark completed
        const recentReply = await prisma.message.findFirst({
          where: {
            conversationId: enrollment.conversationId,
            direction: "INCOMING",
            createdAt: { gt: enrollment.lastStepSentAt || enrollment.enrolledAt },
          },
        });

        if (recentReply) {
          await prisma.followUpEnrollment.update({
            where: { id: enrollment.id },
            data: { status: "COMPLETED" },
          });
          continue;
        }

        const step = steps[enrollment.currentStep];

        // Get the contact and conversation
        const contact = await prisma.contact.findUnique({
          where: { id: enrollment.contactId },
        });
        if (!contact?.phoneNumber) continue;

        const conversation = await prisma.conversation.findUnique({
          where: { id: enrollment.conversationId },
          include: { number: true },
        });
        if (!conversation?.number) continue;

        const config = getWhatsAppChannelConfig(conversation.number);
        if (!config.accessToken || !config.phoneNumberId) continue;

        const to = normalizePhone(contact.phoneNumber);
        if (!to) continue;

        // Send template message
        const graphVersion = process.env.META_GRAPH_VERSION || "v22.0";
        const templatePayload: any = {
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: step.templateName,
            language: { code: step.templateLanguage },
          },
        };

        // Check template for variables
        const dbTemplate = await prisma.whatsAppTemplate.findFirst({
          where: { workspaceId: enrollment.workspaceId, name: step.templateName },
        });
        const templateContent = dbTemplate?.content || "";
        const varMatches = templateContent.match(/\{\{\d+\}\}/g);
        const varCount = varMatches ? new Set(varMatches).size : 0;

        if (varCount > 0) {
          const parameters: { type: string; text: string }[] = [];
          for (let i = 0; i < varCount; i++) {
            if (i === 0 && contact.name) {
              parameters.push({ type: "text", text: contact.name });
            } else {
              parameters.push({ type: "text", text: contact.name || "" });
            }
          }
          templatePayload.template.components = [
            { type: "body", parameters },
          ];
        }

        const metaRes = await axios.post(
          `https://graph.facebook.com/${graphVersion}/${config.phoneNumberId}/messages`,
          templatePayload,
          { headers: { Authorization: `Bearer ${config.accessToken}` } }
        );

        const metaMessageId = metaRes.data?.messages?.[0]?.id;

        // Save message to conversation
        const savedMsg = await prisma.message.create({
          data: {
            content: `[Follow-up] Template: ${step.templateName}`,
            type: "TEMPLATE",
            direction: "OUTGOING",
            senderType: "SYSTEM",
            senderName: "Follow-up",
            status: "SENT",
            metaMessageId,
            conversationId: enrollment.conversationId,
          },
        });

        // Update conversation
        await prisma.conversation.update({
          where: { id: enrollment.conversationId },
          data: { lastMessageAt: new Date() },
        });

        // Update enrollment — advance to next step
        const nextStepIndex = enrollment.currentStep + 1;
        const nextStep = nextStepIndex < steps.length ? steps[nextStepIndex] : null;

        await prisma.followUpEnrollment.update({
          where: { id: enrollment.id },
          data: {
            currentStep: nextStepIndex,
            lastStepSentAt: new Date(),
            nextStepDueAt: nextStep
              ? new Date(Date.now() + nextStep.delayHours * 60 * 60 * 1000)
              : null,
            status: nextStep ? "ACTIVE" : "COMPLETED",
          },
        });

        // Emit to Socket.io
        if (globalFollowUpEmitter) {
          globalFollowUpEmitter(
            enrollment.workspaceId,
            savedMsg,
            enrollment.conversationId
          );
        }

        // Log activity
        await prisma.activityLog.create({
          data: {
            type: "AUTOMATION",
            content: `Follow-up step ${enrollment.currentStep + 1}: sent template "${step.templateName}"`,
            conversationId: enrollment.conversationId,
            contactId: enrollment.contactId,
            workspaceId: enrollment.workspaceId,
          },
        });

        console.log(
          `[follow-up] Sent step ${enrollment.currentStep + 1} of "${sequence.name}" to ${contact.phoneNumber}`
        );
      } catch (err: any) {
        console.error(
          `[follow-up] Error processing enrollment ${enrollment.id}:`,
          err.response?.data || err.message
        );
      }
    }
  } catch (err: any) {
    console.error("[follow-up] Scheduler error:", err.message);
  }
}

export function startFollowUpScheduler() {
  if (followUpTimer) return;
  followUpTimer = setInterval(processFollowUpSteps, FOLLOWUP_INTERVAL_MS);
  console.log("[Follow-ups] Scheduler started — checking every 5 minutes");
}

export function stopFollowUpScheduler() {
  if (followUpTimer) {
    clearInterval(followUpTimer);
    followUpTimer = null;
  }
}
