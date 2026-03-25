<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Tawasel App

Tawasel App is a full-stack WhatsApp CRM and automation platform built with React, Express, Prisma, Stripe, and Meta integrations. Designed for UAE businesses that rely on WhatsApp as their primary sales and support channel.

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
Customers can book appointments directly through WhatsApp chat with the AI bot. The system checks staff availability, prevents double-bookings, and sends a WhatsApp reminder 24 hours before the appointment. No more no-shows.

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

## DigitalOcean Deployment

DigitalOcean deployment is now documented here:

- [DEPLOY_DIGITALOCEAN.md](C:\Users\Khaled\Desktop\SaaS%20Whatsapp\SaaS-Whatsapp-CRM-main\SaaS-Whatsapp-CRM-main\DEPLOY_DIGITALOCEAN.md)

The repo also includes an App Platform spec:

- [`.do/app.yaml`](C:\Users\Khaled\Desktop\SaaS%20Whatsapp\SaaS-Whatsapp-CRM-main\SaaS-Whatsapp-CRM-main\.do\app.yaml)

## Update Log

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
