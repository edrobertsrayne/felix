import { describe, test, expect } from "bun:test";
import type { ClientMessage, ServerMessage } from "../gateway.js";

describe("ClientMessage", () => {
  test("should have valid message type", () => {
    const msg: ClientMessage = {
      type: "message",
      content: "Hello",
      sessionId: "test-session",
    };
    expect(msg.type).toBe("message");
    expect(msg.content).toBe("Hello");
    expect(msg.sessionId).toBe("test-session");
  });

  test("should have valid history type", () => {
    const msg: ClientMessage = {
      type: "history",
      sessionId: "test-session",
    };
    expect(msg.type).toBe("history");
  });

  test("should have valid clear type", () => {
    const msg: ClientMessage = {
      type: "clear",
      sessionId: "test-session",
    };
    expect(msg.type).toBe("clear");
  });

  test("message without sessionId should default to default", () => {
    const msg: ClientMessage = {
      type: "message",
      content: "Hello",
    };
    expect(msg.sessionId).toBeUndefined();
  });
});

describe("ServerMessage", () => {
  test("should have valid response type", () => {
    const msg: ServerMessage = {
      type: "response",
      content: "Hello back",
      sessionId: "test-session",
      timestamp: Date.now(),
    };
    expect(msg.type).toBe("response");
    expect(msg.content).toBe("Hello back");
  });

  test("should have valid error type", () => {
    const msg: ServerMessage = {
      type: "error",
      content: "Something went wrong",
      timestamp: Date.now(),
    };
    expect(msg.type).toBe("error");
  });

  test("should have valid history type", () => {
    const msg: ServerMessage = {
      type: "history",
      content: "[]",
      sessionId: "test-session",
      timestamp: Date.now(),
    };
    expect(msg.type).toBe("history");
  });

  test("timestamp should be present", () => {
    const msg: ServerMessage = {
      type: "response",
      content: "test",
      timestamp: Date.now(),
    };
    expect(msg.timestamp).toBeDefined();
    expect(typeof msg.timestamp).toBe("number");
  });
});
