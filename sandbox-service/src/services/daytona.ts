/**
 * Daytona Sandbox Service
 * Wraps the official Daytona SDK for sandbox operations
 */

import { Daytona, type Sandbox } from "@daytonaio/sdk";
import type {
  CreateSandboxResponse,
  ResumeSandboxResponse,
  ExecuteCommandResponse,
  FileInfo,
  LogsResponse,
} from "../types";

export interface DaytonaServiceConfig {
  apiKey: string;
  apiUrl: string;
  snapshotId: string;
}

export class DaytonaSandboxService {
  private daytona: Daytona;
  private snapshotId: string;
  private sandboxCache: Map<string, Sandbox> = new Map();

  constructor(config: DaytonaServiceConfig) {
    this.daytona = new Daytona({
      apiKey: config.apiKey,
      apiUrl: config.apiUrl,
    });
    this.snapshotId = config.snapshotId;
  }

  /**
   * Get a sandbox instance by ID (cached)
   */
  private async getSandbox(sandboxId: string): Promise<Sandbox> {
    const cached = this.sandboxCache.get(sandboxId);
    if (cached) {
      return cached;
    }

    const sandbox = await this.daytona.get(sandboxId);
    this.sandboxCache.set(sandboxId, sandbox);
    return sandbox;
  }

  /**
   * Create a new sandbox with OpenCode server
   */
  async createSandbox(params: {
    anthropicApiKey: string;
    repo?: string;
    gitToken?: string;
    opencodeSessionId?: string;
  }): Promise<CreateSandboxResponse> {
    console.log("[daytona] Creating sandbox", { repo: params.repo || "empty" });

    const startTime = Date.now();

    // Build environment variables
    const envVars: Record<string, string> = {
      ANTHROPIC_API_KEY: params.anthropicApiKey,
    };
    if (params.gitToken) {
      envVars.GH_TOKEN = params.gitToken;
    }

    // Create sandbox from snapshot
    const sandbox = await this.daytona.create({
      snapshot: this.snapshotId,
      envVars,
      public: true,
      autoStopInterval: 30, // Stop after 30 minutes of inactivity
    });

    console.log("[daytona] Sandbox created", {
      sandboxId: sandbox.id,
      durationMs: Date.now() - startTime,
    });

    // Cache the sandbox instance
    this.sandboxCache.set(sandbox.id, sandbox);

    // Configure git credentials if token provided
    if (params.gitToken) {
      console.log("[daytona] Configuring git credentials");
      const credentialUrl = `https://x-access-token:${params.gitToken}@github.com`;
      await sandbox.process.executeCommand(
        `umask 077 && echo '${credentialUrl}' > /root/.git-credentials`
      );
      await sandbox.process.executeCommand(
        "git config --global credential.helper 'store --file=/root/.git-credentials'"
      );

      // Fetch GitHub user identity
      try {
        const userResult = await sandbox.process.executeCommand(
          `curl -s -H "Authorization: Bearer ${params.gitToken}" -H "Accept: application/vnd.github+json" https://api.github.com/user`
        );
        const userData = JSON.parse(userResult.result || "{}");
        const githubUsername = userData.login || "github-user";
        const githubEmail =
          userData.email || `${githubUsername}@users.noreply.github.com`;
        const githubName = userData.name || githubUsername;

        await sandbox.process.executeCommand(
          `git config --global user.email "${githubEmail}"`
        );
        await sandbox.process.executeCommand(
          `git config --global user.name "${githubName}"`
        );
        console.log("[daytona] Git configured for user", { user: githubName });
      } catch (e) {
        console.warn("[daytona] Could not fetch GitHub user info", e);
      }
    }

    // Clone repository if provided
    if (params.repo) {
      console.log("[daytona] Cloning repository", { repo: params.repo });
      const cloneResult = await sandbox.process.executeCommand(
        `git clone https://github.com/${params.repo}.git /workspace`,
        undefined, // cwd
        undefined, // env
        120 // timeout in seconds
      );

      if (cloneResult.exitCode !== 0) {
        await this.terminateSandbox(sandbox.id);
        throw new Error(`Failed to clone repository: ${cloneResult.result}`);
      }
    } else {
      // Create empty workspace
      await sandbox.process.executeCommand("mkdir -p /workspace");
    }

    // Create OpenCode configuration
    console.log("[daytona] Creating opencode.json configuration");
    const opencodeConfig = JSON.stringify({
      server: { port: 4096, hostname: "0.0.0.0" },
    });
    await sandbox.process.executeCommand(
      `echo '${opencodeConfig}' > /workspace/opencode.json`
    );

    // Start OpenCode server with optional session ID
    const sessionArg = params.opencodeSessionId
      ? `--session ${params.opencodeSessionId}`
      : "";
    console.log("[daytona] Starting OpenCode server", {
      sessionId: params.opencodeSessionId || "new",
    });

    await sandbox.process.executeCommand(
      `cd /workspace && nohup opencode ${sessionArg} serve --port 4096 --hostname 0.0.0.0 > /tmp/opencode.log 2>&1 < /dev/null & echo "started"`,
      undefined, // cwd
      undefined, // env
      10 // timeout
    );

    // Wait for server to start
    console.log("[daytona] Waiting for OpenCode server to start");
    const healthResult = await this.waitForOpenCode(sandbox);
    if (!healthResult.healthy) {
      await this.terminateSandbox(sandbox.id);
      throw new Error(
        `OpenCode server failed to start: ${healthResult.error}`
      );
    }

    // Get preview URL for port 4096
    const previewLink = await sandbox.getPreviewLink(4096);
    const previewUrl = previewLink.url;

    console.log("[daytona] Sandbox ready", {
      sandboxId: sandbox.id,
      previewUrl,
      durationMs: Date.now() - startTime,
    });

    return {
      sandboxId: sandbox.id,
      previewUrl,
      opencodeSessionId: params.opencodeSessionId,
    };
  }

