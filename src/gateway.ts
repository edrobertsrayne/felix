import { WebSocketServer, WebSocket } from "ws";
import type { Message } from "./client.js";
import { type Workspace, initWorkspace } from "./workspace.js";
import {
  loadSession,
  appendEntry,
  clearSession,
  type SessionEntry,
} from "./session.js";
import { readMemory, writeMemory, appendToDailyLog } from "./memory.js";
import {
  type ContextConfig,
  checkContextStatus,
  truncateMessages,
} from "./context.js";
import { type Config as AppConfig } from "./config.js";
import { initSearch, indexAllMemory, search, closeSearch } from "./search.js";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Database = any;

export interface GatewayConfig {
  port: number;
}

export interface ClientMessage {
  type:
    | "message"
    | "history"
    | "clear"
    | "readMemory"
    | "writeMemory"
    | "search";
  content?: string;
  sessionId?: string;
  query?: string;
}

export interface ServerMessage {
  type:
    | "response"
    | "error"
    | "history"
    | "memory"
    | "searchResults"
    | "stream_start"
    | "stream_chunk"
    | "stream_end";
  content: string;
  sessionId?: string;
  timestamp: number;
}

type MessageHandler = (
  sessionId: string,
  messages: Message[],
) => Promise<string>;

export type StreamHandler = (
  sessionId: string,
  messages: Message[],
) => AsyncGenerator<string>;

export class Gateway {
  private wss: WebSocketServer;
  private messageHandler: MessageHandler;
  private streamHandler?: StreamHandler;
  private clients: Set<WebSocket> = new Set();
  private workspace: Workspace;
  private contextConfig: ContextConfig;
  private systemPrompt: string;
  private searchDb: Database;

  constructor(
    config: GatewayConfig,
    appConfig: AppConfig,
    messageHandler: MessageHandler,
    streamHandler?: StreamHandler,
  ) {
    this.wss = new WebSocketServer({ port: config.port });
    this.messageHandler = messageHandler;
    this.streamHandler = streamHandler;
    this.workspace = initWorkspace(appConfig.workspace);
    this.contextConfig = {
      maxTokens: appConfig.contextWindow,
      guardThreshold: appConfig.guardThreshold,
    };
    this.systemPrompt = appConfig.systemPrompt;
    this.searchDb = initSearch(this.workspace);

    console.log(`[Gateway] Workspace: ${this.workspace.root}`);
    console.log(
      `[Gateway] Context: ${this.contextConfig.maxTokens} tokens (${this.contextConfig.guardThreshold * 100}% threshold)`,
    );

    this.setupServer();
  }

  private setupServer(): void {
    this.wss.on("connection", (ws: WebSocket) => {
      this.clients.add(ws);
      console.log(`[Gateway] Client connected (${this.clients.size} total)`);

      ws.on("message", (data: Buffer) => {
        try {
          const msg: ClientMessage = JSON.parse(data.toString());
          this.handleMessage(ws, msg);
        } catch {
          this.send(ws, {
            type: "error",
            content: "Invalid JSON message",
            timestamp: Date.now(),
          });
        }
      });

      ws.on("close", () => {
        this.clients.delete(ws);
        console.log(
          `[Gateway] Client disconnected (${this.clients.size} total)`,
        );
      });

      ws.on("error", (err) => {
        console.error(`[Gateway] WebSocket error:`, err.message);
      });
    });

    this.wss.on("listening", () => {
      const addr = this.wss.address();
      const port = typeof addr === "object" ? addr?.port : addr;
      console.log(`[Gateway] Listening on ws://127.0.0.1:${port}`);
    });
  }

