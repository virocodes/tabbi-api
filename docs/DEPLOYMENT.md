# Production Deployment Guide

This guide gets your Tabbi MVP to production as fast as possible using the services already integrated in the codebase.

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│   SDK Client    │────▶│  Cloudflare Workers  │────▶│ Sandbox Service │────▶│  Daytona Sandbox │
└─────────────────┘     │  + Durable Objects   │     │    (Node.js)    │     │   (OpenCode)     │
                        └──────────────────────┘     └─────────────────┘     └──────────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
              ┌──────────┐  ┌───────────┐  ┌───────────┐
              │ Supabase │  │  Upstash  │  │ Anthropic │
              │ Postgres │  │   Redis   │  │    API    │
              │  + Auth  │  └───────────┘  └───────────┘
              └──────────┘
                    │
              ┌──────────┐
              │ Dashboard│
              │ (Next.js)│
              └──────────┘
```

## Services You'll Need

| Service | Purpose | Free Tier | Time to Setup |
|---------|---------|-----------|---------------|
| [Supabase](https://supabase.com) | PostgreSQL + Auth + RLS | 500 MB, 50k MAU | 10 min |
| [Cloudflare Workers](https://workers.cloudflare.com) | API hosting + Durable Objects | 100k req/day | 5 min |
| [Upstash](https://upstash.com) | Redis rate limiting | 10k commands/day | 3 min |
| [Daytona](https://daytona.io) | Sandbox compute | $30 free credits | 5 min |
| [Anthropic](https://console.anthropic.com) | Claude API | Pay-as-you-go | 2 min |
| Node.js hosting | Sandbox service | Varies by provider | 5 min |
| [Vercel](https://vercel.com) | Dashboard hosting | Unlimited sites | 5 min |

**Total setup time: ~35 minutes**

---

## Step 1: Supabase (10 min)

Supabase provides PostgreSQL database, authentication, and Row Level Security in one platform.

### 1.1 Create Account & Project

1. Go to [supabase.com](https://supabase.com) and sign up
2. Create a new project (e.g., "tabbi")
3. Choose a region close to your users
4. Set a strong database password (save it securely)

### 1.2 Run Schema Migration

1. In your Supabase dashboard, go to **SQL Editor**
2. Paste the contents of `database/schema.sql`
3. Click **Run** to execute

This creates:
- `api_keys` table with RLS policies
- `sessions` table for tracking
- `usage_records` table for analytics
- Helper functions for key management

### 1.3 Get Your Credentials

From the Supabase dashboard, go to **Settings > API**:

| Credential | Where to Find | Used By |
|------------|---------------|---------|
| Project URL | Settings > API | Dashboard, API |
| Anon Key | Settings > API > anon public | Dashboard (client-side) |
| Service Role Key | Settings > API > service_role | API (server-side only) |

> **Important:** The service role key bypasses RLS. Keep it secret and only use it in your Cloudflare Worker.

### 1.4 Enable Auth Providers (Optional)

For the dashboard, you can enable additional auth providers:

1. Go to **Authentication > Providers**
2. Enable GitHub, Google, or other providers
3. Configure OAuth credentials as needed

Email/password auth is enabled by default.

---

## Step 2: Upstash Redis (3 min)

### 2.1 Create Account & Database

1. Go to [upstash.com](https://upstash.com) and sign up
2. Create a new Redis database
3. Select a region close to your Cloudflare Workers (recommended: `us-east-1` or `eu-west-1`)

### 2.2 Get Credentials

From the Upstash dashboard, copy:
- **REST URL**: `https://xxx.upstash.io`
- **REST Token**: `AXxxxxxxxxxxxx`

These go into your Cloudflare Workers secrets.

---

## Step 3: Daytona Sandbox (5 min)

Daytona provides fast sandbox compute with built-in pause/resume and file operations.

### 3.1 Create Account

1. Go to [app.daytona.io](https://app.daytona.io) and sign up
2. Get your API key from the dashboard

### 3.2 Create Snapshot

Build and push the Docker image for the sandbox:

```bash
cd daytona

# Build the image
docker build -t opencode-sandbox:v1 .

# Create a Daytona snapshot from the image
daytona snapshot create --name opencode-sandbox --image opencode-sandbox:v1
```

Note the snapshot ID from the output - you'll need this for `DAYTONA_SNAPSHOT_ID`.

### 3.3 Credentials

From the Daytona dashboard, you'll need:
- **API Key**: Your Daytona API key
- **Snapshot ID**: The ID from the snapshot create command

These go into your sandbox-service environment variables (Step 4b).

---

## Step 4: Anthropic API Key (2 min)

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an API key
3. Copy the key (starts with `sk-ant-`)

---

## Step 4b: Deploy Sandbox Service (5 min)

The sandbox-service is a Node.js service that manages Daytona sandbox infrastructure. It must be deployed before the Cloudflare Workers API.

### 4b.1 Configure Environment

```bash
cd sandbox-service

# Copy example env file
cp .env.example .env
```

Edit `.env`:
```env
PORT=3000
INTERNAL_API_KEY=your-internal-api-key-here  # Generate with: openssl rand -hex 32
DAYTONA_API_KEY=your-daytona-api-key
DAYTONA_API_URL=https://app.daytona.io/api
DAYTONA_SNAPSHOT_ID=your-snapshot-id
```

### 4b.2 Deploy

Deploy the sandbox-service to your preferred Node.js hosting platform (e.g., Railway, Render, Fly.io, or a VPS).

```bash
npm run build
npm run start
```

Note the deployment URL - you'll need it for `SANDBOX_SERVICE_URL` in the API configuration.

---

## Step 5: Cloudflare Workers (10 min)

### 5.1 Create Account

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) and sign up
2. Install Wrangler CLI:
   ```bash
   npm install -g wrangler
   wrangler login
   ```

