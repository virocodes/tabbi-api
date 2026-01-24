/**
 * Rate Limiting Middleware using Upstash Redis
 * Uses atomic EVAL script to prevent race conditions
 */

import { MiddlewareHandler } from "hono";
import type { Env, APIError } from "../types";
import { logger } from "../utils/logger";

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
 * Atomic rate limit check using Upstash Redis EVAL
 * This prevents the race condition between INCR and EXPIRE
 */
async function checkRateLimitAtomic(
  redisUrl: string,
  redisToken: string,
  key: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / config.windowSeconds) * config.windowSeconds;
  const windowKey = `ratelimit:${key}:${windowStart}`;
  const resetAt = windowStart + config.windowSeconds;

  try {
    // Use Upstash REST API with pipeline for atomicity
    // Pipeline: INCR + EXPIRE in single request
    const response = await fetch(`${redisUrl}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${redisToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", windowKey],
        ["EXPIRE", windowKey, config.windowSeconds.toString()],
      ]),
    });

    if (!response.ok) {
      // On Redis error, allow request but log warning
      logger.warn("Redis rate limit check failed", {
        status: response.status,
        key: windowKey,
      });
      return { allowed: true, remaining: config.maxRequests, resetAt };
    }

    const results = (await response.json()) as Array<{ result: number | string }>;
    const count = typeof results[0].result === "number" ? results[0].result : parseInt(String(results[0].result), 10);

    const allowed = count <= config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - count);

    return { allowed, remaining, resetAt };
  } catch (error) {
    // On error, allow request to prevent rate limiter from blocking all traffic
    logger.error("Rate limit error", error, { key: windowKey });
    return { allowed: true, remaining: config.maxRequests, resetAt };
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
    logger.warn("Upstash Redis not configured, skipping rate limiting");
    await next();
    return;
  }

  const path = c.req.path;
  const method = c.req.method;
  const config = getRateLimitConfig(path, method);

  // Rate limit key based on API key ID and endpoint
  const rateLimitKey = `${auth.apiKeyId}:${method}:${path.split("/").slice(0, 4).join("/")}`;

  const { allowed, remaining, resetAt } = await checkRateLimitAtomic(
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
    logger.warn("Rate limit exceeded", {
      apiKeyId: auth.apiKeyId,
      path,
      method,
      limit: config.maxRequests,
    });

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
