/**
 * Agent API SDK
 *
 * TypeScript SDK for building applications with the Agent API.
 *
 * @example
 * ```typescript
 * import { AgentAPI } from "@agent-api/sdk";
 *
 * const agent = new AgentAPI({ apiKey: "aa_live_xxx" });
 *
 * const session = await agent.createSession({
 *   repo: "owner/repo",
 *   gitToken: "ghp_xxx"
 * });
 *
 * await session.sendMessage("Fix the auth bug", {
 *   onEvent: (e) => {
 *     if (e.type === "message.assistant") {
 *       console.log(e.data.content);
 *     }
 *   }
 * });
 *
 * const files = await session.listFiles();
 * await session.delete();
 * ```
 */

// Export main classes
export { AgentAPI, Session } from "./client";

// Export types
export type {
  AgentAPIConfig,
  SessionInfo,
  SessionStatus,
  CreateSessionOptions,
  SendMessageOptions,
  Message,
  ToolCall,
  SSEEvent,
  SSEEventType,
  SSEEventData,
  SessionStartingData,
  SessionRunningData,
  SessionIdleData,
  MessageUserData,
  MessageAssistantData,
  MessageToolData,
  MessageCompleteData,
  ErrorData,
  FileInfo,
  ListFilesResponse,
} from "./types";

// Export error class
export { AgentAPIError } from "./types";
