/**
 * Agent API Type Definitions
 * Single source of truth for all API types
 */

// ============================================================================
// Session Types
// ============================================================================

export type SessionStatus = "idle" | "starting" | "running" | "paused" | "error";

export interface SessionState {
  sessionId: string;
  status: SessionStatus;
  sandboxId: string | null;
  sandboxUrl: string | null;
  snapshotId: string | null;
  opencodeSessionId: string | null;
  isProcessing: boolean;
  repo: string | null;
  createdAt: string;
  lastActivityAt: string;
  // Ownership stored separately in SQL, not in state object
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
  createdAt: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: string;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface CreateSessionRequest {
  repo?: string;
  gitToken?: string;
}

export interface CreateSessionResponse {
  id: string;
  status: SessionStatus;
  createdAt: string;
}

export interface SendMessageRequest {
  content: string;
}

export interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
}

export interface ListFilesResponse {
  files: FileInfo[];
}

// ============================================================================
// SSE Event Types
// ============================================================================

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

export interface SSEEvent {
  type: SSEEventType;
  data: unknown;
  timestamp: string;
}

export interface SessionStartingEvent {
  type: "session.starting";
  data: { sessionId: string };
}

export interface SessionRunningEvent {
  type: "session.running";
  data: { sessionId: string };
}

export interface SessionIdleEvent {
  type: "session.idle";
  data: { sessionId: string };
}

export interface MessageAssistantEvent {
  type: "message.assistant";
  data: { content: string; isPartial: boolean };
}

export interface MessageToolEvent {
  type: "message.tool";
  data: { toolName: string; toolId: string; status: "calling" | "result"; result?: string };
}

export interface MessageCompleteEvent {
  type: "message.complete";
  data: { messageId: string; role: "assistant"; content: string };
}

export interface ErrorEvent {
  type: "error";
  data: { code: string; message: string; details?: Record<string, unknown> };
}

// ============================================================================
// Error Types
// ============================================================================

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_API_KEY"
  | "SESSION_NOT_OWNED"
  | "SESSION_NOT_FOUND"
  | "FILE_NOT_FOUND"
  | "SESSION_BUSY"
  | "RATE_LIMIT_EXCEEDED"
  | "SANDBOX_CREATE_FAILED"
  | "SANDBOX_TIMEOUT"
  | "STREAM_ERROR"
  | "INTERNAL_ERROR";

export interface APIError {
  error: {
    code: ErrorCode | string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// ============================================================================
// Auth Context
// ============================================================================

export interface AuthContext {
  apiKeyId: string;
  userId: string;
  environment: "live" | "test";
  requestId: string; // Added for request tracing
}

// ============================================================================
// Environment Bindings
// ============================================================================

export interface Env {
  // Durable Object bindings
  SESSION_AGENT: DurableObjectNamespace;

  // Environment variables
  MODAL_API_URL: string;
  MODAL_API_SECRET: string;
  MODAL_ENVIRONMENT?: "dev" | "prod"; // Added: configurable Modal environment
  DATABASE_URL: string;
  UPSTASH_REDIS_URL: string;
  UPSTASH_REDIS_TOKEN: string;
  ANTHROPIC_API_KEY: string;
}

// Extend Hono context
declare module "hono" {
  interface ContextVariableMap {
    auth: AuthContext;
    requestId: string;
  }
}
