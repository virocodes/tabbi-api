/**
 * Sandbox Service Entry Point
 * Hono server with Daytona and OpenCode SDK integrations
 */

import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger as honoLogger } from "hono/logger";

import { loadEnvConfig, type APIError } from "./types";
import { sandboxRoutes } from "./routes/sandbox";
import { opencodeRoutes } from "./routes/opencode";
import { DaytonaSandboxService } from "./services/daytona";

// Load configuration
let config: ReturnType<typeof loadEnvConfig>;
try {
  config = loadEnvConfig();
} catch (error) {
  console.error("Failed to load configuration:", error);
  process.exit(1);
}

// Initialize services
const daytonaService = new DaytonaSandboxService({
  apiKey: config.daytonaApiKey,
  apiUrl: config.daytonaApiUrl,
  snapshotId: config.daytonaSnapshotId,
});

// Create Hono app
const app = new Hono();

// Middleware
app.use("*", honoLogger());
app.use("*", cors());

// Auth middleware - verify internal API key
app.use("*", async (c, next) => {
  // Skip auth for health endpoint
  if (c.req.path === "/health") {
    return next();
  }

  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    const error: APIError = {
      error: {
        code: "UNAUTHORIZED",
        message: "Missing or invalid Authorization header",
      },
    };
    return c.json(error, 401);
  }

  const token = authHeader.slice(7);
  if (token !== config.internalApiKey) {
    const error: APIError = {
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid API key",
      },
    };
    return c.json(error, 401);
  }

  return next();
});

// Inject services into context
app.use("*", async (c, next) => {
  c.set("daytonaService", daytonaService);
  c.set("config", config);
  return next();
});

// Health endpoint
app.get("/health", async (c) => {
  try {
    const healthy = await daytonaService.health();
    return c.json({ healthy, service: "sandbox-service" });
  } catch (error) {
    return c.json(
      {
        healthy: false,
        service: "sandbox-service",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      503
    );
  }
});

// Mount routes
app.route("/sandbox", sandboxRoutes);
app.route("/opencode", opencodeRoutes);

// 404 handler
app.notFound((c) => {
  const error: APIError = {
    error: {
      code: "NOT_FOUND",
      message: `Route not found: ${c.req.method} ${c.req.path}`,
    },
  };
  return c.json(error, 404);
});

// Error handler
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  const error: APIError = {
    error: {
      code: "INTERNAL_ERROR",
      message: err instanceof Error ? err.message : "Internal server error",
    },
  };
  return c.json(error, 500);
});

// Extend Hono context types
declare module "hono" {
  interface ContextVariableMap {
    daytonaService: DaytonaSandboxService;
    config: ReturnType<typeof loadEnvConfig>;
  }
}

// Start server
console.log(`Starting sandbox-service on port ${config.port}...`);
serve({
  fetch: app.fetch,
  port: config.port,
});
console.log(`Sandbox service running at http://localhost:${config.port}`);