### 5.2 Update wrangler.toml

```toml
name = "tabbi-api"
main = "src/index.ts"
compatibility_date = "2024-05-12"
compatibility_flags = ["nodejs_compat"]

# Durable Objects
[[durable_objects.bindings]]
name = "SESSION_AGENT"
class_name = "SessionAgent"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["SessionAgent"]

[dev]
port = 8787
local_protocol = "http"
```

### 5.3 Set Secrets

```bash
cd api

# Set each secret
wrangler secret put SANDBOX_SERVICE_URL
# Paste: URL of your deployed sandbox-service (see Step 5b)

wrangler secret put SANDBOX_SERVICE_API_KEY
# Paste: The INTERNAL_API_KEY from your sandbox-service

wrangler secret put SUPABASE_URL
# Paste: https://xxx.supabase.co (from Supabase Settings > API)

wrangler secret put SUPABASE_SERVICE_KEY
# Paste: service_role key from Supabase Settings > API

wrangler secret put UPSTASH_REDIS_URL
# Paste: https://xxx.upstash.io

wrangler secret put UPSTASH_REDIS_TOKEN
# Paste: AXxxxxxxxxxxxx

wrangler secret put ANTHROPIC_API_KEY
# Paste: sk-ant-xxxxx
```

### 5.4 Deploy

```bash
# Deploy to Cloudflare
wrangler deploy
```

You'll get a URL like: `https://api.tabbi.dev`

### 5.5 Custom Domain (Optional)

1. In Cloudflare dashboard, go to Workers & Pages > your worker
2. Click "Triggers" > "Custom Domains"
3. Add your domain (e.g., `api.yourdomain.com`)

---

## Step 6: Deploy Dashboard (5 min)

The Next.js dashboard provides a UI for users to manage API keys and view usage.

### 6.1 Configure Environment

```bash
cd dashboard

# Copy example env file
cp .env.local.example .env.local
```

Edit `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_API_URL=https://api.tabbi.dev
```

> **Note:** Use the **anon** key here, not the service role key. The anon key is safe for client-side use.

### 6.2 Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
cd dashboard
vercel

# Follow prompts to link to your Vercel account
# Set environment variables when prompted
```

Or deploy via GitHub:
1. Push your repo to GitHub
2. Go to [vercel.com](https://vercel.com) and import the project
3. Set root directory to `dashboard`
4. Add environment variables in Vercel dashboard
5. Deploy

### 6.3 Configure Auth Redirect

In Supabase dashboard:
1. Go to **Authentication > URL Configuration**
2. Add your Vercel URL to **Redirect URLs**:
   - `https://your-app.vercel.app/auth`
   - `https://your-app.vercel.app/dashboard`

---

## Step 7: Verify Deployment

### Health Check

```bash
curl https://api.tabbi.dev/health
# {"status":"ok"}
```

### Create a Session

```bash
curl -X POST https://api.tabbi.dev/v1/sessions \
  -H "Authorization: Bearer tb_live_abc123def456ghi789jkl012mno345pq" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Test with SDK

```typescript
import { Tabbi } from "tabbi-sdk";

const tabbi = new Tabbi({
  apiKey: "tb_live_abc123def456ghi789jkl012mno345pq",
  baseUrl: "https://api.tabbi.dev"
});

const session = await tabbi.createSession();
await session.waitForReady();
await session.sendMessage("Hello!", {
  onEvent: (e) => console.log(e)
});
await session.delete();
```

### Test Dashboard

1. Go to your dashboard URL (e.g., `https://your-app.vercel.app`)
2. Sign up with email/password or OAuth
3. Create an API key from the dashboard
4. Copy the key and test with the SDK above

---

## Environment Variables Summary

### Sandbox Service

