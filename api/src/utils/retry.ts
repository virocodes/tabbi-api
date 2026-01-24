/**
 * Retry Utility with Exponential Backoff
 * Provides retry logic for transient failures
 */

import { logger } from "./logger";

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;
  /** Initial delay in ms (default: 1000) */
  initialDelayMs?: number;
  /** Maximum delay in ms (default: 30000) */
  maxDelayMs?: number;
  /** Exponential backoff multiplier (default: 2) */
  backoffMultiplier?: number;
  /** Whether to add jitter to delays (default: true) */
  jitter?: boolean;
  /** Function to determine if error is retryable (default: retry on 5xx and network errors) */
  isRetryable?: (error: Error) => boolean;
  /** Context for logging */
  context?: string;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, "isRetryable" | "context">> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true,
};

/**
 * Default function to determine if an error is retryable
 */
function defaultIsRetryable(error: Error): boolean {
  const message = error.message.toLowerCase();

  // Retry on network errors
  if (
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("socket hang up")
  ) {
    return true;
  }

  // Retry on 5xx errors
  if (message.includes("(5") || message.includes("502") || message.includes("503") || message.includes("504")) {
    return true;
  }

  // Retry on rate limits (429)
  if (message.includes("429") || message.includes("rate limit")) {
    return true;
  }

  return false;
}

/**
 * Calculate delay with optional jitter
 */
function calculateDelay(attempt: number, options: Required<Omit<RetryOptions, "isRetryable" | "context">>): number {
  const baseDelay = Math.min(
    options.initialDelayMs * Math.pow(options.backoffMultiplier, attempt - 1),
    options.maxDelayMs
  );

  if (options.jitter) {
    // Add random jitter between 0-25% of base delay
    const jitter = baseDelay * 0.25 * Math.random();
    return Math.floor(baseDelay + jitter);
  }

  return baseDelay;
}

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const isRetryable = options.isRetryable ?? defaultIsRetryable;
  const context = options.context ?? "operation";

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      const shouldRetry = attempt < opts.maxAttempts && isRetryable(lastError);

      if (shouldRetry) {
        const delay = calculateDelay(attempt, opts);
        logger.warn(`${context} failed, retrying`, {
          attempt,
          maxAttempts: opts.maxAttempts,
          delayMs: delay,
          error: lastError.message,
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        logger.error(`${context} failed permanently`, lastError, {
          attempt,
          maxAttempts: opts.maxAttempts,
        });
        throw lastError;
      }
    }
  }

  // Should never reach here, but TypeScript needs this
  throw lastError ?? new Error("Retry failed");
}

/**
 * Create a retryable version of a function
 */
export function makeRetryable<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  options: RetryOptions = {}
): T {
  return ((...args: unknown[]) => withRetry(() => fn(...args), options)) as T;
}
