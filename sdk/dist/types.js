/**
 * Agent API SDK Types
 * @packageDocumentation
 */
// ============================================================================
// Error Types
// ============================================================================
/**
 * Error thrown by the Agent API SDK
 *
 * @example
 * ```typescript
 * try {
 *   await session.sendMessage("...");
 * } catch (error) {
 *   if (error instanceof AgentAPIError) {
 *     console.error(`Error ${error.code}: ${error.message}`);
 *     console.error(`HTTP Status: ${error.status}`);
 *   }
 * }
 * ```
 */
export class AgentAPIError extends Error {
    code;
    details;
    status;
    /**
     * Create a new AgentAPIError
     * @param code - Error code (e.g., "SESSION_NOT_FOUND")
     * @param message - Human-readable error message
     * @param details - Additional error details
     * @param status - HTTP status code
     */
    constructor(code, message, details, status) {
        super(message);
        this.code = code;
        this.details = details;
        this.status = status;
        this.name = "AgentAPIError";
    }
}
//# sourceMappingURL=types.js.map