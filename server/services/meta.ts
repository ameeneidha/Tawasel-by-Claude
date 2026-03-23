import axios from "axios";
import prisma from "../../src/lib/prisma.js";
import { normalizePhone } from "../config.js";
import { wait } from "../utils/helpers.js";

// ── Types ──────────────────────────────────────────────────────────

export type WhatsAppMediaKind = "image" | "document" | "audio";

export type IncomingWhatsAppMessagePayload =
  | {
      type: "TEXT";
      content: string;
      aiInput: string | null;
    }
  | {
      type: "IMAGE" | "DOCUMENT" | "AUDIO";
      content: string;
      aiInput: string | null;
      mediaId: string;
      mediaMimeType?: string;
      mediaFilename?: string;
    };

export type EmbeddedSignupPhoneAsset = {
  wabaId: string | null;
  phoneNumberId: string;
  displayPhoneNumber: string;
  verifiedName?: string | null;
  businessName?: string | null;
};

export type EmbeddedSignupResultPayload = {
  success: boolean;
  error?: string;
  workspaceId?: string | null;
  businessId?: string | null;
  accessToken?: string | null;
  tokenExpiresAt?: string | null;
  phoneNumbers?: EmbeddedSignupPhoneAsset[];
};

// ── Constants ──────────────────────────────────────────────────────

export const META_GRAPH_VERSION =
  process.env.META_GRAPH_VERSION || "v22.0";

export const INSTAGRAM_PROFILE_SYNC_TTL_MS = 6 * 60 * 60 * 1000;
const INSTAGRAM_PROFILE_SYNC_MAX_RETRIES = 3;

// ── Channel Config ─────────────────────────────────────────────────

export const getWhatsAppChannelConfig = (
  number?: {
    metaAccessToken?: string | null;
    metaPhoneNumberId?: string | null;
  } | null
) => ({
  accessToken:
    number?.metaAccessToken?.trim() ||
    process.env.META_ACCESS_TOKEN ||
    "",
  phoneNumberId:
    number?.metaPhoneNumberId?.trim() ||
    process.env.META_PHONE_NUMBER_ID ||
    "",
});

// ── Embedded Signup ────────────────────────────────────────────────

export const parseEmbeddedSignupState = (state?: string | null) => {
  if (!state) return null;
  try {
    return JSON.parse(
      Buffer.from(state, "base64url").toString("utf8")
    ) as {
      workspaceId?: string;
      requestedAt?: string;
    };
  } catch {
    return null;
  }
};

export const buildEmbeddedSignupState = (workspaceId: string) =>
  Buffer.from(
    JSON.stringify({
      workspaceId,
      requestedAt: new Date().toISOString(),
    }),
    "utf8"
  ).toString("base64url");

export const formatMetaDisplayPhoneNumber = (
  phoneNumber?: string | null
) => {
  const trimmed = phoneNumber?.trim() || "";
  if (!trimmed) return "";
  if (trimmed.startsWith("+")) return trimmed;
  const digits = normalizePhone(trimmed);
  return digits ? `+${digits}` : trimmed;
};

export const getEmbeddedSignupRuntimeConfig = () => {
  const appId = String(process.env.META_APP_ID || "").trim();
  const appSecret = String(process.env.META_APP_SECRET || "").trim();
  const configId = String(
    process.env.META_EMBEDDED_SIGNUP_CONFIG_ID || ""
  ).trim();
  const missingKeys = [
    !appId ? "META_APP_ID" : null,
    !appSecret ? "META_APP_SECRET" : null,
    !configId ? "META_EMBEDDED_SIGNUP_CONFIG_ID" : null,
  ].filter(Boolean) as string[];

  return {
    appId,
    appSecret,
    configId,
    missingKeys,
    enabled: missingKeys.length === 0,
  };
};

