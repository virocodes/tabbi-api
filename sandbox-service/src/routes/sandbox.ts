/**
 * Sandbox Routes
 * Daytona sandbox operations exposed via HTTP API
 */

import { Hono } from "hono";
import type { DaytonaSandboxService } from "../services/daytona";
import type {
  CreateSandboxRequest,
  ResumeSandboxRequest,
  ExecuteCommandRequest,
  APIError,
} from "../types";

// Extend Hono context for type safety
type Env = {
  Variables: {
    daytonaService: DaytonaSandboxService;
  };
};

const sandbox = new Hono<Env>();

/**
 * POST /sandbox
 * Create a new sandbox with OpenCode server
 */
sandbox.post("/", async (c) => {
  const service = c.get("daytonaService");

  let body: CreateSandboxRequest;
  try {
    body = await c.req.json<CreateSandboxRequest>();
  } catch {
    const error: APIError = {
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid JSON in request body",
      },
    };
    return c.json(error, 400);
  }

  if (!body.anthropicApiKey) {
    const error: APIError = {
      error: {
        code: "VALIDATION_ERROR",
        message: "anthropicApiKey is required",
      },
    };
    return c.json(error, 400);
  }

  try {
    const result = await service.createSandbox({
      anthropicApiKey: body.anthropicApiKey,
      repo: body.repo,
      gitToken: body.gitToken,
      opencodeSessionId: body.opencodeSessionId,
      systemPrompt: body.systemPrompt,
    });
    return c.json(result, 201);
  } catch (error) {
    console.error("[sandbox] Create failed:", error);
    const apiError: APIError = {
      error: {
        code: "SANDBOX_CREATE_FAILED",
        message: error instanceof Error ? error.message : "Failed to create sandbox",
      },
    };
    return c.json(apiError, 500);
  }
});

/**
 * POST /sandbox/:id/start
 * Resume a paused sandbox
 */
sandbox.post("/:id/start", async (c) => {
  const service = c.get("daytonaService");
  const sandboxId = c.req.param("id");

  let body: ResumeSandboxRequest;
  try {
    body = await c.req.json<ResumeSandboxRequest>();
  } catch {
    const error: APIError = {
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid JSON in request body",
      },
    };
    return c.json(error, 400);
  }

  if (!body.anthropicApiKey) {
    const error: APIError = {
      error: {
        code: "VALIDATION_ERROR",
        message: "anthropicApiKey is required",
      },
    };
    return c.json(error, 400);
  }

  try {
    const result = await service.resumeSandbox(
      sandboxId,
      body.anthropicApiKey,
      body.opencodeSessionId
    );
    return c.json(result);
  } catch (error) {
    console.error("[sandbox] Resume failed:", error);
    const apiError: APIError = {
      error: {
        code: "SANDBOX_RESUME_FAILED",
        message: error instanceof Error ? error.message : "Failed to resume sandbox",
      },
    };
    return c.json(apiError, 500);
  }
});

/**
 * POST /sandbox/:id/stop
 * Pause a sandbox
 */
sandbox.post("/:id/stop", async (c) => {
  const service = c.get("daytonaService");
  const sandboxId = c.req.param("id");

  try {
    await service.pauseSandbox(sandboxId);
    return c.json({ success: true });
  } catch (error) {
    console.error("[sandbox] Pause failed:", error);
    const apiError: APIError = {
      error: {
        code: "SANDBOX_PAUSE_FAILED",
        message: error instanceof Error ? error.message : "Failed to pause sandbox",
      },
    };
    return c.json(apiError, 500);
  }
});

/**
 * DELETE /sandbox/:id
 * Terminate a sandbox
 */
sandbox.delete("/:id", async (c) => {
  const service = c.get("daytonaService");
  const sandboxId = c.req.param("id");

  try {
    await service.terminateSandbox(sandboxId);
    return c.json({ success: true });
  } catch (error) {
    console.error("[sandbox] Terminate failed:", error);
    const apiError: APIError = {
      error: {
        code: "SANDBOX_TERMINATE_FAILED",
        message: error instanceof Error ? error.message : "Failed to terminate sandbox",
      },
    };
    return c.json(apiError, 500);
  }
});

