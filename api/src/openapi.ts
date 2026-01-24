/**
 * OpenAPI Specification for Agent API
 */

export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Agent API",
    description: `REST API for building AI coding agent applications. Abstracts infrastructure complexity by providing simple endpoints for session management, message streaming, and file access.

## Authentication
All requests require an API key in the Authorization header:
\`\`\`
Authorization: Bearer aa_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
\`\`\`

API keys follow the format \`aa_{environment}_{32 alphanumeric characters}\` where environment is either \`live\` or \`test\`.

## Streaming
The \`/messages\` endpoint returns Server-Sent Events (SSE) for real-time streaming of agent responses, tool calls, and status updates.`,
    version: "0.1.0",
    license: { name: "MIT" },
  },
  servers: [
    { url: "https://api.agent-api.com", description: "Production" },
    { url: "http://localhost:8787", description: "Local Development" },
  ],
  security: [{ bearerAuth: [] }],
  tags: [
    { name: "Sessions", description: "Session lifecycle management" },
    { name: "Messages", description: "Send messages and stream responses" },
    { name: "Files", description: "Access workspace files" },
  ],
  paths: {
    "/v1/sessions": {
      post: {
        summary: "Create Session",
        description:
          "Creates a new session with an isolated sandbox environment. The sandbox includes a full development environment with the OpenCode agent. Optionally clone a Git repository into the workspace.",
        operationId: "createSession",
        tags: ["Sessions"],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateSessionRequest" },
              examples: {
                empty: { summary: "Empty workspace", value: {} },
                withRepo: {
                  summary: "Clone a repository",
                  value: { repo: "owner/repo", gitToken: "ghp_xxxxxxxxxxxx" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Session created successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateSessionResponse" },
                example: {
                  id: "e2e1091c-daa3-42de-ba3b-0d0a05e72fc1",
                  status: "starting",
                  createdAt: "2026-01-23T11:44:00.114Z",
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "429": { $ref: "#/components/responses/RateLimited" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/v1/sessions/{sessionId}/messages": {
      post: {
        summary: "Send Message",
        description:
          "Send a message to the session and stream the response via Server-Sent Events (SSE). The agent will process the message, potentially using tools to read/write files, run commands, and more. Events are streamed in real-time.\n\n**Note:** Only one message can be processed at a time per session. Sending a message while another is processing returns a 409 error.",
        operationId: "sendMessage",
        tags: ["Messages"],
        parameters: [{ $ref: "#/components/parameters/sessionId" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SendMessageRequest" },
              example: { content: "Create a file called hello.txt with Hello World" },
            },
          },
        },
        responses: {
          "200": {
            description: "SSE stream of events",
            content: {
              "text/event-stream": {
                schema: { $ref: "#/components/schemas/SSEEvent" },
              },
            },
          },
          "400": {
            description: "Invalid request body",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/APIError" } },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
          "409": {
            description: "Session is busy processing another message",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/APIError" },
                example: {
                  error: {
                    code: "SESSION_BUSY",
                    message: "Session is currently processing another message",
                  },
                },
              },
            },
          },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/v1/sessions/{sessionId}/files/{path}": {
      get: {
        summary: "Get File or List Directory",
        description:
          "Retrieve a file from the workspace or list directory contents.\n\n- If the path ends with `/` or is `/`, returns a directory listing\n- Otherwise, returns the file content",
        operationId: "getFile",
        tags: ["Files"],
        parameters: [
          { $ref: "#/components/parameters/sessionId" },
          {
            name: "path",
            in: "path",
            required: true,
            description: "File or directory path relative to `/workspace`. Use `/` to list the root directory.",
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "File content or directory listing",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ListFilesResponse" },
              },
              "text/plain": {
                schema: { type: "string" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/v1/sessions/{sessionId}": {
      delete: {
        summary: "Delete Session",
        description:
          "Terminate the session and cleanup all resources including the sandbox. This action is irreversible.",
        operationId: "deleteSession",
        tags: ["Sessions"],
        parameters: [{ $ref: "#/components/parameters/sessionId" }],
        responses: {
          "200": {
            description: "Session terminated",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { status: { type: "string", enum: ["terminated"] } },
                },
                example: { status: "terminated" },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "403": { $ref: "#/components/responses/Forbidden" },
          "404": { $ref: "#/components/responses/NotFound" },
          "500": { $ref: "#/components/responses/InternalError" },
        },
      },
    },
    "/health": {
      get: {
        summary: "Health Check",
        description: "Check if the API is healthy",
        operationId: "healthCheck",
        security: [],
        responses: {
          "200": {
            description: "API is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", enum: ["ok"] },
                    version: { type: "string" },
                    timestamp: { type: "string", format: "date-time" },
                  },
                },
                example: {
                  status: "ok",
                  version: "0.1.0",
                  timestamp: "2026-01-23T11:44:00.000Z",
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        description: "API key in format `aa_live_xxx` or `aa_test_xxx`",
      },
    },
    parameters: {
      sessionId: {
        name: "sessionId",
        in: "path",
        required: true,
        description: "Session ID (UUID)",
        schema: { type: "string", format: "uuid" },
        example: "e2e1091c-daa3-42de-ba3b-0d0a05e72fc1",
      },
    },
    schemas: {
      CreateSessionRequest: {
        type: "object",
        properties: {
          repo: {
            type: "string",
            description: 'Git repository to clone (e.g., "owner/repo" or full URL)',
            example: "owner/repo",
          },
          gitToken: {
            type: "string",
            description: "Personal access token for private repositories",
            example: "ghp_xxxxxxxxxxxx",
          },
        },
      },
      CreateSessionResponse: {
        type: "object",
        required: ["id", "status", "createdAt"],
        properties: {
          id: { type: "string", format: "uuid", description: "Unique session identifier" },
          status: { $ref: "#/components/schemas/SessionStatus" },
          createdAt: { type: "string", format: "date-time", description: "ISO 8601 timestamp" },
        },
      },
      SendMessageRequest: {
        type: "object",
        required: ["content"],
        properties: {
          content: {
            type: "string",
            description: "The message content to send to the agent",
            minLength: 1,
            example: "Create a file called hello.txt with Hello World",
          },
        },
      },
      SessionStatus: {
        type: "string",
        enum: ["idle", "starting", "running", "paused", "error"],
        description:
          "- `idle`: Session is ready to receive messages\n- `starting`: Sandbox is being created\n- `running`: Currently processing a message\n- `paused`: Session is paused (snapshot saved)\n- `error`: Session encountered an error",
      },
      SSEEvent: {
        type: "object",
        required: ["type", "data", "timestamp"],
        properties: {
          type: { $ref: "#/components/schemas/SSEEventType" },
          data: { type: "object", description: "Event-specific data" },
          timestamp: { type: "string", format: "date-time" },
        },
      },
      SSEEventType: {
        type: "string",
        enum: [
          "session.starting",
          "session.running",
          "session.paused",
          "session.idle",
          "message.user",
          "message.assistant",
          "message.tool",
          "message.complete",
          "error",
        ],
        description:
          "**Session Events:**\n- `session.starting` - Sandbox is initializing\n- `session.running` - Processing message\n- `session.idle` - Ready for next message\n- `session.paused` - Session paused\n\n**Message Events:**\n- `message.user` - User message received\n- `message.assistant` - Assistant response (may be partial)\n- `message.tool` - Tool call or result\n- `message.complete` - Message finished\n\n**Error Events:**\n- `error` - An error occurred",
      },
      FileInfo: {
        type: "object",
        required: ["name", "path", "isDirectory"],
        properties: {
          name: { type: "string", description: "File or directory name" },
          path: { type: "string", description: "Full path in workspace" },
          isDirectory: { type: "boolean", description: "True if this is a directory" },
          size: { type: "integer", description: "File size in bytes (only for files)" },
        },
      },
      ListFilesResponse: {
        type: "object",
        required: ["files"],
        properties: {
          files: { type: "array", items: { $ref: "#/components/schemas/FileInfo" } },
        },
      },
      APIError: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "object",
            required: ["code", "message"],
            properties: {
              code: { $ref: "#/components/schemas/ErrorCode" },
              message: { type: "string", description: "Human-readable error message" },
              details: { type: "object", description: "Additional error details" },
            },
          },
        },
      },
      ErrorCode: {
        type: "string",
        enum: [
          "INVALID_API_KEY",
          "SESSION_NOT_OWNED",
          "SESSION_NOT_FOUND",
          "FILE_NOT_FOUND",
          "SESSION_BUSY",
          "RATE_LIMIT_EXCEEDED",
          "SANDBOX_CREATE_FAILED",
          "SANDBOX_TIMEOUT",
          "INTERNAL_ERROR",
        ],
        description:
          "- `INVALID_API_KEY` - API key is missing or invalid\n- `SESSION_NOT_OWNED` - Session belongs to a different API key\n- `SESSION_NOT_FOUND` - Session does not exist\n- `FILE_NOT_FOUND` - File not found in workspace\n- `SESSION_BUSY` - Session is processing another message\n- `RATE_LIMIT_EXCEEDED` - Too many requests\n- `SANDBOX_CREATE_FAILED` - Failed to create sandbox\n- `SANDBOX_TIMEOUT` - Sandbox operation timed out\n- `INTERNAL_ERROR` - Internal server error",
      },
    },
    responses: {
      Unauthorized: {
        description: "Invalid or missing API key",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/APIError" },
            example: { error: { code: "INVALID_API_KEY", message: "Invalid or missing API key" } },
          },
        },
      },
      Forbidden: {
        description: "Session belongs to a different API key",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/APIError" },
            example: {
              error: { code: "SESSION_NOT_OWNED", message: "Session belongs to a different API key" },
            },
          },
        },
      },
      NotFound: {
        description: "Resource not found",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/APIError" },
            example: { error: { code: "SESSION_NOT_FOUND", message: "Session not found" } },
          },
        },
      },
      RateLimited: {
        description: "Too many requests",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/APIError" },
            example: {
              error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many requests, please slow down" },
            },
          },
        },
      },
      InternalError: {
        description: "Internal server error",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/APIError" },
            example: { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
          },
        },
      },
    },
  },
};
