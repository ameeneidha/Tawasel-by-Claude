# Tawasel - SaaS WhatsApp CRM

## Tech Stack
- **Frontend**: React 19 + Vite + TypeScript + Tailwind CSS + Radix UI + Lucide icons + Sonner toasts
- **Backend**: Express.js (server.ts) + Prisma ORM + PostgreSQL 16
- **Real-time**: Socket.io (cross-process events relayed via Redis pub/sub channel `socket-events`)
- **Queue**: Redis + BullMQ — Meta webhooks enqueued on `meta-webhooks` queue, processed by separate `tawasel-worker` process
- **AI**: OpenAI gpt-4.1-mini with function calling (tool use loop)
- **Payments**: Stripe
- **Channels**: WhatsApp (Meta Cloud API) + Instagram DMs
- **Monitoring**: Sentry (@sentry/node) in both server and worker
- **Process manager**: PM2 via `ecosystem.config.cjs` — runs `tawasel-app` + `tawasel-worker`

## Project Structure
- `src/` — React frontend (Vite)
- `src/pages/` — Page components (Inbox, Contacts, Appointments, Campaigns, etc.)
- `src/components/` — Shared components (Sidebar, Topbar, etc.)
- `src/contexts/SidebarContext.tsx` — Mobile sidebar open/close state
- `src/constants/plans.ts` — Plan tier config (STARTER/GROWTH/PRO)
- `server.ts` — Express API + Socket.io + route handlers. Webhook endpoint is now a thin queue-and-respond.
- `server/worker.ts` — BullMQ worker process. Consumes the `meta-webhooks` queue and relays Socket.io events via Redis pub/sub.
- `server/lib/redis.ts` — Shared Redis connection + queue/channel name constants
- `server/services/webhookProcessor.ts` — Extracted Meta webhook processing logic (WhatsApp + Instagram + AI + auto-assign + follow-ups + escalation). Takes a `WebhookContext { emit }` so it works in both the worker and inline fallback.
- `server/services/ai.ts` — AI chatbot with OpenAI function calling (appointment booking tools)
- `server/services/appointmentReminders.ts` — Rules-based + legacy reminder scheduler (24h, 1h, post-visit)
- `server/services/tokenRefresh.ts` — Daily WhatsApp OAuth token auto-refresh (keeps 60-day tokens alive indefinitely)
- `server/services/meta.ts` — WhatsApp/Instagram message sending
- `server/middleware/auth.ts` — Auth + plan limit enforcement
- `server/config.ts` — Plan limits configuration
- `ecosystem.config.cjs` — PM2 ecosystem file declaring both server + worker
- `prisma/schema.prisma` — Database schema (PostgreSQL)
- `prisma/seed.ts` — Demo data seeder (uses TRUNCATE CASCADE for Postgres reset)

## Key Patterns
- Multi-tenant: everything scoped by workspaceId
- Auth: requireAuth middleware → req.user, workspace membership check
- RBAC: requireRole('ADMIN', 'OWNER') middleware for sensitive routes, requireRole('OWNER') for billing
- Plan limits: enforceWorkspacePlanLimit('resource', res, workspaceId) middleware
- API: Express routes in server.ts with Prisma queries
- Frontend state: useApp() context hook for workspace/user data
- Socket.io rooms: joined by workspaceId for real-time updates

## Dev Commands
```bash
npm run dev          # Start dev server (frontend + backend on port 3000)
npx prisma studio    # Browse database
npx prisma db seed   # Reset and seed demo data
npx prisma migrate dev --name <name>  # Create migration
npx tsc --noEmit     # Type check
npx vite build       # Production build
```

## Demo Accounts (after seeding)
- Superadmin: ameeneidha@gmail.com / password123
- Starter: starter@wabahub.local / password123
- Growth: growth@wabahub.local / password123
- Pro: pro@wabahub.local / password123

