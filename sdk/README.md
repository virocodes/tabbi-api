# tabbi-sdk

TypeScript SDK for building AI coding agent applications with Tabbi.

## Installation

```bash
npm install tabbi-sdk
```

## Quick Start

```typescript
import { Tabbi } from "tabbi-sdk";

const tabbi = new Tabbi({
  apiKey: "tb_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
});

// Create a session (streams progress, returns when ready)
const session = await tabbi.createSession({
  onProgress: (event) => console.log(event.message)
});

// Send a message and stream the response
await session.sendMessage("Create a hello world Express server", {
  onEvent: (event) => {
    if (event.type === "message.assistant") {
      process.stdout.write(event.data.content);
    }
  }
});

// Access files in the workspace
const files = await session.listFiles("/");
const content = await session.getFileText("/index.js");

// Cleanup when done
await session.delete();
```

## Features

- **SSE Streaming**: Real-time progress updates during session creation and message streaming
- **Isolated Sandboxes**: Each session runs in an isolated environment with Node.js, Git, and development tools
- **Git Integration**: Clone repositories directly into the workspace
- **File Access**: Read and list files created by the AI agent
- **TypeScript**: Full type definitions included

## API Reference

### `Tabbi`

Main client class.

```typescript
const tabbi = new Tabbi({
  apiKey: string,      // Required: API key (tb_live_xxx or tb_test_xxx)
  baseUrl?: string,    // Optional: API URL (default: https://api.tabbi.dev)
  timeout?: number     // Optional: Request timeout in ms (default: 30000)
});
```

#### `createSession(options?)`

Create a new session with an isolated sandbox.

```typescript
const session = await tabbi.createSession({
  repo?: string,                              // Git repo to clone (owner/repo format)
  gitToken?: string,                          // GitHub token for private repos
  onProgress?: (event: SessionProgressEvent) => void  // Progress callback
});
```

Returns a ready-to-use `Session` instance.

#### `getSession(id)`

Get an existing session by ID.

```typescript
const session = tabbi.getSession("uuid-here");
```

### `Session`

Represents an active session.

#### Properties

- `id: string` - Session UUID
- `status: SessionStatus` - Current status: `idle`, `starting`, `running`, `paused`, `error`
- `createdAt: string` - ISO 8601 timestamp

#### `sendMessage(content, options?)`

Send a message and stream the response.

```typescript
const message = await session.sendMessage("Your prompt here", {
  onEvent: (event: SSEEvent) => {
    // Handle streaming events
  },
  signal?: AbortSignal  // Optional: for cancellation
});
```

#### `listFiles(path?)`

List files in the workspace.

```typescript
const files = await session.listFiles("/src");
// Returns: FileInfo[]
```

#### `getFileText(path)`

Get file content as text.

```typescript
const content = await session.getFileText("/src/index.ts");
```

#### `delete()`

Delete the session and cleanup resources.

```typescript
await session.delete();
```

## Event Types

Events received via `onEvent` callback:

| Type | Description |
|------|-------------|
| `message.assistant` | Assistant response (may be partial) |
| `message.tool` | Tool call or result |
| `session.running` | Processing started |
| `session.idle` | Processing complete |
| `error` | An error occurred |

```typescript
// message.assistant data
{ content: string, isPartial: boolean }

// message.tool data
{ toolName: string, toolId: string, status: "calling" | "result", result?: string }
```

## Error Handling

```typescript
import { TabbiError } from "tabbi-sdk";

try {
  await session.sendMessage("...");
} catch (error) {
  if (error instanceof TabbiError) {
    console.error(`${error.code}: ${error.message}`);
  }
}
```

Common error codes: `INVALID_API_KEY`, `SESSION_NOT_FOUND`, `SESSION_BUSY`, `RATE_LIMIT_EXCEEDED`

## Examples

See the [examples](./examples) directory for complete examples:

- [cli-chat](./examples/cli-chat) - Command-line chat interface

## License

MIT
