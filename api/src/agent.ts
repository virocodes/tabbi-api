/**
 * SessionAgent Durable Object
 * Manages individual session state and orchestrates sandbox/OpenCode communication
 */

import { DurableObject } from "cloudflare:workers";
import { v4 as uuidv4 } from "uuid";
import type { SessionState, Message, APIError, FileInfo, Env } from "./types";
import { ModalClient } from "./services/modal";
import { OpenCodeClient } from "./services/opencode";

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

export class SessionAgent extends DurableObject {
  private sql: SqlStorage;
  private initialized = false;

  constructor(state: DurableObjectState, _env: Env) {
    super(state, _env);
    this.sql = state.storage.sql;
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

      if (path === "/debug-fetch" && request.method === "POST") {
        return this.handleDebugFetch(request);
      }

      return new Response("Not Found", { status: 404 });
    } catch (error) {
      console.error("SessionAgent error:", error);
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
      modalApiUrl: string;
      modalApiSecret: string;
    }>();

    // Check if already initialized
    const existingState = await this.getState();
    if (existingState) {
      return Response.json(existingState);
    }

    // Create initial state
    const now = new Date().toISOString();
    const state: SessionState = {
      sessionId: body.sessionId,
      status: "starting",
      sandboxId: null,
      sandboxUrl: null,
      snapshotId: null,
      opencodeSessionId: null,
      messages: [],
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

    // Start sandbox creation in background
    this.ctx.waitUntil(
      this.createSandbox(
        body.modalApiUrl,
        body.modalApiSecret,
        body.anthropicApiKey,
        body.repo,
        body.gitToken
      )
    );

    return Response.json(state, { status: 201 });
  }

  /**
   * Create sandbox asynchronously
   */
  private async createSandbox(
    modalApiUrl: string,
    modalApiSecret: string,
    anthropicApiKey: string,
    repo?: string,
    gitToken?: string
  ): Promise<void> {
    const modal = new ModalClient(modalApiUrl, modalApiSecret);

    try {
      const result = await modal.createSandbox(anthropicApiKey, repo, gitToken);

      const state = await this.getState();
      if (!state) return;

      state.sandboxId = result.sandbox_id;
      state.sandboxUrl = result.tunnel_url;
      state.status = "idle";
      state.lastActivityAt = new Date().toISOString();

      // Initialize OpenCode session
      const opencode = new OpenCodeClient(result.tunnel_url);
      const session = await opencode.getOrCreateSession();
      state.opencodeSessionId = session.id;

      await this.setState(state);
    } catch (error) {
      console.error("Sandbox creation failed:", error);

      const state = await this.getState();
      if (!state) return;

      state.status = "error";
      await this.setState(state);
    }
  }

