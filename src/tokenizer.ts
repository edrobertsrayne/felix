import { get_encoding, type Tiktoken } from "tiktoken";
import type { Message } from "./client.js";

let encoder: Tiktoken | null = null;

function getEncoder(): Tiktoken {
  if (!encoder) {
    encoder = get_encoding("cl100k_base");
  }
  return encoder;
}

export function countTokens(text: string): number {
  const enc = getEncoder();
  return enc.encode(text).length;
}

export function countMessageTokens(message: Message): number {
  const rolePrefix = message.role === "system" ? "" : `${message.role}: `;
  return countTokens(rolePrefix + message.content) + 4;
}

export function countMessagesTokens(messages: Message[]): number {
  let total = 0;

  for (const msg of messages) {
    total += countMessageTokens(msg);
  }

  total += 3;
  return total;
}

export function estimateContextUsage(
  messages: Message[],
  systemPrompt: string,
  maxTokens: number,
): number {
  const systemTokens = countTokens(systemPrompt);
  const messageTokens = countMessagesTokens(messages);
  const total = systemTokens + messageTokens;

  return total / maxTokens;
}
