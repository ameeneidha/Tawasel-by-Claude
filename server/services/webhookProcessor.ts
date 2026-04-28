import prisma from "../../src/lib/prisma.js";
import {
  buildIncomingWhatsAppMessagePayload,
  refreshBroadcastCampaignStats,
  sendMetaMessage,
  getWhatsAppChannelConfig,
  fetchInstagramContactProfile,
  INSTAGRAM_PROFILE_SYNC_TTL_MS,
} from "./meta.js";
import { getAIResponse } from "./ai.js";
import { normalizePhone, INSTAGRAM_INTEGRATION_ENABLED } from "../config.js";
import { getInstagramContactFallbackName } from "../utils/helpers.js";

export type WebhookEmitter = (room: string, event: string, data: any) => void;

export interface WebhookContext {
  emit: WebhookEmitter;
}

const instagramProfileHydrationQueue = new Set<string>();

function enqueueInstagramProfileHydration(
  ctx: WebhookContext,
  {
    contactId,
    workspaceId,
    instagramScopedUserId,
    accessToken,
  }: {
    contactId: string;
    workspaceId: string;
    instagramScopedUserId?: string | null;
    accessToken?: string | null;
  }
) {
  const normalizedScopedUserId = String(instagramScopedUserId || "").trim();
  const normalizedAccessToken = String(accessToken || "").trim();
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

      if (!currentContact) return;

      const hasCachedProfile =
        Boolean(currentContact.instagramUsername?.trim()) ||
        Boolean(currentContact.avatar?.trim()) ||
        (Boolean(currentContact.name?.trim()) &&
          currentContact.name.trim() !== getInstagramContactFallbackName(normalizedScopedUserId));

      const lastSyncAgeMs = currentContact.lastProfileSyncAt
        ? Date.now() - currentContact.lastProfileSyncAt.getTime()
        : Number.POSITIVE_INFINITY;

      if (hasCachedProfile && lastSyncAgeMs < INSTAGRAM_PROFILE_SYNC_TTL_MS) return;

      const profile = await fetchInstagramContactProfile(normalizedScopedUserId, normalizedAccessToken);
      if (!profile) return;

      const updatedContact = await prisma.contact.update({
        where: { id: contactId },
        data: {
          instagramScopedUserId: normalizedScopedUserId,
          instagramId: normalizedScopedUserId,
          instagramUsername: profile.username?.trim() || null,
          name: profile.name?.trim() || getInstagramContactFallbackName(normalizedScopedUserId),
          avatar: profile.profile_pic?.trim() || currentContact.avatar || null,
          instagramFollowerCount:
            typeof profile.follower_count === "number" ? profile.follower_count : null,
          instagramIsVerifiedUser:
            typeof profile.is_verified_user === "boolean" ? profile.is_verified_user : null,
          lastProfileSyncAt: new Date(),
        },
      });

      const relatedConversations = await prisma.conversation.findMany({
        where: { workspaceId, contactId },
        select: { id: true },
      });

      for (const conversation of relatedConversations) {
        ctx.emit(workspaceId, "conversation-updated", conversation.id);
      }

      ctx.emit(workspaceId, "contact-updated", { contactId: updatedContact.id });
    } catch (error) {
      console.error("[instagram-profile-sync:queue-failure]", error);
    } finally {
      instagramProfileHydrationQueue.delete(queueKey);
    }
  }, 0);
}

