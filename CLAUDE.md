# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tabbi is a platform for building AI coding agent applications. It provides isolated sandbox environments with Claude AI agents, featuring real-time streaming, git integration, and file access.

## Architecture

The project consists of 4 independent packages:

- **api/** - Cloudflare Workers REST API with Hono framework, Durable Objects for session state, SSE streaming
- **sdk/** - TypeScript client SDK (@tabbi/sdk) for interacting with sessions
- **dashboard/** - Next.js web UI for API key management and usage analytics with Supabase Auth
- **sandbox-service/** - Node.js service managing Daytona sandbox infrastructure

## Build Commands

### API (Cloudflare Workers)
```bash
cd api
npm run dev        # Local dev server (port 8787)
npm run deploy     # Deploy to Cloudflare Workers
npm run typecheck  # Type checking
npm run lint       # ESLint
npm run format     # Prettier formatting
```

### Dashboard (Next.js)
```bash
cd dashboard
npm run dev        # Next.js dev server
npm run build      # Production build
npm run lint       # Linting
```

### SDK
```bash
cd sdk
npm run build      # Compile TypeScript to dist/
npm run typecheck  # Type checking
npm run docs       # Generate TypeDoc documentation
```

### Sandbox Service
```bash
cd sandbox-service
npm run dev        # tsx watch development
npm run build      # Compile TypeScript
npm run start      # Production server
```

## Key Files

- **api/src/agent.ts** - SessionAgent Durable Object (session state + messages in SQLite)
- **api/src/routes/sessions.ts** - Session endpoints with SSE streaming
- **api/openapi.yaml** - OpenAPI 3.1.0 specification
- **sdk/src/client.ts** - Tabbi and Session classes
- **sandbox-service/src/services/daytona.ts** - Daytona SDK wrapper
- **database/schema.sql** - Complete PostgreSQL schema with RLS

## API Authentication

Bearer token with API keys in format `tb_live_xxx` (production) or `tb_test_xxx` (test).

Middleware stack: Auth → Rate Limiting → Route Handling

## Database

Supabase PostgreSQL with Row Level Security. Tables: `api_keys`, `sessions`, `usage_records`.

Run `database/schema.sql` for initial setup. Apply migrations from `database/migrations/` sequentially.

## External Services

- **Supabase** - PostgreSQL + Auth
- **Cloudflare Workers** - API hosting + Durable Objects
- **Upstash** - Redis rate limiting
- **Daytona** - Sandbox provisioning
- **Anthropic API** - Claude AI

## Environment Variables

See `api/wrangler.toml` for Cloudflare secrets, `sandbox-service/.env.example` for sandbox config, `dashboard/.env.local.example` for dashboard config.
