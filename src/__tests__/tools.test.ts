/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import fs from "fs";
import path from "path";
import os from "os";
import { validateWorkspacePath, createTools } from "../tools.js";

const TEST_DIR = path.join(os.tmpdir(), "felix-tools-test");

describe("tools", () => {
  beforeAll(() => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
    fs.mkdirSync(path.join(TEST_DIR, "subdir"), { recursive: true });
    fs.writeFileSync(path.join(TEST_DIR, "file.txt"), "hello world");
    fs.writeFileSync(
      path.join(TEST_DIR, "subdir", "nested.txt"),
      "nested content",
    );
  });

  afterAll(() => {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe("validateWorkspacePath", () => {
    test("should allow paths within workspace", () => {
      const result = validateWorkspacePath(TEST_DIR, "file.txt");
      expect(result).toBe(path.join(TEST_DIR, "file.txt"));
    });

    test("should allow subdirectory paths", () => {
      const result = validateWorkspacePath(TEST_DIR, "subdir/nested.txt");
      expect(result).toBe(path.join(TEST_DIR, "subdir", "nested.txt"));
    });

    test("should reject paths outside workspace", () => {
      expect(() => validateWorkspacePath(TEST_DIR, "../outside")).toThrow();
    });

    test("should reject absolute paths outside workspace", () => {
      expect(() => validateWorkspacePath(TEST_DIR, "/etc/passwd")).toThrow();
    });
  });

  describe("createTools - read", () => {
    test("should read file contents", async () => {
      const tools = createTools(TEST_DIR) as any;
      const readTool = tools.find((t: any) => t.function.name === "read");
      const result = await readTool.function.execute({ path: "file.txt" });
      expect(result.success).toBe(true);
      expect(result.content).toContain("hello world");
    });

    test("should return error for nonexistent file", async () => {
      const tools = createTools(TEST_DIR) as any;
      const readTool = tools.find((t: any) => t.function.name === "read");
      const result = await readTool.function.execute({
        path: "nonexistent.txt",
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe("File not found");
    });

    test("should return error for directory", async () => {
      const tools = createTools(TEST_DIR) as any;
      const readTool = tools.find((t: any) => t.function.name === "read");
      const result = await readTool.function.execute({ path: "subdir" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("directory");
    });

    test("should support offset and limit", async () => {
      fs.writeFileSync(
        path.join(TEST_DIR, "lines.txt"),
        "line1\nline2\nline3\nline4\nline5",
      );
      const tools = createTools(TEST_DIR) as any;
      const readTool = tools.find((t: any) => t.function.name === "read");
      const result = await readTool.function.execute({
        path: "lines.txt",
        offset: 2,
        limit: 2,
      });
      expect(result.success).toBe(true);
      expect(result.content).toContain("line2");
      expect(result.content).toContain("line3");
      expect(result.content).not.toContain("line1");
    });
  });

  describe("createTools - write", () => {
    test("should create new file", async () => {
      const tools = createTools(TEST_DIR) as any;
      const writeTool = tools.find((t: any) => t.function.name === "write");
      const result = await writeTool.function.execute({
        path: "newfile.txt",
        content: "new content",
      });
      expect(result.success).toBe(true);
      const written = fs.readFileSync(
        path.join(TEST_DIR, "newfile.txt"),
        "utf-8",
      );
      expect(written).toBe("new content");
    });

    test("should overwrite existing file", async () => {
      const tools = createTools(TEST_DIR) as any;
      const writeTool = tools.find((t: any) => t.function.name === "write");
      await writeTool.function.execute({
        path: "file.txt",
        content: "updated",
      });
      const content = fs.readFileSync(path.join(TEST_DIR, "file.txt"), "utf-8");
      expect(content).toBe("updated");
    });

    test("should create parent directories", async () => {
      const tools = createTools(TEST_DIR) as any;
      const writeTool = tools.find((t: any) => t.function.name === "write");
      const result = await writeTool.function.execute({
        path: "newdir/deep/file.txt",
        content: "deep",
      });
      expect(result.success).toBe(true);
      const exists = fs.existsSync(path.join(TEST_DIR, "newdir/deep/file.txt"));
      expect(exists).toBe(true);
    });

    test("should reject path outside workspace", async () => {
      const tools = createTools(TEST_DIR) as any;
      const writeTool = tools.find((t: any) => t.function.name === "write");
      const result = await writeTool.function.execute({
        path: "../outside.txt",
        content: "malicious",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("createTools - edit", () => {
    test("should replace text in file", async () => {
      fs.writeFileSync(path.join(TEST_DIR, "file.txt"), "hello world");
      const tools = createTools(TEST_DIR) as any;
      const editTool = tools.find((t: any) => t.function.name === "edit");
      const result = await editTool.function.execute({
        path: "file.txt",
        find: "hello",
        replace: "goodbye",
      });
      expect(result.success).toBe(true);
      const content = fs.readFileSync(path.join(TEST_DIR, "file.txt"), "utf-8");
      expect(content).toBe("goodbye world");
    });

    test("should return error when text not found", async () => {
      const tools = createTools(TEST_DIR) as any;
      const editTool = tools.find((t: any) => t.function.name === "edit");
      const result = await editTool.function.execute({
        path: "file.txt",
        find: "nonexistent",
        replace: "something",
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Text not found in file");
    });

    test("should return error for nonexistent file", async () => {
      const tools = createTools(TEST_DIR) as any;
      const editTool = tools.find((t: any) => t.function.name === "edit");
      const result = await editTool.function.execute({
        path: "nonexistent.txt",
        find: "text",
        replace: "new",
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe("File not found");
    });
  });

  describe("createTools - ls", () => {
    test("should list directory contents", async () => {
      const tools = createTools(TEST_DIR) as any;
      const lsTool = tools.find((t: any) => t.function.name === "ls");
      const result = await lsTool.function.execute({ path: "." });
      expect(result.success).toBe(true);
      expect(result.files).toContain("file.txt");
      expect(result.files).toContain("subdir/");
    });

    test("should list subdirectory contents", async () => {
      const tools = createTools(TEST_DIR) as any;
      const lsTool = tools.find((t: any) => t.function.name === "ls");
      const result = await lsTool.function.execute({ path: "subdir" });
      expect(result.success).toBe(true);
      expect(result.files).toContain("nested.txt");
    });

    test("should return error for nonexistent directory", async () => {
      const tools = createTools(TEST_DIR) as any;
      const lsTool = tools.find((t: any) => t.function.name === "ls");
      const result = await lsTool.function.execute({ path: "nonexistent" });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Directory not found");
    });

    test("should return error when path is a file", async () => {
      const tools = createTools(TEST_DIR) as any;
      const lsTool = tools.find((t: any) => t.function.name === "ls");
      const result = await lsTool.function.execute({ path: "file.txt" });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Path is not a directory");
    });
  });

  describe("createTools - glob", () => {
    test("should find files matching pattern", async () => {
      fs.writeFileSync(path.join(TEST_DIR, "test.ts"), "test");
      fs.writeFileSync(path.join(TEST_DIR, "test.js"), "test");
      const tools = createTools(TEST_DIR) as any;
      const globTool = tools.find((t: any) => t.function.name === "glob");
      const result = await globTool.function.execute({ pattern: "*.txt" });
      expect(result.success).toBe(true);
      expect(result.files).toContain("file.txt");
    });

    test("should find files in subdirectories with pattern", async () => {
      const tools = createTools(TEST_DIR) as any;
      const globTool = tools.find((t: any) => t.function.name === "glob");
      const result = await globTool.function.execute({
        pattern: "subdir/nested.txt",
      });
      expect(result.success).toBe(true);
      expect(result.files.length).toBeGreaterThan(0);
    });

    test("should return empty for non-matching pattern", async () => {
      const tools = createTools(TEST_DIR) as any;
      const globTool = tools.find((t: any) => t.function.name === "glob");
      const result = await globTool.function.execute({ pattern: "*.xyz" });
      expect(result.success).toBe(true);
      expect(result.files).toEqual([]);
    });

    test("should handle exact filename without wildcard", async () => {
      const tools = createTools(TEST_DIR) as any;
      const globTool = tools.find((t: any) => t.function.name === "glob");
      const result = await globTool.function.execute({ pattern: "file.txt" });
      expect(result.success).toBe(true);
      expect(result.files).toContain("file.txt");
    });
  });

  describe("createTools - grep", () => {
    test("should find matching lines", async () => {
      fs.writeFileSync(
        path.join(TEST_DIR, "search.txt"),
        "hello world\nfoo bar\nhello again",
      );
      const tools = createTools(TEST_DIR) as any;
      const grepTool = tools.find((t: any) => t.function.name === "grep");
      const result = await grepTool.function.execute({
        pattern: "hello",
        path: ".",
      });
      expect(result.success).toBe(true);
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results[0].content).toContain("hello");
    });

    test("should return empty results for no matches", async () => {
      const tools = createTools(TEST_DIR) as any;
      const grepTool = tools.find((t: any) => t.function.name === "grep");
      const result = await grepTool.function.execute({
        pattern: "nonexistentpattern123",
        path: ".",
      });
      expect(result.success).toBe(true);
      expect(result.results).toEqual([]);
    });

    test("should limit results to 100", async () => {
      const tools = createTools(TEST_DIR) as any;
      const grepTool = tools.find((t: any) => t.function.name === "grep");
      const result = await grepTool.function.execute({ pattern: "." });
      expect(result.success).toBe(true);
      expect(result.results.length).toBeLessThanOrEqual(100);
    });
  });

  describe("createTools - webfetch", () => {
    test("should reject invalid URL scheme", async () => {
      const tools = createTools(TEST_DIR) as any;
      const webfetchTool = tools.find(
        (t: any) => t.function.name === "webfetch",
      );
      const result = await webfetchTool.function.execute({
        url: "invalid://url",
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
