import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  initSearch,
  indexMemoryFile,
  indexAllMemory,
  search,
  closeSearch,
} from "../search.js";
import { initWorkspace, type Workspace } from "../workspace.js";
import fs from "fs";
import path from "path";

const TEST_WORKSPACE = path.resolve("test-workspace-search");

describe("search", () => {
  let workspace: Workspace;
  let db: ReturnType<typeof initSearch>;

  beforeEach(() => {
    workspace = initWorkspace(TEST_WORKSPACE);
    db = initSearch(workspace);
  });

  afterEach(() => {
    closeSearch(db);
    if (fs.existsSync(TEST_WORKSPACE)) {
      fs.rmSync(TEST_WORKSPACE, { recursive: true, force: true });
    }
  });

  test("should initialize search database", () => {
    expect(db).toBeDefined();
  });

  test("should index memory file", () => {
    const testPath = path.join(workspace.memoryDir, "test.md");
    fs.writeFileSync(testPath, "Line one\nLine two\nLine three", "utf-8");
    indexMemoryFile(db, testPath, "Line one\nLine two\nLine three");
    const results = search(db, "one");
    expect(results.length).toBeGreaterThan(0);
  });

  test("should search memory and return results", () => {
    const testPath = path.join(workspace.memoryDir, "test.md");
    fs.writeFileSync(testPath, "The quick brown fox", "utf-8");
    indexMemoryFile(db, testPath, "The quick brown fox");
    const results = search(db, "quick");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].snippet).toContain("quick");
  });

  test("should return empty for no matches", () => {
    const results = search(db, "nonexistentword12345");
    expect(results).toHaveLength(0);
  });

  test("should return empty for empty query", () => {
    const results = search(db, "");
    expect(results).toHaveLength(0);
  });

  test("should handle multiple words in query", () => {
    const testPath = path.join(workspace.memoryDir, "test.md");
    fs.writeFileSync(testPath, "JavaScript TypeScript Python", "utf-8");
    indexMemoryFile(db, testPath, "JavaScript TypeScript Python");
    const results = search(db, "JavaScript Python");
    expect(results.length).toBeGreaterThan(0);
  });

  test("should limit results", () => {
    const testPath = path.join(workspace.memoryDir, "test.md");
    const content = Array.from({ length: 20 }, (_, i) => `Line ${i}`).join(
      "\n",
    );
    fs.writeFileSync(testPath, content, "utf-8");
    indexMemoryFile(db, testPath, content);
    const results = search(db, "Line", 3);
    expect(results.length).toBeLessThanOrEqual(3);
  });

  test("should index all memory files", () => {
    fs.writeFileSync(workspace.memoryFile, "Main memory content", "utf-8");
    const dailyPath = path.join(workspace.memoryDir, "2024-06-15.md");
    fs.writeFileSync(dailyPath, "Daily log content", "utf-8");
    indexAllMemory(workspace, db);
    const results = search(db, "memory");
    expect(results.length).toBeGreaterThan(0);
  });
});