export const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export async function exchangeMetaCodeForAccessToken(
  code: string,
  redirectUri: string
) {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error("Meta app credentials are not configured");
  }

  const response = await axios.get(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/oauth/access_token`,
    {
      params: {
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: redirectUri,
        code,
      },
    }
  );

  return response.data as {
    access_token: string;
    expires_in?: number;
    token_type?: string;
  };
}

export async function fetchEmbeddedSignupPhoneAssets(
  accessToken: string,
  hints: { businessId?: string | null; wabaId?: string | null } = {}
) {
  const collected = new Map<string, EmbeddedSignupPhoneAsset>();
  const headers = {
    Authorization: `Bearer ${accessToken}`,
  };

  const addPhone = (
    phone: any,
    fallback: {
      wabaId?: string | null;
      businessName?: string | null;
    } = {}
  ) => {
    const phoneNumberId = String(phone?.id || "").trim();
    if (!phoneNumberId) return;

    collected.set(phoneNumberId, {
      wabaId:
        String(
          phone?.whatsapp_business_account_id ||
            fallback.wabaId ||
            ""
        ).trim() ||
        fallback.wabaId ||
        null,
      phoneNumberId,
      displayPhoneNumber: formatMetaDisplayPhoneNumber(
        phone?.display_phone_number ||
          phone?.formatted_phone_number ||
          phone?.phone_number
      ),
      verifiedName: phone?.verified_name || null,
      businessName:
        fallback.businessName || phone?.verified_name || null,
    });
  };

  const queryCandidates = [
    {
      path: "/me",
      params: {
        fields:
          "id,name,owned_whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,verified_name,whatsapp_business_account_id}},client_whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,verified_name,whatsapp_business_account_id}}",
      },
      collect: (data: any) => {
        const groups = [
          ...(Array.isArray(
            data?.owned_whatsapp_business_accounts?.data
          )
            ? data.owned_whatsapp_business_accounts.data
            : []),
          ...(Array.isArray(
            data?.client_whatsapp_business_accounts?.data
          )
            ? data.client_whatsapp_business_accounts.data
            : []),
        ];

        for (const business of groups) {
          const phones = Array.isArray(business?.phone_numbers?.data)
            ? business.phone_numbers.data
            : Array.isArray(business?.phone_numbers)
              ? business.phone_numbers
              : [];
          for (const phone of phones) {
            addPhone(phone, {
              wabaId: business?.id || null,
              businessName: business?.name || data?.name || null,
            });
          }
        }
      },
    },
    {
      path: "/me/owned_whatsapp_business_accounts",
      params: {
        fields:
          "id,name,phone_numbers{id,display_phone_number,verified_name,whatsapp_business_account_id}",
      },
      collect: (data: any) => {
        for (const business of Array.isArray(data?.data)
          ? data.data
          : []) {
          const phones = Array.isArray(business?.phone_numbers?.data)
            ? business.phone_numbers.data
            : Array.isArray(business?.phone_numbers)
              ? business.phone_numbers
              : [];
          for (const phone of phones) {
            addPhone(phone, {
              wabaId: business?.id || null,
              businessName: business?.name || null,
            });
          }
        }
      },
    },
    {
      path: "/me/client_whatsapp_business_accounts",
      params: {
        fields:
          "id,name,phone_numbers{id,display_phone_number,verified_name,whatsapp_business_account_id}",
      },
      collect: (data: any) => {
        for (const business of Array.isArray(data?.data)
          ? data.data
          : []) {
          const phones = Array.isArray(business?.phone_numbers?.data)
            ? business.phone_numbers.data
            : Array.isArray(business?.phone_numbers)
              ? business.phone_numbers
              : [];
          for (const phone of phones) {
            addPhone(phone, {
              wabaId: business?.id || null,
              businessName: business?.name || null,
            });
          }
        }
      },
    },
  ];

  const normalizedWabaId = String(hints.wabaId || "").trim();
  const normalizedBusinessId = String(hints.businessId || "").trim();

  if (normalizedWabaId) {
    queryCandidates.unshift({
      path: `/${normalizedWabaId}`,
      params: {
        fields:
          "id,name,phone_numbers{id,display_phone_number,verified_name,whatsapp_business_account_id}",
      },
      collect: (data: any) => {
        const phones = Array.isArray(data?.phone_numbers?.data)
          ? data.phone_numbers.data
          : Array.isArray(data?.phone_numbers)
            ? data.phone_numbers
            : [];
        for (const phone of phones) {
          addPhone(phone, {
            wabaId: data?.id || normalizedWabaId,
            businessName: data?.name || null,
          });
        }
      },
    });
  }

  if (normalizedBusinessId) {
    queryCandidates.unshift(
      {
        path: `/${normalizedBusinessId}/owned_whatsapp_business_accounts`,
        params: {
          fields:
            "id,name,phone_numbers{id,display_phone_number,verified_name,whatsapp_business_account_id}",
        },
        collect: (data: any) => {
          for (const business of Array.isArray(data?.data)
            ? data.data
            : []) {
            const phones = Array.isArray(
              business?.phone_numbers?.data
            )
              ? business.phone_numbers.data
              : Array.isArray(business?.phone_numbers)
                ? business.phone_numbers
                : [];
            for (const phone of phones) {
              addPhone(phone, {
                wabaId: business?.id || null,
                businessName: business?.name || null,
              });
            }
          }
        },
      },
      {
        path: `/${normalizedBusinessId}/client_whatsapp_business_accounts`,
        params: {
          fields:
            "id,name,phone_numbers{id,display_phone_number,verified_name,whatsapp_business_account_id}",
        },
        collect: (data: any) => {
          for (const business of Array.isArray(data?.data)
            ? data.data
            : []) {
            const phones = Array.isArray(
              business?.phone_numbers?.data
            )
              ? business.phone_numbers.data
              : Array.isArray(business?.phone_numbers)
                ? business.phone_numbers
                : [];
            for (const phone of phones) {
              addPhone(phone, {
                wabaId: business?.id || null,
                businessName: business?.name || null,
              });
            }
          }
        },
      }
    );
  }

  console.log("[embedded-signup] asset lookup started", {
    businessId: normalizedBusinessId || null,
    wabaId: normalizedWabaId || null,
    candidateQueries: queryCandidates.map((query) => query.path),
  });

  for (const query of queryCandidates) {
    try {
      const response = await axios.get(
        `https://graph.facebook.com/${META_GRAPH_VERSION}${query.path}`,
        {
          params: query.params,
          headers,
        }
      );
      query.collect(response.data);
      if (collected.size > 0) {
        break;
      }
    } catch (error) {
      console.warn(
        `Embedded signup asset lookup failed for ${query.path}`,
        error instanceof Error ? error.message : error
      );
    }
  }

  console.log("[embedded-signup] asset lookup finished", {
    businessId: normalizedBusinessId || null,
    wabaId: normalizedWabaId || null,
    assetCount: collected.size,
    phoneNumberIds: Array.from(collected.values()).map(
      (asset) => asset.phoneNumberId
    ),
  });

  return Array.from(collected.values()).filter(
    (asset) => asset.displayPhoneNumber || asset.phoneNumberId
  );
}

