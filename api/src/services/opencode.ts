/**
 * OpenCode Client
 * Communicates with OpenCode server running in Modal sandbox
 */

export interface OpenCodeSession {
  id: string;
  title?: string;
}

export class OpenCodeClientWrapper {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  /**
   * Health check
   */
  async health(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/global/health`);
      if (!response.ok) return false;
      const data = (await response.json()) as { healthy?: boolean };
      return data.healthy ?? false;
    } catch {
      return false;
    }
  }

  /**
   * List existing sessions
   */
  async listSessions(): Promise<OpenCodeSession[]> {
    const response = await fetch(`${this.baseUrl}/session`);

    if (!response.ok) {
      throw new Error(`Failed to list sessions: ${response.status}`);
    }

    const result = (await response.json()) as
      | Array<{ id: string; title?: string }>
      | { data?: Array<{ id: string; title?: string }> };

    // Handle both formats: { data: [...] } or direct array
    const sessions = Array.isArray(result)
      ? result
      : ((result as { data?: Array<{ id: string; title?: string }> }).data ?? []);

    return sessions.map((s: { id: string; title?: string }) => ({
      id: s.id,
      title: s.title,
    }));
  }

  /**
   * Create a new session
   */
  async createSession(title?: string): Promise<OpenCodeSession> {
    const response = await fetch(`${this.baseUrl}/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: title || "api-session" }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to create session: ${response.status} - ${text}`);
    }

    const result = (await response.json()) as
      | { id: string; title?: string }
      | { data?: { id: string; title?: string } };

    // Handle both formats: { data: {...} } or direct object with id
    const session =
      "id" in result ? result : (result as { data?: { id: string; title?: string } }).data;

    if (!session || !session.id) {
      throw new Error("Failed to create session - no id in response");
    }

    return { id: session.id, title: session.title };
  }

  /**
   * Get or create a session
   */
  async getOrCreateSession(): Promise<OpenCodeSession> {
    const sessions = await this.listSessions();
    if (sessions.length > 0) {
      return sessions[0];
    }
    return this.createSession();
  }

  /**
   * Send a prompt to a session and stream the response
   * Uses POST /session/{id}/message endpoint
   *
   * IMPORTANT: Subscribe to events FIRST, then send the message.
   * OpenCode's /message endpoint blocks until processing completes.
   * If we POST first, we miss all the streaming events!
   */
  async sendMessage(
    sessionId: string,
    content: string
  ): Promise<ReadableStream<Uint8Array>> {
    const startTime = Date.now();

    // Subscribe to events FIRST - before sending the message
    // This ensures we catch all streaming events during processing
    console.log(`[opencode] sendMessage: connecting to event stream FIRST...`);
    const eventStreamStart = Date.now();
    const eventStream = await this.createEventStream();
    console.log(`[opencode] sendMessage: event stream connected in ${Date.now() - eventStreamStart}ms`);

    // NOW send the message - fire and forget, don't await the response
    // The response will come through the event stream
    console.log(`[opencode] sendMessage: starting POST to ${this.baseUrl}/session/${sessionId}/message`);
    const url = `${this.baseUrl}/session/${sessionId}/message`;

    // Fire and forget - don't await, just send
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        parts: [{ type: "text", text: content }],
      }),
    })
      .then((response) => {
        console.log(`[opencode] sendMessage: POST completed in ${Date.now() - startTime}ms, status: ${response.status}`);
        if (!response.ok) {
          console.error(`[opencode] sendMessage: POST failed with status ${response.status}`);
        }
      })
      .catch((error) => {
        console.error(`[opencode] sendMessage: POST error:`, error);
      });

    return eventStream;
  }

  /**
   * Create event stream from OpenCode SSE endpoint
   * Uses simpler ReadableStream with pull-based reading for proper streaming
   */
  private async createEventStream(): Promise<ReadableStream<Uint8Array>> {
    const url = `${this.baseUrl}/event`;
    console.log(`[opencode] createEventStream: fetching ${url}`);
    const fetchStart = Date.now();
    const response = await fetch(url);
    console.log(`[opencode] createEventStream: fetch completed in ${Date.now() - fetchStart}ms, status: ${response.status}`);

    if (!response.ok || !response.body) {
      throw new Error(`Failed to connect to event stream: ${response.status}`);
    }

    const sourceBody = response.body;
    const encoder = new TextEncoder();
    let buffer = "";
    let receivedServerConnected = false;
    let firstChunkReceived = false;
    const streamStartTime = Date.now();

    // Use ReadableStream with start() for simpler, non-blocking streaming
    return new ReadableStream({
      async start(controller) {
        const reader = sourceBody.getReader();
        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            if (!firstChunkReceived) {
              firstChunkReceived = true;
              console.log(`[opencode] createEventStream: first chunk received after ${Date.now() - streamStartTime}ms`);
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;

              try {
                const data = JSON.parse(line.slice(6));

                // Track server.connected
                if (data.type === "server.connected") {
                  receivedServerConnected = true;
                }

                const transformed = transformOpenCodeEvent(data);
                if (transformed) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify(transformed)}\n\n`)
                  );
                }

                // Check for session.idle to close (use close() not terminate())
                if (receivedServerConnected) {
                  const isSessionIdle =
                    data.type === "session.idle" ||
                    (data.type === "session.status" &&
                      data.properties?.status?.type === "idle");

                  if (isSessionIdle) {
                    controller.close();
                    reader.cancel();
                    return;
                  }
                }
              } catch {
                // Skip invalid JSON
              }
            }
          }

          // Process any remaining buffer
          if (buffer.trim() && buffer.startsWith("data: ")) {
            try {
              const data = JSON.parse(buffer.slice(6));
              const transformed = transformOpenCodeEvent(data);
              if (transformed) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(transformed)}\n\n`)
                );
              }
            } catch {
              // Ignore
            }
          }

          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });
  }
}

// Re-export as OpenCodeClient for backwards compatibility
export { OpenCodeClientWrapper as OpenCodeClient };

/**
 * Transform OpenCode events to our SSE event format
 *
 * Raw OpenCode events have structure:
 * { type: "message.part.updated", properties: { part: {...}, delta: "..." } }
 */
function transformOpenCodeEvent(
  event: Record<string, unknown>
): { type: string; data: Record<string, unknown>; timestamp: string } | null {
  const timestamp = new Date().toISOString();
  const eventType = event.type as string;

  // Skip heartbeat events
  if (eventType === "server.heartbeat") {
    return null;
  }

  // Handle message.part.updated events (the main event type from OpenCode)
  if (eventType === "message.part.updated") {
    const properties = event.properties as Record<string, unknown> | undefined;
    const part = properties?.part as Record<string, unknown> | undefined;
    const delta = properties?.delta as string | undefined;

    if (!part) return null;

    const partType = part.type as string;

    // Text content
    if (partType === "text") {
      const time = part.time as Record<string, unknown> | undefined;

      // Only emit for assistant streaming (has delta) or completed messages (has time.start)
      // User message parts don't have delta or time.start
      if (!delta && !time?.start) return null;

      const content = delta || (part.text as string) || "";
      const isComplete = !!time?.end;

      // Only emit if there's actual content
      if (!content) return null;

      return {
        type: "message.assistant",
        data: {
          content,
          isPartial: !isComplete,
        },
        timestamp,
      };
    }

    // Tool calls
    if (partType === "tool") {
      const state = part.state as Record<string, unknown> | undefined;
      const status = state?.status as string;
      const toolName = part.tool as string || "unknown";
      const toolId = part.callID as string || part.id as string || "";

      if (status === "pending" || status === "running") {
        return {
          type: "message.tool",
          data: {
            toolName,
            toolId,
            status: "calling",
            input: state?.input,
          },
          timestamp,
        };
      }

      if (status === "completed") {
        return {
          type: "message.tool",
          data: {
            toolName,
            toolId,
            status: "result",
            result: state?.output || state?.title || "Done",
          },
          timestamp,
        };
      }
    }

    // Skip other part types (step-start, step-finish, etc.)
    return null;
  }

  switch (eventType) {
    case "session.status": {
      const properties = event.properties as Record<string, unknown> | undefined;
      const status = properties?.status as Record<string, unknown> | undefined;
      const statusType = status?.type as string;

      if (statusType === "idle") {
        return {
          type: "session.idle",
          data: { sessionId: properties?.sessionID },
          timestamp,
        };
      }
      // Skip busy status updates
      return null;
    }

    case "session.idle":
      return {
        type: "session.idle",
        data: {},
        timestamp,
      };

    case "error":
      return {
        type: "error",
        data: {
          code: "OPENCODE_ERROR",
          message: (event.message || event.error || "Unknown error") as string,
        },
        timestamp,
      };

    case "server.connected":
      return {
        type: "server.connected",
        data: {},
        timestamp,
      };

    // Skip these verbose events
    case "message.updated":
    case "session.updated":
    case "session.diff":
    case "file.edited":
      return null;

    default:
      return null;
  }
}
