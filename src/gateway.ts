import { WebSocketServer, WebSocket } from "ws";
import type { Message } from "./client.js";

export interface GatewayConfig {
  port: number;
}

export interface ClientMessage {
  type: "message" | "history" | "clear";
  content?: string;
  sessionId?: string;
}

export interface ServerMessage {
  type: "response" | "error" | "history";
  content: string;
  sessionId?: string;
  timestamp: number;
}

type MessageHandler = (
  sessionId: string,
  messages: Message[],
) => Promise<string>;

export class Gateway {
  private wss: WebSocketServer;
  private sessions: Map<string, Message[]> = new Map();
  private messageHandler: MessageHandler;
  private clients: Set<WebSocket> = new Set();

  constructor(config: GatewayConfig, messageHandler: MessageHandler) {
    this.wss = new WebSocketServer({ port: config.port });
    this.messageHandler = messageHandler;
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
          this.send(ws, { type: "error", content: "No content", timestamp: Date.now() });
          return;
        }

        const history = this.sessions.get(sessionId) || [];
        history.push({ role: "user", content: msg.content });

        try {
          const response = await this.messageHandler(sessionId, history);
          history.push({ role: "assistant", content: response });
          this.sessions.set(sessionId, history);

          this.send(ws, {
            type: "response",
            content: response,
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
        const historyData = this.sessions.get(sessionId) || [];
        this.send(ws, {
          type: "history",
          content: JSON.stringify(historyData),
          sessionId,
          timestamp: Date.now(),
        });
        break;
      }

      case "clear":
        this.sessions.delete(sessionId);
        this.send(ws, {
          type: "response",
          content: "Session cleared",
          sessionId,
          timestamp: Date.now(),
        });
        break;
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
    this.wss.close();
  }
}
