/**
 * Modal API Client
 * Communicates with the Modal sandbox service
 *
 * Modal FastAPI endpoints have separate URLs per function:
 * - https://{workspace}--{app}-api-create-sandbox.modal.run
 * - https://{workspace}--{app}-api-pause-sandbox.modal.run
 * - etc.
 */

import { logger } from "../utils/logger";
import { withRetry } from "../utils/retry";

export interface ModalCreateSandboxResponse {
  sandbox_id: string;
  tunnel_url: string;
  error?: string;
}

export interface ModalPauseSandboxResponse {
  snapshot_id?: string;
  error?: string;
}

export interface ModalResumeSandboxResponse {
  sandbox_id: string;
  tunnel_url: string;
  error?: string;
}

export interface ModalFileInfo {
  name: string;
  path: string;
  is_directory: boolean;
  size?: number;
}

export interface ModalListFilesResponse {
  files?: ModalFileInfo[];
  error?: string;
}

export interface ModalReadFileResponse {
  content?: string;
  error?: string;
}

export interface ModalLogsResponse {
  logs?: {
    opencode: string;
    processes: string;
    health_check: string;
    environment: string;
  };
  error?: string;
}

export interface ModalClientOptions {
  /** Base URL pattern like "https://workspace--agent-sandbox" */
  baseUrl: string;
  /** API secret for authentication */
  apiSecret: string;
  /** Environment suffix: "dev" or "prod" (default: from MODAL_ENVIRONMENT or "dev") */
  environment?: "dev" | "prod";
  /** Request timeout in ms (default: 60000) */
  timeoutMs?: number;
}

export class ModalClient {
  private baseUrl: string;
  private apiSecret: string;
  private environment: string;
  private timeoutMs: number;
  private log = logger.child({ service: "modal" });

  /**
   * @param options - Client configuration options
   */
  constructor(options: ModalClientOptions | string, apiSecret?: string) {
    // Support legacy constructor signature
    if (typeof options === "string") {
      this.baseUrl = options
        .replace(/\/$/, "")
        .replace(/-dev\.modal\.run$/, "")
        .replace(/-prod\.modal\.run$/, "")
        .replace(/-api-\w+-?\w*$/, "")
        .replace(/\.modal\.run$/, "");
      this.apiSecret = apiSecret || "";
      this.environment = "dev";
      this.timeoutMs = 60000;
    } else {
      this.baseUrl = options.baseUrl
        .replace(/\/$/, "")
        .replace(/-dev\.modal\.run$/, "")
        .replace(/-prod\.modal\.run$/, "")
        .replace(/-api-\w+-?\w*$/, "")
        .replace(/\.modal\.run$/, "");
      this.apiSecret = options.apiSecret;
      this.environment = options.environment || "dev";
      this.timeoutMs = options.timeoutMs || 60000;
    }
  }

  /**
   * Build the full URL for a Modal function endpoint
   */
  private getEndpointUrl(functionName: string): string {
    return `${this.baseUrl}-${functionName}-${this.environment}.modal.run`;
  }

