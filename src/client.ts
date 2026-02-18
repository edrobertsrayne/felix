import { OpenRouter } from "@openrouter/sdk";

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMConfig {
  apiKey: string;
  model?: string;
  systemPrompt?: string;
}

export class LLMClient {
  private client: OpenRouter;
  private model: string;
  private systemPrompt: string;

  constructor(config: LLMConfig) {
    this.client = new OpenRouter({
      apiKey: config.apiKey,
    });
    this.model = config.model || "openrouter/auto";
    this.systemPrompt = config.systemPrompt || "You are a helpful assistant.";
  }

  async chat(messages: Message[]): Promise<string> {
    const fullMessages: Message[] = [
      { role: "system", content: this.systemPrompt },
      ...messages,
    ];

    const response = await this.client.chat.send({
      model: this.model,
      messages: fullMessages,
    });

    return response.choices[0]?.message?.content || "";
  }

  async *chatStream(messages: Message[]): AsyncGenerator<string> {
    const fullMessages: Message[] = [
      { role: "system", content: this.systemPrompt },
      ...messages,
    ];

    const response = await this.client.chat.send(
      {
        model: this.model,
        messages: fullMessages,
      },
      {
        stream: true,
      },
    );

    for await (const chunk of response) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }
}
