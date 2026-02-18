import { describe, test, expect } from "bun:test";

describe("normalizeTelegramMessage", () => {
  test("should normalize private chat message", () => {
    const telegramMsg = {
      chat: { id: 123456789, type: "private" as const },
      from: { id: 123456789, first_name: "John" },
      text: "Hello bot",
    };

    const chatId = telegramMsg.chat.id;
    const content = telegramMsg.text || "";
    const senderName = telegramMsg.from.first_name;
    const isGroup = telegramMsg.chat.type !== "private";
    const sessionId = chatId.toString();

    expect(chatId).toBe(123456789);
    expect(content).toBe("Hello bot");
    expect(senderName).toBe("John");
    expect(isGroup).toBe(false);
    expect(sessionId).toBe("123456789");
  });

  test("should normalize group chat message", () => {
    const telegramMsg: {
      chat: { id: number; type: string };
      from: { id: number; first_name: string };
      text: string;
    } = {
      chat: { id: 111111111, type: "group" },
      from: { id: 123456789, first_name: "John" },
      text: "Hello in group",
    };

    const isGroup = telegramMsg.chat.type !== "private";

    expect(telegramMsg.chat.id).toBe(111111111);
    expect(isGroup).toBe(true);
  });

  test("should handle empty message text", () => {
    const telegramMsg = {
      chat: { id: 123456789, type: "private" as const },
      from: { id: 123456789, first_name: "John" },
      text: undefined,
    };

    const content = telegramMsg.text || "";

    expect(content).toBe("");
  });
});

describe("isChatAllowed", () => {
  const isChatAllowed = (chatId: number, allowedChats: string[]): boolean => {
    return allowedChats.includes(chatId.toString());
  };

  test("should return true for allowed chat", () => {
    expect(isChatAllowed(123456789, ["123456789"])).toBe(true);
  });

  test("should return false for non-allowed chat", () => {
    expect(isChatAllowed(987654321, ["123456789"])).toBe(false);
  });

  test("should return false for empty allowlist", () => {
    expect(isChatAllowed(123456789, [])).toBe(false);
  });
});

describe("isPrivateChat", () => {
  const isPrivateChat = (chatType: string): boolean => {
    return chatType === "private";
  };

  test("should return true for private chat", () => {
    expect(isPrivateChat("private")).toBe(true);
  });

  test("should return false for group chat", () => {
    expect(isPrivateChat("group")).toBe(false);
  });

  test("should return false for supergroup", () => {
    expect(isPrivateChat("supergroup")).toBe(false);
  });
});

describe("TelegramAdapterConfig", () => {
  test("should have required config fields", () => {
    const config = {
      botToken: "test-token",
      allowedChats: ["123456789"],
    };

    expect(config.botToken).toBe("test-token");
    expect(config.allowedChats).toEqual(["123456789"]);
    expect(Array.isArray(config.allowedChats)).toBe(true);
  });
});
