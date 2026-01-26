/**
 * SessionAgent Durable Object
 * Manages individual session state and orchestrates sandbox/OpenCode communication
 */

import { DurableObject } from "cloudflare:workers";
import { v4 as uuidv4 } from "uuid";
import type { SessionState, Message, APIError, FileInfo, Env } from "./types";
import { SandboxProxyClient } from "./services/sandbox-proxy";
import { logger, Logger } from "./utils/logger";

// SQLite schema for session state
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS session_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    tool_calls TEXT,
    created_at TEXT NOT NULL
  );
`;

// Configuration stored once during initialization
interface SessionConfig {
  anthropicApiKey: string;
  sandboxServiceUrl: string;
  sandboxServiceApiKey: string;
}

export class SessionAgent extends DurableObject {
  private sql: SqlStorage;
  private initialized = false;
  private log: Logger;

  constructor(state: DurableObjectState, _env: Env) {
    super(state, _env);
    this.sql = state.storage.sql;
    this.log = logger.child({ component: "SessionAgent" });
  }

  private async ensureSchema(): Promise<void> {
    if (this.initialized) return;

    try {
      this.sql.exec(SCHEMA);
      this.initialized = true;
    } catch {
      this.initialized = true;
    }
  }

  private async getState(): Promise<SessionState | null> {
    await this.ensureSchema();

    const result = this.sql.exec("SELECT value FROM session_state WHERE key = 'state'");
    const rows = [...result];

    if (rows.length === 0) {
      return null;
    }

    return JSON.parse(rows[0].value as string) as SessionState;
  }

  private async setState(state: SessionState): Promise<void> {
    await this.ensureSchema();

    this.sql.exec(
      "INSERT OR REPLACE INTO session_state (key, value) VALUES ('state', ?)",
      JSON.stringify(state)
    );
  }

  private async getConfig(): Promise<SessionConfig | null> {
    await this.ensureSchema();

    const result = this.sql.exec("SELECT value FROM session_state WHERE key = 'config'");
    const rows = [...result];

    if (rows.length === 0) {
      return null;
    }

    return JSON.parse(rows[0].value as string) as SessionConfig;
  }

  private async setConfig(config: SessionConfig): Promise<void> {
    await this.ensureSchema();

    this.sql.exec(
      "INSERT OR REPLACE INTO session_state (key, value) VALUES ('config', ?)",
      JSON.stringify(config)
    );
  }

  private async addMessage(message: Message): Promise<void> {
    await this.ensureSchema();

    this.sql.exec(
      `INSERT INTO messages (id, role, content, tool_calls, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      message.id,
      message.role,
      message.content,
      message.toolCalls ? JSON.stringify(message.toolCalls) : null,
      message.createdAt
    );
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const requestId = request.headers.get("X-Request-ID") || "unknown";
    this.log = logger.child({ component: "SessionAgent", requestId });

    try {
      if (path === "/initialize" && request.method === "POST") {
        return this.handleInitialize(request);
      }

      if (path === "/prompt-stream" && request.method === "POST") {
        return this.handlePromptStream(request);
      }

      if (path.startsWith("/files")) {
        return this.handleFiles(request, path.replace("/files", ""));
      }

      if (path === "/terminate" && request.method === "POST") {
        return this.handleTerminate(request);
      }

      if (path === "/check-ownership" && request.method === "POST") {
        return this.handleCheckOwnership(request);
      }

      if (path === "/state" && request.method === "GET") {
        return this.handleGetState();
      }

      if (path === "/get-sandbox-id" && request.method === "GET") {
        return this.handleGetSandboxId();
      }

      if (path === "/health" && request.method === "GET") {
        return this.handleHealth();
      }

      return new Response("Not Found", { status: 404 });
    } catch (error) {
      this.log.error("SessionAgent error", error);
      const apiError: APIError = {
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        },
      };
      return Response.json(apiError, { status: 500 });
    }
  }

  /**
   * Health check endpoint
   */
  private async handleHealth(): Promise<Response> {
    const state = await this.getState();
    return Response.json({
      healthy: true,
      hasState: !!state,
      status: state?.status || "uninitialized",
    });
  }

  /**
   * Initialize a new session
   */
  private async handleInitialize(request: Request): Promise<Response> {
    const body = await request.json<{
      sessionId: string;
      apiKeyId: string;
      userId: string;
      repo?: string;
      gitToken?: string;
      anthropicApiKey: string;
      sandboxServiceUrl: string;
      sandboxServiceApiKey: string;
    }>();

    this.log = this.log.child({ sessionId: body.sessionId });

    // Check if already initialized
    const existingState = await this.getState();
    if (existingState) {
      this.log.info("Session already initialized, returning existing state");
      return Response.json(existingState);
    }

    // Store configuration securely (not passed in every request)
    const config: SessionConfig = {
      anthropicApiKey: body.anthropicApiKey,
      sandboxServiceUrl: body.sandboxServiceUrl,
      sandboxServiceApiKey: body.sandboxServiceApiKey,
    };
    await this.setConfig(config);

    // Create initial state
    const now = new Date().toISOString();
    const state: SessionState = {
      sessionId: body.sessionId,
      status: "starting",
      sandboxId: null,
      sandboxUrl: null,
      snapshotId: null,
      opencodeSessionId: null,
      isProcessing: false,
      repo: body.repo || null,
      createdAt: now,
      lastActivityAt: now,
    };

    // Store ownership info
    this.sql.exec(
      "INSERT OR REPLACE INTO session_state (key, value) VALUES ('apiKeyId', ?)",
      body.apiKeyId
    );
    this.sql.exec(
      "INSERT OR REPLACE INTO session_state (key, value) VALUES ('userId', ?)",
      body.userId
    );

    await this.setState(state);

    this.log.info("Session initialized, starting sandbox creation");

    // Start sandbox creation in background
    this.ctx.waitUntil(
      this.createSandbox(config, body.repo, body.gitToken)
    );

    return Response.json(state, { status: 201 });
  }

  /**
   * Create sandbox asynchronously via sandbox service
   */
  private async createSandbox(
    config: SessionConfig,
    repo?: string,
    gitToken?: string,
    existingOpencodeSessionId?: string
  ): Promise<void> {
    const proxy = new SandboxProxyClient(
      config.sandboxServiceUrl,
      config.sandboxServiceApiKey
    );

    try {
      this.log.info("Creating sandbox via sandbox service");
      const result = await proxy.createSandbox({
        anthropicApiKey: config.anthropicApiKey,
        repo,
        gitToken,
        opencodeSessionId: existingOpencodeSessionId,
      });

      const state = await this.getState();
      if (!state) {
        this.log.error("State disappeared during sandbox creation");
        return;
      }

      state.sandboxId = result.sandboxId;
      state.sandboxUrl = result.previewUrl;
      state.lastActivityAt = new Date().toISOString();

      this.log.info("Sandbox created, initializing OpenCode session", {
        sandboxId: result.sandboxId,
      });

      // Initialize OpenCode session via proxy
      const session = await proxy.getOrCreateSession(result.previewUrl);
      state.opencodeSessionId = session.id;
      state.status = "idle";

      await this.setState(state);
      this.log.info("Session ready", { opencodeSessionId: session.id });
    } catch (error) {
      this.log.error("Sandbox creation failed", error);

      const state = await this.getState();
      if (!state) return;

      state.status = "error";
      await this.setState(state);
    }
  }

  /**
   * Handle prompt streaming - returns immediately, doesn't block waiting for sandbox
   */
  private async handlePromptStream(request: Request): Promise<Response> {
    const body = await request.json<{
      content: string;
    }>();

    const state = await this.getState();
    if (!state) {
      const error: APIError = {
        error: {
          code: "SESSION_NOT_FOUND",
          message: "Session not initialized",
        },
      };
      return Response.json(error, { status: 404 });
    }

    // Check if already processing
    if (state.isProcessing) {
      const error: APIError = {
        error: {
          code: "SESSION_BUSY",
          message: "Session is currently processing another message",
        },
      };
      return Response.json(error, { status: 409 });
    }

    // Get stored config
    const config = await this.getConfig();
    if (!config) {
      const error: APIError = {
        error: {
          code: "INTERNAL_ERROR",
          message: "Session configuration not found",
        },
      };
      return Response.json(error, { status: 500 });
    }

    // If session is still starting, return error immediately - client should poll
    if (state.status === "starting") {
      const error: APIError = {
        error: {
          code: "SESSION_BUSY",
          message: "Session is still starting. Poll GET /v1/sessions/:id for status.",
        },
      };
      return Response.json(error, { status: 409 });
    }

    const proxy = new SandboxProxyClient(
      config.sandboxServiceUrl,
      config.sandboxServiceApiKey
    );

    // Auto-resume if paused (Daytona uses same sandboxId, preserves filesystem)
    if (state.status === "paused" && state.sandboxId) {
      this.log.info("Auto-resuming paused session");
      state.status = "starting";
      state.isProcessing = true;
      await this.setState(state);

      try {
        // Pass opencodeSessionId to resume the same conversation
        const result = await proxy.resumeSandbox(
          state.sandboxId,
          config.anthropicApiKey,
          state.opencodeSessionId || undefined
        );
        state.sandboxUrl = result.previewUrl;

        const session = await proxy.getOrCreateSession(result.previewUrl);
        state.opencodeSessionId = session.id;
        state.status = "running";
        await this.setState(state);
      } catch (error) {
        this.log.error("Failed to resume sandbox", error);
        state.status = "error";
        state.isProcessing = false;
        await this.setState(state);

        const apiError: APIError = {
          error: {
            code: "SANDBOX_CREATE_FAILED",
            message: `Failed to resume sandbox: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        };
        return Response.json(apiError, { status: 500 });
      }
    }

    // Verify sandbox is ready
    if (!state.sandboxUrl || !state.opencodeSessionId) {
      const error: APIError = {
        error: {
          code: "SANDBOX_CREATE_FAILED",
          message: "Sandbox not ready",
        },
      };
      return Response.json(error, { status: 500 });
    }

    // Set processing flag
    state.isProcessing = true;
    state.status = "running";
    await this.setState(state);

    // Store user message
    const userMessage: Message = {
      id: uuidv4(),
      role: "user",
      content: body.content,
      createdAt: new Date().toISOString(),
    };
    await this.addMessage(userMessage);

    // Create SSE stream
    const encoder = new TextEncoder();
    const { readable, writable } = new TransformStream();

    // Fire-and-forget streaming
    this.ctx.waitUntil(
      (async () => {
        const streamingStartTime = Date.now();
        this.log.info("Starting message streaming");

        try {
          // Send initial events
          const initialWriter = writable.getWriter();
          await initialWriter.write(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "session.running",
                data: { sessionId: state.sessionId },
                timestamp: new Date().toISOString(),
              })}\n\n`
            )
          );
          await initialWriter.write(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "message.user",
                data: { content: body.content },
                timestamp: new Date().toISOString(),
              })}\n\n`
            )
          );

          // Release the lock so pipeTo() can use the writable
          initialWriter.releaseLock();

          // Get streaming response from sandbox service
          this.log.info("Connecting to sandbox service for streaming");
          const streamResponse = await proxy.sendMessageStream(
            state.sandboxUrl!,
            state.opencodeSessionId!,
            body.content
          );

          // Pipe response body directly to client - zero buffering
          if (streamResponse.body) {
            await streamResponse.body.pipeTo(writable, { preventClose: true });
          }

          this.log.info("Stream completed", { durationMs: Date.now() - streamingStartTime });

          // Send final idle event
          const finalWriter = writable.getWriter();
          await finalWriter.write(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "session.idle",
                data: { sessionId: state.sessionId },
                timestamp: new Date().toISOString(),
              })}\n\n`
            )
          );
          await finalWriter.close();
        } catch (error) {
          this.log.error("Stream error", error);
          try {
            const errorWriter = writable.getWriter();
            await errorWriter.write(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "error",
                  data: {
                    code: "STREAM_ERROR",
                    message: error instanceof Error ? error.message : "Stream failed",
                  },
                  timestamp: new Date().toISOString(),
                })}\n\n`
              )
            );
            await errorWriter.close();
          } catch {
            // Writer may already be closed
          }
        } finally {
          // Update state
          const currentState = await this.getState();
          if (currentState) {
            currentState.isProcessing = false;
            currentState.status = "idle";
            currentState.lastActivityAt = new Date().toISOString();
            await this.setState(currentState);
          }
        }
      })()
    );

    // Return immediately
    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }

  /**
   * Handle file operations
   */
  private async handleFiles(request: Request, path: string): Promise<Response> {
    const state = await this.getState();
    if (!state || !state.sandboxId) {
      const error: APIError = {
        error: {
          code: "SESSION_NOT_FOUND",
          message: "Session not found or sandbox not running",
        },
      };
      return Response.json(error, { status: 404 });
    }

    const config = await this.getConfig();
    if (!config) {
      const error: APIError = {
        error: {
          code: "INTERNAL_ERROR",
          message: "Session configuration not found",
        },
      };
      return Response.json(error, { status: 500 });
    }

    const proxy = new SandboxProxyClient(
      config.sandboxServiceUrl,
      config.sandboxServiceApiKey
    );

    const url = new URL(request.url);
    const isListing = url.searchParams.get("list") === "true";

    if (isListing) {
      try {
        const workspacePath = `/workspace${path}`.replace(/\/+$/, "") || "/workspace";
        const files = await proxy.listFiles(state.sandboxId, workspacePath);

        const mappedFiles: FileInfo[] = files.map((f) => ({
          name: f.name,
          path: f.path,
          isDirectory: f.isDirectory,
          size: f.size,
        }));

        return Response.json({ files: mappedFiles });
      } catch (error) {
        this.log.error("Failed to list files", error);
        const apiError: APIError = {
          error: {
            code: "INTERNAL_ERROR",
            message: `Failed to list files: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        };
        return Response.json(apiError, { status: 500 });
      }
    } else {
      try {
        const filePath = `/workspace${path}`;
        const content = await proxy.readFile(state.sandboxId, filePath);

        return new Response(content, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (message.includes("404") || message.includes("not found") || message.includes("FILE_NOT_FOUND")) {
          const apiError: APIError = {
            error: {
              code: "FILE_NOT_FOUND",
              message: `File not found: ${path}`,
            },
          };
          return Response.json(apiError, { status: 404 });
        }

        this.log.error("Failed to read file", error);
        const apiError: APIError = {
          error: {
            code: "INTERNAL_ERROR",
            message: `Failed to read file: ${message}`,
          },
        };
        return Response.json(apiError, { status: 500 });
      }
    }
  }

  /**
   * Handle session termination
   */
  private async handleTerminate(_request: Request): Promise<Response> {
    const state = await this.getState();
    if (!state) {
      return Response.json({ status: "not_found" }, { status: 404 });
    }

    const config = await this.getConfig();

    if (state.sandboxId && config) {
      const proxy = new SandboxProxyClient(
        config.sandboxServiceUrl,
        config.sandboxServiceApiKey
      );

      try {
        await proxy.terminateSandbox(state.sandboxId);
        this.log.info("Sandbox terminated", { sandboxId: state.sandboxId });
      } catch (error) {
        this.log.error("Failed to terminate sandbox", error);
      }
    }

    // Clear state
    this.sql.exec("DELETE FROM session_state");
    this.sql.exec("DELETE FROM messages");

    return Response.json({ status: "terminated" });
  }

  /**
   * Get session state
   */
  private async handleGetState(): Promise<Response> {
    const state = await this.getState();
    if (!state) {
      const error: APIError = {
        error: {
          code: "SESSION_NOT_FOUND",
          message: "Session not found",
        },
      };
      return Response.json(error, { status: 404 });
    }

    return Response.json({
      id: state.sessionId,
      status: state.status,
      createdAt: state.createdAt,
    });
  }

  /**
   * Get sandbox ID for logs endpoint
   */
  private async handleGetSandboxId(): Promise<Response> {
    const state = await this.getState();
    if (!state || !state.sandboxId) {
      return Response.json({ sandboxId: null }, { status: 404 });
    }

    return Response.json({ sandboxId: state.sandboxId });
  }

  /**
   * Check session ownership
   */
  private async handleCheckOwnership(request: Request): Promise<Response> {
    const body = await request.json<{ apiKeyId: string }>();

    const state = await this.getState();
    if (!state) {
      return Response.json({ exists: false, owned: false });
    }

    const result = this.sql.exec("SELECT value FROM session_state WHERE key = 'apiKeyId'");
    const rows = [...result];

    if (rows.length === 0) {
      return Response.json({ exists: true, owned: false });
    }

    const storedApiKeyId = rows[0].value as string;
    const owned = storedApiKeyId === body.apiKeyId;

    return Response.json({ exists: true, owned });
  }
}
