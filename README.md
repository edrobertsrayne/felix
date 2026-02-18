# Felix

An OpenClaw-inspired AI agent with a WebSocket gateway and terminal UI. Built with Bun, TypeScript, and Ink.

## Overview

Felix is a local-first AI agent that provides:

- **WebSocket Gateway** - Control plane for routing messages and managing sessions
- **TUI (Terminal UI)** - Interactive chat interface built with Ink/React
- **Telegram Adapter** - Connect via Telegram bot
- **Memory System** - Persistent long-term memory with hybrid search (vector + BM25)
- **Session Management** - Conversation history with token budget guarding

## Architecture

```
Channel Adapters (Telegram, TUI, etc.)
         ↓
    Gateway (ws://127.0.0.1:18789)
         ↓
   LLM Client (OpenRouter)
```

## Prerequisites

- [Bun](https://bun.sh) runtime
- OpenRouter API key
- (Optional) Telegram bot token

## Setup

1. Install dependencies:

   ```bash
   bun install
   ```

2. Create a `.env` file:

   ```bash
   cp .env.example .env
   ```

3. Configure your API keys in `.env`:

   ```
   OPENROUTER_API_KEY=your-key
   TELEGRAM_BOT_TOKEN=your-bot-token  # optional
   ```

4. Copy and edit the config:
   ```bash
   cp config.example.json config.json
   ```

## Usage

### Development

```bash
bun run dev
```

### Production Build

```bash
bun run build:all
bun run start
```

### Commands

| Command           | Description                  |
| ----------------- | ---------------------------- |
| `bun run gateway` | Start WebSocket gateway only |
| `bun run tui`     | Start terminal UI only       |
| `bun test`        | Run tests                    |

## Configuration

Edit `config.json`:

| Option                  | Description                           | Default             |
| ----------------------- | ------------------------------------- | ------------------- |
| `workspace`             | Agent workspace directory             | `./agent-workspace` |
| `contextWindow`         | Max tokens for context                | `128000`            |
| `guardThreshold`        | Token threshold before guard triggers | `0.8`               |
| `gateway.port`          | WebSocket server port                 | `18789`             |
| `model`                 | OpenRouter model                      | `openrouter/auto`   |
| `systemPrompt`          | System prompt for LLM                 | (see example)       |
| `telegram.enabled`      | Enable Telegram bot                   | `false`             |
| `telegram.allowedChats` | Allowed chat IDs                      | `[]`                |

## WebSocket Protocol

Connect to `ws://127.0.0.1:18789`. Send JSON messages:

### Client → Server

```typescript
// Send a message
{ "type": "message", "content": "Hello", "sessionId": "default" }

// Get history
{ "type": "history", "sessionId": "default" }

// Clear session
{ "type": "clear", "sessionId": "default" }

// Read memory
{ "type": "readMemory" }

// Write memory
{ "type": "writeMemory", "content": "..." }

// Search memory
{ "type": "search", "query": "..." }

// Get status
{ "type": "status" }
```

### Server → Client

```typescript
// Response
{ "type": "response", "content": "...", "sessionId": "...", "timestamp": 1234567890 }

// Streaming chunk
{ "type": "stream_chunk", "content": "...", "sessionId": "...", "timestamp": 1234567890 }

// Error
{ "type": "error", "content": "...", "timestamp": 1234567890 }

// Status
{ "type": "status", "statusData": { "port": 18789, "clientCount": 1, ... }, "timestamp": 1234567890 }
```

## Project Structure

```
src/
├── index.ts          # Entry point, wires everything together
├── gateway.ts        # WebSocket server (control plane)
├── client.ts         # OpenRouter SDK wrapper
├── config.ts         # Configuration loader
├── pipeline.ts       # Message processing pipeline
├── context.ts        # Context window management
├── session.ts        # Session history management
├── memory.ts         # Long-term memory system
├── search.ts         # Hybrid search (vector + BM25)
├── tokenizer.ts      # Token counting utilities
├── workspace.ts      # Workspace file management
├── tui.tsx           # Terminal UI (Ink/React)
├── cli.ts            # CLI commands
├── daemon.ts         # Daemon process management
├── gateway-service.ts # Gateway as a service
├── adapters/
│   └── telegram.ts   # Telegram bot adapter
├── tui/
│   ├── components/   # TUI React components
│   └── hooks/        # Custom hooks
└── __tests__/        # Test files
```

## Testing

```bash
bun test
bun test run src/__tests__/gateway.test.ts
```

## License

MIT
