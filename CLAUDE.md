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
- `server/services/appointmentReminders.ts` — 24-hour WhatsApp reminder scheduler
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
- **GitHub repo**: github.com/ameeneidha/Tawasel-by-Claude (origin on server)

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

## Potential Next Features
- Calendar view with drag-to-reschedule (react-big-calendar)
- 1-hour before reminder option
- Customer self-service booking link
- Recurring appointments
- Instagram DM inbox (code exists, needs re-enabling)
- Telegram channel integration
- Website live chat widget → inbox
- Email inbox via Resend
