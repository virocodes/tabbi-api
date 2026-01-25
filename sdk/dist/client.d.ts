/**
 * Tabbi SDK Client
 * @packageDocumentation
 */
import type { TabbiConfig, SessionInfo, CreateSessionOptions, SendMessageOptions, Message, FileInfo } from "./types";
/**
 * Main client for interacting with the Tabbi API.
 *
 * @example
 * ```typescript
 * import { Tabbi } from "@tabbi/sdk";
 *
 * const tabbi = new Tabbi({
 *   apiKey: "tb_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
 * });
 *
 * const session = await tabbi.createSession();
 * await session.sendMessage("Create a hello world app");
 * await session.delete();
 * ```
 */
export declare class Tabbi {
    private apiKey;
    private baseUrl;
    private timeout;
    /**
     * Create a new Tabbi client.
     *
     * @param config - Configuration options
     * @throws Error if API key is missing or invalid format
     *
     * @example
     * ```typescript
     * const tabbi = new Tabbi({
     *   apiKey: "tb_live_xxx",
     *   baseUrl: "https://api.tabbi.sh", // optional
     *   timeout: 30000 // optional, in milliseconds
     * });
     * ```
     */
    constructor(config: TabbiConfig);
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
    createSession(options?: CreateSessionOptions): Promise<Session>;
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
    getSession(id: string): Session;
    /**
     * Make an authenticated request to the API.
     * @internal
     */
    request<T>(path: string, options?: RequestInit, isStream?: boolean): Promise<T>;
    /**
     * Make a streaming request to the API.
     * @internal
     */
    streamRequest(path: string, options?: RequestInit): Promise<Response>;
}
/**
 * Represents an active session with an isolated sandbox environment.
 *
 * Sessions are created via {@link Tabbi.createSession} and provide methods
 * for sending messages, accessing files, and managing the session lifecycle.
 *
 * @example
 * ```typescript
 * const session = await tabbi.createSession();
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
export declare class Session {
    /** Unique session identifier (UUID) */
    readonly id: string;
    private _status;
    private _createdAt;
    private client;
    /**
     * @internal
     */
    constructor(client: Tabbi, info: SessionInfo);
    /**
     * Current session status.
     *
     * - `idle` - Ready to receive messages
     * - `starting` - Sandbox is being created
     * - `running` - Processing a message
     * - `paused` - Session is paused
     * - `error` - Session encountered an error
     */
    get status(): SessionInfo["status"];
    /**
     * ISO 8601 timestamp of when the session was created.
     */
    get createdAt(): string;
    /**
     * Send a message to the AI agent and stream the response.
     *
     * The agent will process the message and may use tools to read/write files,
     * run commands, search code, and more. Events are streamed in real-time.
     *
     * @param content - The message to send
     * @param options - Options including event callback and abort signal
     * @returns The final assistant message
     * @throws {@link TabbiError} with code `SESSION_BUSY` if already processing
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
    sendMessage(content: string, options?: SendMessageOptions): Promise<Message>;
    /**
     * Process SSE stream and return final message.
     * Uses async iteration for better Node.js streaming support.
     * @internal
     */
    private processStream;
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
     *   console.log(`${file.isDirectory ? "D" : "F"} ${file.name}`);
     * }
     * ```
     */
    listFiles(path?: string): Promise<FileInfo[]>;
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
    getFile(path: string): Promise<Blob>;
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
    getFileText(path: string): Promise<string>;
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
    delete(): Promise<void>;
    /**
     * Wait for the session to be ready.
     *
     * Call this after creating a session to ensure the sandbox is initialized
     * before sending messages. Uses exponential backoff for polling.
     *
     * @param timeoutMs - Maximum time to wait in milliseconds
     * @throws {@link TabbiError} with code `TIMEOUT` if timeout exceeded
     * @throws {@link TabbiError} with code `SESSION_ERROR` if session has an error
     *
     * @example
     * ```typescript
     * const session = await agent.createSession();
     * await session.waitForReady(60000); // Wait up to 60 seconds
     * await session.sendMessage("Hello!");
     * ```
     */
    waitForReady(timeoutMs?: number): Promise<void>;
    /**
     * Refresh the session status from the server.
     *
     * @example
     * ```typescript
     * await session.refresh();
     * console.log(session.status); // "idle" | "running" | etc.
     * ```
     */
    refresh(): Promise<void>;
}
//# sourceMappingURL=client.d.ts.map