<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Tawasel App

Tawasel App is a full-stack WhatsApp CRM and automation platform built with React, Express, Prisma, Stripe, and Meta integrations. Designed for UAE businesses that rely on WhatsApp as their primary sales and support channel.

## User Guides

- `TAWASEL_OPERATOR_GUIDE_EN.md` - English operator playbook for onboarding users.
- `TAWASEL_OPERATOR_GUIDE_AR.md` - Arabic operator playbook for UAE/GCC users.

## Latest Product Slice

- Inbox visual refresh: the core inbox now follows the new design-system direction with a warm paper canvas, always-visible chat search, segmented All/Unread/Mine/Overdue filters, clearer selected/unread states, darker brand outbound bubbles, an optimized logo asset, and a more polished composer without adding any heavy UI dependency.
- Dashboard visual refresh: the main dashboard now follows the same design-system direction with a serif greeting hero, three priority KPI cards, warm paper surfaces, calmer filters, and localized hero copy.
- Dashboard greeting is now time-aware, so the hero says morning, afternoon, or evening based on the viewer's local time instead of always saying morning.
- Branded Tawasel loading states: shared `TawaselLoader` SVG/CSS component adds pulse, typing, and orbit variants without importing the large loader preview HTML or adding runtime dependencies.
- Appointments visual refresh: the appointments workspace now has a premium schedule hero, selected-day KPI cards, Day/Week/Month/List segmented navigation, refreshed filters, and real up-next/reminder-rule panels while preserving existing booking, drag-to-reschedule, and reminder timeline logic.
- Contacts visual refresh: the contacts workspace now follows the same design system with a people-focused hero, real contact KPI cards, stage/source filters, polished mobile cards, and a denser desktop table with initials, source, stage, list chips, and safe delete actions while preserving import, merge, and bulk list workflows.
- CRM visual refresh: the pipeline now uses the uploaded board design direction with a live pipeline hero, real KPI cards, responsive stage columns that keep the standard stages visible, initials-based lead cards, localized labels, and preserved stage movement/value editing/custom stage controls.
- App-wide design-system pass: shared shell, topbar, sidebar, tooltips, auth screens, public legal/info pages, and remaining operational pages now use the new warm paper canvas, Instrument Serif page titles, rounded card/control language, and optimized Tawasel logo treatment without adding new frontend dependencies.
- Settings API Keys no longer shows the old hardcoded placeholder production key; the page is now a disabled/coming-soon state until real public API key generation is implemented with one-time reveal, hashed storage, revoke, and rotate controls.
- Voice note transcription V1: incoming WhatsApp audio messages are transcribed by the BullMQ worker, shown live in Inbox, retryable when failed, and passed into the existing AI chatbot flow for appointment booking.
- Arabic booking resolver now handles common GCC staff-name variants, Arabic month dates like `6 مايو 2026`, and spoken time words like `الساعة الثالثة ظهرا`.
- Resolver calls now accept the full customer sentence/transcript so relative dates like `باكر` are resolved automatically even when the AI does not split the date into a separate field.
- Voice transcription is now plan-limited monthly: Starter 60 minutes, Growth 300 minutes, Pro 1,500 minutes. Usage is recorded in `UsageLog` as `TRANSCRIPTION_SECOND`.
- Chatbots now have structured AI behavior settings, an about-business knowledge template, and a prompt builder that injects live services/staff/prices from the database as the source of truth.

## Why Tawasel?

Most businesses in the UAE run Facebook and Instagram ads that drive customers to WhatsApp. The problem is that leads get lost, replies are slow, and there's no way to track what's working. Tawasel solves this by turning WhatsApp into a structured sales and support system.

## Features & How They Help

### Shared Team Inbox
Your entire team sees every WhatsApp conversation in one place. No more passing phones around or missing messages. Agents can reply, add internal notes, and hand off conversations — customers only see one seamless thread.

### AI Chatbot Auto-Replies
When a customer messages at 11 PM or during Friday prayers, the AI chatbot responds instantly. It answers common questions, collects information, and can even book appointments — so you never lose a lead to slow response time.

### AI-to-Human Escalation
When the AI chatbot can't answer a question, detects customer frustration, or the customer asks to speak to a real person, it automatically hands off the conversation to your team. The bot tells the customer "I'm connecting you with a team member," pauses itself, and raises the conversation priority. Every agent online gets a real-time notification with a sound alert so the customer gets a fast response from a human.

### Campaign Link Generator & Ad Tracking
Run ads on **any platform** — Snapchat, Google, TikTok, Instagram, Facebook, YouTube, LinkedIn, or even QR codes — and track exactly which ad brought each lead. Tawasel's Campaign Link Generator creates unique WhatsApp links with tracking codes for each ad campaign. When a customer clicks your ad and messages you, Tawasel automatically detects the campaign code and tags the lead with the platform and campaign name. No more guessing which ads are working.

**How it works:**
1. Pick your ad platform (Snapchat, Google, TikTok, etc.)
2. Name your campaign (e.g., "SUMMER-SALE")
3. Tawasel generates a trackable `wa.me` link with a unique code (e.g., `SC-SUMMER-SALE`)
4. Paste the link in your ad → customer clicks → WhatsApp opens → lead is auto-tagged

For Facebook and Instagram Click-to-WhatsApp ads, Tawasel also reads Meta's native referral data automatically — no campaign code needed.

### Auto-Assign Rules
Stop manually distributing leads among your team. Set up rules to automatically route conversations:
- **Round Robin**: Distribute leads equally across your sales team
- **By Ad Campaign**: Send leads from your luxury car ads to your premium sales agent, and service ads to your support team
- **By Keyword**: Route conversations mentioning "pricing" to sales and "complaint" to support

### Follow-up Sequences
Most leads don't convert on the first message. Tawasel automatically sends follow-up WhatsApp messages when a lead goes quiet:
- Day 1: "Thanks for your interest! Here's more info about our services"
- Day 3: "Just checking in — do you have any questions?"
- Day 7: "We have a special offer this week"

