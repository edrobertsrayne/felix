import fs from "fs";
import type { Message } from "./client.js";
import { getSessionPath, type Workspace } from "./workspace.js";

export interface SessionEntry {
  role: "system" | "user" | "assistant";
  content: string;
  timestamp: number;
  toolCalls?: Array<{
    name: string;
    arguments: string;
    result?: string;
  }>;
}

export function appendEntry(
  workspace: Workspace,
  sessionId: string,
  entry: SessionEntry,
): void {
  const filePath = getSessionPath(workspace, sessionId);
  const line = JSON.stringify(entry) + "\n";
  fs.appendFileSync(filePath, line);
}

export function loadSession(
  workspace: Workspace,
  sessionId: string,
): Message[] {
  const filePath = getSessionPath(workspace, sessionId);

  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n").filter((line) => line.trim());

    return lines.map((line) => {
      const entry: SessionEntry = JSON.parse(line);
      return {
        role: entry.role,
        content: entry.content,
      };
    });
  } catch (err) {
    console.error(`[Session] Failed to load session ${sessionId}:`, err);
    return [];
  }
}

export function clearSession(workspace: Workspace, sessionId: string): void {
  const filePath = getSessionPath(workspace, sessionId);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

export function getSessionCount(workspace: Workspace): number {
  const { sessionsDir } = workspace;
  if (!fs.existsSync(sessionsDir)) {
    return 0;
  }

  const files = fs.readdirSync(sessionsDir);
  return files.filter((f) => f.endsWith(".jsonl")).length;
}
