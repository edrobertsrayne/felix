import { OpenRouter, fromChatMessages, stepCountIs } from "@openrouter/sdk";
import { createTools } from "./tools.js";

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMConfig {
  apiKey: string;
  model?: string;
  systemPrompt?: string;
  workspace?: string;
}

export class LLMClient {
  private client: OpenRouter;
  private model: string;
  private systemPrompt: string;
  private workspace: string;

  constructor(config: LLMConfig) {
    this.client = new OpenRouter({
      apiKey: config.apiKey,
    });
    this.model = config.model || "openrouter/auto";
    this.systemPrompt = config.systemPrompt || "You are a helpful assistant.";
    this.workspace = config.workspace || ".";
  }

  async chat(messages: Message[]): Promise<string> {
    const fullMessages: Message[] = [
      { role: "system", content: this.systemPrompt },
      ...messages,
    ];

    const result = this.client.callModel({
      model: this.model,
      input: fromChatMessages(fullMessages),
    });

    return await result.getText();
  }

  async chatWithTools(messages: Message[]): Promise<string> {
    const fullMessages: Message[] = [
      { role: "system", content: this.systemPrompt },
      ...messages,
    ];

    const tools = createTools(this.workspace);

    console.log(`[LLM] Workspace: ${this.workspace}`);
    console.log(`[LLM] Sending request with ${tools.length} tools`);
    console.log(
      `[LLM] Available tools: ${tools.map((t) => t.function.name).join(", ")}`,
    );

    const result = this.client.callModel({
      model: this.model,
      input: fromChatMessages(fullMessages),
      tools,
      stopWhen: stepCountIs(10),
    });

    return await result.getText();
  }
}