The sequence stops automatically when the customer replies, so they never feel spammed.

### Appointment Booking
Customers can book, reschedule, and cancel appointments directly through WhatsApp chat with the AI bot — or through a public self-service booking page at `app.tawasel.io/book/{your-slug}` that works with no login. The system checks staff availability, prevents double-bookings, and sends WhatsApp reminders 24 hours before, 1 hour before, and a post-visit follow-up. A drag-to-reschedule calendar view lets your team rearrange the day in seconds. No more no-shows, no more phone tag.

### Broadcast Campaigns
Send approved WhatsApp template messages to your customer lists for promotions, updates, or re-engagement. Track delivery, read rates, and replies in real-time. Every broadcast message appears in the customer's inbox conversation, so when they reply, your team has the full context.

### CRM Pipeline
Track every lead from first contact to closed deal. See your conversion funnel, pipeline value, and win rate on the dashboard. Move leads through stages (New Lead, Contacted, Qualified, Won, Lost) and never forget to follow up.

### Ad Performance Dashboard
See the numbers that matter: how many leads came from ads, your conversion rate at each pipeline stage, average response time by lead source, and which campaigns are actually generating revenue — not just clicks.

### Compose Messages
Start conversations with new or existing contacts using approved WhatsApp templates. Works outside the 24-hour messaging window, so you can reach out to leads proactively.

### Multi-Workspace & Team Management
Each business gets its own workspace with role-based access (Owner, Admin, User). Invite team members, control permissions, and manage multiple business accounts from one login.

### Plan-Based Pricing
Three tiers (Starter, Growth, Pro) with usage limits that scale with your business. Stripe-powered subscriptions with automatic billing.

## Local Development

**Prerequisites:** Node.js 22

1. Install dependencies:
   `npm install`
2. Copy environment variables from [`.env.example`](C:\Users\Khaled\Desktop\SaaS%20Whatsapp\SaaS-Whatsapp-CRM-main\SaaS-Whatsapp-CRM-main\.env.example) into your local `.env`
3. Start the app:
   `npm run start`

## Remotion Marketing Video

The repository includes a 45-second SaaS intro composition for Tawasel at `remotion/TawaselIntro.tsx`.

- Preview in Remotion Studio: `npm run remotion:studio`
- Render the MP4: `npm run remotion:render:intro`
- Render a quick still frame: `npm run remotion:still:intro`

The rendered intro is written to `out/tawasel-intro.mp4`.

## DigitalOcean Deployment

DigitalOcean deployment is now documented here:

- [DEPLOY_DIGITALOCEAN.md](C:\Users\Khaled\Desktop\SaaS%20Whatsapp\SaaS-Whatsapp-CRM-main\SaaS-Whatsapp-CRM-main\DEPLOY_DIGITALOCEAN.md)

The repo also includes an App Platform spec:

- [`.do/app.yaml`](C:\Users\Khaled\Desktop\SaaS%20Whatsapp\SaaS-Whatsapp-CRM-main\SaaS-Whatsapp-CRM-main\.do\app.yaml)

## Update Log

### May 2, 2026 - 30-day workspace trial system

- **Added no-card trial lifecycle** - new workspaces now start on a 30-day `trialing` Growth workspace with `trialStartedAt` and `trialEndsAt`; expired trials lose access to sending, bookings, reminders, and automation until upgraded.
- **Added superadmin trial controls** - superadmin can start/extend/expire trials and mark a workspace active from the workspace controls panel.
- **Added trial UX** - active trial workspaces show days remaining in-app, and expired trials show a plan prompt while preserving login/view access.
- **Updated landing page positioning** - the main page now leads with the 30-day no-card trial, removes stale billing-unlock language and fake trust count, and fixes browser-side superadmin routing to use `VITE_SUPERADMIN_EMAIL`.

### May 2, 2026 - Public booking confirmation variable order

- **Fixed confirmation template variable order** - public booking now supports the newer four-variable confirmation template order (`customer`, `business`, `date/time`, `staff`) while preserving the legacy five-variable Tawasel template order.

### April 29, 2026 - Remotion intro video

- **Added Remotion marketing composition** - `TawaselIntro` is a 45-second 1920x1080 product intro for the SaaS, covering the brand, scattered lead problem, shared inbox, CRM/AI automation, bookings, reminders, and final CTA.
- **Added Remotion scripts** - `npm run remotion:studio`, `npm run remotion:render:intro`, and `npm run remotion:still:intro`.
- **Added Remotion dependencies** - `remotion` and `@remotion/cli` are now dev dependencies.

### April 28, 2026 - Instagram Phase 5 audit

