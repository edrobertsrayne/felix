import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  readMemory,
  writeMemory,
  readDailyLog,
  appendToDailyLog,
  getMemoryFiles,
} from "../memory.js";
import { initWorkspace, type Workspace } from "../workspace.js";
import fs from "fs";
import path from "path";

const TEST_WORKSPACE = path.resolve("test-workspace-memory");

describe("memory", () => {
  let workspace: Workspace;

  beforeEach(() => {
    workspace = initWorkspace(TEST_WORKSPACE);
  });

  afterEach(() => {
    if (fs.existsSync(TEST_WORKSPACE)) {
      fs.rmSync(TEST_WORKSPACE, { recursive: true, force: true });
    }
  });

  test("should read MEMORY.md", () => {
    const content = readMemory(workspace);
    expect(content).toContain("# Memory");
  });

  test("should write MEMORY.md", () => {
    const newContent = "# Memory\n\nTest content here";
    writeMemory(workspace, newContent);
    const content = readMemory(workspace);
    expect(content).toBe(newContent);
  });

  test("should read daily log", () => {
    const date = new Date("2024-06-15");
    const logPath = path.join(workspace.memoryDir, "2024-06-15.md");
    fs.writeFileSync(logPath, "# Daily Log\n\nTest entry", "utf-8");
    const content = readDailyLog(workspace, date);
    expect(content).toContain("Daily Log");
  });

  test("should return empty string for non-existent daily log", () => {
    const content = readDailyLog(workspace, new Date("2099-01-01"));
    expect(content).toBe("");
  });

  test("should append to daily log", () => {
    const date = new Date("2024-06-15");
    appendToDailyLog(workspace, "Test log entry", date);
    const content = readDailyLog(workspace, date);
    expect(content).toContain("Test log entry");
    expect(content).toContain("## "); // Timestamp header format
  });

  test("should get memory files", () => {
    const date = new Date("2024-06-15");
    appendToDailyLog(workspace, "Entry 1", date);
    const files = getMemoryFiles(workspace);
    expect(files.length).toBeGreaterThan(0);
    expect(files[0]).toEndWith(".md");
  });

  test("should handle empty memory gracefully", () => {
    fs.writeFileSync(workspace.memoryFile, "", "utf-8");
    const content = readMemory(workspace);
    expect(content).toBe("");
  });
});