## Environment Variables Needed
- DATABASE_URL (PostgreSQL connection string, e.g. `postgresql://tawasel:<password>@localhost:5432/tawasel_db?schema=public`)
- REDIS_URL (defaults to `redis://127.0.0.1:6379`)
- SENTRY_DSN (optional but recommended in production)
- WEBHOOK_WORKER_CONCURRENCY (optional, default 10)
- JWT_SECRET
- **SUPERADMIN_EMAIL + VITE_SUPERADMIN_EMAIL** — must both be set to the superadmin email (e.g. `ameeneidha@gmail.com`). `VITE_SUPERADMIN_EMAIL` is baked into the frontend at build time — if missing, the superadmin sees no dashboard after login. Requires `npx vite build` after adding.
- OPENAI_API_KEY
- META_ACCESS_TOKEN, META_PHONE_NUMBER_ID (WhatsApp)
- META_APP_ID, META_APP_SECRET, META_EMBEDDED_SIGNUP_CONFIG_ID (WhatsApp Embedded Signup)
- STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
- RESEND_API_KEY, EMAIL_FROM (e.g., `Tawasel <noreply@tawasel.io>`)
- INSTAGRAM_ACCESS_TOKEN

## Recently Completed (April 27, 2026) — Phase 2c: Per-appointment reminder timeline

- Appointment rows and calendar events now have a clock action that opens a per-booking reminder timeline.
- New endpoint: `GET /api/appointments/:id/reminder-timeline?workspaceId=...` returns active rule schedule entries plus legacy 24h/1h/follow-up sends.
- `AppointmentReminderLog` now stores `status`, `scheduledFor`, and `errorMessage` for visible SENT / SCHEDULED / FAILED / MISSED states.
- Rules scheduler now records failed sends durably and retries later; only successful `SENT` logs suppress future sends for that rule/appointment pair.
- Appointments mobile list now renders phone-friendly cards with compact filters and a bottom-sheet reminder timeline modal.
- Appointment booking now opens as a full-height mobile sheet with sticky header/footer, larger form controls, easier time-slot buttons, and a horizontally scrollable calendar on phones.
- Inbox mobile view now opens to the conversation list on phones, has a clear Chats back button, wider message bubbles, touch-sized composer controls, a full-width template picker, and a full-screen contact panel.
- Inbox no longer auto-generates AI reply suggestion chips when a conversation opens, keeping the reply composer focused on the agent's message.
- Contacts mobile view now renders phone-friendly cards with a compact horizontal list bar, easier create/import actions, and tappable selection for bulk list actions.
- CRM mobile view now renders a phone-friendly stage tab layout with lead cards, deal value editing, and a move-stage control while preserving the desktop pipeline board.
- Settings mobile view now uses a compact horizontal nav, tighter spacing, full-width primary actions, responsive profile/business forms, and horizontal scrolling for billing/API tables.
- Team mobile view now renders member cards, full-width invite actions, and mobile sheet dialogs for inviting/editing members while preserving the desktop table.
- Dashboard mobile view now uses tighter spacing, two-column KPI cards, full-width filter controls, stacked team workload rows, and campaign summary cards.
- Activation checklist now guides first-time workspaces through the booking setup path: WhatsApp connection, service creation, staff availability, booking link testing, reminder rules, and optional AI bot setup.
- Appointments empty states now guide first-time setup with actions for services, staff, test bookings, and reminder rules.
- Inbox empty states now explain the first-message flow and link users toward WhatsApp connection, templates, and later AI bot setup.
- Contacts and CRM empty states now explain how customer data enters Tawasel and offer add/import/first-lead actions.
- Templates empty states now explain Meta-approved WhatsApp templates versus internal session quick replies, with create/sync actions.
- Contacts bulk removal now infers the current selected contact list, so "remove from list" works without selecting the same list again in the picker.
- Manual CRM/Contacts create and edit now normalize phone numbers and block duplicate same-number contacts in the same workspace.
- Contacts page now has safe delete actions; contacts with conversation or appointment history are protected and return a merge-needed message.
- Contacts page now supports merging selected same-number duplicates into a chosen keeper, moving conversations, appointments, tasks, activity, follow-ups, lists, and custom values.
- Deploy requires `npx prisma db push`, `npx prisma generate`, `npx vite build`, then `pm2 restart ecosystem.config.cjs`.

