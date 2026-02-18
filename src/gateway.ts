import { WebSocketServer, WebSocket } from "ws";
import type { Message } from "./client.js";
import { type Workspace, initWorkspace } from "./workspace.js";
import { loadSession, clearSession, getSessionCount } from "./session.js";
import { readMemory, writeMemory } from "./memory.js";
import { type ContextConfig } from "./context.js";
import { type Config as AppConfig } from "./config.js";
import { initSearch, indexAllMemory, search, closeSearch } from "./search.js";
import { processMessage, type PipelineConfig } from "./pipeline.js";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Database = any;

export interface GatewayConfig {
  port: number;
  host?: string;
}

export interface GatewayStatus {
  port: number;
  host: string;
  clientCount: number;
  sessionCount: number;
  uptime: number;
  workspace: string;
  model: string;
  contextWindow: number;
  telegramEnabled: boolean;
}

export interface ClientMessage {
  type:
    | "message"
    | "history"
    | "clear"
    | "readMemory"
    | "writeMemory"
    | "search"
    | "status";
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
    | "status";
  content: string;
  sessionId?: string;
  timestamp: number;
  statusData?: GatewayStatus;
}

type MessageHandler = (
  sessionId: string,
  messages: Message[],
) => Promise<string>;

export class Gateway {
  private wss: WebSocketServer;
  private messageHandler: MessageHandler;
  private clients: Set<WebSocket> = new Set();
  private workspace: Workspace;
  private contextConfig: ContextConfig;
  private systemPrompt: string;
  private searchDb: Database;
  private startTime: number;
  private model: string;
  private telegramEnabled: boolean;
  private host: string;

  constructor(
    config: GatewayConfig,
    appConfig: AppConfig,
    messageHandler: MessageHandler,
  ) {
    this.host = config.host || "127.0.0.1";
    this.wss = new WebSocketServer({ port: config.port, host: this.host });
    this.messageHandler = messageHandler;
    this.workspace = initWorkspace(appConfig.workspace);
    this.contextConfig = {
      maxTokens: appConfig.contextWindow,
      guardThreshold: appConfig.guardThreshold,
    };
    this.systemPrompt = appConfig.systemPrompt;
    this.searchDb = initSearch(this.workspace);
    this.startTime = Date.now();
    this.model = appConfig.model;
    this.telegramEnabled = appConfig.telegram.enabled;

    console.log(`[Gateway] Workspace: ${this.workspace.root}`);
    console.log(
      `[Gateway] Context: ${this.contextConfig.maxTokens} tokens (${this.contextConfig.guardThreshold * 100}% threshold)`,
    );

    this.setupServer(this.host);
  }

  private setupServer(host: string): void {
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
      const resolvedHost = typeof addr === "object" ? addr?.address : host;
      console.log(`[Gateway] Listening on ws://${resolvedHost}:${port}`);
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

        try {
          const pipelineConfig: PipelineConfig = {
            workspace: this.workspace,
            contextConfig: this.contextConfig,
            systemPrompt: this.systemPrompt,
          };

          const result = await processMessage(
            pipelineConfig,
            sessionId,
            msg.content,
            this.messageHandler,
          );

          this.send(ws, {
            type: "response",
            content: result.response,
            sessionId,
            timestamp: Date.now(),
          });
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

      case "status": {
        const addr = this.wss.address();
        const port = typeof addr === "object" ? (addr?.port ?? 0) : 0;
        const resolvedHost =
          typeof addr === "object" ? (addr?.address ?? this.host) : this.host;
        this.send(ws, {
          type: "status",
          content: "",
          timestamp: Date.now(),
          statusData: {
            port,
            host: resolvedHost,
            clientCount: this.clients.size,
            sessionCount: getSessionCount(this.workspace),
            uptime: Date.now() - this.startTime,
            workspace: this.workspace.root,
            model: this.model,
            contextWindow: this.contextConfig.maxTokens,
            telegramEnabled: this.telegramEnabled,
          },
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