/**
 * POST /sandbox/:id/execute
 * Execute a command in a sandbox
 */
sandbox.post("/:id/execute", async (c) => {
  const service = c.get("daytonaService");
  const sandboxId = c.req.param("id");

  let body: ExecuteCommandRequest;
  try {
    body = await c.req.json<ExecuteCommandRequest>();
  } catch {
    const error: APIError = {
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid JSON in request body",
      },
    };
    return c.json(error, 400);
  }

  if (!body.command) {
    const error: APIError = {
      error: {
        code: "VALIDATION_ERROR",
        message: "command is required",
      },
    };
    return c.json(error, 400);
  }

  try {
    const result = await service.executeCommand(
      sandboxId,
      body.command,
      body.cwd,
      body.timeout
    );
    return c.json(result);
  } catch (error) {
    console.error("[sandbox] Execute failed:", error);
    const apiError: APIError = {
      error: {
        code: "COMMAND_EXECUTION_FAILED",
        message: error instanceof Error ? error.message : "Failed to execute command",
      },
    };
    return c.json(apiError, 500);
  }
});

/**
 * GET /sandbox/:id/files
 * List files in sandbox directory
 */
sandbox.get("/:id/files", async (c) => {
  const service = c.get("daytonaService");
  const sandboxId = c.req.param("id");
  const path = c.req.query("path") || "/workspace";

  try {
    const files = await service.listFiles(sandboxId, path);
    return c.json({ files });
  } catch (error) {
    console.error("[sandbox] List files failed:", error);
    const apiError: APIError = {
      error: {
        code: "FILE_OPERATION_FAILED",
        message: error instanceof Error ? error.message : "Failed to list files",
      },
    };
    return c.json(apiError, 500);
  }
});

/**
 * GET /sandbox/:id/files/read
 * Read file content from sandbox
 */
sandbox.get("/:id/files/read", async (c) => {
  const service = c.get("daytonaService");
  const sandboxId = c.req.param("id");
  const path = c.req.query("path");

  if (!path) {
    const error: APIError = {
      error: {
        code: "VALIDATION_ERROR",
        message: "path query parameter is required",
      },
    };
    return c.json(error, 400);
  }

  try {
    const content = await service.readFile(sandboxId, path);
    return c.json({ content });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("not found")) {
      const apiError: APIError = {
        error: {
          code: "FILE_NOT_FOUND",
          message: `File not found: ${path}`,
        },
      };
      return c.json(apiError, 404);
    }

    console.error("[sandbox] Read file failed:", error);
    const apiError: APIError = {
      error: {
        code: "FILE_OPERATION_FAILED",
        message: error instanceof Error ? error.message : "Failed to read file",
      },
    };
    return c.json(apiError, 500);
  }
});

/**
 * GET /sandbox/:id/preview-url
 * Get preview URL for a sandbox port
 */
sandbox.get("/:id/preview-url", async (c) => {
  const service = c.get("daytonaService");
  const sandboxId = c.req.param("id");
  const port = parseInt(c.req.query("port") || "4096", 10);

  try {
    const url = await service.getPreviewUrl(sandboxId, port);
    return c.json({ url });
  } catch (error) {
    console.error("[sandbox] Get preview URL failed:", error);
    const apiError: APIError = {
      error: {
        code: "PREVIEW_URL_FAILED",
        message: error instanceof Error ? error.message : "Failed to get preview URL",
      },
    };
    return c.json(apiError, 500);
  }
});

/**
 * GET /sandbox/:id/logs
 * Get sandbox logs for debugging
 */
sandbox.get("/:id/logs", async (c) => {
  const service = c.get("daytonaService");
  const sandboxId = c.req.param("id");
  const tail = parseInt(c.req.query("tail") || "100", 10);

  try {
    const result = await service.getLogs(sandboxId, tail);
    return c.json(result);
  } catch (error) {
    console.error("[sandbox] Get logs failed:", error);
    const apiError: APIError = {
      error: {
        code: "LOGS_FETCH_FAILED",
        message: error instanceof Error ? error.message : "Failed to get logs",
      },
    };
    return c.json(apiError, 500);
  }
});

export { sandbox as sandboxRoutes };