  /**
   * Pause a sandbox (stops it but preserves filesystem)
   */
  async pauseSandbox(sandboxId: string): Promise<void> {
    console.log("[daytona] Pausing sandbox", { sandboxId });

    const sandbox = await this.getSandbox(sandboxId);
    await sandbox.stop();

    console.log("[daytona] Sandbox paused", { sandboxId });
  }

  /**
   * Resume a paused sandbox
   */
  async resumeSandbox(
    sandboxId: string,
    anthropicApiKey: string,
    opencodeSessionId?: string
  ): Promise<ResumeSandboxResponse> {
    console.log("[daytona] Resuming sandbox", { sandboxId, opencodeSessionId });

    const startTime = Date.now();
    const sandbox = await this.getSandbox(sandboxId);

    // Start the sandbox
    await sandbox.start();

    // Update API key in environment (by executing export command)
    await sandbox.process.executeCommand(
      `export ANTHROPIC_API_KEY="${anthropicApiKey}"`
    );

    // Restart OpenCode server with session ID to restore conversation
    const sessionArg = opencodeSessionId
      ? `--session ${opencodeSessionId}`
      : "";
    console.log("[daytona] Restarting OpenCode server", {
      sessionId: opencodeSessionId || "new",
    });

    await sandbox.process.executeCommand(
      `cd /workspace && nohup opencode ${sessionArg} serve --port 4096 --hostname 0.0.0.0 > /tmp/opencode.log 2>&1 < /dev/null & echo "started"`,
      undefined, // cwd
      undefined, // env
      10 // timeout
    );

    // Wait for server to start
    const healthResult = await this.waitForOpenCode(sandbox);
    if (!healthResult.healthy) {
      throw new Error(
        `OpenCode server failed to start: ${healthResult.error}`
      );
    }

    // Get preview URL
    const previewLink = await sandbox.getPreviewLink(4096);
    const previewUrl = previewLink.url;

    console.log("[daytona] Sandbox resumed", {
      sandboxId,
      previewUrl,
      durationMs: Date.now() - startTime,
    });

    return {
      sandboxId,
      previewUrl,
      opencodeSessionId,
    };
  }

  /**
   * Terminate a sandbox (deletes it permanently)
   */
  async terminateSandbox(sandboxId: string): Promise<void> {
    console.log("[daytona] Terminating sandbox", { sandboxId });

    try {
      const sandbox = await this.getSandbox(sandboxId);
      await sandbox.delete();
      this.sandboxCache.delete(sandboxId);
      console.log("[daytona] Sandbox terminated", { sandboxId });
    } catch (error) {
      console.error("[daytona] Failed to terminate sandbox", error);
      // Don't throw - termination is idempotent
    }
  }

  /**
   * Execute a command in a sandbox
   */
  async executeCommand(
    sandboxId: string,
    command: string,
    cwd?: string,
    timeout?: number
  ): Promise<ExecuteCommandResponse> {
    const sandbox = await this.getSandbox(sandboxId);

    const result = await sandbox.process.executeCommand(
      command,
      cwd,
      undefined, // env
      timeout || 300
    );

    return {
      exitCode: result.exitCode,
      result: result.result || "",
    };
  }

