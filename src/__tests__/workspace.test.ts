import { describe, test, expect, afterEach } from "bun:test";
import {
  initWorkspace,
  getSessionPath,
  getDailyLogPath,
} from "../workspace.js";
import fs from "fs";
import path from "path";

const TEST_WORKSPACE = path.resolve("test-workspace-temp");

describe("workspace", () => {
  afterEach(() => {
    if (fs.existsSync(TEST_WORKSPACE)) {
      fs.rmSync(TEST_WORKSPACE, { recursive: true, force: true });
    }
  });

  test("should create workspace directories", () => {
    const workspace = initWorkspace(TEST_WORKSPACE);
    expect(fs.existsSync(workspace.sessionsDir)).toBe(true);
    expect(fs.existsSync(workspace.memoryDir)).toBe(true);
    expect(fs.existsSync(workspace.memoryFile)).toBe(true);
  });

  test("should create MEMORY.md with default content", () => {
    const workspace = initWorkspace(TEST_WORKSPACE);
    const content = fs.readFileSync(workspace.memoryFile, "utf-8");
    expect(content).toContain("# Memory");
  });

  test("should return correct session path", () => {
    const workspace = initWorkspace(TEST_WORKSPACE);
    const sessionPath = getSessionPath(workspace, "my-session");
    expect(sessionPath).toContain("my-session.jsonl");
  });

  test("should sanitize session IDs", () => {
    const workspace = initWorkspace(TEST_WORKSPACE);
    const sessionPath = getSessionPath(workspace, "session/with?special#chars");
    expect(sessionPath).not.toContain("?");
    expect(sessionPath).not.toContain("#");
  });

  test("should return correct daily log path", () => {
    const workspace = initWorkspace(TEST_WORKSPACE);
    const testDate = new Date("2024-06-15");
    const logPath = getDailyLogPath(workspace, testDate);
    expect(logPath).toContain("2024-06-15.md");
  });

  test("should use today for daily log when no date provided", () => {
    const workspace = initWorkspace(TEST_WORKSPACE);
    const logPath = getDailyLogPath(workspace);
    const today = new Date().toISOString().split("T")[0];
    expect(logPath).toContain(`${today}.md`);
  });
});
