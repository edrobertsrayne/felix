import path from "path";
import fs from "fs";
import { z } from "zod";
import { ToolType } from "@openrouter/sdk";
import type { Tool } from "@openrouter/sdk";

const MAX_LINES = 500;

export function validateWorkspacePath(
  workspace: string,
  targetPath: string,
): string {
  const resolved = path.resolve(workspace, targetPath);
  const workspaceAbs = path.resolve(workspace);
  if (!resolved.startsWith(workspaceAbs)) {
    throw new Error(`Access denied: ${targetPath} is outside workspace`);
  }
  return resolved;
}

export function createTools(workspace: string): Tool[] {
  return [
    {
      type: ToolType.Function,
      function: {
        name: "read",
        description:
          "Read the contents of a file. Use this to view file contents.",
        inputSchema: z.object({
          path: z
            .string()
            .describe("Relative path to the file within the workspace"),
          offset: z
            .number()
            .optional()
            .describe("Line number to start reading from (1-indexed)"),
          limit: z
            .number()
            .optional()
            .describe("Number of lines to read (default: 500)"),
        }),
        outputSchema: z.object({
          content: z.string(),
          success: z.boolean(),
          error: z.string().optional(),
        }),
        execute: async (params: unknown) => {
          const p = params as {
            path?: string;
            offset?: number;
            limit?: number;
          };
          try {
            const filePath = validateWorkspacePath(workspace, p.path || "");
            if (!fs.existsSync(filePath)) {
              return { content: "", success: false, error: "File not found" };
            }
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) {
              return {
                content: "",
                success: false,
                error: "Path is a directory, not a file",
              };
            }
            const content = fs.readFileSync(filePath, "utf-8");
            const lines = content.split("\n");
            const offset = (p.offset || 1) - 1;
            const limit = p.limit || MAX_LINES;
            const selected = lines.slice(offset, offset + limit);
            const totalLines = lines.length;
            const selectedContent = selected.join("\n");
            const info =
              totalLines > limit
                ? `\n\n[Showing ${offset + 1}-${Math.min(offset + limit, totalLines)} of ${totalLines} lines]`
                : "";
            return { content: selectedContent + info, success: true };
          } catch (err) {
            return {
              content: "",
              success: false,
              error: err instanceof Error ? err.message : "Unknown error",
            };
          }
        },
      },
    },
    {
      type: ToolType.Function,
      function: {
        name: "write",
        description:
          "Write content to a file. Creates the file if it doesn't exist, overwrites if it does.",
        inputSchema: z.object({
          path: z
            .string()
            .describe("Relative path to the file within the workspace"),
          content: z.string().describe("Content to write to the file"),
        }),
        outputSchema: z.object({
          success: z.boolean(),
          error: z.string().optional(),
        }),
        execute: async (params: unknown) => {
          const p = params as { path?: string; content?: string };
          try {
            const filePath = validateWorkspacePath(workspace, p.path || "");
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(filePath, p.content || "", "utf-8");
            return { success: true };
          } catch (err) {
            return {
              success: false,
              error: err instanceof Error ? err.message : "Unknown error",
            };
          }
        },
      },
    },
    {
      type: ToolType.Function,
      function: {
        name: "edit",
        description:
          "Edit a file by replacing specific content. Use when you need to modify code or text.",
        inputSchema: z.object({
          path: z
            .string()
            .describe("Relative path to the file within the workspace"),
          find: z.string().describe("Text to find and replace"),
          replace: z.string().describe("Text to replace the found text with"),
        }),
        outputSchema: z.object({
          success: z.boolean(),
          error: z.string().optional(),
        }),
        execute: async (params: unknown) => {
          const p = params as {
            path?: string;
            find?: string;
            replace?: string;
          };
          try {
            const filePath = validateWorkspacePath(workspace, p.path || "");
            if (!fs.existsSync(filePath)) {
              return { success: false, error: "File not found" };
            }
            const content = fs.readFileSync(filePath, "utf-8");
            if (!content.includes(p.find || "")) {
              return { success: false, error: "Text not found in file" };
            }
            const newContent = content.replace(p.find || "", p.replace || "");
            fs.writeFileSync(filePath, newContent, "utf-8");
            return { success: true };
          } catch (err) {
            return {
              success: false,
              error: err instanceof Error ? err.message : "Unknown error",
            };
          }
        },
      },
    },
    {
      type: ToolType.Function,
      function: {
        name: "ls",
        description: "List files and directories in a folder.",
        inputSchema: z.object({
          path: z
            .string()
            .optional()
            .describe("Relative path to directory (default: workspace root)"),
        }),
        outputSchema: z.object({
          files: z.array(z.string()),
          success: z.boolean(),
          error: z.string().optional(),
        }),
        execute: async (params: unknown) => {
          const p = params as { path?: string };
          try {
            const dirPath = validateWorkspacePath(workspace, p.path || ".");
            if (!fs.existsSync(dirPath)) {
              return {
                files: [],
                success: false,
                error: "Directory not found",
              };
            }
            const stat = fs.statSync(dirPath);
            if (!stat.isDirectory()) {
              return {
                files: [],
                success: false,
                error: "Path is not a directory",
              };
            }
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            const files = entries.map((e) =>
              e.isDirectory() ? `${e.name}/` : e.name,
            );
            return { files, success: true };
          } catch (err) {
            return {
              files: [],
              success: false,
              error: err instanceof Error ? err.message : "Unknown error",
            };
          }
        },
      },
    },
    {
      type: ToolType.Function,
      function: {
        name: "glob",
        description:
          "Find files matching a pattern using glob syntax. Supports wildcards like **/*.ts",
        inputSchema: z.object({
          pattern: z
            .string()
            .describe("Glob pattern (e.g., '**/*.ts', 'src/**/*.js')"),
        }),
        outputSchema: z.object({
          files: z.array(z.string()),
          success: z.boolean(),
          error: z.string().optional(),
        }),
        execute: async (params: unknown) => {
          const p = params as { pattern?: string };
          try {
            const matches = globSync(workspace, p.pattern || "");
            return { files: matches, success: true };
          } catch (err) {
            return {
              files: [],
              success: false,
              error: err instanceof Error ? err.message : "Unknown error",
            };
          }
        },
      },
    },
    {
      type: ToolType.Function,
      function: {
        name: "grep",
        description:
          "Search for text patterns in files using regular expressions.",
        inputSchema: z.object({
          pattern: z
            .string()
            .describe("Regular expression pattern to search for"),
          path: z
            .string()
            .optional()
            .describe("Directory to search in (default: workspace root)"),
        }),
        outputSchema: z.object({
          results: z.array(
            z.object({
              file: z.string(),
              line: z.number(),
              content: z.string(),
            }),
          ),
          success: z.boolean(),
          error: z.string().optional(),
        }),
        execute: async (params: unknown) => {
          const p = params as { pattern?: string; path?: string };
          try {
            const searchPath = validateWorkspacePath(workspace, p.path || ".");
            const regex = new RegExp(p.pattern || "", "g");
            const results: { file: string; line: number; content: string }[] =
              [];

            const searchDir = (dir: string) => {
              const entries = fs.readdirSync(dir, { withFileTypes: true });
              for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory() && !entry.name.startsWith(".")) {
                  searchDir(fullPath);
                } else if (entry.isFile()) {
                  try {
                    const lines = fs
                      .readFileSync(fullPath, "utf-8")
                      .split("\n");
                    lines.forEach((line, idx) => {
                      if (regex.test(line)) {
                        results.push({
                          file: path.relative(workspace, fullPath),
                          line: idx + 1,
                          content: line.trim(),
                        });
                      }
                      regex.lastIndex = 0;
                    });
                  } catch {
                    // Skip binary or unreadable files
                  }
                }
              }
            };

            if (
              fs.existsSync(searchPath) &&
              fs.statSync(searchPath).isDirectory()
            ) {
              searchDir(searchPath);
            }

            return { results: results.slice(0, 100), success: true };
          } catch (err) {
            return {
              results: [],
              success: false,
              error: err instanceof Error ? err.message : "Unknown error",
            };
          }
        },
      },
    },
    {
      type: ToolType.Function,
      function: {
        name: "webfetch",
        description:
          "Fetch content from a URL. Use this to get information from the web.",
        inputSchema: z.object({
          url: z.string().describe("URL to fetch content from"),
        }),
        outputSchema: z.object({
          content: z.string(),
          success: z.boolean(),
          error: z.string().optional(),
        }),
        execute: async (params: unknown) => {
          const p = params as { url?: string };
          try {
            const response = await fetch(p.url || "", {
              headers: { "User-Agent": "felix-agent/1.0" },
            });
            const text = await response.text();
            const truncated =
              text.length > 10000
                ? text.slice(0, 10000) + "\n\n[Content truncated]"
                : text;
            return { content: truncated, success: true };
          } catch (err) {
            return {
              content: "",
              success: false,
              error: err instanceof Error ? err.message : "Unknown error",
            };
          }
        },
      },
    },
  ];
}

function globSync(base: string, pattern: string): string[] {
  if (!pattern.includes("*")) {
    const filePath = path.join(base, pattern);
    return fs.existsSync(filePath) ? [pattern] : [];
  }

  const results: string[] = [];

  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(base, fullPath);

      if (entry.isDirectory()) {
        if (!entry.name.startsWith(".")) {
          walk(fullPath);
        }
      } else if (entry.isFile()) {
        if (matchGlob(entry.name, pattern)) {
          results.push(relPath);
        }
      }
    }
  };

  walk(base);
  return results;
}

function matchGlob(filename: string, pattern: string): boolean {
  const regex = globToRegex(pattern);
  return regex.test(filename);
}

function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`);
}