export async function processMetaWebhook(body: any, ctx: WebhookContext): Promise<void> {
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
      if (!metaMessageId) continue;

      let recipient = await prisma.broadcastRecipient.findFirst({
        where: { metaMessageId },
      });

      if (!recipient && receipt?.recipient_id && metadata?.display_phone_number) {
        const workspaceNumbers = await prisma.whatsAppNumber.findMany();
        const displayDigits = normalizePhone(metadata.display_phone_number);
        const receiptChannel = workspaceNumbers.find(
          (candidate) =>
            (candidate.metaPhoneNumberId && candidate.metaPhoneNumberId === metadata?.phone_number_id) ||
            normalizePhone(candidate.phoneNumber) === displayDigits
        );

        if (receiptChannel) {
          const fallbackRecipients = await prisma.broadcastRecipient.findMany({
            where: {
              campaign: { workspaceId: receiptChannel.workspaceId },
              status: { in: ["SENT", "DELIVERED"] },
            },
            include: {
              campaign: { select: { scheduledAt: true } },
            },
          });

          const recipientDigits = normalizePhone(receipt.recipient_id);
          recipient =
            fallbackRecipients
              .filter((candidate) => normalizePhone(candidate.phoneNumber) === recipientDigits)
              .sort((a, b) => {
                const aTime = a.campaign.scheduledAt ? new Date(a.campaign.scheduledAt).getTime() : 0;
                const bTime = b.campaign.scheduledAt ? new Date(b.campaign.scheduledAt).getTime() : 0;
                return bTime - aTime;
              })[0] ?? null;
        }
      }

      if (!recipient) continue;

      const nextStatus =
        receipt.status === "read"
          ? "READ"
          : receipt.status === "delivered"
          ? "DELIVERED"
          : receipt.status === "failed"
          ? "FAILED"
          : receipt.status === "sent"
          ? "SENT"
          : null;

      if (!nextStatus) continue;

      await prisma.broadcastRecipient.update({
        where: { id: recipient.id },
        data: { status: nextStatus, metaMessageId },
      });

      await refreshBroadcastCampaignStats(recipient.campaignId);
    }

    // Update inbox message delivery status
    for (const receipt of statuses) {
      const metaMsgId = receipt?.id;
      if (!metaMsgId) continue;

      const nextMsgStatus =
        receipt.status === "read"
          ? "READ"
          : receipt.status === "delivered"
          ? "DELIVERED"
          : receipt.status === "failed"
          ? "FAILED"
          : receipt.status === "sent"
          ? "SENT"
          : null;

      if (!nextMsgStatus) continue;

      const inboxMsg = await prisma.message.findFirst({
        where: { metaMessageId: metaMsgId },
        include: { conversation: true },
      });

      if (inboxMsg) {
        const statusOrder: Record<string, number> = { SENT: 1, DELIVERED: 2, READ: 3, FAILED: 0 };
        const currentOrder = statusOrder[inboxMsg.status] || 0;
        const newOrder = statusOrder[nextMsgStatus] || 0;

        if (newOrder > currentOrder || nextMsgStatus === "FAILED") {
          await prisma.message.update({
            where: { id: inboxMsg.id },
            data: { status: nextMsgStatus },
          });

          ctx.emit(inboxMsg.conversation.workspaceId, "message-status-updated", {
            messageId: inboxMsg.id,
            conversationId: inboxMsg.conversationId,
            status: nextMsgStatus,
          });
        }
      }
    }

    if (message) {
      const incomingPayload = buildIncomingWhatsAppMessagePayload(message);
      if (!incomingPayload) return;

      const referral = message?.referral || (value as any)?.referral;

      const from = message.from;
      const phoneNumberId = metadata?.phone_number_id;
      const displayPhoneNumber = metadata?.display_phone_number;

      const numbers = await prisma.whatsAppNumber.findMany();
      const displayDigits = normalizePhone(displayPhoneNumber);
      const number = numbers.find(
        (candidate) =>
          (candidate.metaPhoneNumberId && candidate.metaPhoneNumberId === phoneNumberId) ||
          normalizePhone(candidate.phoneNumber) === displayDigits
      );

      if (number) {
        let contact = await prisma.contact.findFirst({
          where: { workspaceId: number.workspaceId, phoneNumber: from },
        });

        const CAMPAIGN_PREFIXES: Record<string, string> = {
          SC: "Snapchat", GG: "Google", TT: "TikTok",
          FB: "Facebook", IG: "Instagram", TW: "Twitter",
          YT: "YouTube", LI: "LinkedIn", EM: "Email",
          WB: "Website", QR: "QR Code", RF: "Referral",
        };
        const campaignCodeMatch = incomingPayload.content?.match(/\b([A-Z]{2})-([A-Z0-9_-]{2,30})\b/);
        const campaignPlatform = campaignCodeMatch ? CAMPAIGN_PREFIXES[campaignCodeMatch[1]] : null;
        const campaignCode = campaignCodeMatch ? campaignCodeMatch[0] : null;

        const adLeadSource = referral
          ? `Ad: ${referral.headline || referral.body || referral.source_type || "Click-to-WhatsApp"}`
          : campaignPlatform
          ? `${campaignPlatform}: ${campaignCodeMatch![2]}`
          : null;

        if (!contact) {
          contact = await prisma.contact.create({
            data: {
              name: value.contacts?.[0]?.profile?.name || from,
              phoneNumber: from,
              workspaceId: number.workspaceId,
              lastActivityAt: new Date(),
              ...(adLeadSource && {
                leadSource: adLeadSource,
                tags: campaignCode ? `campaign,${campaignCode}` : `ad-lead`,
                lastCampaignId: referral?.source_id || campaignCode || null,
              }),
            },
          });

          if (adLeadSource) {
            await prisma.activityLog.create({
              data: {
                type: "LEAD_SOURCE",
                content: campaignCode
                  ? `Lead from campaign: ${campaignPlatform} (${campaignCode})`
                  : `Lead from ad: ${adLeadSource}`,
                contactId: contact.id,
                workspaceId: number.workspaceId,
              },
            });
          }
        } else {
          contact = await prisma.contact.update({
            where: { id: contact.id },
            data: {
              lastActivityAt: new Date(),
              ...(adLeadSource && !contact.leadSource && {
                leadSource: adLeadSource,
                lastCampaignId: referral?.source_id || campaignCode || null,
              }),
            },
          });
        }

        let conversation = await prisma.conversation.findFirst({
          where: {
            workspaceId: number.workspaceId,
            contactId: contact.id,
            channelType: "WHATSAPP",
          },
        });

        if (!conversation) {
          conversation = await prisma.conversation.create({
            data: {
              workspaceId: number.workspaceId,
              contactId: contact.id,
              numberId: number.id,
              channelType: "WHATSAPP",
              status: "ACTIVE",
              lastMessageAt: new Date(),
            },
          });
        } else {
          conversation = await prisma.conversation.update({
            where: { id: conversation.id },
            data: { lastMessageAt: new Date() },
          });
        }

        // Auto-assign
        if (!conversation.assignedToId) {
          try {
            const assignmentRules = await prisma.assignmentRule.findMany({
              where: { workspaceId: number.workspaceId, enabled: true },
              orderBy: { priority: "desc" },
            });

            for (const rule of assignmentRules) {
              const conditions = JSON.parse(rule.conditions || "{}");
              const agentIds: string[] = JSON.parse(rule.agentIds || "[]");
              if (agentIds.length === 0) continue;

              let matches = false;

              if (rule.strategy === "ROUND_ROBIN") {
                matches = true;
              } else if (rule.strategy === "LEAD_SOURCE" && contact.leadSource) {
                const prefix = conditions.leadSourcePrefix || "";
                matches = prefix && contact.leadSource.toLowerCase().includes(prefix.toLowerCase());
              } else if (rule.strategy === "KEYWORD" && incomingPayload.content) {
                const kw = conditions.keyword || "";
                matches = kw && incomingPayload.content.toLowerCase().includes(kw.toLowerCase());
              }

              if (matches) {
                const assignToId = agentIds[rule.currentIndex % agentIds.length];
                await prisma.assignmentRule.update({
                  where: { id: rule.id },
                  data: { currentIndex: (rule.currentIndex + 1) % agentIds.length },
                });
                conversation = await prisma.conversation.update({
                  where: { id: conversation.id },
                  data: { assignedToId: assignToId },
                });
                await prisma.activityLog.create({
                  data: {
                    type: "AUTOMATION",
                    content: `Auto-assigned by rule "${rule.name}"`,
                    conversationId: conversation.id,
                    contactId: contact.id,
                    workspaceId: number.workspaceId,
                  },
                });
                break;
              }
            }
          } catch (e) {
            console.error("[assignment-rules] Error:", e);
          }
        }

        // Auto-enroll in follow-up sequences
        {
          const triggerTypes = ["NEW_LEAD"];
          if (adLeadSource) triggerTypes.push("AD_LEAD");
          try {
            const sequences = await prisma.followUpSequence.findMany({
              where: { workspaceId: number.workspaceId, enabled: true, triggerType: { in: triggerTypes } },
              include: { steps: { orderBy: { position: "asc" } } },
            });
            for (const seq of sequences) {
              if (seq.steps.length === 0) continue;
              const existing = await prisma.followUpEnrollment.findUnique({
                where: { sequenceId_contactId: { sequenceId: seq.id, contactId: contact.id } },
              });
              if (!existing) {
                const firstDelay = seq.steps[0].delayHours;
                await prisma.followUpEnrollment.create({
                  data: {
                    sequenceId: seq.id,
                    contactId: contact.id,
                    conversationId: conversation.id,
                    workspaceId: number.workspaceId,
                    nextStepDueAt: new Date(Date.now() + firstDelay * 60 * 60 * 1000),
                  },
                });
              }
            }
          } catch (e) {
            console.error("[follow-up-enroll] Error:", e);
          }
        }

        // Quote reply
        let incomingReplyToId: string | null = null;
        const quotedMetaId = message?.context?.id;
        if (quotedMetaId) {
          const quotedMsg = await prisma.message.findFirst({
            where: { metaMessageId: quotedMetaId, conversationId: conversation.id },
          });
          if (quotedMsg) incomingReplyToId = quotedMsg.id;
        }

        const newMsg = await prisma.message.create({
          data: {
            conversationId: conversation.id,
            content: incomingPayload.content,
            type: incomingPayload.type,
            mediaId: incomingPayload.type === "TEXT" ? null : incomingPayload.mediaId,
            mediaMimeType: incomingPayload.type === "TEXT" ? null : incomingPayload.mediaMimeType,
            mediaFilename: incomingPayload.type === "TEXT" ? null : incomingPayload.mediaFilename,
            direction: "INCOMING",
            senderType: "USER",
            metaMessageId: message?.id || null,
            replyToId: incomingReplyToId,
            status: "READ",
            readAt: null,
          },
        });

        const repliedRecipient = await prisma.broadcastRecipient.findFirst({
          where: {
            phoneNumber: from,
            status: { in: ["SENT", "DELIVERED", "READ"] },
            campaign: { workspaceId: number.workspaceId, numberId: number.id },
          },
          include: { campaign: { select: { scheduledAt: true } } },
          orderBy: { campaign: { scheduledAt: "desc" } },
        });

        if (repliedRecipient) {
          await prisma.broadcastRecipient.update({
            where: { id: repliedRecipient.id },
            data: { status: "REPLIED" },
          });
          await refreshBroadcastCampaignStats(repliedRecipient.campaignId);
        }

        ctx.emit(number.workspaceId, "new-message", newMsg);
        ctx.emit(number.workspaceId, "conversation-updated", conversation.id);

        // AI Chatbot
        if (!conversation.aiPaused && number.autoReply && number.chatbotId && incomingPayload.aiInput) {
          const chatbot = await prisma.chatbot.findFirst({
            where: { id: number.chatbotId, workspaceId: number.workspaceId },
          });
          if (chatbot && chatbot.enabled) {
            const aiResult = await getAIResponse(chatbot, incomingPayload.aiInput, {
              workspaceId: number.workspaceId,
              contactId: contact.id,
              conversationId: conversation.id,
            });
            if (aiResult.text) {
              const whatsAppConfig = getWhatsAppChannelConfig(number);
              try {
                const aiMetaMsgId = await sendMetaMessage(from, aiResult.text, "whatsapp", {
                  accessToken: whatsAppConfig.accessToken,
                  phoneNumberId: whatsAppConfig.phoneNumberId || phoneNumberId,
                });

                const aiMsg = await prisma.message.create({
                  data: {
                    conversationId: conversation.id,
                    content: aiResult.text,
                    direction: "OUTGOING",
                    senderType: "AI_BOT",
                    senderName: chatbot.name,
                    metaMessageId: aiMetaMsgId || null,
                    status: "SENT",
                  },
                });

                ctx.emit(number.workspaceId, "new-message", aiMsg);
              } catch (error: any) {
                console.error("WhatsApp AI auto-reply failed:", error?.message || error);
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

                ctx.emit(number.workspaceId, "new-message", failedAiMsg);
              }
            }

            if (aiResult.escalated) {
              console.log(`[AI Escalation] Conversation ${conversation.id} escalated: ${aiResult.escalationReason}`);

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
                  contactId: contact.id,
                  workspaceId: number.workspaceId,
                  conversationId: conversation.id,
                },
              });

              ctx.emit(number.workspaceId, "ai-escalation", {
                conversationId: conversation.id,
                contactName: contact.name || contact.phoneNumber || "Unknown",
                reason: aiResult.escalationReason,
                timestamp: new Date().toISOString(),
              });

              ctx.emit(number.workspaceId, "conversation-updated", conversation.id);
            }
          }
        }
      }
    }
  }

  // Process incoming messages from Instagram.
  // Meta may deliver these as object="instagram" or object="page"
  // when the app subscribes through the linked Facebook Page.
  if (body.object === "instagram" || body.object === "page") {
    if (!INSTAGRAM_INTEGRATION_ENABLED) return;

    const entry = body.entry?.[0];
    const messaging = entry?.messaging?.[0];
    const senderId = String(messaging?.sender?.id || "").trim();
    const recipientId = String(messaging?.recipient?.id || "").trim();
    const entryId = String(entry?.id || "").trim();
    const message = messaging?.message;
    const isEcho =
      Boolean(message?.is_echo) ||
      Boolean(messaging?.message_echo) ||
      Boolean(messaging?.is_echo);

    if (message && message.text) {
      const text = message.text;

      const account = await prisma.instagramAccount.findFirst({
        where: {
          OR: [
            recipientId ? { instagramId: recipientId } : undefined,
            recipientId ? { pageId: recipientId } : undefined,
            entryId ? { instagramId: entryId } : undefined,
            entryId ? { pageId: entryId } : undefined,
          ].filter(Boolean) as any,
        },
      });

      if (account) {
        const senderIsBusiness =
          senderId === account.instagramId ||
          senderId === account.pageId ||
          senderId === entryId;

        if (isEcho || senderIsBusiness) {
          console.log("[instagram-webhook] Ignored outbound echo", {
            object: body.object,
            entryId: entryId || null,
            senderId: senderId || null,
            recipientId: recipientId || null,
            isEcho,
          });
          return;
        }

        let contact = await prisma.contact.findFirst({
          where: {
            workspaceId: account.workspaceId,
            OR: [{ instagramScopedUserId: senderId }, { instagramId: senderId }],
          },
        });

        if (!contact) {
          contact = await prisma.contact.create({
            data: {
              name: getInstagramContactFallbackName(senderId),
              instagramId: senderId,
              instagramScopedUserId: senderId,
              workspaceId: account.workspaceId,
              lastActivityAt: new Date(),
            },
          });
        } else {
          contact = await prisma.contact.update({
            where: { id: contact.id },
            data: {
              instagramId: contact.instagramId || senderId,
              instagramScopedUserId: contact.instagramScopedUserId || senderId,
              name: contact.name?.trim() || getInstagramContactFallbackName(senderId),
              lastActivityAt: new Date(),
            },
          });
        }

        let conversation = await prisma.conversation.findFirst({
          where: {
            workspaceId: account.workspaceId,
            contactId: contact.id,
            channelType: "INSTAGRAM",
          },
        });

        if (!conversation) {
          conversation = await prisma.conversation.create({
            data: {
              workspaceId: account.workspaceId,
              contactId: contact.id,
              instagramAccountId: account.id,
              channelType: "INSTAGRAM",
              status: "ACTIVE",
              lastMessageAt: new Date(),
            },
          });
        }

        const newMsg = await prisma.message.create({
          data: {
            conversationId: conversation.id,
            content: text,
            direction: "INCOMING",
            senderType: "USER",
            status: "READ",
            readAt: null,
            metaMessageId: String(message?.mid || "").trim() || null,
          },
        });

        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { lastMessageAt: new Date() },
        });

        ctx.emit(account.workspaceId, "new-message", newMsg);
        ctx.emit(account.workspaceId, "conversation-updated", conversation.id);

        enqueueInstagramProfileHydration(ctx, {
          contactId: contact.id,
          workspaceId: account.workspaceId,
          instagramScopedUserId: senderId,
          accessToken:
            account.accessToken || process.env.INSTAGRAM_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN || "",
        });

        if (!conversation.aiPaused && account.chatbotId) {
          const chatbot = await prisma.chatbot.findFirst({
            where: { id: account.chatbotId, workspaceId: account.workspaceId },
          });
          if (chatbot && chatbot.enabled) {
            const aiResult = await getAIResponse(chatbot, text, {
              workspaceId: account.workspaceId,
              contactId: contact.id,
              conversationId: conversation.id,
            });
            if (aiResult.text) {
              try {
                await sendMetaMessage(senderId, aiResult.text, "instagram", {
                  accessToken:
                    account.accessToken ||
                    process.env.INSTAGRAM_ACCESS_TOKEN ||
                    process.env.META_ACCESS_TOKEN ||
                    "",
                  instagramId: account.instagramId,
                });

                const aiMsg = await prisma.message.create({
                  data: {
                    conversationId: conversation.id,
                    content: aiResult.text,
                    direction: "OUTGOING",
                    senderType: "AI_BOT",
                    senderName: chatbot.name,
                    status: "SENT",
                  },
                });

                ctx.emit(account.workspaceId, "new-message", aiMsg);
              } catch (error: any) {
                console.error("Instagram AI auto-reply failed:", error?.message || error);
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

                ctx.emit(account.workspaceId, "new-message", failedAiMsg);
              }
            }

            if (aiResult.escalated) {
              console.log(`[AI Escalation] Instagram conversation ${conversation.id} escalated: ${aiResult.escalationReason}`);

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
                  contactId: contact.id,
                  workspaceId: account.workspaceId,
                  conversationId: conversation.id,
                },
              });

              ctx.emit(account.workspaceId, "ai-escalation", {
                conversationId: conversation.id,
                contactName: contact.name || "Unknown",
                reason: aiResult.escalationReason,
                timestamp: new Date().toISOString(),
              });

              ctx.emit(account.workspaceId, "conversation-updated", conversation.id);
            }
          }
        }
      } else {
        console.warn("[instagram-webhook] No connected account matched incoming webhook", {
          object: body.object,
          entryId: entryId || null,
          recipientId: recipientId || null,
          senderId: senderId || null,
        });
      }
    }
  }
}
