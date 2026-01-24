/**
 * Sessions Router
 * Implements the 4 main API endpoints
 */

import { Hono } from "hono";
import { v4 as uuidv4 } from "uuid";
import type {
  Env,
  CreateSessionRequest,
  CreateSessionResponse,
  SendMessageRequest,
  ListFilesResponse,
  APIError,
  SessionState,
} from "../types";

const sessions = new Hono<{ Bindings: Env }>();

/**
 * POST /v1/sessions
 * Create a new session with sandbox
 */
sessions.post("/", async (c) => {
  const auth = c.get("auth");
  let body: CreateSessionRequest;

  try {
    body = await c.req.json<CreateSessionRequest>();
  } catch {
    body = {};
  }

  // Generate session ID
  const sessionId = uuidv4();

  // Get Durable Object stub
  const id = c.env.SESSION_AGENT.idFromName(sessionId);
  const stub = c.env.SESSION_AGENT.get(id);

  // Initialize session
  const initRequest = new Request("http://internal/initialize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId,
      apiKeyId: auth.apiKeyId,
      userId: auth.userId,
      repo: body.repo,
      gitToken: body.gitToken,
      anthropicApiKey: c.env.ANTHROPIC_API_KEY,
      modalApiUrl: c.env.MODAL_API_URL,
      modalApiSecret: c.env.MODAL_API_SECRET,
    }),
  });

  const initResponse = await stub.fetch(initRequest);

  if (!initResponse.ok) {
    const error = await initResponse.json<APIError>();
    return c.json(error, initResponse.status as 400 | 500);
  }

  const state = await initResponse.json<SessionState>();

  // Record in database (fire and forget)
  recordSessionCreated(c, sessionId, auth.apiKeyId, body.repo).catch(console.error);

  const response: CreateSessionResponse = {
    id: sessionId,
    status: state.status,
    createdAt: state.createdAt,
  };

  return c.json(response, 201);
});

/**
 * GET /v1/sessions/:id
 * Get session status
 */
sessions.get("/:id", async (c) => {
  const auth = c.get("auth");
  const sessionId = c.req.param("id");

  // Validate session ownership
  const ownershipCheck = await verifySessionOwnership(c, sessionId, auth.apiKeyId);
  if (!ownershipCheck.ok) {
    return c.json(ownershipCheck.error, ownershipCheck.status as 403 | 404);
  }

  // Get Durable Object stub
  const id = c.env.SESSION_AGENT.idFromName(sessionId);
  const stub = c.env.SESSION_AGENT.get(id);

  // Get session state
  const stateRequest = new Request("http://internal/state", {
    method: "GET",
  });

  const stateResponse = await stub.fetch(stateRequest);

  if (!stateResponse.ok) {
    const error = await stateResponse.json<APIError>();
    return c.json(error, stateResponse.status as 500);
  }

  const state = await stateResponse.json<{
    id: string;
    status: string;
    createdAt: string;
  }>();

  return c.json(state);
});

/**
 * POST /v1/sessions/:id/messages
 * Send a message and stream response via SSE
 */
sessions.post("/:id/messages", async (c) => {
  const auth = c.get("auth");
  const sessionId = c.req.param("id");

  // Validate session ownership
  const ownershipCheck = await verifySessionOwnership(c, sessionId, auth.apiKeyId);
  if (!ownershipCheck.ok) {
    return c.json(ownershipCheck.error, ownershipCheck.status as 403 | 404);
  }

  let body: SendMessageRequest;
  try {
    body = await c.req.json<SendMessageRequest>();
  } catch {
    const error: APIError = {
      error: {
        code: "INTERNAL_ERROR",
        message: "Invalid request body. Expected JSON with 'content' field.",
      },
    };
    return c.json(error, 400);
  }

  if (!body.content || typeof body.content !== "string") {
    const error: APIError = {
      error: {
        code: "INTERNAL_ERROR",
        message: "Message content is required",
      },
    };
    return c.json(error, 400);
  }

  // Get Durable Object stub
  const id = c.env.SESSION_AGENT.idFromName(sessionId);
  const stub = c.env.SESSION_AGENT.get(id);

  // Send prompt and get SSE stream
  const streamRequest = new Request("http://internal/prompt-stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: body.content,
      anthropicApiKey: c.env.ANTHROPIC_API_KEY,
      modalApiUrl: c.env.MODAL_API_URL,
      modalApiSecret: c.env.MODAL_API_SECRET,
    }),
  });

  const streamResponse = await stub.fetch(streamRequest);

  if (!streamResponse.ok) {
    const error = await streamResponse.json<APIError>();
    return c.json(error, streamResponse.status as 400 | 409 | 500);
  }

  // Record usage (fire and forget)
  recordMessageSent(c, sessionId, auth.apiKeyId).catch(console.error);

  // Return SSE stream with headers to prevent buffering
  return new Response(streamResponse.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
      "Transfer-Encoding": "chunked",
    },
  });
});

