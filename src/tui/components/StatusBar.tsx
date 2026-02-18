import React from "react";
import { Box, Text } from "ink";
import { colors } from "../../theme.js";

interface StatusBarProps {
  connected: boolean;
  model: string;
}

export function StatusBar({ connected, model }: StatusBarProps) {
  return (
    <Box paddingX={1}>
      <Text color={connected ? colors.green : colors.red}>
        {connected ? "\u25cf" : "\u25cb"}
      </Text>
      <Text color={colors.comment}> </Text>
      <Text color={connected ? colors.fg : colors.comment}>
        {connected ? "Connected" : "Disconnected"}
      </Text>
      <Text color={colors.comment}> {"\u00b7"} </Text>
      <Text bold color={colors.purple}>
        Felix
      </Text>
      <Box flexGrow={1} />
      <Text color={colors.comment}>{model}</Text>
    </Box>
  );
}
