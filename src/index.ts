import dotenv from "dotenv";
import { Gateway } from "./gateway.js";
import { LLMClient, type Message } from "./client.js";
import { startTUI } from "./tui.js";
import { loadConfig, resolveConfig } from "./config.js";
import { TelegramAdapter } from "./adapters/telegram.js";
import { initWorkspace } from "./workspace.js";
import { loadAgentsInstructions } from "./pipeline.js";

dotenv.config();

const rawConfig = loadConfig();
const config = resolveConfig(rawConfig);

const apiKey = process.env.OPENROUTER_API_KEY;

if (!apiKey) {
  console.error("Error: OPENROUTER_API_KEY not set in environment");
  console.error("Create a .env file with OPENROUTER_API_KEY=your-key");
  process.exit(1);
}

const workspace = initWorkspace(config.workspace);
const agentsInstructions = loadAgentsInstructions(workspace);

// Inject workspace path information
const workspaceInfo = `

## Workspace Configuration
Your workspace absolute path: ${workspace.root}
Always use relative paths in tool calls (e.g., "README.md", not "${workspace.root}/README.md").
The tools will automatically resolve relative paths within this workspace.
`;

const fullSystemPrompt = agentsInstructions
  ? `${agentsInstructions}${workspaceInfo}\n\n---\n\n${config.systemPrompt}`
  : `${workspaceInfo}\n\n${config.systemPrompt}`;

console.log(`[Agent] Workspace: ${workspace.root}`);
if (agentsInstructions) {
  console.log(`[Agent] Loaded AGENTS.md (${agentsInstructions.length} chars)`);
}

const llm = new LLMClient({
  apiKey,
  model: config.model,
  systemPrompt: fullSystemPrompt,
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

let telegramAdapter: TelegramAdapter | undefined;

if (config.telegram?.enabled) {
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!telegramToken) {
    console.error("Error: TELEGRAM_BOT_TOKEN not set in environment");
    console.error("Create a .env file with TELEGRAM_BOT_TOKEN=your-bot-token");
    process.exit(1);
  }

  telegramAdapter = new TelegramAdapter(
    {
      botToken: telegramToken,
      allowedChats: config.telegram.allowedChats,
    },
    async (sessionId: string, messages: Message[]) => {
      const response = await llm.chatWithTools(messages);
      return response;
    },
  );
  telegramAdapter.start();
}

if (config.tui?.enabled !== false) {
  startTUI({
    gatewayUrl: `ws://127.0.0.1:${config.gateway.port}`,
    model: config.model,
  });
}

process.on("SIGINT", () => {
  console.log("\nShutting down...");
  telegramAdapter?.stop();
  gateway.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  telegramAdapter?.stop();
  gateway.close();
  process.exit(0);
});
