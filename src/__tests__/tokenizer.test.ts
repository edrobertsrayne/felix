import { describe, test, expect } from "bun:test";
import {
  countTokens,
  countMessageTokens,
  countMessagesTokens,
  estimateContextUsage,
} from "../tokenizer.js";
import type { Message } from "../client.js";

describe("tokenizer", () => {
  test("should count tokens in text", () => {
    const tokens = countTokens("Hello world");
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBe(2);
  });

  test("should count tokens with special characters", () => {
    const tokens = countTokens("Hello, world! How are you?");
    expect(tokens).toBeGreaterThan(5);
  });

  test("should count tokens in message with role", () => {
    const message: Message = { role: "user", content: "Hello" };
    const tokens = countMessageTokens(message);
    expect(tokens).toBeGreaterThan(4);
  });

  test("should count tokens in multiple messages", () => {
    const messages: Message[] = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
      { role: "user", content: "How are you?" },
    ];
    const tokens = countMessagesTokens(messages);
    expect(tokens).toBeGreaterThan(10);
  });

  test("should estimate context usage", () => {
    const messages: Message[] = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there" },
    ];
    const usage = estimateContextUsage(
      messages,
      "You are a helpful assistant.",
      128000,
    );
    expect(usage).toBeGreaterThan(0);
    expect(usage).toBeLessThan(1);
  });

  test("should return low usage for small messages", () => {
    const messages: Message[] = [];
    const usage = estimateContextUsage(messages, "Short", 128000);
    expect(usage).toBeLessThan(0.01);
  });

  test("should count empty string as zero tokens", () => {
    const tokens = countTokens("");
    expect(tokens).toBe(0);
  });
});