## Recently Completed (April 25, 2026) — Bug Fixes

### Business Name save in Settings (Settings.tsx + server.ts)
- `BusinessSettings` component converted from uncontrolled (`defaultValue`) to controlled (`value` + `useState`)
- `useEffect` syncs state when `activeWorkspace` changes (first load, workspace switch)
- Save button wired to new `PATCH /api/workspaces/:id` endpoint; calls `setActiveWorkspace()` on success so sidebar + reminder messages reflect the new name immediately without a page reload
- Button disabled when name is unchanged or empty; shows "Saving…" during request
- New endpoint: `PATCH /api/workspaces/:id` — requireAuth + inline ADMIN/OWNER role check, updates `workspace.name` in Prisma

### Appointments page & template setup fixes (Appointments.tsx + server.ts + appointmentReminders.ts)
- Wrong URL `/api/templates` → `/api/templates/whatsapp`; added `Array.isArray()` guard (was throwing TypeError on 200 HTML response from catch-all, triggering "Failed to load" toast)
- `setupTemplates()` rewired to call proven `/api/templates/whatsapp/create` endpoint 3 times instead of `/api/appointments/setup-templates` (was picking wrong WABA credential, returning "Object does not exist")
- WhatsApp number picker shown on template setup banner when `waNumbers.length >= 1` (was `> 1`, hidden when only 1 number)
- Template bodies restructured: business name moved to mid-body, all templates end with static punctuation — fixes Meta policy violation (variable at start/end)
- Timezone fix: all date/time formatting in `appointmentReminders.ts` and booking confirmation now passes explicit `timeZone: process.env.REMINDER_TIMEZONE || "Asia/Dubai"` — was showing UTC time (4h wrong)

### Reminder rules not firing when template is specified (appointmentReminders.ts)
- Bug 1: `hasApprovedTemplate()` checked local DB which may be stale (PENDING even after Meta approved). When false, fell back to plain text which requires an open 24h session window — fails silently for customers who haven't messaged recently. Fix: when a template name is set in the rule, always try it directly on Meta without the local DB check.
- Bug 2: Wrong parameter order for all 3 standard templates. Templates expect `[customerName, businessName, staffName, time]` but code sent `[customerName, serviceName, staffName, time, businessName]` — service name in the business name slot. Fixed in both rules-based and legacy 24h/1h reminder functions.

### Template status banner stuck on "pending" after Meta approval (Appointments.tsx)
- Root cause: Appointments page only read template status from local DB — never called the sync endpoint. Meta could approve templates but local DB still showed PENDING.
- Fix: on load, if any needed template is pending or missing, silently call `POST /api/templates/whatsapp/sync` first, then re-fetch — banner now reflects real Meta status. Refresh button benefits from the same fix via `fetchAll()`.

### Appointment times 4 hours off (Appointments.tsx + server.ts)
- Root cause: availability endpoint used UTC midnight as day start → slots generated in UTC not UAE time ("09:00" = 09:00 UTC = 1:00 PM UAE). Booking modal sent `startTime` without tz offset → stored as UTC → browser displayed in UAE = 4h ahead
- Fix: both availability endpoints parse date as UAE midnight (`Date.UTC(y,m,d) - 4h`), generate slot strings as `(utcHours + 4) % 24`
- Fix: booking modal sends `startTime: \`${date}T${slot}:00+04:00\`` so server stores correct UTC
- Fix: `formatTime`/`formatDate` use explicit `timeZone: 'Asia/Dubai'`
- Fix: appointment list date filter uses `en-CA + Asia/Dubai` to get `YYYY-MM-DD` in UAE time
- Fix: public booking server builds `startTime` from UAE-aware `dayStartUTC`

