/**
 * Sessions Router
 * Implements the main API endpoints with proper validation and error handling
 */

import { Hono } from "hono";
import { v4 as uuidv4 } from "uuid";
import type {
  Env,
  CreateSessionResponse,
  ListFilesResponse,
  APIError,
  SessionState,
} from "../types";
import { logger } from "../utils/logger";
import { DatabaseOperations } from "../utils/database";
import {
  validateCreateSessionRequest,
  validateSendMessageRequest,
  isValidUUID,
  sanitizeString,
} from "../utils/validation";
import { SandboxProxyClient } from "../services/sandbox-proxy";

const sessions = new Hono<{ Bindings: Env }>();

/**
 * POST /v1/sessions
 * Create a new session with sandbox
 */
sessions.post("/", async (c) => {
  const auth = c.get("auth");
  const requestId = c.get("requestId");
  const log = logger.child({ requestId, apiKeyId: auth.apiKeyId });

  // Parse and validate request body
  let rawBody: unknown;
  try {
    rawBody = await c.req.json();
  } catch {
    rawBody = {};
  }

  const validation = validateCreateSessionRequest(rawBody);
  if (!validation.success) {
    log.warn("Validation failed", { errors: validation.errors });
    const error: APIError = {
      error: {
        code: "VALIDATION_ERROR",
        message: validation.errors?.join(", ") || "Invalid request",
        details: { errors: validation.errors },
      },
    };
    return c.json(error, 400);
  }

  const body = validation.data!;

  // Generate session ID
  const sessionId = uuidv4();
  log.info("Creating session", { sessionId, repo: body.repo });

  // Get Durable Object stub
  const id = c.env.SESSION_AGENT.idFromName(sessionId);
  const stub = c.env.SESSION_AGENT.get(id);

  // Initialize session
  const initRequest = new Request("http://internal/initialize", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Request-ID": requestId,
    },
    body: JSON.stringify({
      sessionId,
      apiKeyId: auth.apiKeyId,
      userId: auth.userId,
      repo: sanitizeString(body.repo),
      gitToken: body.gitToken,
      anthropicApiKey: c.env.ANTHROPIC_API_KEY,
      sandboxServiceUrl: c.env.SANDBOX_SERVICE_URL,
      sandboxServiceApiKey: c.env.SANDBOX_SERVICE_API_KEY,
    }),
  });

  const initResponse = await stub.fetch(initRequest);

  if (!initResponse.ok) {
    const error = await initResponse.json<APIError>();
    log.error("Session initialization failed", new Error(error.error.message));
    return c.json(error, initResponse.status as 400 | 500);
  }

  const state = await initResponse.json<SessionState>();

  // Record in database using waitUntil for reliability
  if (c.env.DATABASE_URL) {
    const db = new DatabaseOperations(c.env.DATABASE_URL);
    c.executionCtx.waitUntil(
      db.recordSessionCreated(sessionId, auth.apiKeyId, sanitizeString(body.repo))
        .catch((err) => log.error("Failed to record session", err))
    );
  }

  const response: CreateSessionResponse = {
    id: sessionId,
    status: state.status,
    createdAt: state.createdAt,
  };

  log.info("Session created", { sessionId, status: state.status });
  return c.json(response, 201);
});

/**
 * GET /v1/sessions/:id
 * Get session status
 */
