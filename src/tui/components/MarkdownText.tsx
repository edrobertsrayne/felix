import React from "react";
import { Box, Text } from "ink";
import { Lexer, type Token, type Tokens } from "marked";
import { colors } from "../../theme.js";

interface MarkdownTextProps {
  content: string;
}

function renderInlineTokens(tokens: Token[]): React.ReactNode[] {
  return tokens.map((token, i) => {
    switch (token.type) {
      case "strong":
        return (
          <Text key={i} bold>
            {renderInlineTokens((token as Tokens.Strong).tokens)}
          </Text>
        );
      case "em":
        return (
          <Text key={i} italic>
            {renderInlineTokens((token as Tokens.Em).tokens)}
          </Text>
        );
      case "codespan":
        return (
          <Text key={i} color={colors.orange}>
            {"`"}
            {(token as Tokens.Codespan).text}
            {"`"}
          </Text>
        );
      case "link":
        return (
          <Text key={i} color={colors.cyan}>
            {(token as Tokens.Link).text}
          </Text>
        );
      case "text": {
        const t = token as Tokens.Text;
        if (t.tokens) {
          return (
            <Text key={i}>{renderInlineTokens(t.tokens)}</Text>
          );
        }
        return <Text key={i}>{t.text}</Text>;
      }
      case "escape":
        return <Text key={i}>{(token as Tokens.Escape).text}</Text>;
      default:
        if ("text" in token) {
          return <Text key={i}>{(token as { text: string }).text}</Text>;
        }
        return null;
    }
  });
}

function renderToken(token: Token, index: number): React.ReactNode {
  switch (token.type) {
    case "paragraph":
      return (
        <Box key={index} marginBottom={1}>
          <Text color={colors.fg}>
            {renderInlineTokens((token as Tokens.Paragraph).tokens)}
          </Text>
        </Box>
      );

    case "heading": {
      const h = token as Tokens.Heading;
      return (
        <Box key={index} marginBottom={1}>
          <Text bold color={colors.blue}>
            {"#".repeat(h.depth)} {renderInlineTokens(h.tokens)}
          </Text>
        </Box>
      );
    }

    case "code": {
      const c = token as Tokens.Code;
      return (
        <Box
          key={index}
          flexDirection="column"
          marginBottom={1}
          paddingX={1}
        >
          <Text color={colors.comment}>
            {"```"}
            {c.lang || ""}
          </Text>
          <Text color={colors.cyan}>{c.text}</Text>
          <Text color={colors.comment}>{"```"}</Text>
        </Box>
      );
    }

    case "blockquote": {
      const bq = token as Tokens.Blockquote;
      return (
        <Box key={index} marginBottom={1} paddingLeft={1}>
          <Text color={colors.comment}>{"\u2502"} </Text>
          <Box flexDirection="column">
            <Text dimColor>
              {bq.tokens.map((t, j) => renderToken(t, j))}
            </Text>
          </Box>
        </Box>
      );
    }

    case "list": {
      const list = token as Tokens.List;
      return (
        <Box key={index} flexDirection="column" marginBottom={1}>
          {list.items.map((item, j) => {
            const bullet = list.ordered ? `${j + 1}.` : "\u2022";
            return (
              <Box key={j} paddingLeft={1}>
                <Text color={colors.blue}>{bullet} </Text>
                <Text color={colors.fg}>
                  {item.tokens
                    ? renderInlineTokens(item.tokens)
                    : item.text}
                </Text>
              </Box>
            );
          })}
        </Box>
      );
    }

    case "hr":
      return (
        <Box key={index} marginBottom={1}>
          <Text color={colors.comment}>{"─".repeat(40)}</Text>
        </Box>
      );

    case "space":
      return null;

    default:
      if ("text" in token) {
        return (
          <Box key={index} marginBottom={1}>
            <Text color={colors.fg}>
              {(token as { text: string }).text}
            </Text>
          </Box>
        );
      }
      return null;
  }
}

export function MarkdownText({ content }: MarkdownTextProps) {
  const tokens = new Lexer().lex(content);
  return (
    <Box flexDirection="column">
      {tokens.map((token, i) => renderToken(token, i))}
    </Box>
  );
}
