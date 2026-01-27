/**
 * Supabase-based Authentication Middleware
 * Validates API keys against Supabase Postgres
 */

import { MiddlewareHandler } from "hono";
import type { Env, AuthContext, APIError } from "../types";
import { logger } from "../utils/logger";
import { withRetry } from "../utils/retry";

// API key format: tb_<env>_<32 alphanumeric chars>
const API_KEY_REGEX = /^tb_(live|test)_[a-zA-Z0-9]{32}$/;

function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;
}

async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Validate API key against Supabase with retry logic
 */
async function validateApiKey(
  supabaseUrl: string,
  supabaseServiceKey: string,
  keyHash: string
): Promise<{ id: string; userId: string; revokedAt: string | null } | null> {
  return withRetry(
    async () => {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/api_keys?key_hash=eq.${keyHash}&select=id,user_id,revoked_at`,
        {
          headers: {
            apikey: supabaseServiceKey,
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
        }
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Supabase auth request failed (${response.status}): ${text}`);
      }

      const rows = (await response.json()) as Array<{
        id: string;
        user_id: string;
        revoked_at: string | null;
      }>;

      if (rows.length === 0) {
        return null;
      }

      return {
        id: rows[0].id,
        userId: rows[0].user_id,
        revokedAt: rows[0].revoked_at,
      };
    },
    {
      maxAttempts: 3,
      context: "supabase auth validation",
      isRetryable: (error) => {
        const message = error.message.toLowerCase();
        return (
          message.includes("timeout") ||
          message.includes("connection") ||
          message.includes("503") ||
          message.includes("502") ||
          message.includes("504") ||
          message.includes("network")
        );
      },
    }
  );
}

/**
 * Authentication middleware using Supabase
 */
export const supabaseAuthMiddleware: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const requestId = generateRequestId();
  c.set("requestId", requestId);
  c.header("X-Request-ID", requestId);

  const log = logger.child({ requestId });

  // Extract API key from Authorization header
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    const error: APIError = {
      error: {
        code: "INVALID_API_KEY",
        message: "Missing or malformed Authorization header",
      },
    };
    return c.json(error, 401);
  }

  const apiKey = authHeader.slice(7);

  if (!API_KEY_REGEX.test(apiKey)) {
    const error: APIError = {
      error: {
        code: "INVALID_API_KEY",
        message: "Invalid API key format",
      },
    };
    return c.json(error, 401);
  }

  // Check if Supabase is configured
  if (!c.env.SUPABASE_URL || !c.env.SUPABASE_SERVICE_KEY) {
    // Development mode: use mock auth when Supabase is not configured
    log.warn("Supabase not configured, using mock auth for development");

    const auth: AuthContext = {
      apiKeyId: "mock-api-key-id",
      userId: "mock-user-id",
      environment: apiKey.startsWith("tb_live_") ? "live" : "test",
      requestId,
    };

    c.set("auth", auth);

    log.info("Request authenticated (mock)", {
      apiKeyId: auth.apiKeyId,
      path: c.req.path,
    });

    await next();
    return;
  }

  // Hash and validate against Supabase
  const keyHash = await hashApiKey(apiKey);
  let keyData: { id: string; userId: string; revokedAt: string | null } | null;

  try {
    keyData = await validateApiKey(
      c.env.SUPABASE_URL,
      c.env.SUPABASE_SERVICE_KEY,
      keyHash
    );
  } catch (error) {
    log.error("Failed to validate API key", error);
    const apiError: APIError = {
      error: {
        code: "AUTHENTICATION_ERROR",
        message: "Failed to validate API key",
      },
    };
    return c.json(apiError, 500);
  }

  if (!keyData) {
    log.warn("API key not found", { keyPrefix: apiKey.substring(0, 12) });
    const error: APIError = {
      error: {
        code: "INVALID_API_KEY",
        message: "API key not found",
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
    environment: apiKey.startsWith("tb_live_") ? "live" : "test",
    requestId,
  };

  c.set("auth", auth);

  log.info("Request authenticated", {
    apiKeyId: keyData.id,
    path: c.req.path,
  });

  await next();
};
