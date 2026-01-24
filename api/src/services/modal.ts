/**
 * Modal API Client
 * Communicates with the Modal sandbox service
 *
 * Modal FastAPI endpoints have separate URLs per function:
 * - https://{workspace}--{app}-api-create-sandbox.modal.run
 * - https://{workspace}--{app}-api-pause-sandbox.modal.run
 * - etc.
 */

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

export class ModalClient {
  private baseUrl: string;
  private apiSecret: string;

  /**
   * @param baseUrl - Base URL pattern like "https://workspace--agent-sandbox"
   *                  (without function name or -dev suffix)
   * @param apiSecret - Optional API secret for authentication
   */
  constructor(baseUrl: string, apiSecret: string) {
    // Remove trailing parts to get base pattern
    this.baseUrl = baseUrl
      .replace(/\/$/, "")
      .replace(/-dev\.modal\.run$/, "")
      .replace(/-api-\w+-?\w*$/, "")
      .replace(/\.modal\.run$/, "");
    this.apiSecret = apiSecret;
  }

  /**
   * Build the full URL for a Modal function endpoint
   */
  private getEndpointUrl(functionName: string): string {
    return `${this.baseUrl}-${functionName}-dev.modal.run`;
  }

  private async request<T>(
    functionName: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = this.getEndpointUrl(functionName);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiSecret) {
      headers["Authorization"] = `Bearer ${this.apiSecret}`;
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Modal API error (${response.status}): ${error}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Create a new sandbox with OpenCode server
   */
  async createSandbox(
    anthropicApiKey: string,
    repo?: string,
    gitToken?: string
  ): Promise<ModalCreateSandboxResponse> {
    const result = await this.request<ModalCreateSandboxResponse>("api-create-sandbox", {
      method: "POST",
      body: JSON.stringify({
        repo: repo || null,
        pat: gitToken || null,
        anthropic_api_key: anthropicApiKey,
      }),
    });

    if (result.error) {
      throw new Error(result.error);
    }

    return result;
  }

  /**
   * Pause a sandbox and create a snapshot
   */
  async pauseSandbox(sandboxId: string): Promise<ModalPauseSandboxResponse> {
    const result = await this.request<ModalPauseSandboxResponse>("api-pause-sandbox", {
      method: "POST",
      body: JSON.stringify({ sandbox_id: sandboxId }),
    });

    if (result.error) {
      throw new Error(result.error);
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
    const result = await this.request<ModalResumeSandboxResponse>("api-resume-sandbox", {
      method: "POST",
      body: JSON.stringify({
        snapshot_id: snapshotId,
        anthropic_api_key: anthropicApiKey,
      }),
    });

    if (result.error) {
      throw new Error(result.error);
    }

    return result;
  }

  /**
   * Terminate a sandbox without snapshot
   */
  async terminateSandbox(sandboxId: string): Promise<void> {
    await this.request<{ success: boolean }>("api-terminate-sandbox", {
      method: "POST",
      body: JSON.stringify({ sandbox_id: sandboxId }),
    });
  }

  /**
   * List files in sandbox directory
   */
  async listFiles(
    sandboxId: string,
    path: string = "/workspace"
  ): Promise<ModalListFilesResponse> {
    const result = await this.request<ModalListFilesResponse>("api-list-files", {
      method: "POST",
      body: JSON.stringify({ sandbox_id: sandboxId, path }),
    });

    if (result.error) {
      throw new Error(result.error);
    }

    return result;
  }

  /**
   * Read file content from sandbox
   */
  async readFile(sandboxId: string, path: string): Promise<ModalReadFileResponse> {
    const result = await this.request<ModalReadFileResponse>("api-read-file", {
      method: "POST",
      body: JSON.stringify({ sandbox_id: sandboxId, path }),
    });

    if (result.error) {
      throw new Error(result.error);
    }

    return result;
  }

  /**
   * Get logs from a sandbox
   */
  async getLogs(sandboxId: string, tail: number = 100): Promise<ModalLogsResponse> {
    const result = await this.request<ModalLogsResponse>("api-get-logs", {
      method: "POST",
      body: JSON.stringify({ sandbox_id: sandboxId, tail }),
    });

    if (result.error) {
      throw new Error(result.error);
    }

    return result;
  }

  /**
   * Health check
   */
  async health(): Promise<boolean> {
    try {
      const result = await this.request<{ status: string }>("health");
      return result.status === "ok";
    } catch {
      return false;
    }
  }
}