sessions.get("/:id", async (c) => {
  const auth = c.get("auth");
  const requestId = c.get("requestId");
  const sessionId = c.req.param("id");
  const log = logger.child({ requestId, sessionId, apiKeyId: auth.apiKeyId });

  // Validate session ID format
  if (!isValidUUID(sessionId)) {
    const error: APIError = {
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid session ID format",
      },
    };
    return c.json(error, 400);
  }

  // Validate session ownership
  const ownershipCheck = await verifySessionOwnership(c, sessionId, auth.apiKeyId, log);
  if (!ownershipCheck.ok) {
    return c.json(ownershipCheck.error, ownershipCheck.status as 403 | 404);
  }

  // Get Durable Object stub
  const id = c.env.SESSION_AGENT.idFromName(sessionId);
  const stub = c.env.SESSION_AGENT.get(id);

  // Get session state
  const stateRequest = new Request("http://internal/state", {
    method: "GET",
    headers: { "X-Request-ID": requestId },
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
  const requestId = c.get("requestId");
  const sessionId = c.req.param("id");
  const log = logger.child({ requestId, sessionId, apiKeyId: auth.apiKeyId });

  // Validate session ID format
  if (!isValidUUID(sessionId)) {
    const error: APIError = {
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid session ID format",
      },
    };
    return c.json(error, 400);
  }

  // Validate session ownership
  const ownershipCheck = await verifySessionOwnership(c, sessionId, auth.apiKeyId, log);
  if (!ownershipCheck.ok) {
    return c.json(ownershipCheck.error, ownershipCheck.status as 403 | 404);
  }

  // Parse and validate request body
  let rawBody: unknown;
  try {
    rawBody = await c.req.json();
  } catch {
    const error: APIError = {
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid JSON in request body",
      },
    };
    return c.json(error, 400);
  }

  const validation = validateSendMessageRequest(rawBody);
  if (!validation.success) {
    log.warn("Message validation failed", { errors: validation.errors });
    const error: APIError = {
      error: {
        code: "VALIDATION_ERROR",
        message: validation.errors?.join(", ") || "Invalid request",
        details: { errors: validation.errors },
      },
    };
    return c.json(error, 400);
  }

  const body = validation.data!;
  log.info("Sending message", { contentLength: body.content.length });

  // Get Durable Object stub
  const id = c.env.SESSION_AGENT.idFromName(sessionId);
  const stub = c.env.SESSION_AGENT.get(id);

  // Send prompt and get SSE stream
  const streamRequest = new Request("http://internal/prompt-stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Request-ID": requestId,
    },
    body: JSON.stringify({
      content: body.content,
    }),
  });

  const streamResponse = await stub.fetch(streamRequest);

  if (!streamResponse.ok) {
    const error = await streamResponse.json<APIError>();
    log.error("Message stream failed", new Error(error.error.message));
    return c.json(error, streamResponse.status as 400 | 409 | 500);
  }

  // Record usage using waitUntil
  if (c.env.DATABASE_URL) {
    const db = new DatabaseOperations(c.env.DATABASE_URL);
    c.executionCtx.waitUntil(
      db.recordMessageSent(sessionId, auth.apiKeyId)
        .catch((err) => log.error("Failed to record message", err))
    );
  }

  // Return SSE stream with headers to prevent buffering
  return new Response(streamResponse.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
      "X-Request-ID": requestId,
    },
  });
});

/**
 * GET /v1/sessions/:id/files/*
 * Retrieve workspace files
 */
sessions.get("/:id/files/*", async (c) => {
  const auth = c.get("auth");
  const requestId = c.get("requestId");
  const sessionId = c.req.param("id");
  const filePath = c.req.path.replace(`/v1/sessions/${sessionId}/files`, "") || "/";
  const log = logger.child({ requestId, sessionId, path: filePath });

  // Validate session ID format
  if (!isValidUUID(sessionId)) {
    const error: APIError = {
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid session ID format",
      },
    };
    return c.json(error, 400);
  }

  // Validate session ownership
  const ownershipCheck = await verifySessionOwnership(c, sessionId, auth.apiKeyId, log);
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
        "X-Request-ID": requestId,
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
      "X-Request-ID": requestId,
    },
  });
});

/**
 * GET /v1/sessions/:id/logs
 * Get sandbox logs for debugging
 */