### Booking modal "No available slots" always shown (Appointments.tsx + server.ts)
- Root cause: availability endpoint returns an **array** `[{ staffId, staffName, slots }]` but frontend read `res.data.slots` (undefined on an array) → always fell back to `[]`
- Fix: `const staffResult = Array.isArray(res.data) ? res.data[0] : res.data; setSlots(staffResult?.slots || [])`
- Also: internal availability endpoint now matches public booking fallback — if staff has no hours for Fri/Sat, returns `dayOff: true` + empty slots; for other days defaults to 09:00–17:00 instead of always returning empty
- UX: date label now shows day of week ("Friday") so agent knows immediately if they picked a day off; "no slots" message hints "staff may not work on weekends" on Fri/Sat
- Time slot buttons showed "Invalid Date" — slots are plain strings like "09:00" but were passed through `new Date(s).toLocaleTimeString()`. Fixed to render the string directly.
- "Failed to create appointment" — booking modal sent `startTime: slot` ("09:00"), server did `new Date("09:00")` = Invalid Date → Prisma error. Fixed: send `startTime: \`${date}T${slot}:00\`` (e.g. "2026-04-25T09:00:00")

### Annual billing toggle (plans.ts + Settings.tsx)
- `plans.ts`: filled `annualStripePriceId` for all 3 plans (STARTER/GROWTH/PRO)
- Billing plans page: Monthly/Annual toggle with "Save 20%" badge; price display switches dynamically; annual shows "Billed AED X/year — save AED Y/year"; checkout sends correct Stripe price ID based on selected cycle; removed "annual coming soon" banner

### Standing rule
Every code change going forward must also update `README.md` and `AGENTS.md` before pushing.

---

## Recently Completed (April 25, 2026) — Phase 2: Flexible Reminders & Template Builder

### WhatsApp Template Builder (Templates page)
- **Full in-app template creator** — no need to use Meta Business Manager
- **Header support**: None / Text / Image (JPG/PNG) / Video (MP4) — file uploaded to Meta via resumable upload API to get `header_handle` for review
- **Body editor** with named variable tags (`{{customer_name}}`, `{{service}}`, `{{staff}}`, `{{date}}`, `{{time}}`, `{{business}}`) — auto-converted to numbered `{{1}}`, `{{2}}` format on submit with sample values (fixes "Incorrect params" rejection)
- **Buttons**: Quick Reply, URL, Phone Number — up to 3, live preview in WhatsApp-style bubble
- **WhatsApp number picker** — dropdown to select which WABA the template is created on (workspaces with multiple numbers)
- **Compact modal** — sticky header/footer, scrollable middle, max-h-[92vh], fits at 100% zoom
- **Status pills**: APPROVED (green) / PENDING (amber) / REJECTED (red) with rejection reason shown inline
- **Auto-sync on load**: if any template is PENDING, silently syncs from Meta in the background
- **Delete templates**: trash icon on each WA template card — removes from Meta Graph API + local DB
- `WhatsAppTemplate.rejectedReason` field added to schema (run `npx prisma db push` on deploy)

### Appointment Reminder Rules Engine (Appointments → Reminders tab)
- New **Reminders tab** in Appointments page (4th tab)
- Create/edit/delete/toggle reminder rules — any offset (e.g. 15min, 3h, 12h, 48h before/after)
- Two trigger types: `BEFORE_START` and `AFTER_END`
- Each rule can use a Meta-approved template name OR a plain-text message body
- Max 5 active rules per workspace
- New schema models: `AppointmentReminderRule`, `AppointmentReminderLog` (dedup guard)
- Scheduler rewrites: rules-based pass + legacy fallback (24h/1h/post-visit for workspaces with no rules)
- Tolerance window: ±20 min (scheduler checks every 30 min)

