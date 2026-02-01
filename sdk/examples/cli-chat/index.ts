/**
 * Simple CLI Chat Example
 *
 * A command-line interface for chatting with an AI agent.
 *
 * Usage:
 *   npx ts-node index.ts
 *
 * Environment variables:
 *   TABBI_API_KEY - Your Tabbi API key (required)
 */

import * as readline from "readline";
import { Tabbi, TabbiError } from "tabbi-sdk";
import type { SSEEvent } from "tabbi-sdk";

// ANSI color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
};

function log(color: keyof typeof colors, ...args: unknown[]) {
  console.log(colors[color], ...args, colors.reset);
}

async function main() {
  // Get API key from environment
  const apiKey = process.env.TABBI_API_KEY;
  if (!apiKey) {
    log("red", "Error: TABBI_API_KEY environment variable is required");
    log("dim", "Set it with: export TABBI_API_KEY=tb_test_xxx");
    process.exit(1);
  }

  // Initialize the client
  const tabbi = new Tabbi({ apiKey });

  log("dim", "Connecting to: https://api.tabbi.dev");

  log("cyan", "\n=== Tabbi CLI Chat ===\n");
  log("dim", "Creating a new session...\n");

  // Create a session with SSE streaming (no polling needed)
  let session;
  try {
    const startTime = Date.now();
    session = await tabbi.createSession({
      onProgress: (event) => {
        log("dim", `  ${event.message}`);
      },
    });
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    log("green", `Session is ready! (${elapsed}s)`);
    log("dim", `  ID: ${session.id}\n`);
  } catch (error) {
    if (error instanceof TabbiError) {
      log("red", `Failed to create session: ${error.code} - ${error.message}`);
    } else {
      log("red", `Failed to create session: ${error}`);
    }
    process.exit(1);
  }

  // Set up readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  log("cyan", "Type your messages to the agent. Commands:");
  log("dim", "  /files [path]  - List files in workspace");
  log("dim", "  /read <path>   - Read a file");
  log("dim", "  /status        - Show session status");
  log("dim", "  /quit          - Exit and cleanup\n");

  const prompt = () => {
    rl.question(`${colors.blue}You: ${colors.reset}`, async (input) => {
      const trimmed = input.trim();

      if (!trimmed) {
        prompt();
        return;
      }

      // Handle commands
      if (trimmed.startsWith("/")) {
        await handleCommand(trimmed);
        prompt();
        return;
      }

      // Send message to agent
      try {
        process.stdout.write(`${colors.magenta}Agent: ${colors.reset}`);

        await session.sendMessage(trimmed, {
          onEvent: (event: SSEEvent) => {
            handleEvent(event);
          },
        });

        console.log("\n");
      } catch (error) {
        if (error instanceof TabbiError) {
          log("red", `\nError: ${error.code} - ${error.message}`);
        } else {
          log("red", `\nError: ${error}`);
        }
      }

      prompt();
    });
  };

  async function handleCommand(input: string) {
    const parts = input.split(" ");
    const command = parts[0].toLowerCase();
    const arg = parts.slice(1).join(" ");

    switch (command) {
      case "/files": {
        try {
          const path = arg || "/";
          const files = await session.listFiles(path);
          log("cyan", `\nFiles in ${path}:`);
          for (const file of files) {
            const icon = file.isDirectory ? "[DIR]" : "[FILE]";
            const size = file.size ? ` (${file.size} bytes)` : "";
            log("dim", `  ${icon} ${file.name}${size}`);
          }
          console.log();
        } catch (error) {
          if (error instanceof TabbiError) {
            log("red", `Error listing files: ${error.message}`);
          }
        }
        break;
      }

      case "/read": {
        if (!arg) {
          log("yellow", "Usage: /read <path>");
          break;
        }
        try {
          const content = await session.getFileText(arg);
          log("cyan", `\n--- ${arg} ---`);
          console.log(content);
          log("cyan", "--- end ---\n");
        } catch (error) {
          if (error instanceof TabbiError) {
            log("red", `Error reading file: ${error.message}`);
          }
        }
        break;
      }

      case "/status": {
        log("cyan", `\nSession Status:`);
        log("dim", `  ID: ${session.id}`);
        log("dim", `  Status: ${session.status}`);
        log("dim", `  Created: ${session.createdAt}\n`);
        break;
      }

      case "/quit":
      case "/exit": {
        await cleanup();
        break;
      }

      default: {
        log("yellow", `Unknown command: ${command}`);
        break;
      }
    }
  }

  function handleEvent(event: SSEEvent) {
    switch (event.type) {
      case "message.assistant": {
        const data = event.data as { content: string; isPartial: boolean };
        if (data.isPartial) {
          // Stream partial content
          process.stdout.write(data.content);
        }
        break;
      }

      case "message.tool": {
        const data = event.data as {
          toolName: string;
          status: string;
          result?: string;
        };
        if (data.status === "calling") {
          process.stdout.write(
            `\n${colors.yellow}[${data.toolName}]${colors.reset} `
          );
        } else if (data.status === "result" && data.result) {
          // Truncate long results
          const result =
            data.result.length > 100
              ? data.result.slice(0, 100) + "..."
              : data.result;
          process.stdout.write(`${colors.dim}${result}${colors.reset}\n`);
        }
        break;
      }

      case "session.running": {
        // Agent started processing
        break;
      }

      case "session.idle": {
        // Agent finished processing
        break;
      }

      case "error": {
        const data = event.data as { code: string; message: string };
        log("red", `\nError: ${data.code} - ${data.message}`);
        break;
      }
    }
  }

  let isCleaningUp = false;
  async function cleanup() {
    if (isCleaningUp) return;
    isCleaningUp = true;

    log("dim", "\nCleaning up session...");
    try {
      await session.delete();
      log("green", "Session deleted successfully.");
    } catch (error) {
      log("red", `Error deleting session: ${error}`);
    }
    rl.close();
    process.exit(0);
  }

  // Handle Ctrl+C
  process.on("SIGINT", () => {
    cleanup();
  });

  // Start the prompt loop
  prompt();
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