- **Added `INSTAGRAM_AUDIT.md`** - repo-specific audit and implementation plan for Instagram Inbox + Comment Replies.
- **Confirmed existing Instagram foundation** - Prisma already has `InstagramAccount`, Instagram contact fields, and `Conversation.channelType = INSTAGRAM`; the webhook processor already handles basic inbound Instagram text DMs; Inbox already renders Instagram conversations and supports text-only replies.
- **Identified missing SaaS-ready pieces** - real Instagram/Facebook OAuth connection flow, Page selection, Page access token storage, webhook subscription, inbound message dedupe, robust multi-entry webhook handling, comment schema/API/UI, and keyword private-reply automation.
- **Recommended next slice** - connect one real Instagram Professional account, receive a DM in Inbox, and reply from Inbox before starting comment automation.
- **Flag mismatch noted** - backend `server/config.ts` currently enables Instagram while frontend `src/lib/product.ts` still marks Instagram product surfaces as disabled.
- **Instagram connect first pass implemented** - Channels now starts Meta OAuth, handles the callback, lets the owner choose a linked Instagram Professional account when multiple Pages are returned, saves Page token/IG account details, and attempts webhook subscription.
- **New Instagram connect endpoints** - `GET /api/instagram/connect/start`, `GET /api/instagram/connect/callback`, `POST /api/instagram/connect/finalize`, and `DELETE /api/instagram/accounts/:id`.
- **Schema update** - `InstagramAccount` now stores `pageId`, `pageAccessToken`, `metaBusinessId`, `tokenExpiresAt`, and `connectedAt`.
- **Webhook subscription fix** - Instagram Page subscription now uses `message_reads` instead of invalid `messaging_seen`.
- **Permission fix** - Instagram OAuth now includes `pages_messaging`, which Meta requires before subscribing a Page to `messages`, `messaging_postbacks`, `message_reactions`, and `message_reads`.
- **Instagram DM parser fix** - webhook processing now accepts both Instagram and Page webhook envelopes and matches connected accounts by Instagram ID or Facebook Page ID.
- **Webhook diagnostics** - `/webhook/meta` now logs incoming POST attempts before signature verification, making Meta delivery/signature issues visible in PM2 logs.
- **Webhook signature fix** - Meta webhook HMAC verification now uses the raw request bytes instead of a UTF-8 string conversion, which prevents Instagram payload signatures from failing on non-ASCII content.
- **Instagram echo fix** - outbound Instagram echo events are ignored so agent replies from Inbox no longer create duplicate customer contacts.
- **Instagram delete fix** - deleting an Instagram channel now removes it from Channels even when old conversations exist by clearing `conversation.instagramAccountId` and deleting the channel record instead of leaving a stuck `DISCONNECTED` entry.
- **Deploy note** - this update requires `npx prisma db push`, `npx prisma generate`, `npx vite build`, then `pm2 restart ecosystem.config.cjs`.

### May 2, 2026 - Public booking QA fixes

- **Finished homepage pricing Arabic coverage** - landing pricing cards, plan descriptions/highlights, comparison group/row labels, Included/Not included chips, FAQ items, pricing trust signals, and Growth sidebar bullets now render in Arabic from the language toggle.
- **Completed visible landing-page Arabic pass** - homepage feature cards, pricing intro, comparison headings, FAQ intro, Growth sidebar, plan metric labels, and footer team-needs copy now switch with the Arabic language toggle.
- **Expanded Arabic UI coverage** - Settings navigation/personal/business/API/billing headers and the public landing page hero/signup/footer CTA now support Arabic/English copy and RTL direction.
- **Fixed dashboard alert translations** - main dashboard alert cards now localize backend-generated alerts such as stale leads, unread messages, overdue conversations, failed sends, and disconnected channels.
- **Added Arabic public booking flow** - `/book/:slug` now has an Arabic/English language toggle, RTL layout direction, Arabic customer-facing labels, and Arabic UAE date/time formatting across the booking and confirmation screens.
- **Fixed invisible public booking inputs** - customer name and WhatsApp number fields on `/book/:slug` now force a white background, dark text, visible placeholder text, and green caret so typing is visible regardless of global/dark styles.
- **Clarified booking link behavior** - Business Settings now shows the current public booking link with a copy action and explains that the slug remains stable when the business name changes, so old links keep working.
- **Fixed public booking confirmation templates** - the confirmation sender now reads the approved template body and sends only the variables that template actually uses, preventing Meta `#132000` parameter-count rejections when older approved templates have fewer placeholders.

### April 27, 2026 - Phase 2c: Per-appointment reminder timeline

- **Reminder timeline modal in Appointments** - each appointment row and calendar event now has a clock action that opens a timeline showing scheduled, sent, failed, and missed reminder attempts for that booking.
- **New endpoint**: `GET /api/appointments/:id/reminder-timeline?workspaceId=...` - returns active reminder-rule schedule entries plus any legacy 24h/1h/follow-up sends for the appointment.
- **Durable failure tracking** - `AppointmentReminderLog` now stores `status`, `scheduledFor`, and `errorMessage`, so Meta/template/session failures are visible instead of only appearing in server logs.
- **Retry-friendly scheduler** - failed rule sends remain visible in the timeline and can retry on a later scheduler tick; only successfully sent logs suppress future sends for that rule/appointment pair.
- **Mobile appointments polish** - Appointments now uses phone-friendly cards instead of a horizontal table on small screens, with compact filters and a bottom-sheet reminder timeline modal.
- **Mobile booking flow polish** - appointment booking now opens as a full-height mobile sheet with sticky header/footer, larger form controls, easier time-slot buttons, and a horizontally scrollable calendar on phones.
- **Mobile inbox polish** - Inbox now opens to the conversation list on phones, has a clear Chats back button, wider message bubbles, touch-sized composer controls, a full-width template picker, and a full-screen contact panel on mobile.
- **Inbox reply composer cleanup** - automatic AI reply suggestion chips were removed from chat conversations so the composer stays focused on the agent's message.
- **Mobile contacts polish** - Contacts now uses phone-friendly cards on small screens, a compact horizontal list bar, easier create/import actions, and tappable selection for bulk list actions.
- **Mobile CRM polish** - CRM now uses a phone-friendly stage tab view with lead cards, deal value editing, and a move-stage control while keeping the desktop pipeline board unchanged.
- **Mobile settings polish** - Settings now uses a compact horizontal mobile nav, tighter page spacing, full-width primary actions, responsive profile/business forms, and safer horizontal scrolling for billing/API tables.
- **Mobile team polish** - Team now uses phone-friendly member cards, full-width invite actions, and mobile sheet dialogs for inviting/editing team members while preserving the desktop table.
- **Mobile dashboard polish** - Dashboard now has tighter phone spacing, two-column mobile KPI cards, full-width filter controls, stacked team rows, and mobile campaign summary cards.
- **Activation checklist polish** - onboarding now guides new workspaces through the real booking setup path: connect WhatsApp, create services, add staff, test the public booking link, set reminder rules, and optionally create an AI bot.
- **Appointments empty-state polish** - blank appointment, service, staff, and reminder screens now show guided setup actions so new workspaces know the next step.
- **Inbox empty-state polish** - empty inboxes now explain the first-message flow and link users to WhatsApp connection, templates, and later AI bot setup.
- **Contacts/CRM empty-state polish** - blank contacts and CRM stages now explain how customer data enters Tawasel and offer add/import/first-lead actions.
- **Templates empty-state polish** - WhatsApp templates now explain Meta approval and offer create/sync actions, while session templates explain quick replies and offer direct creation.
- **Contacts list removal fix** - when viewing a specific contact list, selecting contacts and clicking remove now removes them from the current list without requiring the list picker first.
- **Contact duplicate guard** - manual CRM/Contacts create and edit now normalize phone numbers and block another contact in the same workspace from using the same number in a different format.
- **Safe contact delete** - Contacts page now has delete actions; contacts with conversation or appointment history are protected and return a merge-needed message instead of being removed.
- **Merge duplicate contacts** - select duplicate same-number contacts, choose which one to keep, and Tawasel moves conversations, appointments, tasks, activity, follow-ups, lists, and custom values before deleting the duplicate.
- **Deploy checklist**: `npx prisma db push` (adds reminder log status fields) -> `npx prisma generate` -> `npx vite build` -> `pm2 restart ecosystem.config.cjs`.

