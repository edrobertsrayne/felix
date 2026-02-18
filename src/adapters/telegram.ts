import TelegramBot from "node-telegram-bot-api";
import type { Message } from "../client.js";

export interface TelegramAdapterConfig {
  botToken: string;
  allowedChats: string[];
}

export interface NormalizedMessage {
  chatId: number;
  content: string;
  senderName: string;
  isGroup: boolean;
  sessionId: string;
}

export function normalizeTelegramMessage(
  msg: TelegramBot.Message,
): NormalizedMessage {
  const chatId = msg.chat.id;
  const content = msg.text || "";
  const senderName = msg.from?.first_name || "Unknown";
  const isGroup = msg.chat.type !== "private";
  const sessionId = chatId.toString();

  return {
    chatId,
    content,
    senderName,
    isGroup,
    sessionId,
  };
}

export function isChatAllowed(chatId: number, allowedChats: string[]): boolean {
  return allowedChats.includes(chatId.toString());
}

export function isPrivateChat(chatType: string): boolean {
  return chatType === "private";
}

export class TelegramAdapter {
  private bot: TelegramBot;
  private allowedChats: Set<string>;
  private messageHandler: (
    sessionId: string,
    messages: Message[],
  ) => Promise<string>;
  private running: boolean = false;

  constructor(
    config: TelegramAdapterConfig,
    messageHandler: (sessionId: string, messages: Message[]) => Promise<string>,
  ) {
    this.bot = new TelegramBot(config.botToken, { polling: true });
    this.allowedChats = new Set(config.allowedChats);
    this.messageHandler = messageHandler;
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    const botInfo = await this.bot.getMe();
    console.log(
      `[Telegram] Bot started: ${botInfo.first_name} (@${botInfo.username})`,
    );

    this.bot.on("message", (msg) => this.handleMessage(msg));
    this.running = true;
  }

  stop(): void {
    if (!this.running) {
      return;
    }
    this.bot.stopPolling();
    this.running = false;
    console.log("[Telegram] Bot stopped");
  }

  private async handleMessage(msg: TelegramBot.Message): Promise<void> {
    const normalized = normalizeTelegramMessage(msg);

    if (normalized.isGroup) {
      console.log(
        `[Telegram] Rejected group message from chat ${normalized.chatId}`,
      );
      return;
    }

    if (!isChatAllowed(normalized.chatId, Array.from(this.allowedChats))) {
      console.log(
        `[Telegram] Rejected unauthorized message from chat ${normalized.chatId}`,
      );
      return;
    }

    if (!normalized.content.trim()) {
      return;
    }

    await this.sendTyping(normalized.chatId);

    try {
      const history: Message[] = [];
      history.push({ role: "user", content: normalized.content });

      const response = await this.messageHandler(normalized.sessionId, history);

      await this.sendMessage(normalized.chatId, response);
    } catch (err) {
      console.error(`[Telegram] Error processing message:`, err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      await this.sendMessage(normalized.chatId, `Error: ${errorMessage}`);
    }
  }

  private async sendTyping(chatId: number): Promise<void> {
    try {
      await this.bot.sendChatAction(chatId, "typing");
    } catch (err) {
      console.error(`[Telegram] Failed to send typing action:`, err);
    }
  }

  private async sendMessage(chatId: number, text: string): Promise<void> {
    const maxLength = 4096;
    const chunks: string[] = [];

    for (let i = 0; i < text.length; i += maxLength) {
      chunks.push(text.slice(i, i + maxLength));
    }

    for (const chunk of chunks) {
      try {
        await this.bot.sendMessage(chatId, chunk);
      } catch (err) {
        console.error(`[Telegram] Failed to send message:`, err);
      }
    }
  }
}
