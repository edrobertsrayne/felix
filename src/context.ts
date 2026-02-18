import type { Message } from "./client.js";
import { countTokens, countMessagesTokens } from "./tokenizer.js";

export interface ContextConfig {
  maxTokens: number;
  guardThreshold: number;
}

export interface ContextStatus {
  currentTokens: number;
  maxTokens: number;
  usagePercent: number;
  needsTruncation: boolean;
}

export function checkContextStatus(
  messages: Message[],
  systemPrompt: string,
  config: ContextConfig,
): ContextStatus {
  const systemTokens = countTokens(systemPrompt);
  const messageTokens = countMessagesTokens(messages);
  const total = systemTokens + messageTokens;

  const maxAllowed = config.maxTokens * config.guardThreshold;

  return {
    currentTokens: total,
    maxTokens: config.maxTokens,
    usagePercent: (total / config.maxTokens) * 100,
    needsTruncation: total > maxAllowed,
  };
}

export function truncateMessages(
  messages: Message[],
  maxTokens: number,
): Message[] {
  const result: Message[] = [];
  let totalTokens = 0;

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    const tokens = countTokens(msg.content) + 4;

    if (totalTokens + tokens > maxTokens) {
      break;
    }

    result.unshift(msg);
    totalTokens += tokens;
  }

  return result;
}
