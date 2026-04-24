import prisma from "../../src/lib/prisma.js";
import axios from "axios";

// ── WhatsApp Token Auto-Refresh Scheduler ─────────────────────────────────
// Long-lived Meta user tokens expire after 60 days but can be renewed
// indefinitely using fb_exchange_token — as long as you refresh before expiry.
// This scheduler runs daily and renews any token expiring within 30 days.
// Result: tokens are effectively permanent with no user action required.

const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // every 24 hours
const REFRESH_THRESHOLD_DAYS = 30; // refresh if expiring within 30 days

async function refreshExpiringTokens() {
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  const graphVersion = process.env.META_GRAPH_VERSION || "v22.0";

  if (!appId || !appSecret) {
    console.warn("[token-refresh] META_APP_ID or META_APP_SECRET not set — skipping");
    return;
  }

  const thresholdDate = new Date(Date.now() + REFRESH_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);

  // Find numbers with tokens expiring soon OR with no expiry recorded
  // (tokens with no expiry are old short-lived ones — try to upgrade them too)
  const numbers = await prisma.whatsAppNumber.findMany({
    where: {
      metaAccessToken: { not: null },
      metaWabaId: { not: null },
      OR: [
        { metaTokenExpiresAt: { lte: thresholdDate } },
        { metaTokenExpiresAt: null },
      ],
    },
  });

  if (numbers.length === 0) {
    console.log("[token-refresh] No tokens need renewal");
    return;
  }

  console.log(`[token-refresh] Found ${numbers.length} token(s) to refresh`);

  for (const number of numbers) {
    try {
      const r = await axios.get(
        `https://graph.facebook.com/${graphVersion}/oauth/access_token`,
        {
          params: {
            grant_type: "fb_exchange_token",
            client_id: appId,
            client_secret: appSecret,
            fb_exchange_token: number.metaAccessToken,
          },
        }
      );

      const newToken: string = r.data.access_token;
      const expiresIn: number | undefined = r.data.expires_in;
      const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;

      await prisma.whatsAppNumber.update({
        where: { id: number.id },
        data: { metaAccessToken: newToken, metaTokenExpiresAt: expiresAt },
      });

      const expiryStr = expiresAt
        ? `expires ${expiresAt.toLocaleDateString()}`
        : "no expiry set";
      console.log(`[token-refresh] ✅ ${number.phoneNumber} — token refreshed (${expiryStr})`);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message;
      console.error(`[token-refresh] ❌ ${number.phoneNumber} — refresh failed: ${msg}`);
      // If refresh fails (token fully expired), we can't do much automatically.
      // The workspace owner will need to reconnect from Channels.
      // TODO: send an email/notification to workspace owner when token expires
    }
  }
}

export function startTokenRefreshScheduler() {
  console.log("[token-refresh] Scheduler started — checking daily for expiring tokens");

  // Run once immediately on startup to catch any already-expired tokens
  refreshExpiringTokens().catch((e) =>
    console.error("[token-refresh] Startup refresh error:", e?.message)
  );

  // Then run every 24 hours
  setInterval(() => {
    refreshExpiringTokens().catch((e) =>
      console.error("[token-refresh] Scheduled refresh error:", e?.message)
    );
  }, REFRESH_INTERVAL_MS);
}
