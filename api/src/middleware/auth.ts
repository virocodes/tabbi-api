/**
 * API Key Authentication Middleware
 */

import { Context, MiddlewareHandler } from "hono";
import type { Env, AuthContext, APIError } from "../types";

// API key format: aa_<env>_<32 alphanumeric chars>
const API_KEY_REGEX = /^aa_(live|test)_[a-zA-Z0-9]{32}$/;

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
 * Validates API key and sets auth context
 */
export const authMiddleware: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const authHeader = c.req.header("Authorization");
  const apiKey = extractApiKey(authHeader);

  if (!apiKey) {
    const error: APIError = {
      error: {
        code: "INVALID_API_KEY",
        message: "Missing or malformed Authorization header. Expected: Bearer aa_<env>_<key>",
      },
    };
    return c.json(error, 401);
  }

  if (!isValidKeyFormat(apiKey)) {
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
  const keyData = await lookupApiKey(c, keyHash);

  if (!keyData) {
    const error: APIError = {
      error: {
        code: "INVALID_API_KEY",
        message: "API key not found or has been revoked",
      },
    };
    return c.json(error, 401);
  }

  if (keyData.revokedAt) {
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
  };

  c.set("auth", auth);

  await next();
};

/**
 * Lookup API key in database
 */
async function lookupApiKey(
  c: Context<{ Bindings: Env }>,
  keyHash: string
): Promise<{ id: string; userId: string; revokedAt: string | null } | null> {
  const databaseUrl = c.env.DATABASE_URL;

  if (!databaseUrl) {
    // For development without database, use a mock
    console.warn("DATABASE_URL not set, using mock auth");
    return {
      id: "mock-api-key-id",
      userId: "mock-user-id",
      revokedAt: null,
    };
  }

  try {
    // Use Neon serverless driver pattern
    const response = await fetch(`${databaseUrl}`, {
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
      console.error("Database query failed:", response.status);
      return null;
    }

    const result = (await response.json()) as { rows: Array<{ id: string; user_id: string; revoked_at: string | null }> };

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      revokedAt: row.revoked_at,
    };
  } catch (error) {
    console.error("Error looking up API key:", error);
    return null;
  }
}

/**
 * Hash API key utility (exported for key generation)
 */
export { hashApiKey };
