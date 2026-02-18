import { describe, test, expect } from "bun:test";
import {
  checkContextStatus,
  truncateMessages,
  type ContextConfig,
} from "../context.js";
import type { Message } from "../client.js";

const DEFAULT_CONFIG: ContextConfig = {
  maxTokens: 128000,
  guardThreshold: 0.8,
};

describe("context", () => {
  test("should check context status with low usage", () => {
    const messages: Message[] = [{ role: "user", content: "Hello" }];
    const status = checkContextStatus(
      messages,
      "You are helpful.",
      DEFAULT_CONFIG,
    );
    expect(status.needsTruncation).toBe(false);
    expect(status.usagePercent).toBeLessThan(1);
  });

  test("should detect when truncation is needed", () => {
    const longContent = "This is a test message. ".repeat(1000);
    const messages: Message[] = [
      { role: "user", content: longContent },
      { role: "assistant", content: longContent },
      { role: "user", content: longContent },
      { role: "assistant", content: longContent },
    ];
    const config: ContextConfig = {
      maxTokens: 100,
      guardThreshold: 0.8,
    };
    const status = checkContextStatus(messages, "Short", config);
    expect(status.needsTruncation).toBe(true);
  });

  test("should truncate messages within token limit", () => {
    const messages: Message[] = [
      { role: "user", content: "First message" },
      { role: "assistant", content: "Second message" },
      { role: "user", content: "Third message" },
      { role: "assistant", content: "Fourth message" },
      { role: "user", content: "Fifth message" },
    ];
    const truncated = truncateMessages(messages, 30);
    expect(truncated.length).toBeLessThan(messages.length);
  });

  test("should keep most recent messages when truncating", () => {
    const messages: Message[] = [
      { role: "user", content: "First" },
      { role: "assistant", content: "Second" },
      { role: "user", content: "Third (most recent)" },
    ];
    const truncated = truncateMessages(messages, 100);
    expect(truncated[truncated.length - 1].content).toBe("Third (most recent)");
  });

  test("should return all messages if under limit", () => {
    const messages: Message[] = [{ role: "user", content: "Hi" }];
    const truncated = truncateMessages(messages, 10000);
    expect(truncated.length).toBe(messages.length);
  });

  test("should handle empty messages array", () => {
    const truncated = truncateMessages([], 100);
    expect(truncated).toHaveLength(0);
  });
});
