import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  appendEntry,
  loadSession,
  clearSession,
  getSessionCount,
  type SessionEntry,
} from "../session.js";
import { initWorkspace, type Workspace } from "../workspace.js";
import fs from "fs";
import path from "path";

const TEST_WORKSPACE = path.resolve("test-workspace-session");

describe("session", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = initWorkspace(TEST_WORKSPACE);
  });

  afterEach(() => {
    if (fs.existsSync(TEST_WORKSPACE)) {
      fs.rmSync(TEST_WORKSPACE, { recursive: true, force: true });
    }
  });

  test("should append entry to session", () => {
    const entry: SessionEntry = {
      role: "user",
      content: "Hello",
      timestamp: Date.now(),
    };
    appendEntry(workspace, "test-session", entry);
    const sessionPath = path.join(workspace.sessionsDir, "test-session.jsonl");
    expect(fs.existsSync(sessionPath)).toBe(true);
  });

  test("should load session from JSONL", () => {
    const entry1: SessionEntry = {
      role: "user",
      content: "Hello",
      timestamp: Date.now(),
    };
    const entry2: SessionEntry = {
      role: "assistant",
      content: "Hi there",
      timestamp: Date.now(),
    };
    appendEntry(workspace, "test-session", entry1);
    appendEntry(workspace, "test-session", entry2);

    const messages = loadSession(workspace, "test-session");
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("user");
    expect(messages[0].content).toBe("Hello");
    expect(messages[1].role).toBe("assistant");
    expect(messages[1].content).toBe("Hi there");
  });

  test("should return empty array for non-existent session", () => {
    const messages = loadSession(workspace, "nonexistent");
    expect(messages).toHaveLength(0);
  });

  test("should clear session", () => {
    const entry: SessionEntry = {
      role: "user",
      content: "Hello",
      timestamp: Date.now(),
    };
    appendEntry(workspace, "test-session", entry);
    clearSession(workspace, "test-session");
    const messages = loadSession(workspace, "test-session");
    expect(messages).toHaveLength(0);
  });

  test("should track session count", () => {
    expect(getSessionCount(workspace)).toBe(0);
    const entry: SessionEntry = {
      role: "user",
      content: "Hello",
      timestamp: Date.now(),
    };
    appendEntry(workspace, "session1", entry);
    appendEntry(workspace, "session2", entry);
    expect(getSessionCount(workspace)).toBe(2);
  });

  test("should preserve tool calls in entry", () => {
    const entry: SessionEntry = {
      role: "assistant",
      content: "I'll run a command",
      timestamp: Date.now(),
      toolCalls: [{ name: "shell", arguments: "ls -la", result: "total 4" }],
    };
    appendEntry(workspace, "test-session", entry);
    const messages = loadSession(workspace, "test-session");
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe("I'll run a command");
  });
});
