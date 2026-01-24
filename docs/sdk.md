# Agent API SDK

TypeScript SDK for building AI coding agent applications.

## Installation

```bash
npm install @agent-api/sdk
```

## Quick Start

```typescript
import { AgentAPI } from "@agent-api/sdk";

// Initialize the client
const agent = new AgentAPI({
  apiKey: "aa_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
});

// Create a session
const session = await agent.createSession();

// Send a message and stream the response
const message = await session.sendMessage("Create a hello world app", {
  onEvent: (event) => {
    if (event.type === "message.assistant") {
      process.stdout.write(event.data.content);
    }
  }
});

// Access files in the workspace
const files = await session.listFiles("/");
const content = await session.getFileText("/src/index.ts");

// Cleanup
await session.delete();
```

## API Reference

### `AgentAPI`

Main client class for interacting with the Agent API.

#### Constructor

```typescript
new AgentAPI(config: AgentAPIConfig)
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `config.apiKey` | `string` | Yes | API key (`aa_live_xxx` or `aa_test_xxx`) |
| `config.baseUrl` | `string` | No | API base URL (default: `https://api.agent-api.com`) |
| `config.timeout` | `number` | No | Request timeout in ms (default: `30000`) |

#### Methods

##### `createSession(options?)`

Create a new session with an isolated sandbox environment.

```typescript
const session = await agent.createSession({
  repo: "owner/repo",        // Optional: Git repository to clone
  gitToken: "ghp_xxx"        // Optional: Token for private repos
});
```

**Returns:** `Promise<Session>`

##### `getSession(id)`

Get an existing session by ID.

```typescript
const session = agent.getSession("e2e1091c-daa3-42de-ba3b-0d0a05e72fc1");
```

**Returns:** `Session`

---

### `Session`

Represents an active session with a sandbox environment.

#### Properties

|   Property  |      Type      | Description |
|-------------|----------------|-------------|
| `id`        | `string`       | Session UUID|
| `status`    | `SessionStatus`| Current status: `idle`, `starting`, `running`,`paused`, `error` |
| `createdAt` | `string` | ISO 8601 creation timestamp |

#### Methods

##### `sendMessage(content, options?)`

Send a message and stream the response.

```typescript
const message = await session.sendMessage("Fix the bug in auth.ts", {
  onEvent: (event) => {
    switch (event.type) {
      case "message.assistant":
        console.log(event.data.content);
        break;
      case "message.tool":
        console.log(`Tool: ${event.data.toolName} - ${event.data.status}`);
        break;
      case "error":
        console.error(event.data.message);
        break;
    }
  },
  signal: abortController.signal  // Optional: for cancellation
});
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `content` | `string` | Yes | Message to send |
| `options.onEvent` | `(event: SSEEvent) => void` | No | Event callback |
| `options.signal` | `AbortSignal` | No | Abort signal for cancellation |

**Returns:** `Promise<Message>`

##### `listFiles(path?)`

List files in the workspace.

```typescript
const files = await session.listFiles("/src");
// [{ name: "index.ts", path: "/workspace/src/index.ts", isDirectory: false, size: 1234 }]
```

**Returns:** `Promise<FileInfo[]>`

##### `getFile(path)`

Get file content as a Blob.

```typescript
const blob = await session.getFile("/src/index.ts");
```

**Returns:** `Promise<Blob>`

##### `getFileText(path)`

Get file content as text.

```typescript
const content = await session.getFileText("/src/index.ts");
```

**Returns:** `Promise<string>`

##### `delete()`

Delete the session and cleanup resources.

```typescript
await session.delete();
```

**Returns:** `Promise<void>`

##### `waitForReady(timeoutMs?)`

Wait for the session to be ready (status changes from `starting`).

```typescript
await session.waitForReady(60000); // Wait up to 60 seconds
```

**Returns:** `Promise<void>`

---

## Types

### `SSEEvent`

Server-Sent Event from the message stream.

```typescript
interface SSEEvent {
  type: SSEEventType;
  data: SSEEventData;
  timestamp: string;
}
```

### `SSEEventType`

| Type | Description |
|------|-------------|
| `session.starting` | Sandbox is initializing |
| `session.running` | Processing message |
| `session.idle` | Ready for next message |
| `session.paused` | Session paused |
| `message.user` | User message received |
| `message.assistant` | Assistant response (may be partial) |
| `message.tool` | Tool call or result |
| `message.complete` | Message finished |
| `error` | An error occurred |

### Event Data Types

```typescript
// message.assistant
interface MessageAssistantData {
  content: string;
  isPartial: boolean;
}

