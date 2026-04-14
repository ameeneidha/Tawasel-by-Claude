# Tawasel - SaaS WhatsApp CRM

## Tech Stack
- **Frontend**: React 19 + Vite + TypeScript + Tailwind CSS + Radix UI + Lucide icons + Sonner toasts
- **Backend**: Express.js (server.ts) + Prisma ORM + SQLite
- **Real-time**: Socket.io
- **AI**: OpenAI gpt-4.1-mini with function calling (tool use loop)
- **Payments**: Stripe
- **Channels**: WhatsApp (Meta Cloud API) + Instagram DMs

## Project Structure
- `src/` — React frontend (Vite)
- `src/pages/` — Page components (Inbox, Contacts, Appointments, Campaigns, etc.)
- `src/components/` — Shared components (Sidebar, Topbar, etc.)
- `src/contexts/SidebarContext.tsx` — Mobile sidebar open/close state
- `src/constants/plans.ts` — Plan tier config (STARTER/GROWTH/PRO)
- `server.ts` — Express API + Socket.io + all route handlers
- `server/` — Backend services and middleware
- `server/services/ai.ts` — AI chatbot with OpenAI function calling (appointment booking tools)
- `server/services/appointmentReminders.ts` — 24-hour WhatsApp reminder scheduler
- `server/services/meta.ts` — WhatsApp/Instagram message sending
- `server/middleware/auth.ts` — Auth + plan limit enforcement
- `server/config.ts` — Plan limits configuration
- `prisma/schema.prisma` — Database schema
- `prisma/seed.ts` — Demo data seeder

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
- DATABASE_URL (SQLite path)
- JWT_SECRET
- OPENAI_API_KEY
- META_ACCESS_TOKEN, META_PHONE_NUMBER_ID (WhatsApp)
- META_APP_ID, META_APP_SECRET, META_EMBEDDED_SIGNUP_CONFIG_ID (WhatsApp Embedded Signup)
- STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
- RESEND_API_KEY, EMAIL_FROM (e.g., `Tawasel <noreply@tawasel.io>`)
- INSTAGRAM_ACCESS_TOKEN

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
npx vite build
pm2 restart tawasel-app
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
