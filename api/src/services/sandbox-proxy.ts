/**
 * Sandbox Proxy Client
 * Calls the Node.js sandbox service for Daytona and OpenCode operations
 */

import { logger } from "../utils/logger";
import type { McpServerConfig, AgentConfig } from "../types";

export interface CreateSandboxParams {
  anthropicApiKey: string;
  repo?: string;
  gitToken?: string;
  opencodeSessionId?: string;
  systemPrompt?: string;
  mcpServers?: Record<string, McpServerConfig>;
  agents?: Record<string, AgentConfig>;
  skills?: string[];
}

export interface CreateSandboxResponse {
  sandboxId: string;
  previewUrl: string;
  opencodeSessionId?: string;
}

export interface ResumeSandboxResponse {
  sandboxId: string;
  previewUrl: string;
  opencodeSessionId?: string;
}

export interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
}

export interface LogsResponse {
  logs: {
    opencode: string;
    processes: string;
    healthCheck: string;
    environment: string;
  };
}

export interface OpenCodeSession {
  id: string;
  title?: string;
}

export class SandboxProxyClient {
  private serviceUrl: string;
  private apiKey: string;
  private log = logger.child({ service: "sandbox-proxy" });

  constructor(serviceUrl: string, apiKey: string) {
    this.serviceUrl = serviceUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
  }

  /**
   * Make an authenticated request to the sandbox service
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.serviceUrl}${path}`;

    this.log.debug("Making sandbox service request", {
      method,
      url,
      bodyPreview: body ? JSON.stringify(body).slice(0, 100) : undefined,
    });

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();

    if (!response.ok) {
      this.log.error("Sandbox service error", {
        status: response.status,
        url,
        response: text.slice(0, 500),
      });
      throw new Error(`Sandbox service error (${response.status}): ${text}`);
    }

    if (!text) {
      return {} as T;
    }

    const parsed = JSON.parse(text) as T;
    this.log.debug("Sandbox service response", {
      url,
      responsePreview: JSON.stringify(parsed).slice(0, 200),
    });

    return parsed;
  }

  // ============================================================================
  // Sandbox Operations
  // ============================================================================

  /**
   * Create a new sandbox with OpenCode server
   */
  async createSandbox(params: CreateSandboxParams): Promise<CreateSandboxResponse> {
    return this.request<CreateSandboxResponse>("POST", "/sandbox", params);
  }

  /**
   * Pause a sandbox
   */
  async pauseSandbox(sandboxId: string): Promise<void> {
    await this.request("POST", `/sandbox/${sandboxId}/stop`);
  }

  /**
   * Resume a paused sandbox
   */
  async resumeSandbox(
    sandboxId: string,
    anthropicApiKey: string,
    opencodeSessionId?: string
  ): Promise<ResumeSandboxResponse> {
    return this.request<ResumeSandboxResponse>(
      "POST",
      `/sandbox/${sandboxId}/start`,
      {
        anthropicApiKey,
        opencodeSessionId,
      }
    );
  }

  /**
   * Terminate a sandbox
   */
  async terminateSandbox(sandboxId: string): Promise<void> {
    await this.request("DELETE", `/sandbox/${sandboxId}`);
  }

  /**
   * List files in sandbox directory
   */
  async listFiles(sandboxId: string, path: string = "/workspace"): Promise<FileInfo[]> {
    const result = await this.request<{ files: FileInfo[] }>(
      "GET",
      `/sandbox/${sandboxId}/files?path=${encodeURIComponent(path)}`
    );
    return result.files;
  }

  /**
   * Read file content from sandbox
   */
  async readFile(sandboxId: string, path: string): Promise<string> {
    const result = await this.request<{ content: string }>(
      "GET",
      `/sandbox/${sandboxId}/files/read?path=${encodeURIComponent(path)}`
    );
    return result.content;
  }

  /**
   * Get sandbox logs
   */
  async getLogs(sandboxId: string, tail: number = 100): Promise<LogsResponse> {
    return this.request<LogsResponse>(
      "GET",
      `/sandbox/${sandboxId}/logs?tail=${tail}`
    );
  }

  // ============================================================================
  // OpenCode Operations
  // ============================================================================

  /**
   * Check OpenCode server health
   */
  async opencodeHealth(sandboxUrl: string): Promise<boolean> {
    try {
      const result = await this.request<{ healthy: boolean }>(
        "GET",
        `/opencode/health?baseUrl=${encodeURIComponent(sandboxUrl)}`
      );
      return result.healthy;
    } catch {
      return false;
    }
  }

  /**
   * Get or create an OpenCode session
   */
  async getOrCreateSession(sandboxUrl: string): Promise<OpenCodeSession> {
    return this.request<OpenCodeSession>(
      "POST",
      "/opencode/sessions/get-or-create",
      { baseUrl: sandboxUrl }
    );
  }

  /**
   * Send a message and return raw streaming Response.
   * Workers will pipe this directly to client - no buffering.
   */
  async sendMessageStream(
    sandboxUrl: string,
    sessionId: string,
    content: string
  ): Promise<Response> {
    const url = `${this.serviceUrl}/opencode/sessions/${sessionId}/message`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ baseUrl: sandboxUrl, content }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Sandbox service error: ${response.status} - ${text}`);
    }

    // Return raw Response - body is a ReadableStream
    // Workers will forward this stream directly to client
    return response;
  }

  // ============================================================================
  // Health Check
  // ============================================================================

  /**
   * Health check - verify sandbox service is reachable
   */
  async health(): Promise<boolean> {
    try {
      const result = await this.request<{ healthy: boolean }>("GET", "/health");
      return result.healthy;
    } catch {
      return false;
    }
  }
}