sessions.get("/:id/logs", async (c) => {
  const auth = c.get("auth");
  const requestId = c.get("requestId");
  const sessionId = c.req.param("id");
  const log = logger.child({ requestId, sessionId });

  // Validate session ID format
  if (!isValidUUID(sessionId)) {
    const error: APIError = {
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid session ID format",
      },
    };
    return c.json(error, 400);
  }

  // Validate session ownership
  const ownershipCheck = await verifySessionOwnership(c, sessionId, auth.apiKeyId, log);
  if (!ownershipCheck.ok) {
    return c.json(ownershipCheck.error, ownershipCheck.status as 403 | 404);
  }

  // Get Durable Object stub to get sandbox ID
  const id = c.env.SESSION_AGENT.idFromName(sessionId);
  const stub = c.env.SESSION_AGENT.get(id);

  // Get sandbox ID from internal state
  const getSandboxRequest = new Request("http://internal/get-sandbox-id", {
    method: "GET",
    headers: { "X-Request-ID": requestId },
  });
  const sandboxResponse = await stub.fetch(getSandboxRequest);

  if (!sandboxResponse.ok) {
    return c.json(
      {
        error: {
          code: "SESSION_NOT_FOUND",
          message: "Sandbox not available",
        },
      },
      404
    );
  }

  const { sandboxId } = await sandboxResponse.json<{ sandboxId: string }>();

  if (!sandboxId) {
    return c.json(
      {
        error: {
          code: "SESSION_NOT_FOUND",
          message: "Sandbox not running",
        },
      },
      404
    );
  }

  // Fetch logs from sandbox service
  const proxy = new SandboxProxyClient(
    c.env.SANDBOX_SERVICE_URL,
    c.env.SANDBOX_SERVICE_API_KEY
  );

  try {
    const tail = parseInt(c.req.query("tail") || "100", 10);
    const result = await proxy.getLogs(sandboxId, tail);
    return c.json(result);
  } catch (error) {
    log.error("Failed to fetch logs", error);
    return c.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Failed to fetch logs",
        },
      },
      500
    );
  }
});

/**
 * DELETE /v1/sessions/:id
 * Cleanup session
 */
sessions.delete("/:id", async (c) => {
  const auth = c.get("auth");
  const requestId = c.get("requestId");
  const sessionId = c.req.param("id");
  const log = logger.child({ requestId, sessionId, apiKeyId: auth.apiKeyId });

  // Validate session ID format
  if (!isValidUUID(sessionId)) {
    const error: APIError = {
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid session ID format",
      },
    };
    return c.json(error, 400);
  }

  // Validate session ownership
  const ownershipCheck = await verifySessionOwnership(c, sessionId, auth.apiKeyId, log);
  if (!ownershipCheck.ok) {
    return c.json(ownershipCheck.error, ownershipCheck.status as 403 | 404);
  }

  log.info("Terminating session");

  // Get Durable Object stub
  const id = c.env.SESSION_AGENT.idFromName(sessionId);
  const stub = c.env.SESSION_AGENT.get(id);

  // Terminate session
  const terminateRequest = new Request("http://internal/terminate", {
    method: "POST",
    headers: {
      "X-Request-ID": requestId,
    },
  });

  const terminateResponse = await stub.fetch(terminateRequest);

  if (!terminateResponse.ok) {
    const error = await terminateResponse.json<APIError>();
    log.error("Session termination failed", new Error(error.error.message));
    return c.json(error, terminateResponse.status as 500);
  }

  // Record termination using waitUntil
  if (c.env.DATABASE_URL) {
    const db = new DatabaseOperations(c.env.DATABASE_URL);
    c.executionCtx.waitUntil(
      db.recordSessionTerminated(sessionId)
        .catch((err) => log.error("Failed to record termination", err))
    );
  }

  log.info("Session terminated");
  return c.json({ status: "terminated" });
});

/**
 * Verify session ownership
 */
async function verifySessionOwnership(
  c: { env: Env },
  sessionId: string,
  apiKeyId: string,
  log: ReturnType<typeof logger.child>
): Promise<{ ok: true } | { ok: false; error: APIError; status: number }> {
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
    log.warn("Session not found");
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
    log.warn("Session not owned by this API key");
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

export { sessions };