  /**
   * Make a request to Modal API with retry logic
   */
  private async request<T>(
    functionName: string,
    options: RequestInit = {},
    retryable = true
  ): Promise<T> {
    const url = this.getEndpointUrl(functionName);
    const startTime = Date.now();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiSecret) {
      headers["Authorization"] = `Bearer ${this.apiSecret}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    const doRequest = async (): Promise<T> => {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            ...headers,
            ...options.headers,
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Modal API error (${response.status}): ${error}`);
        }

        return response.json() as Promise<T>;
      } finally {
        clearTimeout(timeoutId);
      }
    };

    try {
      const result = retryable
        ? await withRetry(doRequest, {
            maxAttempts: 3,
            initialDelayMs: 1000,
            maxDelayMs: 10000,
            context: `modal.${functionName}`,
            isRetryable: (error) => {
              const msg = error.message.toLowerCase();
              // Retry on transient errors, not on 4xx client errors
              return (
                msg.includes("timeout") ||
                msg.includes("network") ||
                msg.includes("502") ||
                msg.includes("503") ||
                msg.includes("504") ||
                msg.includes("abort")
              );
            },
          })
        : await doRequest();

      this.log.info("Modal request completed", {
        function: functionName,
        durationMs: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      this.log.error("Modal request failed", error, {
        function: functionName,
        durationMs: Date.now() - startTime,
      });
      throw error;
    }
  }

  /**
   * Create a new sandbox with OpenCode server
   */
  async createSandbox(
    anthropicApiKey: string,
    repo?: string,
    gitToken?: string
  ): Promise<ModalCreateSandboxResponse> {
    this.log.info("Creating sandbox", { repo: repo || "empty" });

    const result = await this.request<ModalCreateSandboxResponse>(
      "api-create-sandbox",
      {
        method: "POST",
        body: JSON.stringify({
          repo: repo || null,
          pat: gitToken || null,
          anthropic_api_key: anthropicApiKey,
        }),
      }
    );

    if (result.error) {
      throw new Error(`Sandbox creation failed: ${result.error}`);
    }

    this.log.info("Sandbox created", {
      sandboxId: result.sandbox_id,
      tunnelUrl: result.tunnel_url,
    });

    return result;
  }

  /**
   * Pause a sandbox and create a snapshot
   */
  async pauseSandbox(sandboxId: string): Promise<ModalPauseSandboxResponse> {
    this.log.info("Pausing sandbox", { sandboxId });

    const result = await this.request<ModalPauseSandboxResponse>(
      "api-pause-sandbox",
      {
        method: "POST",
        body: JSON.stringify({ sandbox_id: sandboxId }),
      }
    );

    if (result.error) {
      throw new Error(`Sandbox pause failed: ${result.error}`);
    }

    return result;
  }

  /**
   * Resume a sandbox from a snapshot
   */
  async resumeSandbox(
    snapshotId: string,
    anthropicApiKey: string
  ): Promise<ModalResumeSandboxResponse> {
    this.log.info("Resuming sandbox", { snapshotId });

    const result = await this.request<ModalResumeSandboxResponse>(
      "api-resume-sandbox",
      {
        method: "POST",
        body: JSON.stringify({
          snapshot_id: snapshotId,
          anthropic_api_key: anthropicApiKey,
        }),
      }
    );

    if (result.error) {
      throw new Error(`Sandbox resume failed: ${result.error}`);
    }

    return result;
  }

  /**
   * Terminate a sandbox without snapshot
   */
  async terminateSandbox(sandboxId: string): Promise<void> {
    this.log.info("Terminating sandbox", { sandboxId });

    // Don't retry termination - it's idempotent
    await this.request<{ success: boolean }>(
      "api-terminate-sandbox",
      {
        method: "POST",
        body: JSON.stringify({ sandbox_id: sandboxId }),
      },
      false // no retry
    );
  }

  /**
   * List files in sandbox directory
   */
  async listFiles(
    sandboxId: string,
    path: string = "/workspace"
  ): Promise<ModalListFilesResponse> {
    const result = await this.request<ModalListFilesResponse>(
      "api-list-files",
      {
        method: "POST",
        body: JSON.stringify({ sandbox_id: sandboxId, path }),
      }
    );

    if (result.error) {
      throw new Error(`List files failed: ${result.error}`);
    }

    return result;
  }

  /**
   * Read file content from sandbox
   */
  async readFile(sandboxId: string, path: string): Promise<ModalReadFileResponse> {
    const result = await this.request<ModalReadFileResponse>(
      "api-read-file",
      {
        method: "POST",
        body: JSON.stringify({ sandbox_id: sandboxId, path }),
      }
    );

    if (result.error) {
      throw new Error(`Read file failed: ${result.error}`);
    }

    return result;
  }

  /**
   * Get logs from a sandbox
   */
  async getLogs(sandboxId: string, tail: number = 100): Promise<ModalLogsResponse> {
    const result = await this.request<ModalLogsResponse>(
      "api-get-logs",
      {
        method: "POST",
        body: JSON.stringify({ sandbox_id: sandboxId, tail }),
      }
    );

    if (result.error) {
      throw new Error(`Get logs failed: ${result.error}`);
    }

    return result;
  }

  /**
   * Health check
   */
  async health(): Promise<boolean> {
    try {
      const result = await this.request<{ status: string }>("health", {}, false);
      return result.status === "ok";
    } catch {
      return false;
    }
  }
}