### April 25, 2026 — Bug Fixes: Appointments page, template setup, timezone, Business Name save

- **Fixed reminder rules not firing when template specified** — scheduler checked local DB approval status (stale) instead of trying the template directly; also fixed wrong parameter order (service name was in business name slot) across all 3 reminder templates
- **Fixed template status banner stuck on "pending"** — Appointments page never synced from Meta, only read local DB. Now auto-syncs on load when any template is pending, so the banner updates immediately after Meta approves
- **Fixed appointment times 4 hours off** — availability endpoint used UTC midnight as day start so all slots were in UTC not UAE time. Fixed: parse date as UAE midnight, generate slot strings in local time, send `+04:00` offset from booking modal, display with explicit `Asia/Dubai` timezone
- **Fixed "Failed to create appointment"** — booking modal sent `startTime: "09:00"` (slot only), server did `new Date("09:00")` = Invalid Date → Prisma failure. Fixed to send `"2026-04-25T09:00:00"` by combining date + slot
- **Fixed time slot buttons showing "Invalid Date"** — slots are plain `"HH:MM"` strings but were passed through `new Date(s).toLocaleTimeString()` which returns Invalid Date. Fixed to render the string directly
- **Fixed booking modal always showing "No available slots"** — availability endpoint returns an array `[{ staffId, staffName, slots }]` but frontend was reading `res.data.slots` (undefined on an array), always falling back to `[]`. Fixed to read `res.data[0].slots`. Also: internal endpoint now has the same Fri/Sat fallback as the public booking page, and the date label now shows the day of week so agents know if they picked a day off
- **Annual billing toggle** — Monthly/Annual switch on the plans page with "Save 20%" badge; prices update dynamically; annual checkout sends the correct Stripe annual price ID; removed "coming soon" placeholder
- **Fixed "Failed to load appointments data"** — wrong URL `/api/templates` (returned 200 HTML catch-all) changed to `/api/templates/whatsapp`; added `Array.isArray()` guard so HTML response doesn't throw a TypeError and trigger the error toast
- **Fixed template setup "Object does not exist" error** — rewrote `setupTemplates()` in the frontend to call the proven `/api/templates/whatsapp/create` endpoint directly (3 times, once per template) instead of the internal `/api/appointments/setup-templates` route that was picking the wrong WABA credential
- **Fixed Meta policy violation** — reminder template bodies were ending with a variable (`{{business}}`); restructured so all templates end with static punctuation and business name is placed mid-body
- **Added WhatsApp number picker to template setup banner** — when a workspace has a connected number the banner shows a dropdown so the owner can choose which WABA to submit templates on
- **Fixed reminder time showing wrong timezone (UTC instead of UAE)** — `toLocaleTimeString([])` was using server UTC; all date/time formatting in `appointmentReminders.ts` and the booking confirmation now passes explicit `timeZone: process.env.REMINDER_TIMEZONE || "Asia/Dubai"`
- **Fixed Business Name not saving in Settings** — `BusinessSettings` component was using `defaultValue` (uncontrolled input) with a Save button that had no `onClick` handler. Fixed: controlled input with `useState`, `useEffect` sync, Save button calls new `PATCH /api/workspaces/:id` endpoint, updates `AppContext` immediately so the sidebar and reminder messages reflect the new name without a page reload
- **New API endpoint**: `PATCH /api/workspaces/:id` — updates workspace name, requires ADMIN or OWNER role

### April 25, 2026 — Phase 2: Flexible Reminders & Template Builder

- **In-app WhatsApp Template Builder** — Create and submit Meta-reviewed templates directly from Tawasel without ever opening Meta Business Manager
  - **Header types**: None / Text / Image (JPG/PNG) / Video (MP4) — image/video uploaded to Meta via resumable upload API to get a `header_handle` for compliance review
  - **Body editor** with named variable tags (`{{customer_name}}`, `{{service}}`, `{{date}}`, etc.) — auto-converted to numbered `{{1}}`, `{{2}}` format on submit with auto-generated sample values, fixing Meta's "Incorrect params" rejection
  - **Buttons**: add Quick Reply, URL, or Phone Number buttons (up to 3) with a live WhatsApp-style preview
  - **WhatsApp number picker** — workspaces with multiple connected numbers can choose which WABA receives the template
  - **Compact modal** — sticky header/footer, scrollable body, fits without zooming out
  - **Status pills**: APPROVED (green) / PENDING (amber) / REJECTED (red) — rejection reason shown inline so you know exactly what to fix
  - **Auto-sync on load**: if any template is PENDING, the page silently re-syncs from Meta in the background to catch newly approved/rejected templates
  - **Delete templates**: trash icon on each template card removes from Meta Graph API and local DB simultaneously

