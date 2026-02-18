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

export async function processMessage(
  config: PipelineConfig,
  sessionId: string,
  content: string,
  messageHandler: MessageHandler,
): Promise<PipelineResult> {
  const history = loadSession(config.workspace, sessionId);
  history.push({ role: "user", content });

  const status = checkContextStatus(
    history,
    config.systemPrompt,
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
