import prisma from "../../src/lib/prisma.js";
import { openai } from "../config.js";
import { getAIResponse } from "./ai.js";
import {
  downloadMetaMedia,
  getWhatsAppChannelConfig,
  sendMetaMessage,
} from "./meta.js";
import type { WebhookContext } from "./webhookProcessor.js";

export type AudioTranscriptionJobData = {
  messageId: string;
};

const TRANSCRIPTION_MODEL = process.env.OPENAI_TRANSCRIPTION_MODEL || "whisper-1";
const TRANSCRIPTION_LANGUAGE_HINT = (process.env.OPENAI_TRANSCRIPTION_LANGUAGE || "ar").trim();

function buildAudioFile(buffer: Buffer, filename: string, contentType: string) {
  return new File([buffer], filename, { type: contentType }) as any;
}

function getTranscriptText(result: any) {
  return String(result?.text || "").trim();
}

async function maybeRunAiForTranscribedMessage(message: any, ctx: WebhookContext) {
  const conversation = message.conversation;
  if (!conversation || conversation.aiPaused || message.direction !== "INCOMING") return;
  if (conversation.channelType !== "WHATSAPP") return;

  const number = conversation.number;
  if (!number?.autoReply || !number.chatbotId) return;

  const transcription = String(message.transcription || "").trim();
  if (!transcription) return;

  const chatbot = await prisma.chatbot.findFirst({
    where: { id: number.chatbotId, workspaceId: conversation.workspaceId },
  });
  if (!chatbot?.enabled) return;

  const aiResult = await getAIResponse(chatbot, transcription, {
    workspaceId: conversation.workspaceId,
    contactId: conversation.contactId,
    conversationId: conversation.id,
  });

  if (aiResult.text) {
    const config = getWhatsAppChannelConfig(number);
    const to = conversation.contact?.phoneNumber;

    try {
      const aiMetaMsgId = to
        ? await sendMetaMessage(to, aiResult.text, "whatsapp", {
            accessToken: config.accessToken,
            phoneNumberId: config.phoneNumberId || number.metaPhoneNumberId || undefined,
          })
        : undefined;

      const aiMsg = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          content: aiResult.text,
          direction: "OUTGOING",
          senderType: "AI_BOT",
          senderName: chatbot.name,
          metaMessageId: aiMetaMsgId || null,
          status: aiMetaMsgId ? "SENT" : "FAILED",
        },
      });

      ctx.emit(conversation.workspaceId, "new-message", aiMsg);
    } catch (error: any) {
      console.error("[transcription-ai] WhatsApp AI auto-reply failed:", error?.message || error);
      const failedAiMsg = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          content: aiResult.text,
          direction: "OUTGOING",
          senderType: "AI_BOT",
          senderName: chatbot.name,
          status: "FAILED",
        },
      });

      ctx.emit(conversation.workspaceId, "new-message", failedAiMsg);
    }
  }

  if (aiResult.escalated) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        aiPaused: true,
        internalStatus: "WAITING_FOR_INTERNAL",
        priority:
          conversation.priority === "LOW" || conversation.priority === "MEDIUM"
            ? "HIGH"
            : conversation.priority,
      },
    });

    await prisma.activityLog.create({
      data: {
        type: "AI_HANDOFF",
        content: `AI escalated to human agent. Reason: ${aiResult.escalationReason}`,
        contactId: conversation.contactId,
        workspaceId: conversation.workspaceId,
        conversationId: conversation.id,
      },
    });

    ctx.emit(conversation.workspaceId, "ai-escalation", {
      conversationId: conversation.id,
      contactName: conversation.contact?.name || conversation.contact?.phoneNumber || "Unknown",
      reason: aiResult.escalationReason,
      timestamp: new Date().toISOString(),
    });
    ctx.emit(conversation.workspaceId, "conversation-updated", conversation.id);
  }
}

