<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Tawasel App

Tawasel App is a full-stack WhatsApp CRM and automation platform built with React, Express, Prisma, Stripe, and Meta integrations.

## Local Development

**Prerequisites:** Node.js 22

1. Install dependencies:
   `npm install`
2. Copy environment variables from [`.env.example`](C:\Users\Khaled\Desktop\SaaS%20Whatsapp\SaaS-Whatsapp-CRM-main\SaaS-Whatsapp-CRM-main\.env.example) into your local `.env`
3. Start the app:
   `npm run start`

## DigitalOcean Deployment

DigitalOcean deployment is now documented here:

- [DEPLOY_DIGITALOCEAN.md](C:\Users\Khaled\Desktop\SaaS%20Whatsapp\SaaS-Whatsapp-CRM-main\SaaS-Whatsapp-CRM-main\DEPLOY_DIGITALOCEAN.md)

The repo also includes an App Platform spec:

- [`.do/app.yaml`](C:\Users\Khaled\Desktop\SaaS%20Whatsapp\SaaS-Whatsapp-CRM-main\SaaS-Whatsapp-CRM-main\.do\app.yaml)

## Update Log

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
