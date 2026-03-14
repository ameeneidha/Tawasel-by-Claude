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

### Demo Accounts

- Superadmin: `ameeneidha@gmail.com` / `password123`
- Starter: `starter@wabahub.local` / `password123`
- Growth: `growth@wabahub.local` / `password123`
- Pro: `pro@wabahub.local` / `password123`
