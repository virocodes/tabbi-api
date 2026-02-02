/**
 * Sandbox Service Types
 * Shared types for the Node.js sandbox service
 */

// ============================================================================
// OpenCode Configuration Types
// ============================================================================

/**
 * MCP (Model Context Protocol) server configuration
 */
export interface McpServerConfig {
  /** Server type: local (spawned process) or remote (HTTP endpoint) */
  type: "local" | "remote";
  /** Command to execute for local servers (e.g., ["npx", "-y", "@modelcontextprotocol/server-github"]) */
  command?: string[];
  /** Environment variables for local servers */
  environment?: Record<string, string>;
  /** URL for remote MCP servers */
  url?: string;
  /** HTTP headers for remote servers (e.g., Authorization) */
  headers?: Record<string, string>;
  /** Connection timeout in milliseconds */
  timeout?: number;
  /** Whether the server is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Agent configuration for OpenCode
 */
export interface AgentConfig {
  /** Description of what the agent does */
  description: string;
  /** When this agent is available: primary (main only), subagent (sub only), all (both) */
  mode?: "primary" | "subagent" | "all";
  /** Model to use (e.g., "anthropic/claude-sonnet-4-5") */
  model?: string;
  /** System prompt for the agent */
  prompt?: string;
  /** Temperature for model responses (0-1) */
  temperature?: number;
  /** Tool permissions (e.g., { write: true, edit: false }) */
  tools?: Record<string, boolean>;
  /** Permission rules (e.g., { bash: { "git *": "allow" } }) */
  permission?: Record<string, Record<string, string>>;
}

// ============================================================================
// Sandbox Types
// ============================================================================

export interface CreateSandboxRequest {
  anthropicApiKey: string;
  repo?: string;
  gitToken?: string;
  opencodeSessionId?: string;
  systemPrompt?: string;
  /** MCP servers to configure in OpenCode */
  mcpServers?: Record<string, McpServerConfig>;
  /** Custom agents to configure in OpenCode */
  agents?: Record<string, AgentConfig>;
  /** Skills to install from skills.sh (e.g., ["vercel-labs/react-best-practices"]) */
  skills?: string[];
}

export interface CreateSandboxResponse {
  sandboxId: string;
  previewUrl: string;
  opencodeSessionId?: string;
}

export interface ResumeSandboxRequest {
  anthropicApiKey: string;
  opencodeSessionId?: string;
}

export interface ResumeSandboxResponse {
  sandboxId: string;
  previewUrl: string;
  opencodeSessionId?: string;
}

export interface ExecuteCommandRequest {
  command: string;
  cwd?: string;
  timeout?: number;
}

export interface ExecuteCommandResponse {
  exitCode: number;
  result: string;
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

export interface ReadFileResponse {
  content: string;
}

export interface GetPreviewUrlResponse {
  url: string;
}

export interface LogsResponse {
  logs: {
    opencode: string;
    processes: string;
    healthCheck: string;
    environment: string;
  };
}

// ============================================================================
// OpenCode Types
// ============================================================================

export interface OpenCodeSession {
  id: string;
  title?: string;
}

export interface SendMessageRequest {
  baseUrl: string;
  content: string;
}

export interface OpenCodeHealthResponse {
  healthy: boolean;
}

// ============================================================================
// API Error Types
// ============================================================================

export interface APIError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// ============================================================================
// Environment Configuration
// ============================================================================

export interface EnvConfig {
  port: number;
  internalApiKey: string;
  daytonaApiKey: string;
  daytonaApiUrl: string;
  daytonaSnapshotId: string;
}

export function loadEnvConfig(): EnvConfig {
  const port = parseInt(process.env.PORT || "3000", 10);
  const internalApiKey = process.env.INTERNAL_API_KEY;
  const daytonaApiKey = process.env.DAYTONA_API_KEY;
  const daytonaApiUrl = process.env.DAYTONA_API_URL || "https://app.daytona.io/api";
  const daytonaSnapshotId = process.env.DAYTONA_SNAPSHOT_ID;

  if (!internalApiKey) {
    throw new Error("INTERNAL_API_KEY environment variable is required");
  }
  if (!daytonaApiKey) {
    throw new Error("DAYTONA_API_KEY environment variable is required");
  }
  if (!daytonaSnapshotId) {
    throw new Error("DAYTONA_SNAPSHOT_ID environment variable is required");
  }

  return {
    port,
    internalApiKey,
    daytonaApiKey,
    daytonaApiUrl,
    daytonaSnapshotId,
  };
}
