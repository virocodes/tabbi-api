/**
 * Database Utility
 * Provides reliable database operations with proper error handling
 */

import { logger } from "./logger";
import { withRetry } from "./retry";

export interface DatabaseConfig {
  url: string;
}

export interface QueryResult<T = unknown> {
  rows: T[];
  rowCount: number;
}

/**
 * Execute a database query with retry logic
 */
export async function executeQuery<T = unknown>(
  databaseUrl: string,
  query: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  return withRetry(
    async () => {
      const response = await fetch(databaseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, params }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Database query failed (${response.status}): ${text}`);
      }

      const result = await response.json() as { rows: T[]; rowCount?: number };
      return {
        rows: result.rows || [],
        rowCount: result.rowCount ?? result.rows?.length ?? 0,
      };
    },
    {
      maxAttempts: 3,
      context: "database query",
      isRetryable: (error) => {
        const message = error.message.toLowerCase();
        // Retry on connection issues, not on constraint violations
        return (
          message.includes("timeout") ||
          message.includes("connection") ||
          message.includes("503") ||
          message.includes("502")
        );
      },
    }
  );
}

/**
 * Database operations that should be tracked for reliability
 * Uses waitUntil pattern for fire-and-forget with visibility
 */
export class DatabaseOperations {
  private databaseUrl: string;
  private pendingOps: Promise<void>[] = [];

  constructor(databaseUrl: string) {
    this.databaseUrl = databaseUrl;
  }

  /**
   * Record session creation with proper error tracking
   */
  async recordSessionCreated(
    sessionId: string,
    apiKeyId: string,
    repo: string | null
  ): Promise<void> {
    if (!this.databaseUrl) {
      logger.warn("DATABASE_URL not configured, skipping session record");
      return;
    }

    try {
      await executeQuery(this.databaseUrl,
        `INSERT INTO sessions (id, api_key_id, repo, status)
         VALUES ($1, $2, $3, 'starting')`,
        [sessionId, apiKeyId, repo]
      );
      logger.info("Session recorded in database", { sessionId, apiKeyId });
    } catch (error) {
      logger.error("Failed to record session creation", error, { sessionId, apiKeyId });
      // Re-throw to allow caller to handle (e.g., add to dead letter queue)
      throw error;
    }
  }

  /**
   * Record message sent
   */
  async recordMessageSent(sessionId: string, apiKeyId: string): Promise<void> {
    if (!this.databaseUrl) return;

    try {
      await executeQuery(this.databaseUrl,
        `INSERT INTO usage_records (api_key_id, session_id, event_type)
         VALUES ($1, $2, 'message.sent')`,
        [apiKeyId, sessionId]
      );
    } catch (error) {
      logger.error("Failed to record message sent", error, { sessionId, apiKeyId });
      throw error;
    }
  }

  /**
   * Record session termination
   */
  async recordSessionTerminated(sessionId: string): Promise<void> {
    if (!this.databaseUrl) return;

    try {
      await executeQuery(this.databaseUrl,
        `UPDATE sessions
         SET status = 'terminated', terminated_at = NOW()
         WHERE id = $1`,
        [sessionId]
      );
      logger.info("Session termination recorded", { sessionId });
    } catch (error) {
      logger.error("Failed to record session termination", error, { sessionId });
      throw error;
    }
  }

  /**
   * Update session status
   */
  async updateSessionStatus(sessionId: string, status: string): Promise<void> {
    if (!this.databaseUrl) return;

    try {
      await executeQuery(this.databaseUrl,
        `UPDATE sessions SET status = $2, last_activity_at = NOW() WHERE id = $1`,
        [sessionId, status]
      );
    } catch (error) {
      logger.error("Failed to update session status", error, { sessionId, status });
      throw error;
    }
  }

  /**
   * Queue an operation to be executed with waitUntil
   * Returns a promise that resolves when the operation completes
   */
  queueOperation(operation: () => Promise<void>): Promise<void> {
    const op = operation().catch((error) => {
      logger.error("Queued database operation failed", error);
      // Don't re-throw - this is fire-and-forget
    });
    this.pendingOps.push(op);
    return op;
  }

  /**
   * Get all pending operations for waitUntil
   */
  getPendingOperations(): Promise<void>[] {
    return this.pendingOps;
  }
}
