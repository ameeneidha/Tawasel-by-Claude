# DigitalOcean Deployment Guide

This repo is prepared for a first DigitalOcean App Platform deploy so you can test:

- app login and dashboard
- API routes
- Meta webhooks
- WhatsApp/Instagram integrations

## Important first note

The current Prisma schema uses SQLite.

That is acceptable for a first **testing** deploy, but it is **not** durable on DigitalOcean App Platform because local filesystem data can be lost on rebuilds or container replacement.

Use this setup for:

- API testing
- webhook testing
- product demo testing

Do **not** treat it as final production persistence.

For long-term production, move Prisma to PostgreSQL later.

## 1. Push the repo

Push your latest code to:

- `https://github.com/ameeneidha/saas-whatsapp-crm-Office`

## 2. Create the DigitalOcean app

1. In DigitalOcean, create a new App Platform app from GitHub.
2. Choose this repo and the `main` branch.
3. Use the Node.js service detected from the repo root.

You can also start from the included app spec:

- [`.do/app.yaml`](C:\Users\Khaled\Desktop\SaaS%20Whatsapp\SaaS-Whatsapp-CRM-main\SaaS-Whatsapp-CRM-main\.do\app.yaml)

## 3. Build and run commands

Use:

- Build command:
  `npm install && npm run build`
- Run command:
  `npm run start`

The `start` command now:

1. runs `prisma db push`
2. optionally seeds demo data if `AUTO_SEED_DEMO=true` and the database is empty
3. starts the server

## 4. Required environment variables

Set these in DigitalOcean before first launch:

- `NODE_ENV=production`
- `PORT=8080`
- `JWT_SECRET=YOUR_LONG_RANDOM_SECRET`
- `DATABASE_URL=file:./dev.db`
- `APP_URL=https://app.tawasel.io`
- `PUBLIC_APP_URL=https://app.tawasel.io`
- `API_URL=https://api.tawasel.io`
- `ALLOWED_ORIGINS=https://app.tawasel.io,https://api.tawasel.io`

Frontend build-time variables:

- `VITE_PUBLIC_APP_URL=https://app.tawasel.io`
- `VITE_API_BASE_URL=https://api.tawasel.io`
- `VITE_SOCKET_URL=https://api.tawasel.io`

Optional for first testing deploy:

- `AUTO_SEED_DEMO=true`

Integration variables you will likely also need:

- `OPENAI_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `META_APP_ID`
- `META_APP_SECRET`
- `META_VERIFY_TOKEN`
- `META_ACCESS_TOKEN`
- `META_EMBEDDED_SIGNUP_CONFIG_ID`
- `META_GRAPH_VERSION=v22.0`
- `META_PHONE_NUMBER_ID`
- `META_WABA_ID`
- `INSTAGRAM_APP_ID`
- `INSTAGRAM_APP_SECRET`
- `INSTAGRAM_ACCOUNT_ID`
- `INSTAGRAM_ACCESS_TOKEN`

## 5. Domains

Target domains:

- Website / landing page: `tawasel.io`
- SaaS app dashboard: `app.tawasel.io`
- API / webhooks: `api.tawasel.io`

Recommended testing setup:

- point both `app.tawasel.io` and `api.tawasel.io` to the same DigitalOcean app service first
- keep the frontend using `VITE_API_BASE_URL=https://api.tawasel.io`
- keep Meta webhook URLs on `https://api.tawasel.io/webhook/meta`

## 6. Meta settings after deploy

Update Meta settings to use the deployed API domain:

- Webhook callback URL:
  `https://api.tawasel.io/webhook/meta`
- Embedded Signup callback URL:
  `https://api.tawasel.io/api/meta/embedded-signup/callback`

Also update Meta app settings:

- App Domains:
  - `app.tawasel.io`
  - `api.tawasel.io`
  - `tawasel.io`
- Website URL:
  `https://app.tawasel.io`
- Valid OAuth Redirect URI:
  `https://api.tawasel.io/api/meta/embedded-signup/callback`

## 7. First checks after deploy

Open:

- `https://api.tawasel.io/health`
- `https://api.tawasel.io/api/health`
- `https://app.tawasel.io`

Expected:

- health endpoints return success
- app login page loads
- superadmin and subscriber login work

## 8. If you want demo data on first deploy

Set:

- `AUTO_SEED_DEMO=true`

On first boot only, if the database is empty, the app will seed demo users and workspaces.

After that, set it back to:

- `AUTO_SEED_DEMO=false`

## 9. Production follow-up later

After API testing is complete, the next production step should be:

1. move Prisma from SQLite to PostgreSQL
2. keep App Platform for app hosting
3. use PostgreSQL for durable data
4. keep the same app/api domains