  private async handleMessage(
    ws: WebSocket,
    msg: ClientMessage,
  ): Promise<void> {
    const sessionId = msg.sessionId || "default";

    switch (msg.type) {
      case "message": {
        if (!msg.content) {
          this.send(ws, {
            type: "error",
            content: "No content",
            timestamp: Date.now(),
          });
          return;
        }

        const history = loadSession(this.workspace, sessionId);
        history.push({ role: "user", content: msg.content });

        const status = checkContextStatus(
          history,
          this.systemPrompt,
          this.contextConfig,
        );
        if (status.needsTruncation) {
          const maxTokens = Math.floor(
            this.contextConfig.maxTokens *
              this.contextConfig.guardThreshold *
              0.8,
          );
          const truncated = truncateMessages(history, maxTokens);
          history.length = 0;
          history.push(...truncated);
          console.log(
            `[Gateway] Truncated session ${sessionId} to ${truncated.length} messages (${status.currentTokens} -> ${truncated.length * 50} estimated)`,
          );
        }

        try {
          let response: string;

          if (this.streamHandler) {
            this.send(ws, {
              type: "stream_start",
              content: "",
              sessionId,
              timestamp: Date.now(),
            });

            let fullContent = "";
            const stream = this.streamHandler(sessionId, history);
            for await (const chunk of stream) {
              fullContent += chunk;
              this.send(ws, {
                type: "stream_chunk",
                content: chunk,
                sessionId,
                timestamp: Date.now(),
              });
            }

            response = fullContent;
            this.send(ws, {
              type: "stream_end",
              content: response,
              sessionId,
              timestamp: Date.now(),
            });
          } else {
            response = await this.messageHandler(sessionId, history);
            this.send(ws, {
              type: "response",
              content: response,
              sessionId,
              timestamp: Date.now(),
            });
          }

          history.push({ role: "assistant", content: response });

          const entry: SessionEntry = {
            role: "user",
            content: msg.content,
            timestamp: Date.now(),
          };
          appendEntry(this.workspace, sessionId, entry);

          const responseEntry: SessionEntry = {
            role: "assistant",
            content: response,
            timestamp: Date.now(),
          };
          appendEntry(this.workspace, sessionId, responseEntry);

          appendToDailyLog(
            this.workspace,
            `User: ${msg.content}\nAssistant: ${response}`,
          );
        } catch (err) {
          this.send(ws, {
            type: "error",
            content: err instanceof Error ? err.message : "Unknown error",
            timestamp: Date.now(),
          });
        }
        break;
      }

      case "history": {
        const historyData = loadSession(this.workspace, sessionId);
        this.send(ws, {
          type: "history",
          content: JSON.stringify(historyData),
          sessionId,
          timestamp: Date.now(),
        });
        break;
      }

      case "clear": {
        clearSession(this.workspace, sessionId);
        this.send(ws, {
          type: "response",
          content: "Session cleared",
          sessionId,
          timestamp: Date.now(),
        });
        break;
      }

      case "readMemory": {
        const memory = readMemory(this.workspace);
        this.send(ws, {
          type: "memory",
          content: memory,
          timestamp: Date.now(),
        });
        break;
      }

      case "writeMemory": {
        if (!msg.content) {
          this.send(ws, {
            type: "error",
            content: "No content",
            timestamp: Date.now(),
          });
          return;
        }
        try {
          writeMemory(this.workspace, msg.content);
          indexAllMemory(this.workspace, this.searchDb);
          this.send(ws, {
            type: "response",
            content: "Memory updated",
            timestamp: Date.now(),
          });
        } catch (err) {
          this.send(ws, {
            type: "error",
            content:
              err instanceof Error ? err.message : "Failed to write memory",
            timestamp: Date.now(),
          });
        }
        break;
      }

      case "search": {
        if (!msg.query) {
          this.send(ws, {
            type: "error",
            content: "No query",
            timestamp: Date.now(),
          });
          return;
        }
        const results = search(this.searchDb, msg.query);
        this.send(ws, {
          type: "searchResults",
          content: JSON.stringify(results),
          timestamp: Date.now(),
        });
        break;
      }
    }
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  broadcast(msg: ServerMessage): void {
    const data = JSON.stringify(msg);
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  close(): void {
    closeSearch(this.searchDb);
    this.wss.close();
  }
}
