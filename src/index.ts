import dotenv from "dotenv";
import { Gateway } from "./gateway.js";
import { LLMClient, type Message } from "./client.js";
import { TUI } from "./tui.js";

dotenv.config();

interface Config {
  gateway: {
    port: number;
  };
  model: string;
  systemPrompt: string;
}

const config: Config = {
  gateway: {
    port: 18789,
  },
  model: "openrouter/auto",
  systemPrompt: "You are a helpful AI assistant. Keep responses concise.",
};

const apiKey = process.env.OPENROUTER_API_KEY;

if (!apiKey) {
  console.error("Error: OPENROUTER_API_KEY not set in environment");
  console.error("Create a .env file with OPENROUTER_API_KEY=your-key");
  process.exit(1);
}

const llm = new LLMClient({
  apiKey,
  model: config.model,
  systemPrompt: config.systemPrompt,
});

const gateway = new Gateway(
  config.gateway,
  async (sessionId: string, messages: Message[]) => {
    console.log(`[Gateway] Processing message for session: ${sessionId}`);
    const response = await llm.chat(messages);
    return response;
  },
);

const tui = new TUI({
  gatewayUrl: `ws://127.0.0.1:${config.gateway.port}`,
});

tui.start();

process.on("SIGINT", () => {
  console.log("\nShutting down...");
  gateway.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  gateway.close();
  process.exit(0);
});
