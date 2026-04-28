# Instagram Inbox + Comment Replies Audit

Date: April 28, 2026

## Implementation Update - April 28, 2026

Slice 1 connection flow has been implemented as a first working pass:

- `InstagramAccount` now stores Page ID, Page access token, Meta business ID placeholder, token expiry, and connected time.
- New backend endpoints:
  - `GET /api/instagram/connect/start`
  - `GET /api/instagram/connect/callback`
  - `POST /api/instagram/connect/finalize`
  - `DELETE /api/instagram/accounts/:id`
- Channels now opens Meta OAuth from the Connect Instagram card.
- If Meta returns multiple Facebook Pages with linked Instagram Professional accounts, Channels asks the owner which account to connect.
- Finalize saves the selected Instagram account and tries to subscribe the Page to Instagram messaging webhooks.
- Frontend Instagram product flag is enabled.

Still to prove on production/staging with a real Meta test account:

- OAuth permission approval/scope behavior in the live Meta app.
- Webhook delivery for real incoming Instagram DMs.
- Outbound text reply from Tawasel Inbox into Instagram.
- Whether Meta accepts the webhook subscription fields for the connected Page without extra App Review changes.

## Executive Summary

Instagram is partially implemented in Tawasel, but it is not ready as a customer-facing connection flow yet.

The fastest safe next slice is:

1. Build a real Instagram/Facebook connection flow.
2. Store the Page access token, Facebook Page ID, and Instagram Professional account ID.
3. Subscribe the Page/app to Instagram message webhooks.
4. Test inbound Instagram DMs into the existing Inbox.
5. Test outbound text replies from the existing Inbox.

Instagram comments, public replies, private replies, and keyword auto-DM should come after the DM slice is proven with a real connected Instagram Professional account.

## What Already Exists

### Database

`prisma/schema.prisma` already has:

- `InstagramAccount`
- `Workspace.instagramAccounts`
- `Conversation.channelType` with `WHATSAPP` / `INSTAGRAM`
- `Conversation.instagramAccountId`
- Instagram fields on `Contact`: `instagramId`, `instagramScopedUserId`, `instagramUsername`, profile/follower metadata
- `Message.metaMessageId`, shared by WhatsApp and Instagram

This is enough for Instagram DM conversations, but not enough for Instagram comment management.

Missing for comments:

- `InstagramComment`
- `CommentStatus`
- post/media thumbnail fields
- public reply/private reply tracking
- keyword auto-DM rule linkage

### Backend

`server/config.ts` has backend Instagram enabled:

- `INSTAGRAM_INTEGRATION_ENABLED = true`

`server/services/webhookProcessor.ts` already processes basic Instagram DM webhook payloads:

- reads `body.object === "instagram"`
- reads `entry[0].messaging[0]`
- looks up `InstagramAccount` by recipient Instagram ID
- upserts a workspace contact by Instagram scoped sender ID
- creates or reuses an `INSTAGRAM` conversation
- stores inbound text messages
- emits Socket.io events
- can run AI auto-reply if the Instagram account has a chatbot

Current backend gaps:

- only the first `entry` and first `messaging` item are processed
- inbound Instagram media, reactions, postbacks, seen/read receipts, deletes, story replies, and referrals are not fully handled
- there is no durable dedupe on inbound Instagram message IDs
- there is no real Instagram OAuth connection flow
- there is no endpoint that exchanges Facebook login tokens, lists Pages, selects the linked Instagram account, stores the Page token, and subscribes webhooks
- there is no Instagram comments webhook processor
- there are no comment reply endpoints

`server/services/meta.ts` already has `sendMetaMessage(..., "instagram", ...)`, but it posts to a generic Graph endpoint and should be verified against the approved Instagram Messaging API endpoint/version during the implementation slice.

### Frontend

`src/pages/Inbox.tsx` already understands `INSTAGRAM` conversations:

- channel filter includes Instagram
- conversation list shows an Instagram icon
- contact labels prefer Instagram username
- text-only sending is supported
- attachments are blocked for Instagram with a friendly error
- the contact edit panel protects Instagram identity fields

`src/pages/Channels.tsx` already displays Instagram account cards and a "Connect Instagram" card, but the connect button only shows an info toast. It does not start OAuth.

Current frontend gap:

- `src/lib/product.ts` still has `INSTAGRAM_INTEGRATION_ENABLED = false`, while backend config is `true`. This means some product surfaces may still treat Instagram as parked.

