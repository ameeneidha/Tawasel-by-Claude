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
- `src/pages/` — Page components (Inbox, Contacts, Appointments, etc.)
- `src/components/` — Shared components (Sidebar, Topbar, etc.)
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
- INSTAGRAM_ACCESS_TOKEN

## Recently Completed Features
- Appointment booking system (Services, Staff, Appointments CRUD)
- AI chatbot appointment booking via OpenAI function calling
- 24-hour WhatsApp appointment reminders (background scheduler)
- WhatsApp Embedded Signup (already implemented, needs Meta env vars)
- WhatsApp template sync from Meta Graph API (POST /api/templates/whatsapp/sync)
- Broadcast template picker uses real approved Meta templates (no more hardcoded options)
- Remember me checkbox on login (localStorage vs sessionStorage)
- Removed demo WhatsApp templates from seed — only real synced templates shown

## Potential Next Features
- Calendar view with drag-to-reschedule (react-big-calendar)
- 1-hour before reminder option
- Customer self-service booking link
- Recurring appointments
