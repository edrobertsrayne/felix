import React from "react";
import { Box, Text } from "ink";
import { colors } from "../../theme.js";

export function WelcomeScreen() {
  return (
    <Box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      flexGrow={1}
    >
      <Text bold color={colors.purple}>
        {"\u25c6"} Felix
      </Text>
      <Text color={colors.comment}>Your AI assistant</Text>
      <Box marginTop={1} flexDirection="column" alignItems="center">
        <Text color={colors.comment}>
          Type a message to start {"\u00b7"} /clear to reset
        </Text>
      </Box>
    </Box>
  );
}