## Key Risk

The current app can probably be made to receive and send Instagram DMs after manual database/token setup, but that is not enough for a SaaS customer. A customer needs a guided connect flow that gets the right Page token and webhook subscription without manual database work.

## Official Meta Notes Verified

Meta's Instagram Messaging getting started guide says Instagram Messaging API setup needs an Instagram Professional account, a connected Facebook Page, the correct Page role/task access, Facebook Login or Business Login, a Page access token, message control connected tools enabled, webhook setup, and App Review for production use.

Source: https://developers.facebook.com/docs/messenger-platform/instagram/get-started

Meta's private replies flow for comments allows a private reply to a commenter, but it is limited. The reply is tied to the comment, must happen within the allowed window, and follow-up messages require the user to respond first.

Source: https://www.postman.com/meta/instagram/request/k223fus/private-replies

## Recommended Implementation Order

### Slice 1 - Instagram DM Connection + Inbox Proof

Goal: one real Instagram Business/Creator account can connect, receive a DM, and reply from Tawasel Inbox.

Backend:

- Add OAuth start endpoint for Instagram/Facebook login.
- Add OAuth callback/finalize endpoint.
- Exchange code/user token for a long-lived token where applicable.
- Fetch manageable Facebook Pages.
- Fetch each Page's connected Instagram Professional account.
- Store the selected account in `InstagramAccount`.
- Add fields to `InstagramAccount` for `pageId`, `pageAccessToken`, `tokenExpiresAt`, and `connectedAt`.
- Subscribe the Page/app to needed webhook fields.
- Harden webhook loop to process all entries/messages.
- Store `metaMessageId` on inbound Instagram messages and dedupe repeated events.
- Verify outbound DM endpoint and Graph API version.

Frontend:

- Replace Channels toast with a real "Connect Instagram" flow.
- Add page/account selection UI if multiple Pages are returned.
- Show connected Page, Instagram username, and connection health.
- Keep Inbox behavior text-only for the first slice.

Testing:

- Add one seeded/manual test Instagram account only if needed for local dev.
- Use a real Instagram Professional account in Meta dev mode.
- DM from a second tester account.
- Confirm the DM appears in Inbox.
- Reply from Inbox and confirm it arrives in Instagram.

Deploy:

- Requires `npx prisma db push` after schema fields are added.
- Requires `npx prisma generate`.
- Requires `npx vite build`.
- Restart both `tawasel-app` and `tawasel-worker`.

### Slice 2 - Instagram Comment Capture

Goal: comments appear in a dedicated comments view.

Backend:

- Add `InstagramComment` and `CommentStatus`.
- Parse `comments` and `live_comments` webhook events.
- Store comment ID, IG media ID, commenter scoped ID, username, text, timestamp, and status.
- Add API list endpoint with filters by status/date/post.

Frontend:

- Add `/app/instagram/comments`.
- Show comment list with post ID/thumbnail placeholder, commenter, text, age, and status.

### Slice 3 - Manual Replies

Goal: agent can reply publicly or send one private reply where Meta allows it.

Backend:

- Public reply endpoint.
- Private reply endpoint using comment ID as recipient where supported.
- Persist `repliedAt`, reply type, and status.

Frontend:

- Add reply actions in the comments view.
- Show Meta error text clearly when a reply is outside policy/window.

### Slice 4 - Keyword Auto-DM

Goal: "comment BOOK/PRICE/INFO and get the booking link" campaigns.

Backend:

- Add comment keyword rules.
- Match comments to active rules.
- Send private reply once per eligible comment.
- Store auto-action logs and failures.

Frontend:

- Add rule builder after the manual reply flow is stable.

## Not Recommended Yet

- Do not start with comment automation before DMs are connected and verified.
- Do not promise unlimited follow-up DMs from comments. Private reply can start the interaction, but normal follow-up depends on the user responding and the messaging window.
- Do not use one global `INSTAGRAM_ACCESS_TOKEN` as the production connection model. Each workspace needs its own connected account/token.

## Audit Conclusion

Tawasel is closer than expected on the Inbox side. The missing product work is mainly connection, token storage, webhook subscription, and comment-specific data/API/UI. Build the DM connection slice first because it proves the Meta app permissions, customer connection flow, webhook delivery, Inbox rendering, and outbound reply path all at once.
