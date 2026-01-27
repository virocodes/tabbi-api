/**
 * Tabbi API - Cloudflare Workers Entry Point
 *
 * REST API for building "Claude Code wrapper" products with:
 * - POST   /v1/sessions              → Create session with sandbox
 * - POST   /v1/sessions/:id/messages → Send task, stream via SSE
 * - GET    /v1/sessions/:id/files/*  → Retrieve workspace files
 * - DELETE /v1/sessions/:id          → Cleanup
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./types";
import { supabaseAuthMiddleware } from "./middleware/supabase-auth";
import { rateLimitMiddleware } from "./middleware/rateLimit";
import { sessions } from "./routes/sessions";
import { openApiSpec } from "./openapi";

// Export Durable Object
export { SessionAgent } from "./agent";

// Create Hono app
const app = new Hono<{ Bindings: Env }>();

// Global middleware
app.use("*", cors());

// Health check (public)
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
  });
});

// OpenAPI spec (public)
app.get("/openapi.json", (c) => {
  return c.json(openApiSpec);
});

// API Documentation (public) - using Scalar
app.get("/docs", (c) => {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Tabbi API Documentation</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
  <script id="api-reference" data-url="/openapi.json"></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`;
  return c.html(html);
});

// API v1 routes
const v1 = new Hono<{ Bindings: Env }>();

// Apply auth and rate limiting to all v1 routes
v1.use("*", supabaseAuthMiddleware);
v1.use("*", rateLimitMiddleware);

// Mount sessions router
v1.route("/sessions", sessions);

// Mount v1 under /v1
app.route("/v1", v1);

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      error: {
        code: "NOT_FOUND",
        message: `Route not found: ${c.req.method} ${c.req.path}`,
      },
    },
    404
  );
});

// Error handler
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: err.message || "An unexpected error occurred",
      },
    },
    500
  );
});

export default app;
