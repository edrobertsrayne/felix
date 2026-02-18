import React from "react";
import { render, Box, Text } from "ink";
import { ThemeProvider } from "@inkjs/ui";
import { felixTheme, colors } from "./theme.js";
import { StatusBar } from "./tui/components/StatusBar.js";
import { ChatView } from "./tui/components/ChatView.js";
import { InputArea } from "./tui/components/InputArea.js";
import { useWebSocket } from "./tui/hooks/useWebSocket.js";

interface TUIConfig {
  gatewayUrl: string;
  model?: string;
}

function Separator() {
  return (
    <Box paddingX={1}>
      <Text color={colors.comment}>{"─".repeat(60)}</Text>
    </Box>
  );
}

interface AppProps {
  gatewayUrl: string;
  model: string;
}

function App({ gatewayUrl, model }: AppProps) {
  const { messages, connected, isThinking, streamingContent, sendMessage, clearSession } =
    useWebSocket({ gatewayUrl });

  const termHeight = process.stdout.rows ?? 24;
  // Reserve lines: StatusBar(1) + separator(1) + separator(1) + input(1) + footer(1) = 5
  const chatHeight = termHeight - 5;

  const handleSubmit = (value: string) => {
    const content = value.trim();
    if (!content) return;

    if (content === "/clear") {
      clearSession();
      return;
    }

    sendMessage(content);
  };

  return (
    <ThemeProvider theme={felixTheme}>
      <Box flexDirection="column" height={termHeight}>
        <StatusBar connected={connected} model={model} />
        <Separator />
        <ChatView
          messages={messages}
          isThinking={isThinking}
          streamingContent={streamingContent}
          height={chatHeight}
        />
        <Separator />
        <InputArea onSubmit={handleSubmit} />
        <Box paddingX={1}>
          <Text color={colors.comment}>
            Ctrl+C quit {"\u00b7"} /clear reset
          </Text>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export function startTUI(config: TUIConfig): void {
  render(<App gatewayUrl={config.gatewayUrl} model={config.model ?? "openrouter/auto"} />);
}
