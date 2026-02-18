import React, { useState } from "react";
import { Box, Text } from "ink";
import { TextInput } from "@inkjs/ui";
import { colors } from "../../theme.js";

interface InputAreaProps {
  onSubmit: (value: string) => void;
}

export function InputArea({ onSubmit }: InputAreaProps) {
  const [inputKey, setInputKey] = useState(0);

  const handleSubmit = (value: string) => {
    onSubmit(value);
    setInputKey((k) => k + 1);
  };

  return (
    <Box paddingX={1}>
      <Text bold color={colors.blue}>
        {"\u276f"}{" "}
      </Text>
      <TextInput key={inputKey} onSubmit={handleSubmit} placeholder="" />
    </Box>
  );
}
