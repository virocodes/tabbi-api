/**
 * Agent API SDK Client
 * @packageDocumentation
 */
import { AgentAPIError } from "./types";
const DEFAULT_BASE_URL = "https://api.agent-api.com";
const DEFAULT_TIMEOUT = 30000;
/**
 * Main client for interacting with the Agent API.
 *
 * @example
 * ```typescript
 * import { AgentAPI } from "@agent-api/sdk";
 *
 * const agent = new AgentAPI({
 *   apiKey: "aa_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
 * });
 *
 * const session = await agent.createSession();
 * await session.sendMessage("Create a hello world app");
 * await session.delete();
 * ```
 */
export class AgentAPI {
    apiKey;
    baseUrl;
    timeout;
    /**
     * Create a new AgentAPI client.
     *
     * @param config - Configuration options
     * @throws Error if API key is missing or invalid format
     *
     * @example
     * ```typescript
     * const agent = new AgentAPI({
     *   apiKey: "aa_live_xxx",
     *   baseUrl: "https://api.agent-api.com", // optional
     *   timeout: 30000 // optional, in milliseconds
     * });
     * ```
     */
    constructor(config) {
        if (!config.apiKey) {
            throw new Error("API key is required");
        }
        if (!/^aa_(live|test)_[a-zA-Z0-9]{32}$/.test(config.apiKey)) {
            throw new Error("Invalid API key format. Expected: aa_live_xxx or aa_test_xxx");
        }
        this.apiKey = config.apiKey;
        this.baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "");
        this.timeout = config.timeout || DEFAULT_TIMEOUT;
    }
    /**
     * Create a new session with an isolated sandbox environment.
     *
     * The sandbox includes a full development environment with Node.js, Git,
     * and the OpenCode AI agent. Optionally clone a Git repository into the workspace.
     *
     * @param options - Session creation options
     * @returns A new Session instance
     *
     * @example
     * ```typescript
     * // Empty workspace
     * const session = await agent.createSession();
     *
     * // With a repository
     * const session = await agent.createSession({
     *   repo: "owner/repo",
     *   gitToken: "ghp_xxx" // for private repos
     * });
     * ```
     */
    async createSession(options = {}) {
        const response = await this.request("/v1/sessions", {
            method: "POST",
            body: JSON.stringify({
                repo: options.repo,
                gitToken: options.gitToken,
            }),
        });
        return new Session(this, response);
    }
    /**
     * Get an existing session by ID.
     *
     * Note: This does not verify the session exists on the server.
     * Use this when you have a session ID from a previous request.
     *
     * @param id - Session UUID
     * @returns A Session instance
     *
     * @example
     * ```typescript
     * const session = agent.getSession("e2e1091c-daa3-42de-ba3b-0d0a05e72fc1");
     * await session.sendMessage("Continue working on the feature");
     * ```
     */
    getSession(id) {
        return new Session(this, { id, status: "idle", createdAt: "" });
    }
    /**
     * Make an authenticated request to the API.
     * @internal
     */
    async request(path, options = {}, isStream = false) {
        const url = `${this.baseUrl}${path}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.apiKey}`,
                    ...options.headers,
                },
                signal: options.signal || controller.signal,
            });
            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                }
                catch {
                    throw new AgentAPIError("UNKNOWN_ERROR", `Request failed with status ${response.status}`, undefined, response.status);
                }
                throw new AgentAPIError(errorData.error.code, errorData.error.message, errorData.error.details, response.status);
            }
            if (isStream) {
                return response;
            }
            return response.json();
        }
        finally {
            clearTimeout(timeoutId);
        }
    }
    /**
     * Make a streaming request to the API.
     * @internal
     */
    async streamRequest(path, options = {}) {
        const url = `${this.baseUrl}${path}`;
        const response = await fetch(url, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.apiKey}`,
                ...options.headers,
            },
        });
        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            }
            catch {
                throw new AgentAPIError("UNKNOWN_ERROR", `Request failed with status ${response.status}`, undefined, response.status);
            }
            throw new AgentAPIError(errorData.error.code, errorData.error.message, errorData.error.details, response.status);
        }
        return response;
    }
}
/**
 * Represents an active session with an isolated sandbox environment.
 *
 * Sessions are created via {@link AgentAPI.createSession} and provide methods
 * for sending messages, accessing files, and managing the session lifecycle.
 *
 * @example
 * ```typescript
 * const session = await agent.createSession();
 *
 * // Wait for the sandbox to be ready
 * await session.waitForReady();
 *
 * // Send a message
 * await session.sendMessage("Create a REST API", {
 *   onEvent: (event) => console.log(event)
 * });
 *
 * // Access files
 * const files = await session.listFiles("/");
 * const content = await session.getFileText("/src/index.ts");
 *
 * // Cleanup
 * await session.delete();
 * ```
 */
export class Session {
    /** Unique session identifier (UUID) */
    id;
    _status;
    _createdAt;
    client;
    /**
     * @internal
     */
    constructor(client, info) {
        this.client = client;
        this.id = info.id;
        this._status = info.status;
        this._createdAt = info.createdAt;
    }
    /**
     * Current session status.
     *
     * - `idle` - Ready to receive messages
     * - `starting` - Sandbox is being created
     * - `running` - Processing a message
     * - `paused` - Session is paused
     * - `error` - Session encountered an error
     */
    get status() {
        return this._status;
    }
    /**
     * ISO 8601 timestamp of when the session was created.
     */
    get createdAt() {
        return this._createdAt;
    }
    /**
     * Send a message to the AI agent and stream the response.
     *
     * The agent will process the message and may use tools to read/write files,
     * run commands, search code, and more. Events are streamed in real-time.
     *
     * @param content - The message to send
     * @param options - Options including event callback and abort signal
     * @returns The final assistant message
     * @throws {@link AgentAPIError} with code `SESSION_BUSY` if already processing
     *
     * @example
     * ```typescript
     * const message = await session.sendMessage("Fix the auth bug", {
     *   onEvent: (event) => {
     *     switch (event.type) {
     *       case "message.assistant":
     *         process.stdout.write(event.data.content);
     *         break;
     *       case "message.tool":
     *         console.log(`Tool: ${event.data.toolName}`);
     *         break;
     *     }
     *   }
     * });
     *
     * console.log("Final response:", message.content);
     * ```
     */
    async sendMessage(content, options = {}) {
        const response = await this.client.streamRequest(`/v1/sessions/${this.id}/messages`, {
            method: "POST",
            body: JSON.stringify({ content }),
            signal: options.signal,
        });
        if (!response.body) {
            throw new AgentAPIError("STREAM_ERROR", "No response body");
        }
        return this.processStream(response.body, options.onEvent);
    }
    /**
     * Process SSE stream and return final message.
     * Uses async iteration for better Node.js streaming support.
     * @internal
     */
    async processStream(body, onEvent) {
        const decoder = new TextDecoder();
        let buffer = "";
        let assistantContent = "";
        let messageId = "";
        const processLine = (line) => {
            if (line.startsWith("data: ")) {
                try {
                    const event = JSON.parse(line.slice(6));
                    // Update internal status based on events
                    if (event.type === "session.running") {
                        this._status = "running";
                    }
                    else if (event.type === "session.idle") {
                        this._status = "idle";
                    }
                    else if (event.type === "session.paused") {
                        this._status = "paused";
                    }
                    // Accumulate assistant content
                    if (event.type === "message.assistant") {
                        const data = event.data;
                        if (!data.isPartial) {
                            assistantContent = data.content;
                        }
                    }
                    if (event.type === "message.complete") {
                        const data = event.data;
                        messageId = data.messageId;
                        assistantContent = data.content;
                    }
                    // Call event callback immediately
                    if (onEvent) {
                        onEvent(event);
                    }
                }
                catch {
                    // Skip invalid JSON
                }
            }
        };
        // Try async iteration first (better for Node.js streaming)
        try {
            // @ts-expect-error - ReadableStream may be async iterable in Node.js
            for await (const chunk of body) {
                const text = decoder.decode(chunk, { stream: true });
                buffer += text;
                // Process complete lines immediately
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";
                for (const line of lines) {
                    processLine(line);
                }
            }
        }
        catch {
            // Fallback to reader API if async iteration not supported
            const reader = body.getReader();
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done)
                        break;
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split("\n");
                    buffer = lines.pop() || "";
                    for (const line of lines) {
                        processLine(line);
                    }
                }
            }
            finally {
                reader.releaseLock();
            }
        }
        // Process any remaining buffer
        if (buffer.trim()) {
            processLine(buffer);
        }
        // Return the assembled message
        return {
            id: messageId || crypto.randomUUID(),
            role: "assistant",
            content: assistantContent,
            createdAt: new Date().toISOString(),
        };
    }
    /**
     * List files and directories in the workspace.
     *
     * @param path - Directory path relative to workspace root
     * @returns Array of file information
     *
     * @example
     * ```typescript
     * const files = await session.listFiles("/");
     * for (const file of files) {
     *   console.log(`${file.isDirectory ? "📁" : "📄"} ${file.name}`);
     * }
     * ```
     */
    async listFiles(path = "/") {
        const encodedPath = encodeURIComponent(path).replace(/%2F/g, "/");
        const response = await this.client.request(`/v1/sessions/${this.id}/files${encodedPath}`, { method: "GET" });
        return response.files;
    }
    /**
     * Get file content as a Blob.
     *
     * @param path - File path relative to workspace root
     * @returns File content as a Blob
     *
     * @example
     * ```typescript
     * const blob = await session.getFile("/image.png");
     * const url = URL.createObjectURL(blob);
     * ```
     */
    async getFile(path) {
        const encodedPath = encodeURIComponent(path).replace(/%2F/g, "/");
        const response = await this.client.streamRequest(`/v1/sessions/${this.id}/files${encodedPath}`, { method: "GET" });
        return response.blob();
    }
    /**
     * Get file content as text.
     *
     * @param path - File path relative to workspace root
     * @returns File content as a string
     *
     * @example
     * ```typescript
     * const content = await session.getFileText("/src/index.ts");
     * console.log(content);
     * ```
     */
    async getFileText(path) {
        const blob = await this.getFile(path);
        return blob.text();
    }
    /**
     * Delete the session and cleanup all resources.
     *
     * This terminates the sandbox and is irreversible.
     * Always call this when done to avoid resource leaks.
     *
     * @example
     * ```typescript
     * try {
     *   await session.sendMessage("...");
     * } finally {
     *   await session.delete();
     * }
     * ```
     */
    async delete() {
        await this.client.request(`/v1/sessions/${this.id}`, {
            method: "DELETE",
        });
        this._status = "idle"; // Session is terminated
    }
    /**
     * Wait for the session to be ready.
     *
     * Call this after creating a session to ensure the sandbox is initialized
     * before sending messages.
     *
     * @param timeoutMs - Maximum time to wait in milliseconds
     * @throws {@link AgentAPIError} with code `TIMEOUT` if timeout exceeded
     * @throws {@link AgentAPIError} with code `SESSION_ERROR` if session has an error
     *
     * @example
     * ```typescript
     * const session = await agent.createSession();
     * await session.waitForReady(60000); // Wait up to 60 seconds
     * await session.sendMessage("Hello!");
     * ```
     */
    async waitForReady(timeoutMs = 60000) {
        const startTime = Date.now();
        while (this._status === "starting") {
            if (Date.now() - startTime > timeoutMs) {
                throw new AgentAPIError("TIMEOUT", "Session did not become ready in time");
            }
            // Poll the server for current status
            await this.refresh();
            if (this._status === "starting") {
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }
        }
        if (this._status === "error") {
            throw new AgentAPIError("SESSION_ERROR", "Session encountered an error");
        }
    }
    /**
     * Refresh the session status from the server.
     *
     * @example
     * ```typescript
     * await session.refresh();
     * console.log(session.status); // "idle" | "running" | etc.
     * ```
     */
    async refresh() {
        const info = await this.client.request(`/v1/sessions/${this.id}`, { method: "GET" });
        this._status = info.status;
        this._createdAt = info.createdAt;
    }
}
//# sourceMappingURL=client.js.map