### WhatsApp Token Auto-Refresh (permanent fix, no reconnection required)
- `server/services/tokenRefresh.ts` — daily scheduler renews any token expiring within 30 days via `fb_exchange_token`
- Runs on startup to catch already-expired tokens, then every 24h
- Long-lived tokens renewed indefinitely — customers never need to reconnect every 60 days
- Embedded Signup now exchanges short-lived code for 60-day token immediately on connect
- `POST /api/meta/embedded-signup/refresh-token` — manual trigger for existing expired tokens

### Other fixes in this session
- Template sync: try per-number token first, then system-user token fallback (both endpoints)
- Prefer credentialed WhatsApp number over seeded demo placeholders in all template endpoints
- Template sync error now surfaces full detail (was swallowing Prisma errors when `rejectedReason` column missing)
- Removed stale `META_WABA_ID` env var that was causing "Object does not exist" on all template operations
- `x-workspace-id` header sent with FormData template create (fixes "Workspace ID required" with multer)

### Deploy checklist for Phase 2
```bash
git pull origin main
npm install
npx prisma db push    # adds rejectedReason, AppointmentReminderRule, AppointmentReminderLog
npx prisma generate
npx vite build
pm2 restart ecosystem.config.cjs
```

## Recently Completed (April 24, 2026) — Phase 1.5: AI Self-Service Appointments
- **3 new chatbot tools in `server/services/ai.ts`**:
  - `get_my_appointments` — lists caller's upcoming bookings
  - `reschedule_my_appointment` — moves one to a new time
  - `cancel_my_appointment` — cancels one
- All three scoped strictly by `{ workspaceId, contactId }` where `contactId` is derived server-side from the conversation (NEVER from LLM args) — prevents cross-user enumeration/leaks
- Ownership check before every mutation; rejects CANCELLED/COMPLETED targets
- Conflict check against same staff on reschedule
- Reminder flags (`reminderSentAt`, `reminder1hSentAt`) reset on reschedule
- ActivityLog entries written for each AI-driven mutation (type: `APPOINTMENT_RESCHEDULED`, `APPOINTMENT_CANCELLED`)
- System prompt updated to tell AI to call `get_my_appointments` first for reschedule/cancel flows and to decline cross-user requests

## Recently Completed (April 24, 2026) — Phase 1: Close the Booking Loop
- **Public self-service booking page** at `/book/:slug`:
  - `src/pages/BookingPage.tsx` — standalone, no AppContext/sidebar
  - 5-step flow: service → staff → date → time → details → confirmed
  - 3 public API endpoints (no auth): `GET /api/public/book/:slug`, `GET /api/public/book/:slug/availability`, `POST /api/public/book/:slug`
  - Upserts contact by phone + creates appointment + fires WhatsApp confirmation template
  - Route added before `*` catch-all in `src/App.tsx`
- **Calendar view + drag-to-reschedule** inside `src/pages/Appointments.tsx`:
  - List/Calendar toggle in toolbar
  - `AppointmentCalendar` sub-component using `react-big-calendar` + `withDragAndDrop` HOC
  - `handleEventDrop` → `PATCH /api/appointments/:id` with new startTime/endTime
  - `eventPropGetter` colors events by `service.color`
- **1h reminder + post-visit follow-up** in `server/services/appointmentReminders.ts`:
  - `send24hReminders()` — 23–25h window, uses `tawasel_reminder_24h` template
  - `send1hReminders()` — 45–90min window, uses `tawasel_reminder_1h` template
  - `sendPostVisitFollowUps()` — endTime 30min–4h ago, plain text (session should still be open)
