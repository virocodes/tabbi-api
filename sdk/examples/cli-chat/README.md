# CLI Chat Example

A simple command-line interface for chatting with an AI agent using the Tabbi SDK.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set your API key:
   ```bash
   export TABBI_API_KEY=tb_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

## Usage

Start the CLI:
```bash
npm start
```

### Commands

| Command | Description |
|---------|-------------|
| `/files [path]` | List files in the workspace |
| `/read <path>` | Read a file's contents |
| `/status` | Show session information |
| `/quit` | Exit and cleanup |

### Example Session

```
=== Tabbi CLI Chat ===

Creating a new session...

  Session created
  Creating sandbox...
  Sandbox ready, configuring session...
Session is ready! (5.23s)
  ID: e2e1091c-daa3-42de-ba3b-0d0a05e72fc1

Type your messages to the agent. Commands:
  /files [path]  - List files in workspace
  /read <path>   - Read a file
  /status        - Show session status
  /quit          - Exit and cleanup

You: Create a hello world Python script

Agent: I'll create a simple Hello World Python script for you.
[write] Created hello.py
Done! I've created `hello.py` with a simple Hello World program.

You: /files
Files in /:
  [FILE] hello.py (45 bytes)

You: /read hello.py

--- hello.py ---
#!/usr/bin/env python3
print("Hello, World!")
--- end ---

You: /quit
Cleaning up session...
Session deleted successfully.
```

## How It Works

1. Creates a new session using SSE streaming (shows real-time progress)
2. Session is ready immediately when `createSession()` returns
3. Sends user messages to the AI agent
4. Streams responses in real-time, showing:
   - Assistant text responses
   - Tool calls (file operations, commands, etc.)
5. Cleans up the session on exit