  /**
   * List files in sandbox directory
   */
  async listFiles(sandboxId: string, path: string = "/workspace"): Promise<FileInfo[]> {
    const sandbox = await this.getSandbox(sandboxId);

    // Use find command to list files with metadata
    const result = await sandbox.process.executeCommand(
      `find ${path} -maxdepth 1 -printf '%y|%s|%p\\n' 2>/dev/null | tail -n +2`
    );

    const files: FileInfo[] = [];
    const output = result.result || "";

    for (const line of output.trim().split("\n")) {
      if (!line || !line.includes("|")) continue;

      const parts = line.split("|", 3);
      if (parts.length >= 3) {
        const [fileType, size, filepath] = parts;
        const name = filepath.split("/").pop() || "";
        if (name) {
          files.push({
            name,
            path: filepath,
            isDirectory: fileType === "d",
            size: fileType !== "d" && size ? parseInt(size, 10) : undefined,
          });
        }
      }
    }

    return files;
  }

  /**
   * Read file content from sandbox
   */
  async readFile(sandboxId: string, path: string): Promise<string> {
    const sandbox = await this.getSandbox(sandboxId);

    // Check if file exists
    const checkResult = await sandbox.process.executeCommand(
      `test -f ${path} && echo "exists" || echo "not_found"`
    );

    if (checkResult.result?.trim() !== "exists") {
      throw new Error("File not found");
    }

    // Read file content
    const result = await sandbox.process.executeCommand(`cat ${path}`);
    return result.result || "";
  }

  /**
   * Get preview URL for a sandbox port
   */
  async getPreviewUrl(sandboxId: string, port: number): Promise<string> {
    const sandbox = await this.getSandbox(sandboxId);
    const previewLink = await sandbox.getPreviewLink(port);
    return previewLink.url;
  }

  /**
   * Get logs from a sandbox
   */
  async getLogs(sandboxId: string, tail: number = 100): Promise<LogsResponse> {
    const sandbox = await this.getSandbox(sandboxId);
    const logs: Record<string, string> = {};

    // Get OpenCode server logs
    const opencodeLog = await sandbox.process.executeCommand(
      `tail -n ${tail} /tmp/opencode.log 2>/dev/null || echo '[no logs]'`
    );
    logs.opencode = opencodeLog.result || "[no logs]";

    // Check if OpenCode process is running
    const psResult = await sandbox.process.executeCommand(
      "ps aux | grep -E 'opencode|node' | grep -v grep || echo '[no process]'"
    );
    logs.processes = psResult.result || "[no process]";

    // Check port 4096 status
    const portResult = await sandbox.process.executeCommand(
      "curl -s http://localhost:4096/global/health 2>/dev/null || echo 'NOT_RESPONDING'"
    );
    logs.healthCheck = portResult.result || "NOT_RESPONDING";

    // Get environment (without secrets)
    const envResult = await sandbox.process.executeCommand(
      "env | grep -v API_KEY | grep -v TOKEN | grep -v SECRET | sort"
    );
    logs.environment = envResult.result || "";

    return {
      logs: {
        opencode: logs.opencode,
        processes: logs.processes,
        healthCheck: logs.healthCheck,
        environment: logs.environment,
      },
    };
  }

  /**
   * Health check - verify we can connect to Daytona
   */
  async health(): Promise<boolean> {
    try {
      await this.daytona.list();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Wait for OpenCode server to be ready
   */
  private async waitForOpenCode(
    sandbox: Sandbox
  ): Promise<{ healthy: boolean; error?: string }> {
    const maxAttempts = 30;
    const delayMs = 2000;

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const result = await sandbox.process.executeCommand(
          "curl -s -o /dev/null -w '%{http_code}' http://localhost:4096/global/health"
        );

        const statusCode = result.result?.trim();
        if (statusCode === "200") {
          console.log("[daytona] OpenCode server ready", { attempt: i + 1 });
          return { healthy: true };
        }

        console.log("[daytona] Waiting for OpenCode", {
          attempt: i + 1,
          statusCode,
        });
      } catch (e) {
        console.log("[daytona] Health check error", { attempt: i + 1, error: e });
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    // Get logs and diagnostic info for debugging
    try {
      const logResult = await sandbox.process.executeCommand(
        "cat /tmp/opencode.log 2>&1 || echo '[log file not found]'"
      );

      const psResult = await sandbox.process.executeCommand(
        "ps aux | grep opencode | grep -v grep || echo '[no opencode process]'"
      );

      const portResult = await sandbox.process.executeCommand(
        "netstat -tlnp 2>/dev/null | grep 4096 || ss -tlnp | grep 4096 || echo '[nothing on port 4096]'"
      );

      return {
        healthy: false,
        error: `Timeout waiting for OpenCode. Logs: ${logResult.result?.slice(0, 300) || "empty"} | Process: ${psResult.result?.slice(0, 100) || "none"} | Port: ${portResult.result?.slice(0, 100) || "not listening"}`,
      };
    } catch {
      return {
        healthy: false,
        error: "Timeout waiting for OpenCode - could not retrieve diagnostics",
      };
    }
  }
}