- **Schema additions** on `Appointment`: `reminder1hSentAt`, `followUpSentAt`
- **Template auto-setup** — `POST /api/appointments/setup-templates` creates 3 templates in user's WABA via Meta Graph API using per-number OAuth token. Handles code 2388085 (already exists) gracefully. Auto-syncs after creation
- **Template status banner** in Appointments page (3 states: missing / pending / ready)
- **`sendTemplateMessage(to, templateName, language, parameters, config)`** helper added to `server/services/meta.ts`
- **Resilience fixes**:
  - Availability endpoint falls back to all enabled staff when no `StaffService` links exist, defaults to 09:00–17:00 Sun–Thu when `workingHours` is empty (booking page was returning zero slots otherwise)
  - Appointments page switched `Promise.all` → `Promise.allSettled` so one failed endpoint doesn't break the whole page (e.g. `/api/templates` on workspaces without WABA)
- **Deploy gotcha**: After pulling Phase 1, must run `npx prisma db push && npx prisma generate` on server before `pm2 restart` — Prisma client must know about new columns or `/api/appointments` 500s with P2022

## Recently Completed (April 19, 2026)
- **Profile picture upload** — Upload button in Personal Settings now works. File picker → instant preview → `PATCH /api/users/me` saves base64 image to DB. Full Name also editable with Save Changes button. Context updated immediately so avatar refreshes across the app.
- **Superadmin change password** — Added Account tab to superadmin dashboard with change password form. Superadmin is locked to `/app/superadmin` so `/app/settings` is unreachable; the form lives directly in the dashboard.
- **Embedded Signup auto-register** — `finalize` endpoint now calls `POST /{phoneNumberId}/register` + `POST /{wabaId}/subscribed_apps` automatically after DB save, using the per-number OAuth token. Previously every new number stayed "Pending" with no webhooks.
- **Superadmin dashboard fix** — `VITE_SUPERADMIN_EMAIL` was missing from server `.env`; frontend bakes it at build time so superadmin got no dashboard. Also `SUPERADMIN_EMAIL` (server-side) was missing, causing "Superadmin access required" on all API calls.

## Recently Completed (April 16, 2026)
- **CORS Sentry noise fix** — replaced `callback(new Error("Not allowed by CORS"))` with `callback(null, false)` in both the Express `corsMiddleware` and Socket.io origin handler. Bots/scanners hitting the API with unlisted `Origin` headers were flooding Sentry with false-positive CORS errors every night. Silent rejection stops the noise while keeping the security behaviour identical.

## Recently Completed (April 15, 2026) — Production Hardening
- **PostgreSQL migration** — Prisma now uses `postgresql` provider on Postgres 16; seed rewritten with `TRUNCATE CASCADE`
- **Hourly pg_dump backups** — cron-driven, 30-day retention, stored in `/root/backups/postgres`
- **Sentry error tracking** — wired into server + worker, `setupExpressErrorHandler` catches Express errors
- **Graceful shutdown** — SIGTERM/SIGINT closes HTTP, drains BullMQ queue, quits Redis, flushes Sentry, disconnects Prisma
- **Redis + BullMQ async webhook pipeline**:
  - `/webhook/meta` enqueues events on `meta-webhooks` queue and responds 200 in ~5ms (no more Meta retries on slow AI/DB)
  - `server/worker.ts` — dedicated BullMQ worker process runs `processMetaWebhook()`
  - `server/services/webhookProcessor.ts` — extracted ~700 lines of webhook logic, takes `WebhookContext { emit }` callback
  - Cross-process Socket.io events relayed via Redis pub/sub channel `socket-events`
  - Fallback: if queue is unavailable at request time, webhook is processed inline
  - Retry: 5 attempts with exponential backoff, auto-cleanup of completed/failed jobs
- **PM2 ecosystem.config.cjs** — declares `tawasel-app` and `tawasel-worker` with 15s `kill_timeout`

