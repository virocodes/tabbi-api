/**
 * Agent API SDK Types
 * @packageDocumentation
 */

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configuration options for the AgentAPI client
 */
export interface AgentAPIConfig {
  /**
   * API key for authentication.
   * Format: `aa_live_xxx` for production or `aa_test_xxx` for testing
   */
  apiKey: string;

  /**
   * Base URL for the API
   * @defaultValue `https://api.agent-api.com`
   */
  baseUrl?: string;

  /**
   * Request timeout in milliseconds
   * @defaultValue `30000`
   */
  timeout?: number;
}

// ============================================================================
// Session Types
// ============================================================================

/**
 * Possible states for a session
 *
 * - `idle` - Session is ready to receive messages
 * - `starting` - Sandbox is being created
 * - `running` - Currently processing a message
 * - `paused` - Session is paused (snapshot saved)
 * - `error` - Session encountered an error
 */
export type SessionStatus = "idle" | "starting" | "running" | "paused" | "error";

/**
 * Basic session information returned when creating or retrieving a session
 */
export interface SessionInfo {
  /** Unique session identifier (UUID) */
  id: string;
  /** Current session status */
  status: SessionStatus;
  /** ISO 8601 timestamp of when the session was created */
  createdAt: string;
}

/**
 * Options for creating a new session
 */
export interface CreateSessionOptions {
  /**
   * Git repository to clone into the workspace.
   * Can be in `owner/repo` format or a full URL.
   * @example "facebook/react"
   * @example "https://github.com/facebook/react.git"
   */
  repo?: string;

  /**
   * GitHub Personal Access Token for cloning private repositories.
   * Required if `repo` is a private repository.
   */
  gitToken?: string;
}

// ============================================================================
// Message Types
// ============================================================================

/**
 * A message in the conversation history
 */
export interface Message {
  /** Unique message identifier */
  id: string;
  /** Who sent the message */
  role: "user" | "assistant";
  /** Message content */
  content: string;
  /** Tool calls made during this message (assistant only) */
  toolCalls?: ToolCall[];
  /** ISO 8601 timestamp */
  createdAt: string;
}

/**
 * A tool call made by the assistant
 */
export interface ToolCall {
  /** Unique tool call identifier */
  id: string;
  /** Name of the tool (e.g., "write", "read", "bash") */
  name: string;
  /** Arguments passed to the tool */
  arguments: Record<string, unknown>;
  /** Result returned by the tool */
  result?: string;
}

/**
 * Options for sending a message
 */
export interface SendMessageOptions {
  /**
   * Callback function invoked for each SSE event.
   * Use this to stream responses in real-time.
   *
   * @example
   * ```typescript
   * await session.sendMessage("Hello", {
   *   onEvent: (event) => {
   *     if (event.type === "message.assistant") {
   *       console.log(event.data.content);
   *     }
   *   }
   * });
   * ```
   */
  onEvent?: (event: SSEEvent) => void;

  /**
   * AbortSignal for cancelling the request.
   *
   * @example
   * ```typescript
   * const controller = new AbortController();
   * setTimeout(() => controller.abort(), 30000);
   *
   * await session.sendMessage("...", {
   *   signal: controller.signal
   * });
   * ```
   */
  signal?: AbortSignal;
}

// ============================================================================
// SSE Event Types
// ============================================================================

/**
 * All possible SSE event types
 *
 * **Session Events:**
 * - `session.starting` - Sandbox is initializing
 * - `session.running` - Processing message
 * - `session.idle` - Ready for next message
 * - `session.paused` - Session paused
 *
 * **Message Events:**
 * - `message.user` - User message received
 * - `message.assistant` - Assistant response (may be partial)
 * - `message.tool` - Tool call or result
 * - `message.complete` - Message finished
 *
 * **Error Events:**
 * - `error` - An error occurred
 */
export type SSEEventType =
  | "session.starting"
  | "session.running"
  | "session.paused"
  | "session.idle"
  | "message.user"
  | "message.assistant"
  | "message.tool"
  | "message.complete"
  | "error";

/**
 * A Server-Sent Event from the message stream
 */
export interface SSEEvent {
  /** Event type */
  type: SSEEventType;
  /** Event-specific data */
  data: SSEEventData;
  /** ISO 8601 timestamp */
  timestamp: string;
}

/**
 * Union of all possible event data types
 */
export type SSEEventData =
  | SessionStartingData
  | SessionRunningData
  | SessionIdleData
  | MessageUserData
  | MessageAssistantData
  | MessageToolData
  | MessageCompleteData
  | ErrorData;

/** Data for `session.starting` event */
export interface SessionStartingData {
  sessionId: string;
}

/** Data for `session.running` event */
export interface SessionRunningData {
  sessionId: string;
}

/** Data for `session.idle` event */
export interface SessionIdleData {
  sessionId: string;
}

/** Data for `message.user` event */
export interface MessageUserData {
  content: string;
}

/**
 * Data for `message.assistant` event
 */
export interface MessageAssistantData {
  /** The assistant's response content */
  content: string;
  /**
   * Whether this is a partial (streaming) response.
   * When `false`, this is the final content.
   */
  isPartial: boolean;
}

/**
 * Data for `message.tool` event
 */
export interface MessageToolData {
  /** Name of the tool being called */
  toolName: string;
  /** Unique identifier for this tool call */
  toolId: string;
  /** Current status of the tool call */
  status: "calling" | "result";
  /** Result returned by the tool (when status is "result") */
  result?: string;
}

/** Data for `message.complete` event */
export interface MessageCompleteData {
  messageId: string;
  role: "assistant";
  content: string;
}

/** Data for `error` event */
export interface ErrorData {
  /** Error code */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Additional error details */
  details?: Record<string, unknown>;
}

// ============================================================================
// File Types
// ============================================================================

/**
 * Information about a file or directory in the workspace
 */
export interface FileInfo {
  /** File or directory name */
  name: string;
  /** Full path in the workspace */
  path: string;
  /** Whether this is a directory */
  isDirectory: boolean;
  /** File size in bytes (only for files, not directories) */
  size?: number;
}

/**
 * Response from listing files
 */
export interface ListFilesResponse {
  files: FileInfo[];
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error thrown by the Agent API SDK
 *
 * @example
 * ```typescript
 * try {
 *   await session.sendMessage("...");
 * } catch (error) {
 *   if (error instanceof AgentAPIError) {
 *     console.error(`Error ${error.code}: ${error.message}`);
 *     console.error(`HTTP Status: ${error.status}`);
 *   }
 * }
 * ```
 */
export class AgentAPIError extends Error {
  /**
   * Create a new AgentAPIError
   * @param code - Error code (e.g., "SESSION_NOT_FOUND")
   * @param message - Human-readable error message
   * @param details - Additional error details
   * @param status - HTTP status code
   */
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
    public status?: number
  ) {
    super(message);
    this.name = "AgentAPIError";
  }
}

/**
 * Error response from the API
 * @internal
 */
export interface APIErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
