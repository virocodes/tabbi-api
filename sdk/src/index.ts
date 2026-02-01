/**
 * Tabbi SDK
 *
 * TypeScript SDK for building applications with Tabbi.
 *
 * @example
 * ```typescript
 * import { Tabbi } from "tabbi-sdk";
 *
 * const tabbi = new Tabbi({ apiKey: "tb_live_xxx" });
 *
 * const session = await tabbi.createSession({
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
export { Tabbi, Session } from "./client";

// Export types
export type {
  TabbiConfig,
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
export { TabbiError } from "./types";
