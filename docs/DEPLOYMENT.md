# Production Deployment Guide

This guide gets your Agent API MVP to production as fast as possible using the services already integrated in the codebase.

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│   SDK Client    │────▶│  Cloudflare Workers  │────▶│  Modal Sandbox  │
└─────────────────┘     │  + Durable Objects   │     │  (OpenCode)     │
                        └──────────────────────┘     └─────────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
              ┌──────────┐  ┌───────────┐  ┌───────────┐
              │  Neon    │  │  Upstash  │  │ Anthropic │
              │ Postgres │  │   Redis   │  │    API    │
              └──────────┘  └───────────┘  └───────────┘
```

## Services You'll Need

| Service | Purpose | Free Tier | Time to Setup |
|---------|---------|-----------|---------------|
| [Cloudflare Workers](https://workers.cloudflare.com) | API hosting + Durable Objects | 100k req/day | 5 min |
| [Neon](https://neon.tech) | PostgreSQL database | 0.5 GB storage | 5 min |
| [Upstash](https://upstash.com) | Redis rate limiting | 10k commands/day | 3 min |
| [Modal](https://modal.com) | Sandbox compute | $30/month credits | 10 min |
| [Anthropic](https://console.anthropic.com) | Claude API | Pay-as-you-go | 2 min |

**Total setup time: ~30 minutes**

---

## Step 1: Neon PostgreSQL (5 min)

### 1.1 Create Account & Database

1. Go to [neon.tech](https://neon.tech) and sign up
2. Create a new project (e.g., "agent-api")
3. Copy your connection string from the dashboard

### 1.2 Run Schema Migration

```bash
# Install psql if needed (macOS)
brew install postgresql

# Connect and run schema
psql "your-neon-connection-string" -f database/schema.sql
```

Or use the Neon SQL Editor in the dashboard - paste contents of `database/schema.sql`.

### 1.3 Create Your First API Key

```sql
-- Generate a test API key (run in Neon SQL Editor)
-- The actual key: aa_live_abc123def456ghi789jkl012mno345pq

INSERT INTO api_keys (key_hash, key_prefix, user_id, environment, name)
VALUES (
  -- SHA-256 hash of: aa_live_abc123def456ghi789jkl012mno345pq
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  'aa_live_',
  '00000000-0000-0000-0000-000000000001',  -- Your user ID
  'live',
  'Development Key'
);
```

**To generate a real key hash:**
```javascript
// Run in Node.js or browser console
const key = 'aa_live_' + crypto.randomUUID().replace(/-/g, '');
const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
const hashHex = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
console.log('Key:', key);
console.log('Hash:', hashHex);
```

### 1.4 Get Your Database URL

For Cloudflare Workers, you need the **HTTP** endpoint (not the postgres:// URL).

Neon provides a serverless driver. Your DATABASE_URL will be used with fetch:

```
# Format for wrangler.toml secrets
DATABASE_URL=https://your-project.neon.tech/sql
```

> **Note:** The current codebase expects a simple HTTP POST endpoint. You may need to use Neon's [Serverless Driver](https://neon.tech/docs/serverless/serverless-driver) or adapt the database utility. For fastest MVP, use the Neon HTTP API directly.

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

## Step 3: Modal Sandbox (10 min)

### 3.1 Create Account

1. Go to [modal.com](https://modal.com) and sign up
2. Install the Modal CLI:
   ```bash
   pip install modal
   modal token new
   ```

### 3.2 Deploy Sandbox

```bash
cd sandbox

# Deploy to Modal
modal deploy sandbox.py
```

After deployment, Modal will show you the endpoint URLs:
```
✓ Created api-create-sandbox => https://your-workspace--agent-sandbox-api-create-sandbox-dev.modal.run
✓ Created api-pause-sandbox  => https://your-workspace--agent-sandbox-api-pause-sandbox-dev.modal.run
...
```

Your `MODAL_API_URL` is the base: `https://your-workspace--agent-sandbox`

### 3.3 For Production

```bash
# Deploy to production environment
modal deploy sandbox.py --env=prod
```

Then set `MODAL_ENVIRONMENT=prod` in your Cloudflare Workers.

---

## Step 4: Anthropic API Key (2 min)

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an API key
3. Copy the key (starts with `sk-ant-`)

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
name = "agent-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

# Durable Objects
[[durable_objects.bindings]]
name = "SESSION_AGENT"
class_name = "SessionAgent"

[[migrations]]
tag = "v1"
new_classes = ["SessionAgent"]

# Environment variables (non-secret)
[vars]
MODAL_ENVIRONMENT = "dev"  # or "prod"
```

### 5.3 Set Secrets

```bash
cd api

