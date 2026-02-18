# AGENTS.md - Agent Coding Guidelines

This file provides guidelines for agents working on this codebase.

---

## Project Overview

OpenClaw-inspired agent using OpenRouter SDK with a WebSocket gateway and TUI interface. Built with Bun, TypeScript, and blessed for terminal UI.

---

## Commands

### Running the Application

```bash
# Development with hot reload
bun run dev

# Production build
bun run build

# Run the app
bun run start
```

### Type Checking

```bash
# Type check with tsc
bunx tsc --noEmit
```

### Testing

This project uses Bun's built-in test runner. Tests are located in `src/__tests__/`.

```bash
# Run all tests
bun test

# Run a single test file
bun test run src/__tests__/gateway.test.ts

# Run tests matching a pattern
bun test run "src/**/*.test.ts"
```

### Test-Driven Development (TDD)

Follow the Red-Green-Refactor cycle:

1. **Red** - Write a failing test first
   ```typescript
   test('should return response from LLM', async () => {
     const client = new LLMClient({ apiKey: 'test' });
     const response = await client.chat([{ role: 'user', content: 'Hi' }]);
     expect(response).toBe('Hello');
   });
   ```

2. **Green** - Write minimal code to make it pass
   ```typescript
   async chat(messages: Message[]): Promise<string> {
     return 'Hello'; // Minimal implementation
   }
   ```

3. **Refactor** - Improve code while keeping tests passing

**TDD Guidelines:**
- Write tests before implementation for new features
- Tests should be focused, one concept per test
- Use descriptive test names: `test('should handle empty messages')`
- Group related tests with `describe()`
- Use `beforeEach` for setup, not manual setup in each test
- Mock external dependencies (API calls, WebSocket connections)
- Test happy path and error cases
- Run `bun test` before committing

---

## Code Style

Always use Context7 MCP when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask

### TypeScript Configuration

- Target: ES2022
- Module: ESNext with bundler resolution
- Strict mode enabled
- Use explicit return types for exported functions

### Imports

- Use `.js` extension for local imports (required for ESM):
  ```typescript
  import { Gateway } from './gateway.js';
  import { LLMClient, type Message } from './client.js';
  ```
- Use named imports for SDKs:
  ```typescript
  import { OpenRouter } from '@openrouter/sdk';
  ```
- Use default imports for packages that export default:
  ```typescript
  import dotenv from 'dotenv';
  import blessed from 'blessed';
  ```
- Group imports: external packages, then local imports

### Naming Conventions

- **Classes**: PascalCase (`Gateway`, `LLMClient`, `TUI`)
- **Interfaces**: PascalCase (`GatewayConfig`, `ClientMessage`)
- **Types**: PascalCase (`Message`, `ChatMessage`)
- **Variables/Functions**: camelCase (`chatStream`, `messageHandler`)
- **Constants**: camelCase or SCREAMING_SNAKE_CASE for config constants
- **Files**: kebab-case (`gateway.ts`, `client.ts`)

### Type Definitions

- Use interfaces for object shapes:
  ```typescript
  export interface GatewayConfig {
    port: number;
  }
  ```
- Use type for unions/aliases:
  ```typescript
  type MessageHandler = (sessionId: string, messages: Message[]) => Promise<string>;
  ```
- Prefer explicit types over `any`
- Use `import { type X }` for type-only imports

### Formatting

- Use 2 spaces for indentation
- Maximum line length: 100 characters (soft limit)
- Add newlines between logical sections
- Use template literals over string concatenation
- Prefer const over let; avoid var

### Error Handling

- Always wrap async operations in try/catch
- Provide meaningful error messages:
  ```typescript
  } catch (err) {
    this.send(ws, {
      type: 'error',
      content: err instanceof Error ? err.message : 'Unknown error',
      timestamp: Date.now(),
    });
  }
  ```
- Use early returns to avoid deeply nested code

### Logging

- Use console.log/console.error with component prefix:
  ```typescript
  console.log(`[Gateway] Client connected (${this.clients.size} total)`);
  console.error(`[Gateway] WebSocket error:`, err.message);
  ```

### Class Structure

- Use private fields for encapsulation
- Group related methods (public, private, handlers)
- Constructor should handle initialization only
- Extract complex logic into private methods

### File Organization

```
src/
├── index.ts      # Entry point, wires everything together
├── gateway.ts    # WebSocket server
├── client.ts    # OpenRouter SDK wrapper
├── tui.ts       # Terminal UI
└── types.ts     # Shared types (optional, can be in relevant files)
```

---

## Adding New Features

### New Gateway Commands

1. Add command type to `ClientMessage` interface
2. Add handler in `handleMessage` switch statement
3. Add response type to `ServerMessage` if needed

### New Dependencies

```bash
bun add <package>
bun add -d @types/<package>  # if types needed
```

### Configuration

- Add config to `src/index.ts` as typed constant
- Consider supporting `.env` for sensitive values
- Document required environment variables

---

## Environment Variables

Required:
- `OPENROUTER_API_KEY` - API key for OpenRouter

---

## Notes

- The gateway runs on `ws://127.0.0.1:18789` by default
- Sessions are stored in memory (Map) - not persisted between restarts
- The TUI connects to the gateway via WebSocket
- Use `openrouter/auto` for automatic model selection
