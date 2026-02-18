import fs from "fs";
import path from "path";

export interface Workspace {
  root: string;
  sessionsDir: string;
  memoryDir: string;
  memoryFile: string;
  configFile: string;
}

export function initWorkspace(workspacePath: string): Workspace {
  const root = path.resolve(workspacePath);
  const sessionsDir = path.join(root, "sessions");
  const memoryDir = path.join(root, "memory");
  const memoryFile = path.join(root, "MEMORY.md");
  const configFile = path.join(root, "config.json");

  fs.mkdirSync(sessionsDir, { recursive: true });
  fs.mkdirSync(memoryDir, { recursive: true });

  if (!fs.existsSync(memoryFile)) {
    fs.writeFileSync(memoryFile, "# Memory\n\nLong-term facts and memories.\n");
  }

  return {
    root,
    sessionsDir,
    memoryDir,
    memoryFile,
    configFile,
  };
}

export function getSessionPath(
  workspace: Workspace,
  sessionId: string,
): string {
  const sanitizedId = sessionId.replace(/[^a-zA-Z0-9-_]/g, "_");
  return path.join(workspace.sessionsDir, `${sanitizedId}.jsonl`);
}

export function getDailyLogPath(workspace: Workspace, date?: Date): string {
  const d = date || new Date();
  const filename = d.toISOString().split("T")[0] + ".md";
  return path.join(workspace.memoryDir, filename);
}
