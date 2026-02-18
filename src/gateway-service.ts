import dotenv from "dotenv";
import { Gateway } from "./gateway.js";
import { LLMClient, type Message } from "./client.js";
import { loadConfig, resolveConfig } from "./config.js";
import { createTelegramAdapter } from "./adapters/telegram.js";

export interface GatewayServiceOptions {
  telegram?: boolean;
}

export async function runGatewayService(
  options: GatewayServiceOptions = {},
): Promise<void> {
  dotenv.config();

  const config = resolveConfig(loadConfig());

  const hostFromEnv = process.env.FELIX_GATEWAY_HOST;
  if (hostFromEnv) {
    config.gateway.host = hostFromEnv;
  }

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
    workspace: config.workspace,
  });

  const gateway = new Gateway(
    config.gateway,
    config,
    async (sessionId: string, messages: Message[]) => {
      console.log(`[Gateway] Processing message for session: ${sessionId}`);
      const response = await llm.chatWithTools(messages);
      return response;
    },
  );

  const telegramEnabled = options.telegram !== false && config.telegram.enabled;
  let telegramAdapter = null;

  if (telegramEnabled) {
    telegramAdapter = await createTelegramAdapter(
      config.telegram,
      async (sessionId: string, messages: Message[]) => {
        const response = await llm.chat(messages);
        return response;
      },
    );

    if (telegramAdapter) {
      telegramAdapter.start();
    }
  }

  process.on("SIGINT", () => {
    console.log("\n[Gateway] Shutting down...");
    if (telegramAdapter) {
      telegramAdapter.stop();
    }
    gateway.close();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log("[Gateway] Shutting down...");
    if (telegramAdapter) {
      telegramAdapter.stop();
    }
    gateway.close();
    process.exit(0);
  });
}

runGatewayService();
