import React from "react";
import { Box, Text } from "ink";
import { colors, roleConfig } from "../../theme.js";
import { MarkdownText } from "./MarkdownText.js";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const config = roleConfig[message.role];
  const ts = formatTimestamp(message.timestamp);

  return (
    <Box flexDirection="column" marginBottom={1} paddingX={1}>
      <Box>
        <Text color={config.color}>
          {config.prefix}{" "}
        </Text>
        <Text bold color={config.color}>
          {config.label}
        </Text>
        <Box flexGrow={1} />
        <Text color={colors.comment}>{ts}</Text>
      </Box>
      <Box paddingLeft={2}>
        {message.role === "assistant" ? (
          <MarkdownText content={message.content} />
        ) : (
          <Text color={colors.fg}>{message.content}</Text>
        )}
      </Box>
    </Box>
  );
}
