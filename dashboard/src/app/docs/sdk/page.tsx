"use client";

import { CodeBlock } from "@/components/CodeBlock";

export default function SDKDocsPage() {
  return (
    <div>
      <h1>Tabbi SDK</h1>
      <p className="docs-subtitle">TypeScript SDK for building AI coding agent applications.</p>

      <h2>Installation</h2>
      <CodeBlock language="bash">{`npm install @tabbi/sdk`}</CodeBlock>

      <h2>Quick Start</h2>
      <CodeBlock>{`import { Tabbi } from "@tabbi/sdk";

// Initialize the client
const tabbi = new Tabbi({
  apiKey: "tb_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
});

// Create a session (streams progress, returns when ready)
const session = await tabbi.createSession({
  onProgress: (event) => console.log(event.message)
});
// Output: "Session created", "Creating sandbox...", "Sandbox ready..."

// Session is immediately ready - no need to call waitForReady()!

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
await session.delete();`}</CodeBlock>

      <h2>API Reference</h2>

      <h3>Tabbi</h3>
      <p>Main client class for interacting with the Tabbi API.</p>

      <h4>Constructor</h4>
      <CodeBlock>{`new Tabbi(config: TabbiConfig)`}</CodeBlock>

      <table>
        <thead>
          <tr>
            <th>Parameter</th>
            <th>Type</th>
            <th>Required</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>config.apiKey</code></td>
            <td><code>string</code></td>
            <td>Yes</td>
            <td>API key (<code>tb_live_xxx</code> or <code>tb_test_xxx</code>)</td>
          </tr>
          <tr>
            <td><code>config.baseUrl</code></td>
            <td><code>string</code></td>
            <td>No</td>
            <td>API base URL (default: <code>https://api.tabbi.sh</code>)</td>
          </tr>
          <tr>
            <td><code>config.timeout</code></td>
            <td><code>number</code></td>
            <td>No</td>
            <td>Request timeout in ms (default: <code>30000</code>)</td>
          </tr>
        </tbody>
      </table>

      <h4>createSession(options?)</h4>
      <p>Create a new session with an isolated sandbox environment. Uses SSE streaming to report progress and returns when the session is ready.</p>

      <CodeBlock>{`const session = await tabbi.createSession({
  repo: "owner/repo",        // Optional: Git repository to clone
  gitToken: "ghp_xxx",       // Optional: Token for private repos
  onProgress: (event) => {   // Optional: Progress callback
    console.log(event.message);
  }
});
// Session is ready to use immediately - no need to call waitForReady()`}</CodeBlock>

      <table>
        <thead>
          <tr>
            <th>Parameter</th>
            <th>Type</th>
            <th>Required</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>options.repo</code></td>
            <td><code>string</code></td>
            <td>No</td>
            <td>Git repository to clone (<code>owner/repo</code> format)</td>
          </tr>
          <tr>
            <td><code>options.gitToken</code></td>
            <td><code>string</code></td>
            <td>No</td>
            <td>GitHub token for private repositories</td>
          </tr>
          <tr>
            <td><code>options.onProgress</code></td>
            <td><code>(event: SessionProgressEvent) =&gt; void</code></td>
            <td>No</td>
            <td>Callback for progress updates</td>
          </tr>
        </tbody>
      </table>

      <p><strong>Returns:</strong> <code>Promise&lt;Session&gt;</code> (session is ready to use)</p>

      <h4>getSession(id)</h4>
      <p>Get an existing session by ID.</p>
      <CodeBlock>{`const session = tabbi.getSession("e2e1091c-daa3-42de-ba3b-0d0a05e72fc1");`}</CodeBlock>
      <p><strong>Returns:</strong> <code>Session</code></p>

      <hr />

      <h3>Session</h3>
      <p>Represents an active session with a sandbox environment.</p>

      <h4>Properties</h4>
      <table>
        <thead>
          <tr>
            <th>Property</th>
            <th>Type</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>id</code></td>
            <td><code>string</code></td>
            <td>Session UUID</td>
          </tr>
          <tr>
            <td><code>status</code></td>
            <td><code>SessionStatus</code></td>
            <td>Current status: <code>idle</code>, <code>starting</code>, <code>running</code>, <code>paused</code>, <code>error</code></td>
          </tr>
          <tr>
            <td><code>createdAt</code></td>
            <td><code>string</code></td>
            <td>ISO 8601 creation timestamp</td>
          </tr>
        </tbody>
      </table>

      <h4>sendMessage(content, options?)</h4>
      <p>Send a message and stream the response.</p>
      <CodeBlock>{`const message = await session.sendMessage("Fix the bug in auth.ts", {
  onEvent: (event) => {
    switch (event.type) {
      case "message.assistant":
        console.log(event.data.content);
        break;
      case "message.tool":
        console.log(\`Tool: \${event.data.toolName} - \${event.data.status}\`);
        break;
      case "error":
        console.error(event.data.message);
        break;
    }
  },
  signal: abortController.signal  // Optional: for cancellation
});`}</CodeBlock>

      <table>
        <thead>
          <tr>
            <th>Parameter</th>
            <th>Type</th>
            <th>Required</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>content</code></td>
            <td><code>string</code></td>
            <td>Yes</td>
            <td>Message to send</td>
          </tr>
          <tr>
            <td><code>options.onEvent</code></td>
            <td><code>(event: SSEEvent) =&gt; void</code></td>
            <td>No</td>
            <td>Event callback</td>
          </tr>
          <tr>
            <td><code>options.signal</code></td>
            <td><code>AbortSignal</code></td>
            <td>No</td>
            <td>Abort signal for cancellation</td>
          </tr>
        </tbody>
      </table>

      <p><strong>Returns:</strong> <code>Promise&lt;Message&gt;</code></p>

      <h4>listFiles(path?)</h4>
      <p>List files in the workspace.</p>
      <CodeBlock>{`const files = await session.listFiles("/src");
// [{ name: "index.ts", path: "/workspace/src/index.ts", isDirectory: false, size: 1234 }]`}</CodeBlock>
      <p><strong>Returns:</strong> <code>Promise&lt;FileInfo[]&gt;</code></p>

      <h4>getFile(path)</h4>
      <p>Get file content as a Blob.</p>
      <CodeBlock>{`const blob = await session.getFile("/src/index.ts");`}</CodeBlock>
      <p><strong>Returns:</strong> <code>Promise&lt;Blob&gt;</code></p>

      <h4>getFileText(path)</h4>
      <p>Get file content as text.</p>
      <CodeBlock>{`const content = await session.getFileText("/src/index.ts");`}</CodeBlock>
      <p><strong>Returns:</strong> <code>Promise&lt;string&gt;</code></p>

      <h4>delete()</h4>
      <p>Delete the session and cleanup resources.</p>
      <CodeBlock>{`await session.delete();`}</CodeBlock>
      <p><strong>Returns:</strong> <code>Promise&lt;void&gt;</code></p>

      <hr />

      <h2>Types</h2>

      <h3>SSEEvent</h3>
      <p>Server-Sent Event from the message stream.</p>
      <CodeBlock>{`interface SSEEvent {
  type: SSEEventType;
  data: SSEEventData;
  timestamp: string;
}`}</CodeBlock>

      <h3>SSEEventType</h3>
      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>session.starting</code></td>
            <td>Sandbox is initializing</td>
          </tr>
          <tr>
            <td><code>session.running</code></td>
            <td>Processing message</td>
          </tr>
          <tr>
            <td><code>session.idle</code></td>
            <td>Ready for next message</td>
          </tr>
          <tr>
            <td><code>session.paused</code></td>
            <td>Session paused</td>
          </tr>
          <tr>
            <td><code>message.user</code></td>
            <td>User message received</td>
          </tr>
          <tr>
            <td><code>message.assistant</code></td>
            <td>Assistant response (may be partial)</td>
          </tr>
          <tr>
            <td><code>message.tool</code></td>
            <td>Tool call or result</td>
          </tr>
          <tr>
            <td><code>message.complete</code></td>
            <td>Message finished</td>
          </tr>
          <tr>
            <td><code>error</code></td>
            <td>An error occurred</td>
          </tr>
        </tbody>
      </table>

      <h3>Event Data Types</h3>
      <CodeBlock>{`// message.assistant
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
}`}</CodeBlock>

      <h3>FileInfo</h3>
      <CodeBlock>{`interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
}`}</CodeBlock>

      <h3>Message</h3>
      <CodeBlock>{`interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
  createdAt: string;
}`}</CodeBlock>

      <hr />

      <h2>Error Handling</h2>
      <p>The SDK throws <code>TabbiError</code> for API errors.</p>
      <CodeBlock>{`import { TabbiError } from "@tabbi/sdk";

try {
  await session.sendMessage("...");
} catch (error) {
  if (error instanceof TabbiError) {
    console.error(\`Error \${error.code}: \${error.message}\`);
    console.error(\`HTTP Status: \${error.status}\`);
    console.error(\`Details:\`, error.details);
  }
}`}</CodeBlock>

      <h3>Error Codes</h3>
      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>HTTP Status</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>INVALID_API_KEY</code></td>
            <td>401</td>
            <td>API key is missing or invalid</td>
          </tr>
          <tr>
            <td><code>SESSION_NOT_OWNED</code></td>
            <td>403</td>
            <td>Session belongs to a different API key</td>
          </tr>
          <tr>
            <td><code>SESSION_NOT_FOUND</code></td>
            <td>404</td>
            <td>Session does not exist</td>
          </tr>
          <tr>
            <td><code>FILE_NOT_FOUND</code></td>
            <td>404</td>
            <td>File not found in workspace</td>
          </tr>
          <tr>
            <td><code>SESSION_BUSY</code></td>
            <td>409</td>
            <td>Session is processing another message</td>
          </tr>
          <tr>
            <td><code>RATE_LIMIT_EXCEEDED</code></td>
            <td>429</td>
            <td>Too many requests</td>
          </tr>
          <tr>
            <td><code>SANDBOX_CREATE_FAILED</code></td>
            <td>500</td>
            <td>Failed to create sandbox</td>
          </tr>
          <tr>
            <td><code>SANDBOX_TIMEOUT</code></td>
            <td>500</td>
            <td>Sandbox operation timed out</td>
          </tr>
          <tr>
            <td><code>INTERNAL_ERROR</code></td>
            <td>500</td>
            <td>Internal server error</td>
          </tr>
        </tbody>
      </table>

      <hr />

      <h2>Examples</h2>

      <h3>Basic Usage</h3>
      <CodeBlock>{`import { Tabbi } from "@tabbi/sdk";

const tabbi = new Tabbi({ apiKey: process.env.TABBI_API_KEY! });

async function main() {
  // Create session with progress updates
  const session = await tabbi.createSession({
    onProgress: (event) => console.log(event.message)
  });
  // Session is ready immediately - no waitForReady() needed!

  try {
    // Send a coding task
    await session.sendMessage("Create a TypeScript function that calculates fibonacci numbers", {
      onEvent: (e) => {
        if (e.type === "message.assistant") {
          process.stdout.write(e.data.content);
        }
      }
    });

    // Get the created file
    const files = await session.listFiles("/");
    console.log("\\nFiles:", files);

  } finally {
    await session.delete();
  }
}

main();`}</CodeBlock>

      <h3>Working with Git Repositories</h3>
      <CodeBlock>{`const session = await tabbi.createSession({
  repo: "myorg/myrepo",
  gitToken: process.env.GITHUB_TOKEN
});

await session.sendMessage("Fix the failing tests in src/auth.test.ts");

// Get the diff
const originalContent = "..."; // stored before
const newContent = await session.getFileText("/src/auth.ts");`}</CodeBlock>

      <h3>Streaming to a Frontend</h3>
      <CodeBlock>{`// API Route (Next.js example)
export async function POST(req: Request) {
  const { sessionId, content } = await req.json();

  const tabbi = new Tabbi({ apiKey: process.env.TABBI_API_KEY! });
  const session = tabbi.getSession(sessionId);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        await session.sendMessage(content, {
          onEvent: (event) => {
            controller.enqueue(
              encoder.encode(\`data: \${JSON.stringify(event)}\\n\\n\`)
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
}`}</CodeBlock>

      <h3>Cancellation</h3>
      <CodeBlock>{`const controller = new AbortController();

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
}`}</CodeBlock>

      <hr />

      <h2>Best Practices</h2>
      <ol>
        <li><strong>Always delete sessions</strong> when done to free up resources</li>
        <li><strong>Use <code>onProgress</code> callback</strong> to show users real-time progress during session creation</li>
        <li><strong>Handle <code>SESSION_BUSY</code> errors</strong> - wait and retry if the session is processing</li>
        <li><strong>Stream events</strong> to provide real-time feedback to users</li>
        <li><strong>Set appropriate timeouts</strong> for long-running tasks</li>
      </ol>

      <hr />

      <h2>Environment Variables</h2>
      <CodeBlock language="bash">{`TABBI_API_KEY=tb_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TABBI_API_URL=https://api.tabbi.sh  # Optional`}</CodeBlock>
    </div>
  );
}