// ── WhatsApp Media ─────────────────────────────────────────────────

export const getWhatsAppMediaKind = (
  file: Express.Multer.File
): WhatsAppMediaKind | null => {
  if (file.mimetype.startsWith("image/")) return "image";
  if (file.mimetype.startsWith("audio/")) return "audio";
  if (
    file.mimetype === "application/pdf" ||
    file.mimetype.includes("officedocument") ||
    file.mimetype.includes("msword") ||
    file.mimetype.startsWith("text/")
  ) {
    return "document";
  }
  return null;
};

export const buildIncomingWhatsAppMessagePayload = (
  message: any
): IncomingWhatsAppMessagePayload | null => {
  if (!message?.type) return null;

  if (message.type === "text") {
    const text = message.text?.body?.trim();
    if (!text) return null;
    return {
      type: "TEXT",
      content: text,
      aiInput: text,
    };
  }

  if (message.type === "image" && message.image?.id) {
    const caption = message.image?.caption?.trim();
    return {
      type: "IMAGE",
      content: caption || "[Image]",
      aiInput: caption || null,
      mediaId: message.image.id,
      mediaMimeType: message.image?.mime_type,
    };
  }

  if (message.type === "document" && message.document?.id) {
    const filename = message.document?.filename || "Document";
    const caption = message.document?.caption?.trim();
    return {
      type: "DOCUMENT",
      content: caption
        ? `[Document] ${filename}\n${caption}`
        : `[Document] ${filename}`,
      aiInput: caption || null,
      mediaId: message.document.id,
      mediaMimeType: message.document?.mime_type,
      mediaFilename: filename,
    };
  }

  if (message.type === "audio" && message.audio?.id) {
    const isVoiceNote = Boolean(message.audio?.voice);
    return {
      type: "AUDIO",
      content: isVoiceNote ? "[Voice note]" : "[Audio]",
      aiInput: null,
      mediaId: message.audio.id,
      mediaMimeType: message.audio?.mime_type,
      mediaFilename: isVoiceNote ? "voice-note.ogg" : "audio-message",
    };
  }

  return null;
};