| Variable | Where to Get | Example |
|----------|--------------|---------|
| `PORT` | Your choice | `3000` |
| `INTERNAL_API_KEY` | Generate: `openssl rand -hex 32` | `your-internal-api-key` |
| `DAYTONA_API_KEY` | Daytona dashboard | `your-api-key` |
| `DAYTONA_API_URL` | Default | `https://app.daytona.io/api` |
| `DAYTONA_SNAPSHOT_ID` | Snapshot create output | `your-snapshot-id` |

### Cloudflare Workers (API)

| Variable | Where to Get | Example |
|----------|--------------|---------|
| `SANDBOX_SERVICE_URL` | Your sandbox-service deployment | `https://your-sandbox-service.com` |
| `SANDBOX_SERVICE_API_KEY` | Same as `INTERNAL_API_KEY` above | `your-internal-api-key` |
| `SUPABASE_URL` | Supabase Settings > API > Project URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase Settings > API > service_role | `eyJhbG...` |
| `UPSTASH_REDIS_URL` | Upstash dashboard | `https://xxx.upstash.io` |
| `UPSTASH_REDIS_TOKEN` | Upstash dashboard | `AXxxxxxxxxxxxx` |
| `ANTHROPIC_API_KEY` | Anthropic console | `sk-ant-xxxxx` |

### Dashboard (Vercel)

| Variable | Where to Get | Example |
|----------|--------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Settings > API | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Settings > API | `eyJhbG...` (anon) |
| `NEXT_PUBLIC_API_URL` | Your Cloudflare Workers URL | `https://api.tabbi.dev` |

---

## Cost Estimates (MVP Scale)

| Service | Free Tier | After Free Tier |
|---------|-----------|-----------------|
| Supabase | 500 MB, 50k MAU | $25/month for 8 GB |
| Cloudflare Workers | 100k req/day | $5/month for 10M req |
| Upstash | 10k commands/day | $0.20/100k commands |
| Daytona | $30 free credits | ~$0.0001/sec compute |
| Anthropic | Pay-as-you-go | ~$3-15/1M tokens |
| Vercel | Unlimited hobby | $20/month for Pro |

**Realistic MVP cost: $0-50/month** depending on usage.

---

## Quick Troubleshooting

### "Invalid API key"
- Verify the key hash in database matches your key
- Check key isn't revoked (`revoked_at` should be NULL)

### "Sandbox creation failed"
- Verify sandbox-service is running and accessible
- Verify `SANDBOX_SERVICE_URL` and `SANDBOX_SERVICE_API_KEY` are correct
- Check sandbox-service logs for Daytona errors
- Verify `DAYTONA_API_KEY` and `DAYTONA_SNAPSHOT_ID` in sandbox-service
- Check Daytona dashboard for sandbox status

### "Rate limit exceeded"
- Upstash Redis is configured correctly
- Check `UPSTASH_REDIS_URL` starts with `https://`

### Sessions stuck in "starting"
- Check sandbox logs via the API: `GET /v1/sessions/:id/logs`
- Verify OpenCode server starts correctly in sandbox
- Check Daytona dashboard for sandbox health

### Dashboard auth not working
- Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set
- Check Supabase redirect URLs include your dashboard URL
- Ensure auth providers are enabled in Supabase dashboard

### "Failed to create API key" in dashboard
- Check browser console for errors
- Verify the `create_api_key` RPC function exists in Supabase
- Confirm RLS policies allow the authenticated user to insert

---

## Next Steps After MVP

1. **Monitoring**: Add [Sentry](https://sentry.io) for error tracking
2. **Analytics**: Track usage with [Posthog](https://posthog.com) or built-in usage_records table
3. **Billing**: Integrate [Stripe](https://stripe.com) for paid plans
4. **CDN**: Put static assets behind Cloudflare's CDN
5. **Staging**: Create a separate Worker for staging environment
6. **Custom Domain**: Add custom domains to both API and dashboard

---

## Production Checklist

### Sandbox Service
- [ ] Deployed to Node.js hosting platform
- [ ] Environment variables configured
- [ ] Daytona snapshot created and tested
- [ ] Health check endpoint responding

### API (Cloudflare Workers)
- [ ] All secrets set in Cloudflare Workers
- [ ] `SANDBOX_SERVICE_URL` pointing to sandbox-service
- [ ] Custom domain configured (optional but recommended)
- [ ] Rate limits appropriate for your use case

### Database (Supabase)
- [ ] Database schema migrated (`database/schema.sql`)
- [ ] RLS policies enabled and tested
- [ ] Auth redirect URLs configured
- [ ] Backup strategy confirmed (Supabase has automatic backups)

### Dashboard (Vercel)
- [ ] Environment variables set
- [ ] Custom domain configured (optional)
- [ ] Auth flow tested (sign up, sign in, sign out)
- [ ] API key creation/revocation tested

### General
- [ ] Error monitoring in place
- [ ] SSL/TLS on all endpoints
- [ ] Test full flow: auth → create key → use SDK
