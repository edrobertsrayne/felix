import fs from "fs";
import type { Workspace } from "./workspace.js";
import { getDailyLogPath } from "./workspace.js";

export function readMemory(workspace: Workspace): string {
  try {
    if (fs.existsSync(workspace.memoryFile)) {
      return fs.readFileSync(workspace.memoryFile, "utf-8");
    }
  } catch (err) {
    console.error("[Memory] Failed to read MEMORY.md:", err);
  }
  return "";
}

export function writeMemory(workspace: Workspace, content: string): void {
  try {
    fs.writeFileSync(workspace.memoryFile, content, "utf-8");
  } catch (err) {
    console.error("[Memory] Failed to write MEMORY.md:", err);
    throw err;
  }
}

export function appendToMemory(workspace: Workspace, content: string): void {
  const existing = readMemory(workspace);
  const separator = existing && !existing.endsWith("\n") ? "\n\n" : "";
  writeMemory(workspace, existing + separator + content);
}

export function readDailyLog(workspace: Workspace, date?: Date): string {
  const filePath = getDailyLogPath(workspace, date);

  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf-8");
    }
  } catch (err) {
    console.error("[Memory] Failed to read daily log:", err);
  }
  return "";
}

export function appendToDailyLog(
  workspace: Workspace,
  content: string,
  date?: Date,
): void {
  const filePath = getDailyLogPath(workspace, date);
  const existing = readDailyLog(workspace, date);

  const timestamp = new Date().toISOString();
  const separator = existing && !existing.endsWith("\n") ? "\n" : "";
  const entry = `${separator}## ${timestamp}\n\n${content}\n`;

  try {
    fs.appendFileSync(filePath, entry, "utf-8");
  } catch (err) {
    console.error("[Memory] Failed to append to daily log:", err);
    throw err;
  }
}

export function getMemoryFiles(workspace: Workspace): string[] {
  const { memoryDir } = workspace;

  if (!fs.existsSync(memoryDir)) {
    return [];
  }

  return fs.readdirSync(memoryDir).filter((f) => f.endsWith(".md"));
}
