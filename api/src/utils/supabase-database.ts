/**
 * Supabase Database Operations
 * Provides database operations using Supabase REST API
 */

import { logger } from "./logger";
import { withRetry } from "./retry";

export interface SupabaseConfig {
  url: string;
  serviceKey: string;
}

/**
 * Database operations using Supabase REST API
 * Uses waitUntil pattern for fire-and-forget with visibility
 */
export class SupabaseDatabaseOperations {
  private supabaseUrl: string;
  private supabaseServiceKey: string;
  private pendingOps: Promise<void>[] = [];

  constructor(supabaseUrl: string, supabaseServiceKey: string) {
    this.supabaseUrl = supabaseUrl;
    this.supabaseServiceKey = supabaseServiceKey;
  }

  /**
   * Make a request to Supabase REST API with retry logic
   */
  private async supabaseRequest(
    endpoint: string,
    options: {
      method: "GET" | "POST" | "PATCH" | "DELETE";
      body?: unknown;
      prefer?: string;
    }
  ): Promise<Response> {
    return withRetry(
      async () => {
        const headers: Record<string, string> = {
          apikey: this.supabaseServiceKey,
          Authorization: `Bearer ${this.supabaseServiceKey}`,
          "Content-Type": "application/json",
        };

        if (options.prefer) {
          headers["Prefer"] = options.prefer;
        }

        const response = await fetch(`${this.supabaseUrl}/rest/v1/${endpoint}`, {
          method: options.method,
          headers,
          body: options.body ? JSON.stringify(options.body) : undefined,
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Supabase request failed (${response.status}): ${text}`);
        }

        return response;
      },
      {
        maxAttempts: 3,
        context: `supabase ${options.method} ${endpoint}`,
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
   * Record session creation with proper error tracking
   */
  async recordSessionCreated(
    sessionId: string,
    apiKeyId: string,
    repo: string | null
  ): Promise<void> {
    if (!this.supabaseUrl || !this.supabaseServiceKey) {
      logger.warn("Supabase not configured, skipping session record");
      return;
    }

    try {
      // Record in sessions table
      await this.supabaseRequest("sessions", {
        method: "POST",
        body: {
          id: sessionId,
          api_key_id: apiKeyId,
          repo: repo,
          status: "starting",
        },
        prefer: "return=minimal",
      });

      // Also record in usage_records for usage tracking
      await this.supabaseRequest("usage_records", {
        method: "POST",
        body: {
          api_key_id: apiKeyId,
          session_id: sessionId,
          event_type: "session.created",
        },
        prefer: "return=minimal",
      });

      logger.info("Session recorded in database", { sessionId, apiKeyId });
    } catch (error) {
      logger.error("Failed to record session creation", error, { sessionId, apiKeyId });
      throw error;
    }
  }

  /**
   * Record message sent
   */
  async recordMessageSent(sessionId: string, apiKeyId: string): Promise<void> {
    if (!this.supabaseUrl || !this.supabaseServiceKey) return;

    try {
      await this.supabaseRequest("usage_records", {
        method: "POST",
        body: {
          api_key_id: apiKeyId,
          session_id: sessionId,
          event_type: "message.sent",
        },
        prefer: "return=minimal",
      });
    } catch (error) {
      logger.error("Failed to record message sent", error, { sessionId, apiKeyId });
      throw error;
    }
  }

  /**
   * Record session termination
   */
  async recordSessionTerminated(sessionId: string): Promise<void> {
    if (!this.supabaseUrl || !this.supabaseServiceKey) return;

    try {
      await this.supabaseRequest(`sessions?id=eq.${sessionId}`, {
        method: "PATCH",
        body: {
          status: "terminated",
          terminated_at: new Date().toISOString(),
        },
        prefer: "return=minimal",
      });
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
    if (!this.supabaseUrl || !this.supabaseServiceKey) return;

    try {
      await this.supabaseRequest(`sessions?id=eq.${sessionId}`, {
        method: "PATCH",
        body: {
          status: status,
          last_activity_at: new Date().toISOString(),
        },
        prefer: "return=minimal",
      });
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
