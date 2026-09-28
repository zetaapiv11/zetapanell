# ZetaPanel

> High-performance server control panel inspired by Pterodactyl Panel, integrating **Render API** for infrastructure provisioning and **Cloudflare R2** for object file storage.

## Architecture

```
User (Browser)
       │
       ▼
ZetaPanel Web UI (Angular 21 + Tailwind CSS)
       │
       ▼
ZetaPanel API Backend (Node.js Express + REST API)
  ├── PostgreSQL / Persistent Storage
  ├── Cloudflare R2 (S3-compatible Object Storage for server files & ZIPs)
  └── Render REST API v1 (Live Services, Deploys, Restart, Logs, Metrics)
       │
       ▼
Real Render Services (Background Workers, Web Services, Cron Jobs)
```

## Features

- **Pterodactyl-Inspired UX**: Sleek, high-density dark terminal UI with single-elevation depth and tabular metrics.
- **Direct Render API Communication**: No fake status flags or mock buttons. Real server states, deploys, restarts, env-vars, and streaming logs.
- **Cloudflare R2 Storage**: S3-compatible file manager allowing direct uploads, file edits, folder creation, ZIP extraction, and archiving.
- **Automated Git Bridge**: Enables ZIP project deployments by providing an internal Git Smart HTTP bridge (`/api/v1/git/:id.git`) so Render can build and deploy from panel uploads without requiring third-party Git hosts.
- **Discord Bot Ready**: Preconfigured background worker templates with Discord token management and live terminal streaming.
- **Granular RBAC & API Keys**: Role-based access (Super Admin, Admin, User) and hashed `zp_live_...` API keys for programmatic automation.
- **OpenAPI 3.0 Documentation**: Interactive cURL, JavaScript, and Node.js code snippets at `/docs`.

## Requirements

- Node.js 20+
- PostgreSQL or SQLite
- Render API Key (`rnd_...`)
- Cloudflare R2 Bucket & S3 Credentials

## Environment Variables (`.env`)

```env
# Server Port
PORT=3000

# Authentication
JWT_SECRET=your-super-secure-jwt-secret-key-2026

# Render API
RENDER_API_KEY=rnd_xxxxxxxxxxxxxxxxxxxxxxxx
RENDER_OWNER_ID=usr_xxxxxxxxxxxxxxx

# Cloudflare R2 S3 Storage
R2_ACCOUNT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
R2_ACCESS_KEY_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
R2_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
R2_BUCKET=zetapanel-servers

# Email (SMTP2GO HTTP API) -- required in production for signup OTP and
# password reset. SMTP2GO_SENDER must be a verified sender/domain in SMTP2GO.
# In development (NODE_ENV != production) with these unset, codes are printed
# to the server console instead of emailed.
SMTP2GO_API_KEY=api-xxxxxxxxxxxxxxxxxxxxxxxx
SMTP2GO_SENDER=no-reply@yourdomain.com

# ZetaPanel URL (optional on Render — falls back to Render's
# auto-injected RENDER_EXTERNAL_URL if unset; set this only for a
# custom domain or local dev)
APP_URL=http://localhost:3000
```

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev

# 3. Production build & run
npm run build
npm run serve:ssr:app
```

> Note: `npm start` runs `ng serve` (the dev server). For production, always
> use `npm run serve:ssr:app` after `npm run build` — that's what `render.yaml`
> uses as the `startCommand`.

## Email OTP (signup verification & password reset)

- **Sign-up** is two steps: the form emails a 6-digit code, and the account is only created once the code is verified.
- **Forgot password** emails a 6-digit code; entering it with a new password resets the account and signs out existing sessions.
- Codes expire after 10 minutes, are single-use, allow 5 wrong guesses, and can be re-sent once per 60 seconds (max 5 per hour per address). Only an HMAC of the code is stored.
- Mail is sent through the [SMTP2GO HTTP API](https://developers.smtp2go.com/docs/send-an-email) using `SMTP2GO_API_KEY` and `SMTP2GO_SENDER` (see above).

## Default Super Admin Account

- **Login**: `admin` or `admin@zetapanel.io`
- **Password**: `admin123`
- ⚠️ **Change this immediately in the Admin panel right after your first login** — this account is seeded automatically on every fresh deploy, so anyone who knows the default credentials can log in until you change it.
