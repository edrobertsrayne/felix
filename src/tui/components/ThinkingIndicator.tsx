import React from "react";
import { Box } from "ink";
import { Spinner } from "@inkjs/ui";

export function ThinkingIndicator() {
  return (
    <Box paddingLeft={2} marginBottom={1}>
      <Spinner label="Thinking..." />
    </Box>
  );
}