/**
 * GET /v1/sessions/:id/files/*
 * Retrieve workspace files
 */
sessions.get("/:id/files/*", async (c) => {
  const auth = c.get("auth");
  const sessionId = c.req.param("id");
  const filePath = c.req.path.replace(`/v1/sessions/${sessionId}/files`, "") || "/";

  // Validate session ownership
  const ownershipCheck = await verifySessionOwnership(c, sessionId, auth.apiKeyId);
  if (!ownershipCheck.ok) {
    return c.json(ownershipCheck.error, ownershipCheck.status as 403 | 404);
  }

  // Get Durable Object stub
  const id = c.env.SESSION_AGENT.idFromName(sessionId);
  const stub = c.env.SESSION_AGENT.get(id);

  // Determine if listing or reading
  const isListing = filePath === "/" || filePath.endsWith("/");

  const filesRequest = new Request(
    `http://internal/files${filePath}${isListing ? "?list=true" : ""}`,
    {
      method: "GET",
      headers: {
        "X-Modal-Url": c.env.MODAL_API_URL,
        "X-Modal-Secret": c.env.MODAL_API_SECRET,
      },
    }
  );

  const filesResponse = await stub.fetch(filesRequest);

  if (!filesResponse.ok) {
    const error = await filesResponse.json<APIError>();
    return c.json(error, filesResponse.status as 404 | 500);
  }

  if (isListing) {
    const data = await filesResponse.json<ListFilesResponse>();
    return c.json(data);
  }

  // Return file content
  return new Response(filesResponse.body, {
    headers: {
      "Content-Type": filesResponse.headers.get("Content-Type") || "application/octet-stream",
    },
  });
});

/**
 * POST /v1/sessions/:id/debug
 * Debug endpoint to test fetch to OpenCode
 */
sessions.post("/:id/debug", async (c) => {
  const auth = c.get("auth");
  const sessionId = c.req.param("id");

  const ownershipCheck = await verifySessionOwnership(c, sessionId, auth.apiKeyId);
  if (!ownershipCheck.ok) {
    return c.json(ownershipCheck.error, ownershipCheck.status as 403 | 404);
  }

  const id = c.env.SESSION_AGENT.idFromName(sessionId);
  const stub = c.env.SESSION_AGENT.get(id);

  const body = await c.req.text();
  const debugRequest = new Request("http://internal/debug-fetch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body || "{}",
  });

  const debugResponse = await stub.fetch(debugRequest);
  const data = await debugResponse.json();
  return c.json(data);
});

/**
 * GET /v1/sessions/:id/logs
 * Get sandbox logs for debugging
 */
sessions.get("/:id/logs", async (c) => {
  const auth = c.get("auth");
  const sessionId = c.req.param("id");

  // Validate session ownership
  const ownershipCheck = await verifySessionOwnership(c, sessionId, auth.apiKeyId);
  if (!ownershipCheck.ok) {
    return c.json(ownershipCheck.error, ownershipCheck.status as 403 | 404);
  }

  // Get Durable Object stub to get sandbox ID
  const id = c.env.SESSION_AGENT.idFromName(sessionId);
  const stub = c.env.SESSION_AGENT.get(id);

  const stateRequest = new Request("http://internal/state", {
    method: "GET",
  });
  const stateResponse = await stub.fetch(stateRequest);

  if (!stateResponse.ok) {
    const error = await stateResponse.json<APIError>();
    return c.json(error, stateResponse.status as 500);
  }

  // Get sandbox ID from internal state
  const getSandboxRequest = new Request("http://internal/get-sandbox-id", {
    method: "GET",
  });
  const sandboxResponse = await stub.fetch(getSandboxRequest);

  if (!sandboxResponse.ok) {
    return c.json({
      error: {
        code: "SANDBOX_NOT_FOUND",
        message: "Sandbox not available",
      },
    }, 404);
  }

  const { sandboxId } = await sandboxResponse.json<{ sandboxId: string }>();

  if (!sandboxId) {
    return c.json({
      error: {
        code: "SANDBOX_NOT_FOUND",
        message: "Sandbox not running",
      },
    }, 404);
  }

  // Fetch logs from Modal
  const { ModalClient } = await import("../services/modal");
  const modal = new ModalClient(c.env.MODAL_API_URL, c.env.MODAL_API_SECRET);

  try {
    const tail = parseInt(c.req.query("tail") || "100", 10);
    const result = await modal.getLogs(sandboxId, tail);
    return c.json(result);
  } catch (error) {
    return c.json({
      error: {
        code: "LOGS_FETCH_FAILED",
        message: error instanceof Error ? error.message : "Failed to fetch logs",
      },
    }, 500);
  }
});

