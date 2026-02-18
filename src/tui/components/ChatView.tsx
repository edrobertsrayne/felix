import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { MessageBubble, type ChatMessage } from "./MessageBubble.js";
import { ThinkingIndicator } from "./ThinkingIndicator.js";
import { WelcomeScreen } from "./WelcomeScreen.js";
import { MarkdownText } from "./MarkdownText.js";
import { roleConfig } from "../../theme.js";

interface ChatViewProps {
  messages: ChatMessage[];
  isThinking: boolean;
  streamingContent: string;
  height: number;
}

function StreamingMessage({ content }: { content: string }) {
  const config = roleConfig.assistant;
  return (
    <Box flexDirection="column" marginBottom={1} paddingX={1}>
      <Box>
        <Text color={config.color}>{config.prefix} </Text>
        <Text bold color={config.color}>
          {config.label}
        </Text>
      </Box>
      <Box paddingLeft={2}>
        <MarkdownText content={content} />
      </Box>
    </Box>
  );
}

export function ChatView({
  messages,
  isThinking,
  streamingContent,
  height,
}: ChatViewProps) {
  const [scrollOffset, setScrollOffset] = useState(0);

  // Auto-scroll when new messages arrive or streaming updates
  useEffect(() => {
    setScrollOffset(0);
  }, [messages.length, streamingContent]);

  if (messages.length === 0 && !isThinking && !streamingContent) {
    return (
      <Box flexGrow={1} overflow="hidden" height={height}>
        <WelcomeScreen />
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      overflow="hidden"
      height={height}
    >
      <Box flexDirection="column" marginTop={-scrollOffset}>
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
        {streamingContent && <StreamingMessage content={streamingContent} />}
        {isThinking && <ThinkingIndicator />}
      </Box>
    </Box>
  );
}
