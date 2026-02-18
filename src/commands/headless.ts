import WebSocket from "ws";
import { isGatewayRunning, startDaemon } from "../daemon.js";
import { loadConfig } from "../config.js";

export interface HeadlessOptions {
  prompt: string;
}

export async function runHeadless(options: HeadlessOptions): Promise<void> {
  if (!isGatewayRunning()) {
    console.error("Gateway not running, starting...");
    const result = await startDaemon();
    if (!result) {
      console.error("Failed to start gateway");
      process.exit(1);
    }
    // Wait for gateway to be ready
    await waitForGateway();
  }

  const config = loadConfig();
  const port = config.gateway.port;
  const url = `ws://127.0.0.1:${port}`;

  const sessionId = `headless-${Date.now()}`;

  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(url);

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("Gateway connection timeout"));
    }, 30000);

    ws.on("open", () => {
      ws.send(
        JSON.stringify({
          type: "message",
          content: options.prompt,
          sessionId,
        }),
      );
    });

    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString());

      if (msg.type === "response") {
        process.stdout.write(msg.content + "\n");
        clearTimeout(timeout);
        ws.close();
        resolve();
      } else if (msg.type === "error") {
        clearTimeout(timeout);
        ws.close();
        reject(new Error(msg.content));
      }
    });

    ws.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

async function waitForGateway(maxWaitMs = 5000): Promise<void> {
  const config = loadConfig();
  const port = config.gateway.port;
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    try {
      await new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${port}`);
        const t = setTimeout(() => {
          ws.close();
          reject(new Error("timeout"));
        }, 500);
        ws.on("open", () => {
          clearTimeout(t);
          ws.close();
          resolve();
        });
        ws.on("error", () => {
          clearTimeout(t);
          reject(new Error("not ready"));
        });
      });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw new Error("Gateway failed to start within timeout");
}