  /**
   * Handle prompt streaming
   */
  private async handlePromptStream(request: Request): Promise<Response> {
    const body = await request.json<{
      content: string;
      anthropicApiKey: string;
      modalApiUrl: string;
      modalApiSecret: string;
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

    // Auto-resume if paused
    if (state.status === "paused" && state.snapshotId) {
      state.status = "starting";
      state.isProcessing = true;
      await this.setState(state);

      const modal = new ModalClient(body.modalApiUrl, body.modalApiSecret);
      try {
        const result = await modal.resumeSandbox(state.snapshotId, body.anthropicApiKey);
        state.sandboxId = result.sandbox_id;
        state.sandboxUrl = result.tunnel_url;
        state.snapshotId = null;

        const opencode = new OpenCodeClient(result.tunnel_url);
        const session = await opencode.getOrCreateSession();
        state.opencodeSessionId = session.id;
        state.status = "running";
        await this.setState(state);
      } catch (error) {
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

    // Wait for sandbox to be ready
    if (state.status === "starting") {
      for (let i = 0; i < 60; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const currentState = await this.getState();
        if (!currentState) break;
        if (currentState.status === "idle" || currentState.status === "running") {
          Object.assign(state, currentState);
          break;
        }
        if (currentState.status === "error") {
          const apiError: APIError = {
            error: {
              code: "SANDBOX_CREATE_FAILED",
              message: "Sandbox creation failed",
            },
          };
          return Response.json(apiError, { status: 500 });
        }
      }
    }

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

    // Create SSE stream - let runtime handle buffering naturally
    const encoder = new TextEncoder();
    const { readable, writable } = new TransformStream();

    // Fire-and-forget streaming - use waitUntil to ensure background work completes
    // This is critical: without waitUntil, the runtime may not properly execute background work
    this.ctx.waitUntil(
      (async () => {
        const streamingStartTime = Date.now();
        console.log(`[agent] Starting streaming for session ${state.sessionId}`);

      try {
        // Send initial events using a temporary writer
        const initialWriter = writable.getWriter();
        await initialWriter.write(
          encoder.encode(
            `data: ${JSON.stringify({ type: "session.running", data: { sessionId: state.sessionId }, timestamp: new Date().toISOString() })}\n\n`
          )
        );
        await initialWriter.write(
          encoder.encode(
            `data: ${JSON.stringify({ type: "message.user", data: { content: body.content }, timestamp: new Date().toISOString() })}\n\n`
          )
        );
        console.log(`[agent] Initial events written in ${Date.now() - streamingStartTime}ms`);

        // Release the lock so pipeTo() can use the writable
        initialWriter.releaseLock();

        // Get OpenCode stream
        console.log(`[agent] Calling opencode.sendMessage to ${state.sandboxUrl}...`);
        const sendMessageStart = Date.now();
        const opencode = new OpenCodeClient(state.sandboxUrl!);
        const stream = await opencode.sendMessage(state.opencodeSessionId!, body.content);
        console.log(`[agent] opencode.sendMessage completed in ${Date.now() - sendMessageStart}ms`);

        // Pipe directly - this is the key fix for real-time streaming
        // pipeTo() is non-blocking and lets data flow through immediately
        console.log(`[agent] Starting pipeTo...`);
        const pipeStart = Date.now();
        await stream.pipeTo(writable, { preventClose: true });
        console.log(`[agent] pipeTo completed in ${Date.now() - pipeStart}ms`);

        // Send final idle event
        const finalWriter = writable.getWriter();
        await finalWriter.write(
          encoder.encode(
            `data: ${JSON.stringify({ type: "session.idle", data: { sessionId: state.sessionId }, timestamp: new Date().toISOString() })}\n\n`
          )
        );
        await finalWriter.close();
      } catch (error) {
        console.error("Stream error:", error);
        try {
          const errorWriter = writable.getWriter();
          await errorWriter.write(
            encoder.encode(
              `data: ${JSON.stringify({ type: "error", data: { code: "STREAM_ERROR", message: error instanceof Error ? error.message : "Stream failed" }, timestamp: new Date().toISOString() })}\n\n`
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

    // Return immediately - don't wait for streaming to complete
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
    const modalApiUrl = request.headers.get("X-Modal-Url") || "";
    const modalApiSecret = request.headers.get("X-Modal-Secret") || "";

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

    const modal = new ModalClient(modalApiUrl, modalApiSecret);
    const url = new URL(request.url);
    const isListing = url.searchParams.get("list") === "true";

    if (isListing) {
      try {
        const workspacePath = `/workspace${path}`.replace(/\/+$/, "") || "/workspace";
        const result = await modal.listFiles(state.sandboxId, workspacePath);

        const files: FileInfo[] = (result.files ?? []).map((f) => ({
          name: f.name,
          path: f.path,
          isDirectory: f.is_directory,
          size: f.size,
        }));

        return Response.json({ files });
      } catch (error) {
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
        const result = await modal.readFile(state.sandboxId, filePath);

        return new Response(result.content, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (message.includes("404") || message.includes("not found")) {
          const apiError: APIError = {
            error: {
              code: "FILE_NOT_FOUND",
              message: `File not found: ${path}`,
            },
          };
          return Response.json(apiError, { status: 404 });
        }

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
  private async handleTerminate(request: Request): Promise<Response> {
    const modalApiUrl = request.headers.get("X-Modal-Url") || "";
    const modalApiSecret = request.headers.get("X-Modal-Secret") || "";

    const state = await this.getState();
    if (!state) {
      return Response.json({ status: "not_found" }, { status: 404 });
    }

    if (state.sandboxId) {
      const modal = new ModalClient(modalApiUrl, modalApiSecret);
      try {
        await modal.terminateSandbox(state.sandboxId);
      } catch (error) {
        console.error("Failed to terminate sandbox:", error);
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
   * Debug endpoint to test fetch to OpenCode directly (blocking)
   */
  private async handleDebugFetch(request: Request): Promise<Response> {
    const state = await this.getState();
    if (!state || !state.sandboxUrl || !state.opencodeSessionId) {
      return Response.json({ error: "Session not ready" }, { status: 400 });
    }

    const body = await request.json<{ content?: string }>();
    const content = body.content || "test";

    const results: Record<string, unknown> = {
      sandboxUrl: state.sandboxUrl,
      sessionId: state.opencodeSessionId,
      tests: {},
    };

    // Test 1: Health check
    console.log("[debug] Testing health endpoint...");
    const healthStart = Date.now();
    try {
      const healthRes = await fetch(`${state.sandboxUrl}/global/health`);
      const healthData = await healthRes.text();
      results.tests = {
        ...results.tests as object,
        health: {
          status: healthRes.status,
          time: Date.now() - healthStart,
          data: healthData,
        },
      };
      console.log(`[debug] Health check completed in ${Date.now() - healthStart}ms`);
    } catch (e) {
      results.tests = {
        ...results.tests as object,
        health: { error: String(e), time: Date.now() - healthStart },
      };
    }

    // Test 2: List sessions
    console.log("[debug] Testing list sessions...");
    const listStart = Date.now();
    try {
      const listRes = await fetch(`${state.sandboxUrl}/session`);
      const listData = await listRes.text();
      results.tests = {
        ...results.tests as object,
        listSessions: {
          status: listRes.status,
          time: Date.now() - listStart,
          data: listData.slice(0, 500),
        },
      };
      console.log(`[debug] List sessions completed in ${Date.now() - listStart}ms`);
    } catch (e) {
      results.tests = {
        ...results.tests as object,
        listSessions: { error: String(e), time: Date.now() - listStart },
      };
    }

    // Test 3: POST message (the one that's hanging)
    console.log("[debug] Testing POST message...");
    const postStart = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log("[debug] POST message timeout after 10s");
      controller.abort();
    }, 10000);

    try {
      const postRes = await fetch(
        `${state.sandboxUrl}/session/${state.opencodeSessionId}/message`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ parts: [{ type: "text", text: content }] }),
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);
      const postData = await postRes.text();
      results.tests = {
        ...results.tests as object,
        postMessage: {
          status: postRes.status,
          time: Date.now() - postStart,
          data: postData.slice(0, 500),
        },
      };
      console.log(`[debug] POST message completed in ${Date.now() - postStart}ms`);
    } catch (e) {
      clearTimeout(timeoutId);
      results.tests = {
        ...results.tests as object,
        postMessage: { error: String(e), time: Date.now() - postStart },
      };
    }

    // Test 4: GET /event SSE endpoint
    console.log("[debug] Testing GET /event...");
    const eventStart = Date.now();
    const eventController = new AbortController();
    const eventTimeoutId = setTimeout(() => {
      console.log("[debug] GET /event timeout after 5s");
      eventController.abort();
    }, 5000);

    try {
      const eventRes = await fetch(`${state.sandboxUrl}/event`, {
        signal: eventController.signal,
      });
      clearTimeout(eventTimeoutId);
      // Just check if we can connect, don't read the stream
      results.tests = {
        ...results.tests as object,
        eventStream: {
          status: eventRes.status,
          time: Date.now() - eventStart,
          hasBody: !!eventRes.body,
          headers: Object.fromEntries(eventRes.headers.entries()),
        },
      };
      console.log(`[debug] GET /event connected in ${Date.now() - eventStart}ms`);
      // Cancel the stream to clean up
      eventRes.body?.cancel();
    } catch (e) {
      clearTimeout(eventTimeoutId);
      results.tests = {
        ...results.tests as object,
        eventStream: { error: String(e), time: Date.now() - eventStart },
      };
    }

    return Response.json(results, {
      headers: { "Content-Type": "application/json" },
    });
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
