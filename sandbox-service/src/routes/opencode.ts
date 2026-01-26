/**
 * OpenCode Routes
 * OpenCode session and messaging operations
 */

import { Hono } from "hono";
import { opencodeService } from "../services/opencode";
import type { APIError, SendMessageRequest } from "../types";

const opencode = new Hono();

/**
 * GET /opencode/health
 * Check OpenCode server health
 */
opencode.get("/health", async (c) => {
  const baseUrl = c.req.query("baseUrl");

  if (!baseUrl) {
    const error: APIError = {
      error: {
        code: "VALIDATION_ERROR",
        message: "baseUrl query parameter is required",
      },
    };
    return c.json(error, 400);
  }

  try {
    const healthy = await opencodeService.health(baseUrl);
    return c.json({ healthy });
  } catch (error) {
    console.error("[opencode] Health check failed:", error);
    return c.json({ healthy: false });
  }
});

/**
 * GET /opencode/sessions
 * List existing sessions
 */
opencode.get("/sessions", async (c) => {
  const baseUrl = c.req.query("baseUrl");

  if (!baseUrl) {
    const error: APIError = {
      error: {
        code: "VALIDATION_ERROR",
        message: "baseUrl query parameter is required",
      },
    };
    return c.json(error, 400);
  }

  try {
    const sessions = await opencodeService.listSessions(baseUrl);
    return c.json({ sessions });
  } catch (error) {
    console.error("[opencode] List sessions failed:", error);
    const apiError: APIError = {
      error: {
        code: "OPENCODE_ERROR",
        message: error instanceof Error ? error.message : "Failed to list sessions",
      },
    };
    return c.json(apiError, 500);
  }
});

/**
 * POST /opencode/sessions
 * Create a new session
 */
opencode.post("/sessions", async (c) => {
  let body: { baseUrl: string; title?: string };
  try {
    body = await c.req.json<{ baseUrl: string; title?: string }>();
  } catch {
    const error: APIError = {
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid JSON in request body",
      },
    };
    return c.json(error, 400);
  }

  if (!body.baseUrl) {
    const error: APIError = {
      error: {
        code: "VALIDATION_ERROR",
        message: "baseUrl is required",
      },
    };
    return c.json(error, 400);
  }

  try {
    const session = await opencodeService.createSession(body.baseUrl, body.title);
    return c.json(session, 201);
  } catch (error) {
    console.error("[opencode] Create session failed:", error);
    const apiError: APIError = {
      error: {
        code: "OPENCODE_ERROR",
        message: error instanceof Error ? error.message : "Failed to create session",
      },
    };
    return c.json(apiError, 500);
  }
});

/**
 * POST /opencode/sessions/get-or-create
 * Get existing session or create a new one
 */
opencode.post("/sessions/get-or-create", async (c) => {
  let body: { baseUrl: string };
  try {
    body = await c.req.json<{ baseUrl: string }>();
  } catch {
    const error: APIError = {
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid JSON in request body",
      },
    };
    return c.json(error, 400);
  }

  if (!body.baseUrl) {
    const error: APIError = {
      error: {
        code: "VALIDATION_ERROR",
        message: "baseUrl is required",
      },
    };
    return c.json(error, 400);
  }

  try {
    const session = await opencodeService.getOrCreateSession(body.baseUrl);
    return c.json(session);
  } catch (error) {
    console.error("[opencode] Get or create session failed:", error);
    const apiError: APIError = {
      error: {
        code: "OPENCODE_ERROR",
        message: error instanceof Error ? error.message : "Failed to get or create session",
      },
    };
    return c.json(apiError, 500);
  }
});

/**
 * POST /opencode/sessions/:id/message
 * Send a message and stream the response
 *
 * Returns SSE stream that should be passed through directly to the client.
 */
opencode.post("/sessions/:id/message", async (c) => {
  const sessionId = c.req.param("id");

  let body: SendMessageRequest;
  try {
    body = await c.req.json<SendMessageRequest>();
  } catch {
    const error: APIError = {
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid JSON in request body",
      },
    };
    return c.json(error, 400);
  }

  if (!body.baseUrl) {
    const error: APIError = {
      error: {
        code: "VALIDATION_ERROR",
        message: "baseUrl is required",
      },
    };
    return c.json(error, 400);
  }

  if (!body.content) {
    const error: APIError = {
      error: {
        code: "VALIDATION_ERROR",
        message: "content is required",
      },
    };
    return c.json(error, 400);
  }

  try {
    // Get streaming response from OpenCode
    const eventStream = await opencodeService.sendMessage(
      body.baseUrl,
      sessionId,
      body.content
    );

    // Return as SSE streaming response - NO buffering
    return new Response(eventStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no", // Disable nginx buffering if proxied
      },
    });
  } catch (error) {
    console.error("[opencode] Send message failed:", error);
    const apiError: APIError = {
      error: {
        code: "STREAM_ERROR",
        message: error instanceof Error ? error.message : "Failed to send message",
      },
    };
    return c.json(apiError, 500);
  }
});

export { opencode as opencodeRoutes };