// message.tool
interface MessageToolData {
  toolName: string;
  toolId: string;
  status: "calling" | "result";
  result?: string;
}

// error
interface ErrorData {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
```

### `FileInfo`

```typescript
interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
}
```

### `Message`

```typescript
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
  createdAt: string;
}
```

---

## Error Handling

The SDK throws `AgentAPIError` for API errors.

```typescript
import { AgentAPIError } from "@agent-api/sdk";

try {
  await session.sendMessage("...");
} catch (error) {
  if (error instanceof AgentAPIError) {
    console.error(`Error ${error.code}: ${error.message}`);
    console.error(`HTTP Status: ${error.status}`);
    console.error(`Details:`, error.details);
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_API_KEY` | 401 | API key is missing or invalid |
| `SESSION_NOT_OWNED` | 403 | Session belongs to a different API key |
| `SESSION_NOT_FOUND` | 404 | Session does not exist |
| `FILE_NOT_FOUND` | 404 | File not found in workspace |
| `SESSION_BUSY` | 409 | Session is processing another message |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `SANDBOX_CREATE_FAILED` | 500 | Failed to create sandbox |
| `SANDBOX_TIMEOUT` | 500 | Sandbox operation timed out |
| `INTERNAL_ERROR` | 500 | Internal server error |

---

## Examples

### Basic Usage

```typescript
import { AgentAPI } from "@agent-api/sdk";

const agent = new AgentAPI({ apiKey: process.env.AGENT_API_KEY! });

async function main() {
  const session = await agent.createSession();

  try {
    // Wait for sandbox to be ready
    await session.waitForReady();

    // Send a coding task
    await session.sendMessage("Create a TypeScript function that calculates fibonacci numbers", {
      onEvent: (e) => {
        if (e.type === "message.assistant" && !e.data.isPartial) {
          console.log("Assistant:", e.data.content);
        }
      }
    });

    // Get the created file
    const files = await session.listFiles("/");
    console.log("Files:", files);

  } finally {
    await session.delete();
  }
}

main();
```

### Working with Git Repositories

```typescript
const session = await agent.createSession({
  repo: "myorg/myrepo",
  gitToken: process.env.GITHUB_TOKEN
});

await session.sendMessage("Fix the failing tests in src/auth.test.ts");

// Get the diff
const originalContent = "..."; // stored before
const newContent = await session.getFileText("/src/auth.ts");
```

### Streaming to a Frontend

```typescript
// API Route (Next.js example)
export async function POST(req: Request) {
  const { sessionId, content } = await req.json();

  const agent = new AgentAPI({ apiKey: process.env.AGENT_API_KEY! });
  const session = agent.getSession(sessionId);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        await session.sendMessage(content, {
          onEvent: (event) => {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
            );
          }
        });
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    }
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream" }
  });
}
```

### Cancellation

```typescript
const controller = new AbortController();

// Cancel after 30 seconds
setTimeout(() => controller.abort(), 30000);

try {
  await session.sendMessage("Refactor the entire codebase", {
    signal: controller.signal
  });
} catch (error) {
  if (error.name === "AbortError") {
    console.log("Request was cancelled");
  }
}
```

---

## Best Practices

1. **Always delete sessions** when done to free up resources
2. **Use `waitForReady()`** after creating a session before sending messages
3. **Handle `SESSION_BUSY` errors** - wait and retry if the session is processing
4. **Stream events** to provide real-time feedback to users
5. **Set appropriate timeouts** for long-running tasks

---

## Environment Variables

```bash
AGENT_API_KEY=aa_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AGENT_API_URL=https://api.agent-api.com  # Optional
```