# Set each secret
wrangler secret put DATABASE_URL
# Paste: your Neon connection URL

wrangler secret put UPSTASH_REDIS_URL
# Paste: https://xxx.upstash.io

wrangler secret put UPSTASH_REDIS_TOKEN
# Paste: AXxxxxxxxxxxxx

wrangler secret put MODAL_API_URL
# Paste: https://your-workspace--agent-sandbox

wrangler secret put MODAL_API_SECRET
# Paste: (optional - for Modal auth if you set it up)

wrangler secret put ANTHROPIC_API_KEY
# Paste: sk-ant-xxxxx
```

### 5.4 Deploy

```bash
# Deploy to Cloudflare
wrangler deploy
```

You'll get a URL like: `https://agent-api.your-subdomain.workers.dev`

### 5.5 Custom Domain (Optional)

1. In Cloudflare dashboard, go to Workers & Pages > your worker
2. Click "Triggers" > "Custom Domains"
3. Add your domain (e.g., `api.yourdomain.com`)

---

## Step 6: Verify Deployment

### Health Check

```bash
curl https://agent-api.your-subdomain.workers.dev/health
# {"status":"ok"}
```

### Create a Session

```bash
curl -X POST https://agent-api.your-subdomain.workers.dev/v1/sessions \
  -H "Authorization: Bearer aa_live_abc123def456ghi789jkl012mno345pq" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Test with SDK

```typescript
import { AgentAPI } from "@agent-api/sdk";

const agent = new AgentAPI({
  apiKey: "aa_live_abc123def456ghi789jkl012mno345pq",
  baseUrl: "https://agent-api.your-subdomain.workers.dev"
});

const session = await agent.createSession();
await session.waitForReady();
await session.sendMessage("Hello!", {
  onEvent: (e) => console.log(e)
});
await session.delete();
```

---

## Environment Variables Summary

| Variable | Where to Get | Example |
|----------|--------------|---------|
| `DATABASE_URL` | Neon dashboard | `https://xxx.neon.tech/sql` |
| `UPSTASH_REDIS_URL` | Upstash dashboard | `https://xxx.upstash.io` |
| `UPSTASH_REDIS_TOKEN` | Upstash dashboard | `AXxxxxxxxxxxxx` |
| `MODAL_API_URL` | Modal deploy output | `https://workspace--agent-sandbox` |
| `MODAL_API_SECRET` | Your choice (optional) | `your-secret-here` |
| `MODAL_ENVIRONMENT` | `dev` or `prod` | `dev` |
| `ANTHROPIC_API_KEY` | Anthropic console | `sk-ant-xxxxx` |

---

## Cost Estimates (MVP Scale)

| Service | Free Tier | After Free Tier |
|---------|-----------|-----------------|
| Cloudflare Workers | 100k req/day | $5/month for 10M req |
| Neon | 0.5 GB, 1 project | $19/month for 10 GB |
| Upstash | 10k commands/day | $0.20/100k commands |
| Modal | $30/month credits | ~$0.0001/sec compute |
| Anthropic | Pay-as-you-go | ~$3-15/1M tokens |

**Realistic MVP cost: $0-50/month** depending on usage.

---

## Quick Troubleshooting

### "Invalid API key"
- Verify the key hash in database matches your key
- Check key isn't revoked (`revoked_at` should be NULL)

### "Sandbox creation failed"
- Check Modal deployment is running: `modal app list`
- Verify `MODAL_API_URL` format (no trailing slash, no `-dev.modal.run`)
- Check Anthropic API key is valid

### "Rate limit exceeded"
- Upstash Redis is configured correctly
- Check `UPSTASH_REDIS_URL` starts with `https://`

### Sessions stuck in "starting"
- Check Modal logs: `modal app logs agent-sandbox`
- Verify OpenCode server starts correctly in sandbox

---

## Next Steps After MVP

1. **Monitoring**: Add [Sentry](https://sentry.io) for error tracking
2. **Analytics**: Track usage with [Posthog](https://posthog.com) or built-in usage_records table
3. **Auth**: Add user management with [Clerk](https://clerk.com) or [Auth0](https://auth0.com)
4. **Billing**: Integrate [Stripe](https://stripe.com) for paid plans
5. **CDN**: Put static assets behind Cloudflare's CDN
6. **Staging**: Create a separate Worker for staging environment

---

## Production Checklist

- [ ] All secrets set in Cloudflare Workers
- [ ] Database schema migrated to Neon
- [ ] At least one API key created in database
- [ ] Modal sandbox deployed (dev or prod)
- [ ] Custom domain configured (optional but recommended)
- [ ] Rate limits appropriate for your use case
- [ ] Error monitoring in place
- [ ] Backup strategy for database (Neon has automatic backups)
