import dotenv from "dotenv";
import { Gateway } from "./gateway.js";
import { LLMClient, type Message } from "./client.js";
import { startTUI } from "./tui.js";
import { loadConfig, resolveConfig } from "./config.js";

dotenv.config();

const rawConfig = loadConfig();
const config = resolveConfig(rawConfig);

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
  config,
  async (sessionId: string, messages: Message[]) => {
    console.log(`[Gateway] Processing message for session: ${sessionId}`);
    const response = await llm.chat(messages);
    return response;
  },
  async function* (sessionId: string, messages: Message[]) {
    console.log(`[Gateway] Streaming response for session: ${sessionId}`);
    yield* llm.chatStream(messages);
  },
);

startTUI({
  gatewayUrl: `ws://127.0.0.1:${config.gateway.port}`,
  model: config.model,
});

process.on("SIGINT", () => {
  console.log("\nShutting down...");
  gateway.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  gateway.close();
  process.exit(0);
});
