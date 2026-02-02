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
  McpServerConfig,
  AgentConfig,
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
    systemPrompt?: string;
    mcpServers?: Record<string, McpServerConfig>;
    agents?: Record<string, AgentConfig>;
    skills?: string[];
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

    // Write system prompt to AGENTS.md if provided
    if (params.systemPrompt) {
      console.log("[daytona] Writing system prompt to AGENTS.md");
      // Escape single quotes for shell and write the file
      const escapedPrompt = params.systemPrompt.replace(/'/g, "'\\''");
      await sandbox.process.executeCommand(
        `cat > /workspace/AGENTS.md << 'AGENTS_EOF'\n${params.systemPrompt}\nAGENTS_EOF`
      );
    }

    // Start OpenCode server, wait for it, and create session - all in one command
    // This saves ~5 seconds by:
    // 1. Polling locally (1ms vs 200ms over network)
    // 2. Polling every 250ms (vs 2000ms)
    // 3. Creating session inline (saves ~3s round trips)
    const sessionArg = params.opencodeSessionId
      ? `--session ${params.opencodeSessionId}`
      : "";
    console.log("[daytona] Starting OpenCode server with inline session creation", {
      sessionId: params.opencodeSessionId || "new",
      hasMcpServers: !!params.mcpServers && Object.keys(params.mcpServers).length > 0,
      hasAgents: !!params.agents && Object.keys(params.agents).length > 0,
      skillsCount: params.skills?.length || 0,
    });

    // Build OpenCode configuration object
    const opencodeConfig: {
      server: { port: number; hostname: string };
      mcp?: Record<string, McpServerConfig>;
      agent?: Record<string, AgentConfig>;
    } = {
      server: { port: 4096, hostname: "0.0.0.0" },
    };

    // Add MCP servers if provided
    if (params.mcpServers && Object.keys(params.mcpServers).length > 0) {
      opencodeConfig.mcp = params.mcpServers;
    }

    // Add agents if provided
    if (params.agents && Object.keys(params.agents).length > 0) {
      opencodeConfig.agent = params.agents;
    }

    // Escape the config for shell (using a heredoc with a quoted delimiter prevents variable expansion)
    const configJson = JSON.stringify(opencodeConfig, null, 2);

    // Build skills installation commands
    let skillsInstallScript = "";
    if (params.skills && params.skills.length > 0) {
      console.log("[daytona] Will install skills", { skills: params.skills });
      // Install each skill from skills.sh with a 30s timeout per skill to prevent hangs
      skillsInstallScript = params.skills
        .map((skill) => `timeout 30 npx skills add ${skill} -a opencode -y 2>/dev/null || echo "Skill install skipped: ${skill}"`)
        .join("\n");
    }

    const startupScript = `
cd /workspace

# Create OpenCode configuration with MCP servers and agents
cat > opencode.json << 'CONFIG_EOF'
${configJson}
CONFIG_EOF

${skillsInstallScript ? `# Install skills from skills.sh
${skillsInstallScript}

` : ""}# Start OpenCode server in background
nohup opencode ${sessionArg} serve --port 4096 --hostname 0.0.0.0 > /tmp/opencode.log 2>&1 &

# Poll locally until ready (fast - localhost is ~1ms vs ~200ms over network)
# Use HTTP status code check (more reliable than parsing response body)
for i in $(seq 1 60); do
  STATUS=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:4096/global/health 2>/dev/null || echo "000")
  if [ "$STATUS" = "200" ]; then
    # Create session via localhost (saves ~3s of round trips through proxy)
    # Parse JSON with grep/sed (jq not available in sandbox)
    RESPONSE=$(curl -s -X POST http://localhost:4096/session \
      -H "Content-Type: application/json" \
      -d '{"title":"api-session"}')
    SESSION=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    if [ -n "$SESSION" ]; then
      echo "ready:$SESSION"
      exit 0
    fi
    # If session creation failed, still report ready but with no session
    echo "ready:NONE"
    exit 0
  fi
  sleep 0.25
done

# Timeout - get diagnostics
echo "timeout"
cat /tmp/opencode.log 2>&1 | tail -20
exit 1
`;

    const result = await sandbox.process.executeCommand(
      startupScript,
      undefined, // cwd
      undefined, // env
      30 // timeout in seconds
    );

    // Parse result
    const output = result.result || "";
    const match = output.match(/ready:(.+)/);

    if (!match) {
      // Get diagnostic info
      const logResult = await sandbox.process.executeCommand(
        "cat /tmp/opencode.log 2>&1 | tail -30 || echo '[no logs]'"
      );
      await this.terminateSandbox(sandbox.id);
      throw new Error(
        `OpenCode server failed to start. Output: ${output.slice(0, 200)}. Logs: ${logResult.result?.slice(0, 300) || "empty"}`
      );
    }

    const opencodeSessionId = match[1] === "NONE" ? undefined : match[1];

    // Get preview URL for port 4096
    const previewLink = await sandbox.getPreviewLink(4096);
    const previewUrl = previewLink.url;

    console.log("[daytona] Sandbox ready", {
      sandboxId: sandbox.id,
      previewUrl,
      opencodeSessionId,
      durationMs: Date.now() - startTime,
    });

    return {
      sandboxId: sandbox.id,
      previewUrl,
      opencodeSessionId,
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

    // Restart OpenCode server with session ID and poll locally until ready
    const sessionArg = opencodeSessionId
      ? `--session ${opencodeSessionId}`
      : "";
    console.log("[daytona] Restarting OpenCode server with local polling", {
      sessionId: opencodeSessionId || "new",
    });

    const startupScript = `
cd /workspace

# Start OpenCode server in background
nohup opencode ${sessionArg} serve --port 4096 --hostname 0.0.0.0 > /tmp/opencode.log 2>&1 &

# Poll locally until ready (fast - localhost is ~1ms vs ~200ms over network)
# Use HTTP status code check (more reliable than parsing response body)
for i in $(seq 1 60); do
  STATUS=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:4096/global/health 2>/dev/null || echo "000")
  if [ "$STATUS" = "200" ]; then
    echo "ready"
    exit 0
  fi
  sleep 0.25
done

# Timeout - get diagnostics
echo "timeout"
cat /tmp/opencode.log 2>&1 | tail -20
exit 1
`;

    const result = await sandbox.process.executeCommand(
      startupScript,
      undefined, // cwd
      undefined, // env
      30 // timeout in seconds
    );

    if (!result.result?.includes("ready")) {
      // Get diagnostic info
      const logResult = await sandbox.process.executeCommand(
        "cat /tmp/opencode.log 2>&1 | tail -30 || echo '[no logs]'"
      );
      throw new Error(
        `OpenCode server failed to start. Output: ${result.result?.slice(0, 200) || "empty"}. Logs: ${logResult.result?.slice(0, 300) || "empty"}`
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
   * Binary file extensions that should be read as base64
   */
  private static readonly BINARY_EXTENSIONS = new Set([
    // Images
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".ico", ".svg", ".tiff", ".tif",
    // Video
    ".mp4", ".webm", ".avi", ".mov", ".mkv", ".flv", ".wmv", ".m4v",
    // Audio
    ".mp3", ".wav", ".ogg", ".flac", ".aac", ".m4a", ".wma",
    // Archives
    ".zip", ".tar", ".gz", ".bz2", ".7z", ".rar", ".xz",
    // Documents
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    // Fonts
    ".ttf", ".otf", ".woff", ".woff2", ".eot",
    // Other binary
    ".exe", ".dll", ".so", ".dylib", ".bin", ".dat", ".db", ".sqlite",
    ".wasm", ".pyc", ".class", ".o", ".a",
  ]);

  /**
   * Check if a file path has a binary extension
   */
  private isBinaryFile(path: string): boolean {
    const ext = path.substring(path.lastIndexOf(".")).toLowerCase();
    return DaytonaSandboxService.BINARY_EXTENSIONS.has(ext);
  }

  /**
   * Read file content from sandbox
   * Returns content with encoding info (utf8 for text, base64 for binary)
   */
  async readFile(sandboxId: string, path: string): Promise<{ content: string; encoding: "utf8" | "base64" }> {
    const sandbox = await this.getSandbox(sandboxId);

    // Check if file exists
    const checkResult = await sandbox.process.executeCommand(
      `test -f ${path} && echo "exists" || echo "not_found"`
    );

    if (checkResult.result?.trim() !== "exists") {
      throw new Error("File not found");
    }

    // Read binary files as base64, text files as plain text
    if (this.isBinaryFile(path)) {
      const result = await sandbox.process.executeCommand(`base64 -w 0 ${path}`);
      return {
        content: result.result || "",
        encoding: "base64",
      };
    } else {
      const result = await sandbox.process.executeCommand(`cat ${path}`);
      return {
        content: result.result || "",
        encoding: "utf8",
      };
    }
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

}