## Recently Completed Features
- Campaign Link Generator (/app/campaigns) — create trackable wa.me links for any ad platform
- Campaign code detection in webhook — auto-tags leads from Snapchat, Google, TikTok, etc.
- 12 platform prefixes: SC, GG, TT, FB, IG, TW, YT, LI, EM, WB, QR, RF
- Appointment booking system (Services, Staff, Appointments CRUD)
- AI chatbot appointment booking via OpenAI function calling
- 24-hour WhatsApp appointment reminders (background scheduler)
- WhatsApp Embedded Signup (already implemented, needs Meta env vars)
- WhatsApp template sync from Meta Graph API (POST /api/templates/whatsapp/sync)
- Broadcast template picker uses real approved Meta templates (no more hardcoded options)
- Remember me checkbox on login (localStorage vs sessionStorage)
- Removed demo WhatsApp templates from seed — only real synced templates shown
- Compose Message page now sends real messages via Meta API (POST /api/compose/send)
- Compose and Broadcast pages only show APPROVED templates from Meta
- Lead source auto-tagging from Click-to-WhatsApp ads (Meta referral data)
- Auto-assign rules engine (round-robin, lead source, keyword-based routing)
- Follow-up sequences (auto-send templates when leads don't reply)
- Ad performance analytics + conversion funnel on dashboard
- AI-to-human escalation system (auto-detects when bot can't help, pauses AI, notifies agents with sound + toast, sets conversation to WAITING_FOR_INTERNAL)
- Mobile responsive layout — sidebar overlay, mobile top bar, full-screen inbox chat with back arrow
- SVG favicon — green chat bubble with white T
- Quote reply in inbox with image thumbnail previews
- Role-based access control (RBAC) — requireRole middleware on 31 routes, sidebar filters by role
- Four authority levels: SUPERADMIN → OWNER → ADMIN → USER
- workspaceRole exposed in AppContext for frontend role checks
- Advanced superadmin dashboard: platform analytics, suspend/ban, plan override, impersonate, Stripe refunds
- Workspace model extended: suspended, suspendedReason, planOverride, planOverrideUntil fields
- Plan override logic in getWorkspacePlanLimits — active overrides take precedence over Stripe plan
- Resend domain verification for transactional emails (tawasel.io)
- Forgot password / password reset via Resend email
- Email verification flow via Resend email
- Fixed broadcast "Workspace ID required" bug — requireRole middleware ran before multer parsed FormData body, now sends workspaceId via x-workspace-id header
- Added x-workspace-id to CORS allowedHeaders (was blocking broadcast requests)
- Nginx client_max_body_size set to 25M for FormData/file uploads

## Deployment
- **Server**: DigitalOcean droplet at 137.184.35.83
- **Domain**: tawasel.io (root), app.tawasel.io (frontend), api.tawasel.io (backend)
- **DNS**: Hostinger
- **Email**: Resend (DKIM + SPF verified on tawasel.io)
- **Process manager**: PM2 (`pm2 restart tawasel-app`)
- **App directory on server**: `/root/SaaSdeploy`
- **GitHub repo**: github.com/ameeneidha/Tawasel-by-Codex (origin on server)

## Server Deploy Commands
```bash
ssh root@137.184.35.83
cd /root/SaaSdeploy
git pull origin main
npm install                    # picks up bullmq + ioredis when new
npx vite build
# First time only: install Redis + register PM2 ecosystem
# sudo apt install -y redis-server && sudo systemctl enable --now redis-server
# pm2 delete tawasel-app 2>/dev/null; pm2 start ecosystem.config.cjs && pm2 save
pm2 restart ecosystem.config.cjs   # restarts both tawasel-app and tawasel-worker
pm2 logs tawasel-worker            # verify worker is consuming the queue
```

## Recently Completed (April 14, 2026)
- Arabic translations wired into 20 core app pages via react-i18next (Dashboard, Inbox, Contacts, CRM, Appointments, Compose, Broadcast, Templates, Channels, Chatbots, Campaigns, Team, FollowUps, AutoAssign, Integrations, WebChatWidget, Home, Register, ForgotPassword, Settings/Login already done)
- Remaining untranslated pages (lower priority): FeatureRequest, ReportIssue, ResetPassword, VerifyEmail, VerifyEmailSent, SwitchAccount, Superadmin, and marketing pages (About, Careers, Changelog, Privacy, Terms, DataDeletion, NotFound)

## Recently Completed (April 13, 2026)
- Meta App Review: whatsapp_business_management APPROVED ✅
- Meta App Review: whatsapp_business_messaging APPROVED ✅
- WhatsApp number +971 50 445 7748 connected via Embedded Signup and registered with Cloud API (LIVE mode)
- Webhook subscribed to WABA 2117551528810735, phone registered with Cloud API
- Fixed chatbot PATCH endpoint — was missing workspaceId in request body, causing "Workspace ID required" 400 error
- Demo workspaces (Starter/Growth/Pro) configured with planOverride and subscriptionStatus='active' to bypass Stripe for testing
- Demo users email verified for full feature access
- CORS fix — added all tawasel.io variants to ALLOWED_ORIGINS
- System User permanent token configured (replaces 24h temp token)
- Delete WhatsApp number from Channels page (DELETE /api/numbers/:id with cascade delete)
- Embedded Signup fix for System User tokens — extract WABA IDs from granular_scopes.target_ids via debug_token API

## Previously Completed (April 5, 2026)
- Embedded Signup debugging: token debug logging, retry with 3s delay, System User token fallback, session hints ref for race condition fix
- Two Meta Business Accounts: Quantops (production, owns Tawasel app) and SOSO (testing Embedded Signup with virtual numbers)

## Known Issues
- Prisma migrations need baseline on production (`npx prisma migrate resolve --applied <name>`)

## Roadmap (Phases)

- ✅ **Phase 1 — Close the Booking Loop** (DONE) — Public booking page, calendar view + drag, 1h reminder + post-visit follow-up, template auto-setup
- ✅ **Phase 1.5 — AI Self-Service Appointments** (DONE) — view/reschedule/cancel own appointments via WhatsApp chat
- ✅ **Phase 2 — Flexible Reminders & Template Builder** (DONE) — In-app WA template builder (header/body/buttons), reminder rules engine, per-appointment reminder timeline, token auto-refresh
- 🔜 **Phase 3 — Recurring Appointments** — weekly/bi-weekly/monthly series, package bundles, edit this-one/this-and-future/all
- **Phase 4 — Recurring Appointments** — weekly/bi-weekly/monthly series, package bundles, edit this-one/this-and-future/all
- **Phase 4 — Payments & Deposits** — Stripe Checkout at booking, deposit %, no-show auto-charge, refund workflow, revenue dashboard
- **Phase 5 — Multi-Channel Inbox** — Instagram DMs re-enable, Web Chat Widget → inbox, Telegram, Email via Resend
- **Phase 6 — Team Productivity** — shared canned responses, internal notes, @mentions, SLA timers, read receipts between agents
- **Phase 7 — Advanced AI** — knowledge base upload (RAG), personality presets, training on historical convos, handoff summaries, AI-written draft replies
- **Phase 8 — Analytics & Reporting** — booking conversion funnel, staff utilization, revenue per service/channel, CLV, no-show rate, PDF/CSV export
- **Phase 9 — Customer Portal** — `/customer/:id` magic-link portal, past bookings, loyalty points, one-click rebook, invoice history
- **Phase 10 — Marketing Automation** — birthday messages, re-engagement, review requests, referral program, lead drip
- **Phase 11 — Mobile Apps** — React Native for owners/agents, push notifications, offline queue
- **Phase 12 — Enterprise & Scale** — multi-location, franchise mode, SSO/SAML, audit logs, public API/webhook docs
- **Phase 13 — Marketplace & Discovery** — `tawasel.io/discover` public directory of Tawasel-powered businesses, category search, reviews, embedded book-now CTA
