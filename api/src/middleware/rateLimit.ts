/**
 * Rate Limiting Middleware using Upstash Redis
 */

import { MiddlewareHandler } from "hono";
import type { Env, APIError } from "../types";

interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
}

// Rate limits per endpoint type
const RATE_LIMITS: Record<string, RateLimitConfig> = {
  createSession: { maxRequests: 10, windowSeconds: 60 },
  sendMessage: { maxRequests: 100, windowSeconds: 60 },
  getFile: { maxRequests: 200, windowSeconds: 60 },
  default: { maxRequests: 100, windowSeconds: 60 },
};

/**
 * Get rate limit config based on request path and method
 */
function getRateLimitConfig(path: string, method: string): RateLimitConfig {
  if (method === "POST" && path === "/v1/sessions") {
    return RATE_LIMITS.createSession;
  }
  if (method === "POST" && path.includes("/messages")) {
    return RATE_LIMITS.sendMessage;
  }
  if (method === "GET" && path.includes("/files")) {
    return RATE_LIMITS.getFile;
  }
  return RATE_LIMITS.default;
}

/**
 * Check rate limit using Upstash Redis
 */
async function checkRateLimit(
  redisUrl: string,
  redisToken: string,
  key: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const now = Math.floor(Date.now() / 1000);
  const windowKey = `ratelimit:${key}:${Math.floor(now / config.windowSeconds)}`;

  try {
    // Increment counter using Upstash REST API
    const response = await fetch(`${redisUrl}/incr/${encodeURIComponent(windowKey)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${redisToken}`,
      },
    });

    if (!response.ok) {
      // On Redis error, allow request but log
      console.error("Redis rate limit check failed:", response.status);
      return { allowed: true, remaining: config.maxRequests, resetAt: now + config.windowSeconds };
    }

    const result = (await response.json()) as { result: number };
    const count = result.result;

    // Set expiry on first increment
    if (count === 1) {
      await fetch(`${redisUrl}/expire/${encodeURIComponent(windowKey)}/${config.windowSeconds}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${redisToken}`,
        },
      });
    }

    const allowed = count <= config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - count);
    const resetAt = Math.ceil(now / config.windowSeconds) * config.windowSeconds + config.windowSeconds;

    return { allowed, remaining, resetAt };
  } catch (error) {
    // On error, allow request
    console.error("Rate limit error:", error);
    return { allowed: true, remaining: config.maxRequests, resetAt: now + config.windowSeconds };
  }
}

/**
 * Rate limiting middleware
 */
export const rateLimitMiddleware: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const auth = c.get("auth");
  const redisUrl = c.env.UPSTASH_REDIS_URL;
  const redisToken = c.env.UPSTASH_REDIS_TOKEN;

  // Skip rate limiting if Redis not configured
  if (!redisUrl || !redisToken) {
    console.warn("Upstash Redis not configured, skipping rate limiting");
    await next();
    return;
  }

  const path = c.req.path;
  const method = c.req.method;
  const config = getRateLimitConfig(path, method);

  // Rate limit key based on API key ID
  const rateLimitKey = `${auth.apiKeyId}:${path}:${method}`;

  const { allowed, remaining, resetAt } = await checkRateLimit(
    redisUrl,
    redisToken,
    rateLimitKey,
    config
  );

  // Set rate limit headers
  c.header("X-RateLimit-Limit", config.maxRequests.toString());
  c.header("X-RateLimit-Remaining", remaining.toString());
  c.header("X-RateLimit-Reset", resetAt.toString());

  if (!allowed) {
    const error: APIError = {
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: `Rate limit exceeded. Try again after ${new Date(resetAt * 1000).toISOString()}`,
        details: {
          limit: config.maxRequests,
          windowSeconds: config.windowSeconds,
          resetAt: new Date(resetAt * 1000).toISOString(),
        },
      },
    };
    return c.json(error, 429);
  }

  await next();
};