// ── Messaging ──────────────────────────────────────────────────────

export async function sendMetaMessage(
  to: string,
  text: string,
  type: "whatsapp" | "instagram",
  config: {
    accessToken: string;
    phoneNumberId?: string;
    instagramId?: string;
  }
) {
  try {
    if (type === "whatsapp") {
      const response = await axios.post(
        `https://graph.facebook.com/v17.0/${config.phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          to: to,
          text: { body: text },
        },
        {
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
          },
        }
      );

      return response.data?.messages?.[0]?.id as string | undefined;
    } else {
      const response = await axios.post(
        `https://graph.facebook.com/v17.0/me/messages`,
        {
          recipient: { id: to },
          message: { text: text },
        },
        {
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
          },
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
    console.error(
      `Error sending ${type} message:`,
      error.response?.data || error.message
    );
    throw new Error(metaMessage);
  }
}

export async function uploadWhatsAppMedia(
  file: Express.Multer.File,
  config: { accessToken: string; phoneNumberId: string }
) {
  const formData = new FormData();
  formData.append("messaging_product", "whatsapp");
  formData.append(
    "file",
    new Blob([file.buffer], { type: file.mimetype }),
    file.originalname
  );

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
      "Failed to upload WhatsApp media";
    console.error(
      "Error uploading WhatsApp media:",
      error.response?.data || error.message
    );
    throw new Error(metaMessage);
  }
}

export async function sendWhatsAppMediaMessage(
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
    messaging_product: "whatsapp",
    to,
    type: mediaKind,
  };

  if (mediaKind === "image") {
    payload.image = {
      id: mediaId,
      ...(caption ? { caption } : {}),
    };
  } else if (mediaKind === "document") {
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
      messageId: response.data?.messages?.[0]?.id as
        | string
        | undefined,
    };
  } catch (error: any) {
    const metaMessage =
      error.response?.data?.error?.message ||
      error.response?.data?.message ||
      error.message ||
      "Failed to send WhatsApp attachment";
    console.error(
      "Error sending WhatsApp attachment:",
      error.response?.data || error.message
    );
    throw new Error(metaMessage);
  }
}

export async function refreshBroadcastCampaignStats(
  campaignId: string
) {
  const [deliveredCount, readCount, repliedCount, pendingCount] =
    await Promise.all([
      prisma.broadcastRecipient.count({
        where: {
          campaignId,
          status: {
            in: ["SENT", "DELIVERED", "READ", "REPLIED"],
          },
        },
      }),
      prisma.broadcastRecipient.count({
        where: {
          campaignId,
          status: { in: ["READ", "REPLIED"] },
        },
      }),
      prisma.broadcastRecipient.count({
        where: {
          campaignId,
          status: "REPLIED",
        },
      }),
      prisma.broadcastRecipient.count({
        where: {
          campaignId,
          status: "PENDING",
        },
      }),
    ]);

  return prisma.broadcastCampaign.update({
    where: { id: campaignId },
    data: {
      status: pendingCount > 0 ? "SENDING" : "COMPLETED",
      deliveredCount,
      readCount,
      repliedCount,
    },
    include: {
      _count: { select: { recipients: true } },
      number: true,
    },
  });
}

