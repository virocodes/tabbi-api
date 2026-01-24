/**
 * API Key Authentication Middleware
 * Validates API keys and sets auth context with request tracing
 */

import { Context, MiddlewareHandler } from "hono";
import type { Env, AuthContext, APIError } from "../types";
import { logger } from "../utils/logger";
import { withRetry } from "../utils/retry";

// API key format: aa_<env>_<32 alphanumeric chars>
const API_KEY_REGEX = /^aa_(live|test)_[a-zA-Z0-9]{32}$/;

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;
}

/**
 * Hash an API key using SHA-256
 */
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Extract API key from Authorization header
 */
function extractApiKey(header: string | undefined): string | null {
  if (!header) return null;

  const parts = header.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;

  return parts[1];
}

/**
 * Validate API key format
 */
function isValidKeyFormat(key: string): boolean {
  return API_KEY_REGEX.test(key);
}

/**
 * Get environment from API key prefix
 */
function getEnvironmentFromKey(key: string): "live" | "test" {
  return key.startsWith("aa_live_") ? "live" : "test";
}

/**
 * Authentication middleware
 * Validates API key, generates request ID, and sets auth context
 */
export const authMiddleware: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  // Generate request ID first for all logging
  const requestId = generateRequestId();
  c.set("requestId", requestId);
  c.header("X-Request-ID", requestId);

  // Create logger with request context
  const log = logger.child({ requestId });

  const authHeader = c.req.header("Authorization");
  const apiKey = extractApiKey(authHeader);

  if (!apiKey) {
    log.warn("Missing or malformed Authorization header");
    const error: APIError = {
      error: {
        code: "INVALID_API_KEY",
        message: "Missing or malformed Authorization header. Expected: Bearer aa_<env>_<key>",
      },
    };
    return c.json(error, 401);
  }

  if (!isValidKeyFormat(apiKey)) {
    log.warn("Invalid API key format");
    const error: APIError = {
      error: {
        code: "INVALID_API_KEY",
        message: "Invalid API key format. Expected: aa_live_xxx or aa_test_xxx",
      },
    };
    return c.json(error, 401);
  }

  // Hash the key for database lookup
  const keyHash = await hashApiKey(apiKey);
  const environment = getEnvironmentFromKey(apiKey);

  // Lookup key in database
  const keyData = await lookupApiKey(c, keyHash, log);

  if (!keyData) {
    log.warn("API key not found", { keyPrefix: apiKey.substring(0, 12) });
    const error: APIError = {
      error: {
        code: "INVALID_API_KEY",
        message: "API key not found or has been revoked",
      },
    };
    return c.json(error, 401);
  }

  if (keyData.revokedAt) {
    log.warn("API key revoked", { apiKeyId: keyData.id });
    const error: APIError = {
      error: {
        code: "INVALID_API_KEY",
        message: "API key has been revoked",
      },
    };
    return c.json(error, 401);
  }

  // Set auth context
  const auth: AuthContext = {
    apiKeyId: keyData.id,
    userId: keyData.userId,
    environment,
    requestId,
  };

  c.set("auth", auth);

  log.info("Request authenticated", {
    apiKeyId: keyData.id,
    userId: keyData.userId,
    environment,
    path: c.req.path,
    method: c.req.method,
  });

  await next();
};

/**
 * Lookup API key in database with retry
 */
async function lookupApiKey(
  c: Context<{ Bindings: Env }>,
  keyHash: string,
  log: ReturnType<typeof logger.child>
): Promise<{ id: string; userId: string; revokedAt: string | null } | null> {
  const databaseUrl = c.env.DATABASE_URL;

  if (!databaseUrl) {
    // For development without database, use a mock
    log.warn("DATABASE_URL not set, using mock auth");
    return {
      id: "mock-api-key-id",
      userId: "mock-user-id",
      revokedAt: null,
    };
  }

  try {
    return await withRetry(
      async () => {
        const response = await fetch(databaseUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: `
              SELECT id, user_id, revoked_at
              FROM api_keys
              WHERE key_hash = $1
            `,
            params: [keyHash],
          }),
        });

        if (!response.ok) {
          throw new Error(`Database query failed: ${response.status}`);
        }

        const result = (await response.json()) as {
          rows: Array<{ id: string; user_id: string; revoked_at: string | null }>;
        };

        if (result.rows.length === 0) {
          return null;
        }

        const row = result.rows[0];
        return {
          id: row.id,
          userId: row.user_id,
          revokedAt: row.revoked_at,
        };
      },
      {
        maxAttempts: 2,
        initialDelayMs: 100,
        context: "api key lookup",
      }
    );
  } catch (error) {
    log.error("Error looking up API key", error);
    return null;
  }
}

/**
 * Hash API key utility (exported for key generation)
 */
export { hashApiKey, generateRequestId };
