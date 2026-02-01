/**
 * Sandbox Service Types
 * Shared types for the Node.js sandbox service
 */

// ============================================================================
// Sandbox Types
// ============================================================================

export interface CreateSandboxRequest {
  anthropicApiKey: string;
  repo?: string;
  gitToken?: string;
  opencodeSessionId?: string;
  systemPrompt?: string;
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