- **Appointment Reminder Rules Engine** — Replace the fixed 24h/1h reminders with fully configurable reminder schedules
  - New **Reminders** tab on the Appointments page — create, edit, toggle, and delete rules without touching code
  - Any offset you want: 15 min before, 2 hours before, 12 hours before, 48 hours after — all supported
  - Two trigger directions: `BEFORE_START` (reminders) and `AFTER_END` (follow-ups)
  - Each rule targets a Meta-approved template name or a custom plain-text message body
  - Maximum 5 active rules per workspace
  - Scheduler runs every 30 min with a ±20 min tolerance window — rules-based pass first, legacy 24h/1h/post-visit fallback for workspaces with no custom rules
  - New schema models: `AppointmentReminderRule` (the config), `AppointmentReminderLog` (dedup guard — prevents double-sends)

- **WhatsApp Token Auto-Refresh (permanent fix)** — Customers no longer need to reconnect their WhatsApp number every 60 days
  - `server/services/tokenRefresh.ts` — daily scheduler finds tokens expiring within 30 days and renews them silently via Meta's `fb_exchange_token` API
  - Runs once on server startup (catches already-expired tokens), then every 24 hours
  - Embedded Signup now also exchanges the short-lived code for a 60-day long-lived token immediately at connect time, then the daily scheduler keeps it alive indefinitely

- **Deploy checklist**: `npx prisma db push` (adds `rejectedReason`, `AppointmentReminderRule`, `AppointmentReminderLog`) → `npx prisma generate` → `npx vite build` → `pm2 restart ecosystem.config.cjs`

### April 24, 2026 — Phase 1.5: AI Self-Service Appointments

- **New chatbot tools** (`server/services/ai.ts`): Customers can now view, reschedule, and cancel their own appointments directly through WhatsApp chat
  - `get_my_appointments` — "Do I have an appointment?" → AI shows upcoming bookings
  - `reschedule_my_appointment` — "Move my 3pm to 5pm tomorrow" → AI checks availability, confirms, and moves the booking
  - `cancel_my_appointment` — "Cancel my appointment" → AI confirms and cancels
- **Security-first design**: `contactId` is derived server-side from the WhatsApp conversation (never from LLM args), so the AI can only view or modify the caller's own appointments. Cross-user enumeration attempts are rejected. Ownership is re-verified before every mutation. Reminder flags (`reminderSentAt`, `reminder1hSentAt`) are reset on reschedule so new reminders fire for the new time
- **Activity log entries** for every AI-driven reschedule/cancel, so owners have a full audit trail

### April 24, 2026 — Phase 1: Close the Booking Loop

- **Public self-service booking page** at `/book/:slug` — no login required. Customers pick service → staff (or "Any Available") → date → time slot → enter name + phone → confirm. On submit the system upserts a contact, creates the appointment, and fires a WhatsApp confirmation (template-based). Owners share the link `app.tawasel.io/book/{workspace-slug}` on Instagram bio, Google Business Profile, or website
- **Calendar view with drag-to-reschedule** on the Appointments page. Toggle between list and calendar in the toolbar. Week view by default. Appointments render as colored blocks using the service color. Drag any event to a new time slot → `PATCH /api/appointments/:id` updates `startTime` + `endTime` + resets reminder flags
- **1-hour reminder + post-visit follow-up**: The reminder scheduler now runs three passes every 30 minutes — 24h before, 1h before, and a post-visit follow-up ("How was your [service] with [staff]?") within the 4-hour window after appointment end. Schema additions: `reminder1hSentAt`, `followUpSentAt` on `Appointment`
- **Template auto-setup** (`POST /api/appointments/setup-templates`): One-click button in the Appointments page creates three WhatsApp templates in the owner's WABA via Meta Graph API — `tawasel_booking_confirmation`, `tawasel_reminder_24h`, `tawasel_reminder_1h`. Owner no longer needs to touch Meta Business Manager. Handles "already exists" (code 2388085) gracefully
- **Template status banner**: Appointments page shows a 3-state banner (missing / pending / ready) so the owner knows when reminders can actually fire
- **Resilience fixes**: Public booking availability falls back to all enabled staff when no `StaffService` junction rows exist, and defaults to 09:00–17:00 Sun–Thu when a staff member has no `workingHours` configured. Appointments page switched from `Promise.all` to `Promise.allSettled` so a single failing endpoint (e.g. `/api/templates` on workspaces without a connected WABA) no longer breaks the whole dashboard

### April 19, 2026

- **Profile Picture Upload**: Upload button in Personal Settings now works — file picker opens, image previews instantly in the avatar circle, saved to DB via `PATCH /api/users/me`. Full Name field is now editable with a Save Changes button. Avatar updates across the whole app immediately after save.
- **Superadmin Change Password**: Added an Account tab to the superadmin dashboard with a working change password form. Superadmin was previously locked to `/app/superadmin` with no way to change their password since `/app/settings` is off-limits.
- **Embedded Signup auto-registration**: The finalize endpoint now automatically calls `POST /{phoneNumberId}/register` and `POST /{wabaId}/subscribed_apps` after saving a number. Previously every customer doing Embedded Signup ended up with a "Pending" number that never received messages — fixed for all future signups.
- **Superadmin dashboard fix**: `VITE_SUPERADMIN_EMAIL` was missing from server `.env`, causing the superadmin to see no dashboard after login. Added the env var and documented it as required before `npx vite build`.
- **Superadmin API access fix**: `SUPERADMIN_EMAIL` (server-side) was also missing, causing "Superadmin access required" errors on all API calls from the dashboard.

### April 16, 2026

- **CORS Sentry noise fix**: Replaced `callback(new Error(...))` with `callback(null, false)` in both the Express CORS middleware and the Socket.io origin handler. Bots and scanners hitting the API with unlisted `Origin` headers were generating Sentry error alerts every night. Silent rejection stops the noise — browsers still can't make cross-origin requests, but no server-side error is raised.

### April 15, 2026 — Production Hardening for 100 Workspaces