/**
 * DELETE /v1/sessions/:id
 * Cleanup session
 */
sessions.delete("/:id", async (c) => {
  const auth = c.get("auth");
  const sessionId = c.req.param("id");

  // Validate session ownership
  const ownershipCheck = await verifySessionOwnership(c, sessionId, auth.apiKeyId);
  if (!ownershipCheck.ok) {
    return c.json(ownershipCheck.error, ownershipCheck.status as 403 | 404);
  }

  // Get Durable Object stub
  const id = c.env.SESSION_AGENT.idFromName(sessionId);
  const stub = c.env.SESSION_AGENT.get(id);

  // Terminate session
  const terminateRequest = new Request("http://internal/terminate", {
    method: "POST",
    headers: {
      "X-Modal-Url": c.env.MODAL_API_URL,
      "X-Modal-Secret": c.env.MODAL_API_SECRET,
    },
  });

  const terminateResponse = await stub.fetch(terminateRequest);

  if (!terminateResponse.ok) {
    const error = await terminateResponse.json<APIError>();
    return c.json(error, terminateResponse.status as 500);
  }

  // Record termination (fire and forget)
  recordSessionTerminated(c, sessionId, auth.apiKeyId).catch(console.error);

  return c.json({ status: "terminated" });
});

/**
 * Verify session ownership
 */
async function verifySessionOwnership(
  c: { env: Env },
  sessionId: string,
  apiKeyId: string
): Promise<
  | { ok: true }
  | { ok: false; error: APIError; status: number }
> {
  // Get Durable Object stub
  const id = c.env.SESSION_AGENT.idFromName(sessionId);
  const stub = c.env.SESSION_AGENT.get(id);

  // Check ownership
  const checkRequest = new Request("http://internal/check-ownership", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKeyId }),
  });

  const checkResponse = await stub.fetch(checkRequest);
  const result = await checkResponse.json<{ owned: boolean; exists: boolean }>();

  if (!result.exists) {
    return {
      ok: false,
      error: {
        error: {
          code: "SESSION_NOT_FOUND",
          message: "Session not found",
          details: { sessionId },
        },
      },
      status: 404,
    };
  }

  if (!result.owned) {
    return {
      ok: false,
      error: {
        error: {
          code: "SESSION_NOT_OWNED",
          message: "Session belongs to a different API key",
          details: { sessionId },
        },
      },
      status: 403,
    };
  }

  return { ok: true };
}

/**
 * Record session created in database
 */
async function recordSessionCreated(
  c: { env: Env },
  sessionId: string,
  apiKeyId: string,
  repo?: string
): Promise<void> {
  const databaseUrl = c.env.DATABASE_URL;
  if (!databaseUrl) return;

  try {
    await fetch(databaseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `
          INSERT INTO sessions (id, api_key_id, repo, status)
          VALUES ($1, $2, $3, 'starting')
        `,
        params: [sessionId, apiKeyId, repo || null],
      }),
    });
  } catch (error) {
    console.error("Failed to record session:", error);
  }
}

/**
 * Record message sent in database
 */
async function recordMessageSent(
  c: { env: Env },
  sessionId: string,
  apiKeyId: string
): Promise<void> {
  const databaseUrl = c.env.DATABASE_URL;
  if (!databaseUrl) return;

  try {
    await fetch(databaseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `
          INSERT INTO usage_records (api_key_id, session_id, event_type)
          VALUES ($1, $2, 'message.sent')
        `,
        params: [apiKeyId, sessionId],
      }),
    });
  } catch (error) {
    console.error("Failed to record message:", error);
  }
}

/**
 * Record session terminated in database
 */
async function recordSessionTerminated(
  c: { env: Env },
  sessionId: string,
  _apiKeyId: string
): Promise<void> {
  const databaseUrl = c.env.DATABASE_URL;
  if (!databaseUrl) return;

  try {
    await fetch(databaseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `
          UPDATE sessions
          SET status = 'terminated', terminated_at = NOW()
          WHERE id = $1
        `,
        params: [sessionId],
      }),
    });
  } catch (error) {
    console.error("Failed to record termination:", error);
  }
}

export { sessions };