export async function downloadMetaMedia(
  mediaId: string,
  accessToken: string
) {
  const metadataResponse = await axios.get(
    `https://graph.facebook.com/v17.0/${mediaId}`,
    {
      params: { fields: "url,mime_type" },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const mediaUrl = metadataResponse.data?.url as string | undefined;
  const mimeType = metadataResponse.data?.mime_type as
    | string
    | undefined;

  if (!mediaUrl) {
    throw new Error("Meta did not return a media URL");
  }

  const fileResponse = await axios.get<ArrayBuffer>(mediaUrl, {
    responseType: "arraybuffer",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return {
    buffer: Buffer.from(fileResponse.data),
    contentType:
      mimeType ||
      fileResponse.headers["content-type"] ||
      "application/octet-stream",
  };
}

// ── Instagram Profile Sync ─────────────────────────────────────────

const isRetryableMetaProfileError = (error: any) => {
  const status = Number(error?.response?.status || 0);
  const code = Number(error?.response?.data?.error?.code || 0);

  if (status === 429 || status >= 500) {
    return true;
  }

  return [1, 2, 4].includes(code);
};

const logInstagramProfileHydrationError = (
  error: any,
  instagramScopedUserId: string
) => {
  const status = Number(error?.response?.status || 0);
  const metaError = error?.response?.data?.error;
  const code = Number(metaError?.code || 0);
  const message = String(
    metaError?.message || error?.message || "Unknown Meta error"
  );

  if (code === 190 || /access token/i.test(message)) {
    console.error(
      `[instagram-profile-sync:token] ${instagramScopedUserId}`,
      metaError || message
    );
    return;
  }

  if (code === 10 || code === 200 || /permission/i.test(message)) {
    console.error(
      `[instagram-profile-sync:permission] ${instagramScopedUserId}`,
      metaError || message
    );
    return;
  }

  if (/consent|blocked|not authorized|unsupported/i.test(message)) {
    console.error(
      `[instagram-profile-sync:consent] ${instagramScopedUserId}`,
      metaError || message
    );
    return;
  }

  console.error(
    `[instagram-profile-sync:error] ${instagramScopedUserId} status=${status || "unknown"}`,
    metaError || message
  );
};

export const fetchInstagramContactProfile = async (
  instagramScopedUserId?: string | null,
  accessToken?: string | null
): Promise<{
  username?: string | null;
  name?: string | null;
  profile_pic?: string | null;
  follower_count?: number | null;
  is_verified_user?: boolean | null;
} | null> => {
  const normalizedUserId = String(
    instagramScopedUserId || ""
  ).trim();
  const normalizedToken = String(accessToken || "").trim();

  if (!normalizedUserId || !normalizedToken) {
    return null;
  }

  for (
    let attempt = 1;
    attempt <= INSTAGRAM_PROFILE_SYNC_MAX_RETRIES;
    attempt += 1
  ) {
    try {
      const response = await axios.get(
        `https://graph.facebook.com/v21.0/${normalizedUserId}`,
        {
          params: {
            fields:
              "username,name,profile_pic,follower_count,is_verified_user",
            access_token: normalizedToken,
          },
          timeout: 10000,
        }
      );

      return response.data || null;
    } catch (error: any) {
      const retryable = isRetryableMetaProfileError(error);

      if (
        !retryable ||
        attempt === INSTAGRAM_PROFILE_SYNC_MAX_RETRIES
      ) {
        logInstagramProfileHydrationError(error, normalizedUserId);
        return null;
      }

      await wait(400 * attempt);
    }
  }

  return null;
};