- **PostgreSQL Migration**: Switched `prisma/schema.prisma` from `sqlite` to `postgresql`. Database now runs on Postgres 16 on the DigitalOcean droplet. Seed script rewritten to use `TRUNCATE ... CASCADE` instead of SQLite-specific resets.
- **Automated Backups**: Hourly `pg_dump` via cron with 30-day retention. Dumps stored in `/root/backups/postgres` with `.pgpass` auth.
- **Sentry Error Tracking**: `@sentry/node` initialized in both the API server and the webhook worker. All unhandled errors plus `Sentry.setupExpressErrorHandler(app)` capture Express failures. `SENTRY_DSN` env var required.
- **Graceful Shutdown**: Server and worker both handle SIGTERM/SIGINT — close HTTP connections, drain BullMQ queue, quit Redis, flush Sentry, disconnect Prisma. Prevents dropped in-flight requests during `pm2 restart` / deploys.
- **Redis + BullMQ Async Webhook Pipeline**: The `/webhook/meta` endpoint now enqueues incoming Meta events to a BullMQ queue (`meta-webhooks`) and responds `200` in ~5ms. A separate `tawasel-worker` process consumes the queue and runs the full processing pipeline (WhatsApp/Instagram messages, AI chatbot, auto-assign, follow-ups, escalation, broadcast receipts). Cross-process Socket.io events are relayed through a Redis pub/sub channel (`socket-events`) so the main server emits them to connected browser clients. Eliminates Meta webhook timeouts under load and decouples slow AI/DB work from the HTTP request path.
- **PM2 Ecosystem File** (`ecosystem.config.cjs`): Declares both `tawasel-app` (API + Socket.io) and `tawasel-worker` (BullMQ consumer) with 15s `kill_timeout` so graceful shutdown has time to complete.

### April 14, 2026

- **Arabic Translations**: Wired `react-i18next` into 20 core app pages so the Arabic language switcher fully localizes the main product surface — Dashboard, Inbox, Contacts, CRM Pipeline, Appointments, Compose, Broadcast, Templates, Channels, Chatbots, Campaigns, Team, Follow-ups, Auto-Assign, Integrations, Web Chat Widget, Home, Register, and Forgot Password. Remaining untranslated pages (FeatureRequest, ReportIssue, ResetPassword, VerifyEmail, SwitchAccount, Superadmin, and marketing/legal pages) are lower priority and will follow.

### April 5, 2026

- **Meta App Review**: `whatsapp_business_management` permission approved. `whatsapp_business_messaging` submitted (pending — screencast must show message received on phone)
- **Permanent System User Token**: Replaced 24-hour temporary Meta access token with permanent System User token
- **Delete WhatsApp Numbers**: Channels page now supports deleting connected WhatsApp numbers with full cascade cleanup (conversations, messages, notes, tasks, activities, campaigns, recipients)
- **Embedded Signup Improvements**:
  - Added retry with 3-second delay for phone number provisioning
  - Added System User token fallback for phone asset lookup
  - Fixed React state race condition — session hints now use useRef for synchronous access
  - Added detailed error logging and token debug endpoint for troubleshooting
  - Known issue: phone lookup still returns 0 results when signing up under a different Business Account (SOSO) than the app owner (Quantops) — debug logging added to diagnose exact Meta API error

### March 28, 2026

- **Resend Email Verification**: Configured and verified tawasel.io domain on Resend with DKIM + SPF records for transactional email delivery
- **Password Reset Emails**: Forgot password flow now sends real reset emails via Resend API (was previously blocked by unverified domain)
- **Broadcast Bug Fix**: Fixed "Workspace ID required" error when launching broadcast campaigns — `requireRole` middleware was running before multer parsed the FormData body, so `workspaceId` was undefined. Now sends `workspaceId` via `x-workspace-id` header as fallback
- **CORS Fix**: Added `x-workspace-id` to CORS `allowedHeaders` — browser was blocking broadcast requests because the custom header wasn't permitted in preflight
- **Nginx Upload Limit**: Set `client_max_body_size 25M` to allow FormData with file uploads (was defaulting to 1MB)
- **Server Deployment**: Updated production server with latest code, new Meta access token, and Prisma migration baseline

### March 26, 2026 (Update 3)

- **Advanced Superadmin Dashboard**: Full platform management capabilities for the SaaS owner
  - **Platform Analytics**: Total workspaces, users, messages, conversations, active workspaces (30d), messages today/7d/30d, MRR calculation, plan distribution with progress bars, top workspaces by message volume
  - **Suspend/Ban Workspaces**: Toggle suspension on any workspace with a reason. Suspended workspaces are blocked from accessing the app with a clear error message. Red "SUSPENDED" badge in the dashboard
  - **Override Plan Limits**: Temporarily upgrade any workspace's plan (STARTER/GROWTH/PRO) for a configurable number of days. Shows "OVERRIDE: PRO until Apr 5" badge. Limits auto-revert after expiration
  - **Impersonate Workspace**: Click "Impersonate" to enter any workspace as OWNER for debugging/support. Yellow banner shows "Impersonating [name]" with exit button. Creates temporary membership, removed on exit
  - **Stripe Refunds**: Issue full or partial refunds to any workspace's latest Stripe charge. Modal shows last payment amount with reason dropdown (duplicate, fraudulent, requested_by_customer)
  - Schema additions: `suspended`, `suspendedReason`, `planOverride`, `planOverrideUntil` fields on Workspace model
  - Plan override check in `getWorkspacePlanLimits` — active overrides take precedence

### March 26, 2026 (Update 2)

