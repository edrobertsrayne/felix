import fs from "fs";
import type { Message } from "./client.js";
import type { Workspace } from "./workspace.js";
import { loadSession, appendEntry, type SessionEntry } from "./session.js";
import { appendToDailyLog } from "./memory.js";
import type { ContextConfig } from "./context.js";
import { checkContextStatus, truncateMessages } from "./context.js";

type MessageHandler = (
  sessionId: string,
  messages: Message[],
) => Promise<string>;

export interface PipelineConfig {
  workspace: Workspace;
  contextConfig: ContextConfig;
  systemPrompt: string;
}

export interface PipelineResult {
  response: string;
  sessionId: string;
}

const DEFAULT_BOOTSTRAP_MAX_CHARS = 20000;

export function loadAgentsInstructions(workspace: Workspace): string {
  try {
    const agentsFile = workspace.agentsFile;
    if (fs.existsSync(agentsFile)) {
      const content = fs.readFileSync(agentsFile, "utf-8");
      if (content.length > DEFAULT_BOOTSTRAP_MAX_CHARS) {
        console.log(
          `[Pipeline] AGENTS.md truncated (${content.length} -> ${DEFAULT_BOOTSTRAP_MAX_CHARS} chars)`,
        );
        return (
          content.slice(0, DEFAULT_BOOTSTRAP_MAX_CHARS) +
          "\n\n[Content truncated]"
        );
      }
      return content;
    }
  } catch (err) {
    console.error(`[Pipeline] Failed to load AGENTS.md:`, err);
  }
  return "";
}

export async function processMessage(
  config: PipelineConfig,
  sessionId: string,
  content: string,
  messageHandler: MessageHandler,
): Promise<PipelineResult> {
  const agentsInstructions = loadAgentsInstructions(config.workspace);
  const fullSystemPrompt = agentsInstructions
    ? `${agentsInstructions}\n\n---\n\n${config.systemPrompt}`
    : config.systemPrompt;

  const history = loadSession(config.workspace, sessionId);
  history.push({ role: "user", content });

  const status = checkContextStatus(
    history,
    fullSystemPrompt,
    config.contextConfig,
  );

  if (status.needsTruncation) {
    const maxTokens = Math.floor(
      config.contextConfig.maxTokens *
        config.contextConfig.guardThreshold *
        0.8,
    );
    const truncated = truncateMessages(history, maxTokens);
    history.length = 0;
    history.push(...truncated);
    console.log(
      `[Pipeline] Truncated session ${sessionId} to ${truncated.length} messages (${status.currentTokens} -> ${truncated.length * 50} estimated)`,
    );
  }

  const response = await messageHandler(sessionId, history);

  history.push({ role: "assistant", content: response });

  const entry: SessionEntry = {
    role: "user",
    content,
    timestamp: Date.now(),
  };
  appendEntry(config.workspace, sessionId, entry);

  const responseEntry: SessionEntry = {
    role: "assistant",
    content: response,
    timestamp: Date.now(),
  };
  appendEntry(config.workspace, sessionId, responseEntry);

  appendToDailyLog(
    config.workspace,
    `User: ${content}\nAssistant: ${response}`,
  );

  return { response, sessionId };
}