export async function processAudioTranscription(
  data: AudioTranscriptionJobData,
  ctx: WebhookContext
) {
  const messageId = String(data?.messageId || "").trim();
  if (!messageId) return;

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      conversation: {
        include: {
          contact: true,
          number: true,
          instagramAccount: true,
        },
      },
    },
  });

  if (!message || message.type !== "AUDIO" || !message.mediaId) return;
  if (message.transcriptionStatus === "COMPLETED" && message.transcription?.trim()) return;

  await prisma.message.update({
    where: { id: message.id },
    data: {
      transcriptionStatus: "PENDING",
      transcriptionError: null,
    },
  });

  ctx.emit(message.conversation.workspaceId, "message-transcribed", {
    messageId: message.id,
    conversationId: message.conversationId,
    transcriptionStatus: "PENDING",
    transcription: null,
    transcriptionLang: null,
    transcriptionError: null,
  });

  try {
    if (!openai) {
      throw new Error("OpenAI is not configured");
    }

    const accessToken =
      message.conversation.channelType === "INSTAGRAM"
        ? message.conversation.instagramAccount?.pageAccessToken ||
          message.conversation.instagramAccount?.accessToken ||
          process.env.INSTAGRAM_ACCESS_TOKEN ||
          process.env.META_ACCESS_TOKEN ||
          ""
        : getWhatsAppChannelConfig(message.conversation.number).accessToken;

    if (!accessToken) {
      throw new Error("Meta media access token is not configured");
    }

    const media = await downloadMetaMedia(message.mediaId, accessToken);
    const contentType = message.mediaMimeType || media.contentType || "audio/ogg";
    const filename = message.mediaFilename || "voice-note.ogg";
    const file = buildAudioFile(media.buffer, filename, contentType);

    const transcriptionRequest: any = {
      file,
      model: TRANSCRIPTION_MODEL,
      response_format: "verbose_json",
    };
    if (TRANSCRIPTION_LANGUAGE_HINT) {
      transcriptionRequest.language = TRANSCRIPTION_LANGUAGE_HINT;
    }

    const result = await openai.audio.transcriptions.create(transcriptionRequest);
    const transcription = getTranscriptText(result);

    if (!transcription) {
      throw new Error("Transcription returned empty text");
    }

    const updatedMessage = await prisma.message.update({
      where: { id: message.id },
      data: {
        transcription,
        transcriptionLang: String((result as any)?.language || TRANSCRIPTION_LANGUAGE_HINT || "").trim() || null,
        transcriptionStatus: "COMPLETED",
        transcriptionError: null,
        transcribedAt: new Date(),
      },
      include: {
        conversation: {
          include: {
            contact: true,
            number: true,
            instagramAccount: true,
          },
        },
      },
    });

    ctx.emit(updatedMessage.conversation.workspaceId, "message-transcribed", {
      messageId: updatedMessage.id,
      conversationId: updatedMessage.conversationId,
      transcription: updatedMessage.transcription,
      transcriptionLang: updatedMessage.transcriptionLang,
      transcriptionStatus: updatedMessage.transcriptionStatus,
      transcriptionError: null,
      transcribedAt: updatedMessage.transcribedAt,
    });
    ctx.emit(updatedMessage.conversation.workspaceId, "conversation-updated", updatedMessage.conversationId);

    await maybeRunAiForTranscribedMessage(updatedMessage, ctx);
  } catch (error: any) {
    const errorMessage = error?.response?.data?.error?.message || error?.message || "Transcription failed";
    console.error("[transcription] failed:", errorMessage);

    const failedMessage = await prisma.message.update({
      where: { id: message.id },
      data: {
        transcriptionStatus: "FAILED",
        transcriptionError: errorMessage,
      },
    });

    ctx.emit(message.conversation.workspaceId, "message-transcribed", {
      messageId: failedMessage.id,
      conversationId: failedMessage.conversationId,
      transcriptionStatus: failedMessage.transcriptionStatus,
      transcriptionError: failedMessage.transcriptionError,
    });
  }
}