- **Role-Based Access Control (RBAC)**: Enforced authority levels across all API routes and frontend navigation
  - **SUPERADMIN** (SaaS Owner): Platform-wide admin dashboard — view all workspaces, users, billing, and usage
  - **OWNER** (Business Owner): Full workspace access — billing, team, channels, chatbots, and all settings
  - **ADMIN** (Team Manager): Full operational access — chatbots, channels, broadcasts, templates, auto-assign, follow-ups, campaigns, services, staff. Cannot manage billing or delete workspace
  - **USER** (Agent): Day-to-day operations — inbox, CRM, contacts, appointments, compose messages. Cannot access admin settings
  - `requireRole('ADMIN', 'OWNER')` middleware applied to 28 sensitive routes (chatbots, channels, templates, team, auto-assign, follow-ups, services, staff, campaigns)
  - `requireRole('OWNER')` applied to 3 billing routes
  - Sidebar navigation auto-filters based on user role — agents only see pages they can access
  - Workspace API now returns membership role to frontend
  - `workspaceRole` exposed in AppContext for component-level role checks

### March 26, 2026

- **Mobile Responsive Layout**: Full mobile support for the entire app
  - Sidebar becomes a slide-in overlay with hamburger menu (☰) on mobile
  - Mobile top bar with Tawasel branding and menu toggle
  - Inbox: conversation list → tap to open chat full-screen with back arrow (←)
  - Contact info panel slides in from right on mobile via panel button
  - Desktop layout completely unchanged — all changes use Tailwind `md:` breakpoints
  - New `SidebarContext` for sidebar open/close state management
- **Favicon**: Added SVG favicon — green chat bubble with white "T" matching brand colors
- **Theme color**: Added `<meta name="theme-color">` for mobile browser address bar

### March 25, 2026 (Update 4 — Hotfix)

- **Follow-up Sequences page fix**: Fixed "Failed to load data" error — page was calling `/api/templates` (non-existent) instead of `/api/templates/whatsapp`

### March 25, 2026 (Update 3)

- **AI-to-Human Escalation System**: The AI chatbot now automatically detects when it can't help a customer and escalates to a human agent
  - AI calls `escalate_to_agent` tool when: customer asks for a human, bot fails to help after multiple attempts, customer is frustrated, or request needs human judgment (refunds, complaints)
  - Conversation is automatically paused from AI auto-replies and set to **WAITING FOR INTERNAL** status
  - Priority is auto-raised to **HIGH** so agents notice it immediately
  - Real-time **toast notification with sound** alerts all agents in the workspace
  - Activity log records the escalation reason for context
  - Agent clicks "Open" on the notification → jumps straight to the conversation
  - Works on both WhatsApp and Instagram channels

### March 25, 2026 (Update 2)

- **Campaign Link Generator** (`/app/campaigns`): Create trackable WhatsApp links for ads on any platform — Snapchat, Google, TikTok, Instagram, Facebook, YouTube, LinkedIn, Email, Website, QR Code, and Referral
  - Pick platform → name campaign → get a unique `wa.me` link with embedded tracking code
  - Platform-specific step-by-step guides showing exactly where to paste the link in each ad platform's UI
  - WhatsApp message preview showing what the customer will see
  - Saved campaigns list with one-click copy
  - "How It Works" explainer with campaign code reference table
- **Campaign Code Detection**: Webhook automatically detects campaign codes (e.g., `SC-SUMMER-SALE`, `GG-CARSERVICE`) in incoming messages and auto-tags leads with platform name and campaign
  - Supports 12 platform prefixes: SC (Snapchat), GG (Google), TT (TikTok), FB (Facebook), IG (Instagram), TW (Twitter), YT (YouTube), LI (LinkedIn), EM (Email), WB (Website), QR (QR Code), RF (Referral)
  - Works alongside Meta's native Click-to-WhatsApp ad referral detection

### March 25, 2026

- Ad-driven CRM features for businesses running Facebook/Instagram/Google ads:
  - **Lead Source Auto-Tagging**: Incoming messages from Click-to-WhatsApp ads automatically tag the contact with campaign name, ad headline, and source ID from Meta's referral data
  - **Auto-Assign Rules** (`/app/auto-assign`): Create rules to automatically route incoming conversations to team members using three strategies — Round Robin, Lead Source matching, or Keyword matching — with configurable priorities
  - **Follow-up Sequences** (`/app/follow-ups`): Build automated multi-step follow-up flows that send WhatsApp template messages when leads don't reply. Supports delay configuration per step, auto-cancellation when the lead replies, and three trigger types (New Lead, Ad Lead, Manual)
  - **Follow-up Scheduler**: Background service checks every 5 minutes for due follow-up steps and sends template messages automatically
  - **Ad Performance Analytics**: New dashboard section showing ad lead count, conversion funnel (New → Contacted → Qualified → Won), leads by ad campaign, and average response time by lead source
- Schema additions: AssignmentRule, FollowUpSequence, FollowUpStep, FollowUpEnrollment models

### March 24, 2026 (Update 5)

- Conversation actions menu (three-dot button in chat header):
  - Resolve / Reopen conversation
  - Clear all messages (with confirmation)
  - Delete conversation permanently (with confirmation)
  - Real-time sync: deleted conversations removed from other users' lists via Socket.io

### March 24, 2026 (Update 4)

- Quote reply feature in Inbox (like WhatsApp app):
  - Hover over any message to see reply button
  - Click reply to show quoted message preview above input
  - Sends with WhatsApp context.message_id so customer sees quote on their phone
  - Incoming quote replies from customers also show the quoted message in inbox
  - Click on quoted message to scroll to the original message
- Fixed compose message template parameters:
  - Only sends body parameters if the template actually has variables
  - Templates with no variables (like hello_world) now work correctly

### March 24, 2026 (Update 3)

- Broadcast messages now appear in Inbox conversations:
  - Each broadcast recipient gets a message saved in their inbox conversation
  - Conversations are auto-created if they don't exist
  - Real-time Socket.io updates when broadcasts are sent
- Broadcasts now send as proper WhatsApp template messages:
  - Uses approved Meta templates instead of plain text (works outside 24-hour window)
  - Customers can see and reply to template messages properly
  - Fallback to regular text if no template selected
- Broadcast delivery status tracked in inbox (SENT → DELIVERED → READ)

### March 24, 2026 (Update 2)

- WhatsApp message delivery tracking in Inbox:
  - Outgoing messages now store Meta message ID for webhook matching
  - Status webhook updates inbox messages (not just broadcast recipients)
  - Real-time status updates via Socket.io (SENT → DELIVERED → READ)
  - Visual indicators: single gray ✓ (sent), double gray ✓✓ (delivered), double blue ✓✓ (read), red "Failed" text
  - AI bot replies also tracked with delivery status

### March 24, 2026

- Added appointment booking system:
  - Services, Staff, and Appointments CRUD with full frontend (tabs, modals, filters)
  - Staff working hours grid with per-day toggle and time ranges
  - Booking modal with step-by-step flow (contact → service → staff → date → time slot → notes)
  - Plan limits enforced for services, staff members, and monthly appointments
- AI chatbot appointment booking via OpenAI function calling:
  - 4 tools: list_services, list_staff, check_availability, book_appointment
  - Tool call loop (max 5 iterations) with automatic availability checking and overlap detection
  - Conditionally enabled when workspace has services configured
- 24-hour WhatsApp appointment reminders:
  - Background scheduler checks every 30 minutes for upcoming appointments
  - Sends formatted WhatsApp reminder with service, staff, date, time, and price
  - Prevents duplicate reminders via reminderSentAt tracking
  - Saves reminder as inbox message with real-time Socket.io updates
- WhatsApp template sync from Meta API:
  - Sync button now fetches message templates from Meta Graph API via WABA ID
  - Upserts templates into local database for offline access
- Remember me checkbox on login page:
  - Uses localStorage when checked (persists across sessions)
  - Uses sessionStorage when unchecked (expires on browser close)
- Added CLAUDE.md for efficient Claude Code session continuity
- Fixed broadcast campaign template picker:
  - Step 2 now fetches only APPROVED templates from Meta (synced via Templates page)
  - Removed hardcoded demo templates from dropdown
  - Preview shows real template content
- Removed demo WhatsApp templates from seed data (only real synced templates shown)
- Added Remember me checkbox to login page
- Fixed Compose Message page:
  - Now actually sends messages via Meta WhatsApp API (was previously mock)
  - Supports sending template messages (works outside 24-hour window)
  - Supports sending regular text messages (within 24-hour window)
  - Auto-creates contact and conversation in inbox
  - Only shows APPROVED templates from Meta

### March 15, 2026

- Repositioned the product for a WhatsApp-only launch:
  - removed Instagram from the homepage pricing and positioning
  - removed the public Enterprise plan from pricing surfaces
  - updated the homepage CTA, footer, pricing cards, comparison matrix, and FAQ to focus on WhatsApp CRM, broadcasts, inbox, and automation
- Disabled Instagram for the launch release:
  - removed Instagram from channels, dashboard, inbox filters, integrations, checklist, and settings UI
  - backend now ignores Instagram webhook events in launch mode
  - Instagram account routes return empty/blocked responses in launch mode
  - conversations and dashboard channel usage are filtered to WhatsApp for the launch build
- Upgraded CRM stage management:
  - each workspace now has one customizable pipeline
  - stages can be renamed, recolored, reordered, added, and deleted
  - default stages can also be deleted
  - deleting a stage automatically moves affected leads into a remaining stage
  - CRM, Inbox, Contacts, Broadcast audiences, imports, and dashboard pipeline summaries all now use the workspace stage list
- Improved inbox workflow:
  - added CRM stage dropdown to the top chat header
  - stage selector now uses the same selected color as the CRM stage config
  - unread conversations are highlighted more clearly with stronger visual treatment
- Fixed session templates and inbox sync:
  - session templates now use real backend CRUD
  - create, edit, duplicate, delete, copy, and search all work from the templates page
  - inbox session templates now sync with saved session templates instead of using a fake hardcoded list
  - template picker now supports scrolling and search for large template libraries
- Improved registration and email delivery:
  - upgraded registration with confirm-password, stronger password validation, and better client-side guidance
  - verification and forgot-password email flows now use Resend properly for deployment
  - local preview-link mode is now controlled by `ALLOW_EMAIL_LINK_PREVIEW`
- Deployment readiness updates:
  - this release is prepared for WhatsApp-first deployment on DigitalOcean
  - production email delivery expects `RESEND_API_KEY` and `EMAIL_FROM`
  - Instagram code remains in the codebase for a later release, but it is disabled for this launch build

### March 14, 2026

- Hardened core backend security:
  - removed weak JWT default usage from the expected env flow
  - added auth rate limiting
  - tightened workspace authorization on protected routes
  - enforced plan limits on key creation endpoints
  - protected superadmin routes on the server
  - enforced Meta webhook signature verification
- Reworked owner access:
  - `ameeneidha@gmail.com` now behaves as the SaaS owner/superadmin
  - superadmin is redirected into an owner-only admin experience
  - normal subscriber navigation is hidden from the owner account
- Built a stronger superadmin dashboard:
  - overview metrics
  - workspace directory with search
  - users directory with search and pagination
  - workspace detail drawer with members, billing, usage, feature requests, and issue reports
- Improved demo/test data:
  - added seeded superadmin login
  - added seeded `STARTER`, `GROWTH`, and `PRO` demo accounts for package testing
- Improved CRM workflow:
  - added deal value support
  - added inline deal value editing on CRM cards
  - fixed CRM search and filter behavior
- Implemented real email verification:
  - registration now creates secure email verification tokens
  - added resend and verification completion endpoints on the backend
  - added `/verify-email` and `/verify-email-sent` public pages
  - supports real delivery through Resend with `RESEND_API_KEY` and `EMAIL_FROM`
  - falls back to preview verification links when email delivery is not configured
- Polished the landing page pricing section:
  - removed the add-ons block to keep the pricing page cleaner

### Demo Accounts

- Superadmin: `ameeneidha@gmail.com` / `password123`
- Starter: `starter@wabahub.local` / `password123`
- Growth: `growth@wabahub.local` / `password123`
- Pro: `pro@wabahub.local` / `password123`

Demo accounts are recreated by running:

`npm run seed`
